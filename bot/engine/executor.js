import { placeMarketBuy, placeMarketSell } from '../services/binance.js';
import { calcRiskLevels, recordTrade } from './risk.js';
import Trade from '../../lib/models/Trade.js';
import BotLog from '../../lib/models/BotLog.js';

async function log(userId, level, message, data = null) {
  console.log(`[Bot:${String(userId).slice(-4)}] [${level.toUpperCase()}] ${message}`);
  await BotLog.create({ userId, level, message, data }).catch(() => {});
}

export async function openPosition(userId, apiKey, apiSecret, settings, usdtAmount, indicators, sentiment) {
  const { symbol, stopLossPercent, takeProfitPercent } = settings;

  await log(userId, 'info', `BUY $${usdtAmount.toFixed(2)} of ${symbol} | RSI:${indicators.rsi} | sentiment:${sentiment?.sentiment}`);

  const order = await placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount);
  const { stopLoss, takeProfit } = calcRiskLevels(order.price, stopLossPercent, takeProfitPercent);

  await Trade.create({
    userId, symbol, side: 'BUY',
    price: order.price, qty: order.qty, total: order.total,
    stopLoss, takeProfit, orderId: order.orderId,
    status: 'open', source: 'bot',
    reason: `RSI:${indicators.rsi} MACD:crossover↑ EMA:uptrend Vol:↑ Sentiment:${sentiment?.sentiment}`,
  });

  await recordTrade(userId);
  await log(userId, 'info', `✅ BUY @ $${order.price} | SL:$${stopLoss} TP:$${takeProfit}`);
}

export async function closePosition(userId, apiKey, apiSecret, openTrade, reason) {
  const { symbol, qty, price: entry } = openTrade;

  await log(userId, 'info', `SELL ${symbol} qty:${qty} | Reason: ${reason}`);

  const order  = await placeMarketSell(apiKey, apiSecret, symbol, qty);
  const profit = parseFloat(((order.price - entry) * qty).toFixed(6));

  await Trade.findByIdAndUpdate(openTrade._id, {
    status: 'closed', closedAt: new Date(), profit,
    reason: `${openTrade.reason} | EXIT:${reason}`,
  });

  await Trade.create({
    userId, symbol, side: 'SELL',
    price: order.price, qty: order.qty, total: order.total,
    profit, orderId: order.orderId,
    status: 'closed', source: 'bot', closedAt: new Date(), reason,
  });

  await recordTrade(userId);
  await log(userId, profit >= 0 ? 'info' : 'warn',
    `${profit >= 0 ? '✅' : '❌'} SELL @ $${order.price} | P&L: ${profit >= 0 ? '+' : ''}$${profit}`
  );
}
