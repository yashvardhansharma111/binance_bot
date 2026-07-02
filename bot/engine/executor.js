import { getExchange } from '../services/exchange.js';
import { calcRiskLevels, recordTrade } from './risk.js';
import Trade from '../../lib/models/Trade.js';
import User from '../../lib/models/User.js';
import Commission from '../../lib/models/Commission.js';
import BotLog from '../../lib/models/BotLog.js';
import { sendTradeEmail } from '../../lib/mail.js';

const TOTAL_COMMISSION_RATE = 15;  // 15% of profit
const REFERRER_RATE         = 10;  // referrer gets 10%
const PLATFORM_RATE_WITH    = 5;   // platform gets 5% when referrer exists
const PLATFORM_RATE_WITHOUT = 15;  // platform gets 15% when no referrer

async function log(userId, level, message, data = null) {
  console.log(`[Bot:${String(userId).slice(-4)}] [${level.toUpperCase()}] ${message}`);
  await BotLog.create({ userId, level, message, data }).catch(() => {});
}

async function applyCommission(userId, tradeId, profit) {
  if (profit <= 0) return; // only on profitable trades

  const user = await User.findById(userId);
  if (!user) return;

  const totalCut = parseFloat((profit * TOTAL_COMMISSION_RATE / 100).toFixed(8));

  let referrerId     = null;
  let referrerAmount = 0;
  let platformAmount = totalCut;
  let platformRate   = PLATFORM_RATE_WITHOUT;
  let referrerRate   = 0;

  if (user.referredBy) {
    const referrer = await User.findOne({ referralCode: user.referredBy });
    if (referrer) {
      referrerId     = referrer._id;
      referrerAmount = parseFloat((profit * REFERRER_RATE / 100).toFixed(8));
      platformAmount = parseFloat((profit * PLATFORM_RATE_WITH / 100).toFixed(8));
      platformRate   = PLATFORM_RATE_WITH;
      referrerRate   = REFERRER_RATE;

      // Credit referrer's asset balance
      await User.findByIdAndUpdate(referrer._id, {
        $inc: { assetBalance: referrerAmount },
      });
    }
  }

  // Deduct total commission from user's asset balance
  await User.findByIdAndUpdate(userId, {
    $inc: { assetBalance: -totalCut },
  });

  await Commission.create({
    tradeId,
    userId,
    referrerId,
    profit,
    platformRate,
    referrerRate,
    platformAmount,
    referrerAmount,
    totalAmount: totalCut,
  });

  console.log(`[Commission] ${TOTAL_COMMISSION_RATE}% of $${profit.toFixed(4)} = $${totalCut.toFixed(4)} | platform:$${platformAmount.toFixed(4)} referrer:$${referrerAmount.toFixed(4)}`);
}

export async function openPosition(userId, apiKey, apiSecret, settings, usdtAmount, indicators, sentiment, isTestnet = false, exchange = 'binance') {
  const { symbol, stopLossPercent, takeProfitPercent, useStopLoss } = settings;
  const svc = getExchange(exchange);

  await log(userId, 'info', `BUY $${usdtAmount.toFixed(2)} of ${symbol} | RSI:${indicators.rsi} | sentiment:${sentiment?.sentiment} | exchange:${exchange}`);

  const order = await svc.placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount, isTestnet);
  const { stopLoss: sl, takeProfit } = calcRiskLevels(order.price, stopLossPercent, takeProfitPercent);
  // Respect useStopLoss setting — null means bot will only exit on TP or signal
  const stopLoss = useStopLoss === false ? null : sl;

  await Trade.create({
    userId, symbol, side: 'BUY',
    price: order.price, qty: order.qty, total: order.total,
    stopLoss, takeProfit, orderId: order.orderId,
    status: 'open', source: 'bot',
    reason: `RSI:${indicators.rsi} sentiment:${sentiment?.sentiment}`,
  });

  await recordTrade(userId);
  await log(userId, 'info', `✅ BUY @ $${order.price} | SL:${stopLoss ? '$' + stopLoss : 'OFF'} TP:$${takeProfit}`);

  const user = await User.findById(userId);
  sendTradeEmail(user.email, user.name, 'BUY', {
    symbol, price: order.price, qty: order.qty, total: order.total,
    stopLoss, takeProfit,
    reason: `RSI:${indicators.rsi} sentiment:${sentiment?.sentiment}`,
  }).catch(() => {});
}

export async function closePosition(userId, apiKey, apiSecret, openTrade, reason, isTestnet = false, exchange = 'binance') {
  const { symbol, qty, price: entry } = openTrade;
  const svc = getExchange(exchange);

  await log(userId, 'info', `SELL ${symbol} qty:${qty} | Reason: ${reason}`);

  let order;
  try {
    order = await svc.placeMarketSell(apiKey, apiSecret, symbol, qty, isTestnet);
  } catch (e) {
    const isPhantom  = e.message.includes('-2010') || e.message.includes('insufficient balance') || e.message.includes('balance not enough');
    const isTooSmall = e.message.includes('-1013') || e.message.includes('notional too small');

    // -2010 "insufficient balance" is ambiguous: it may mean the position was already
    // closed on exchange, OR that Binance deducted trading fees from the purchased coins
    // so actual balance < stored qty. Try once more with qty trimmed by 0.2% before
    // giving up and treating as phantom.
    if (isPhantom) {
      // Check actual coin balance on exchange — if > 0 coins are still there (fee deduction issue),
      // sell the real balance. If 0, the position was already closed by SL/TP on exchange.
      const actualBalance = await svc.getAssetBalance(apiKey, apiSecret, symbol, isTestnet).catch(() => 0);
      await log(userId, 'warn',
        `[${symbol}] Sell qty=${qty} got insufficient balance. Actual exchange balance: ${actualBalance}`);

      if (actualBalance > 0) {
        // Coins still on exchange — sell the real amount
        try {
          order = await svc.placeMarketSell(apiKey, apiSecret, symbol, actualBalance, isTestnet);
          // fall through to normal settlement below
        } catch (e2) {
          await log(userId, 'error',
            `[${symbol}] Sell failed even with actual balance ${actualBalance}: ${e2.message} — manual intervention required`);
          await Trade.findByIdAndUpdate(openTrade._id, {
            status: 'closed', closedAt: new Date(),
            profit: 0,
            reason: `${openTrade.reason || ''} | EXIT:${reason} (sell failed — coins may remain on exchange, sell manually)`,
          });
          return;
        }
      } else {
        // Balance = 0 — position was genuinely already closed on exchange (SL/TP hit)
        const exitPrice     = await svc.getCurrentPrice(symbol).catch(() => entry);
        const phantomProfit = parseFloat(((exitPrice - entry) * qty).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, {
          status: 'closed', closedAt: new Date(), profit: phantomProfit,
          reason: `${openTrade.reason || ''} | EXIT:${reason} (SL/TP closed on exchange)`,
        });
        await log(userId, 'warn',
          `Position ${symbol} confirmed closed on exchange (balance=0) — estimated P&L: $${phantomProfit}`);
        return;
      }
    } else if (isTooSmall) {
      const { getCurrentPrice } = svc;
      const exitPrice     = await getCurrentPrice(symbol).catch(() => entry);
      const phantomProfit = parseFloat(((exitPrice - entry) * qty).toFixed(6));
      await Trade.findByIdAndUpdate(openTrade._id, {
        status: 'closed', closedAt: new Date(), profit: phantomProfit,
        reason: `${openTrade.reason || ''} | EXIT:${reason} (notional too small to sell — position written off)`,
      });
      await log(userId, 'warn',
        `Position ${symbol} written off — notional too small to sell — estimated P&L: $${phantomProfit}`);
      return;
    } else {
      throw e;
    }
  }

  const profit = parseFloat(((order.price - entry) * order.qty).toFixed(6));

  const closedTrade = await Trade.findByIdAndUpdate(openTrade._id, {
    status: 'closed', closedAt: new Date(), profit,
    reason: `${openTrade.reason || ''} | EXIT:${reason}`,
  }, { new: true });

  await Trade.create({
    userId, symbol, side: 'SELL',
    price: order.price, qty: order.qty, total: order.total,
    profit, orderId: order.orderId,
    status: 'closed', source: 'bot', closedAt: new Date(), reason,
  });

  await recordTrade(userId);

  // Apply 15% commission on profit
  if (profit > 0) {
    await applyCommission(userId, closedTrade._id, profit);
  }

  const commissionNote = profit > 0
    ? ` | Commission: ${TOTAL_COMMISSION_RATE}% = $${(profit * TOTAL_COMMISSION_RATE / 100).toFixed(4)}`
    : '';

  await log(userId, profit >= 0 ? 'info' : 'warn',
    `${profit >= 0 ? '✅' : '❌'} SELL @ $${order.price} | P&L: ${profit >= 0 ? '+' : ''}$${profit}${commissionNote}`
  );

  const sellUser = await User.findById(userId);
  sendTradeEmail(sellUser.email, sellUser.name, 'SELL', {
    symbol, price: order.price, qty: order.qty,
    profit, reason,
  }).catch(() => {});
}
