/**
 * Bot decision loop — runs once per user per cron tick
 *
 * 1. Load API keys
 * 2. Check open position → SL/TP exit?
 * 3. Fetch candles → calculate indicators
 * 4. Detect signal
 * 5. Risk checks
 * 6. Groq sentiment filter (BUY only)
 * 7. Execute
 */
import { getCandles, getCurrentPrice, getUSDTBalance } from '../services/binance.js';
import { calculateIndicators, detectSignal } from '../services/indicators.js';
import { getSentiment, shouldBlock } from '../services/sentiment.js';
import { canTrade, calcTradeAmount, checkExitConditions } from './risk.js';
import { openPosition, closePosition } from './executor.js';
import { decrypt } from '../../lib/encryption.js';
import ApiKey from '../../lib/models/ApiKey.js';
import BotSettings from '../../lib/models/BotSettings.js';
import Trade from '../../lib/models/Trade.js';
import BotLog from '../../lib/models/BotLog.js';

async function log(userId, level, message, data = null) {
  console.log(`[Bot:${String(userId).slice(-4)}] [${level.toUpperCase()}] ${message}`);
  await BotLog.create({ userId, level, message, data }).catch(() => {});
}

export async function runBotForUser(user) {
  const userId = user._id;

  // Stamp heartbeat first so bot monitor knows the process is alive
  // regardless of subscription status or early exits below
  await BotSettings.findOneAndUpdate(
    { userId },
    { lastTickAt: new Date() },
    { upsert: true }
  ).catch(() => {});

  try {
    // 1. API keys — needed for both exit management and new entries
    const keyDoc = await ApiKey.findOne({ userId, isActive: true });
    if (!keyDoc) return await log(userId, 'warn', 'No active API key — skipped');

    const isTestnet = keyDoc.accountType === 'testnet';

    let apiKey, apiSecret;
    try {
      apiKey    = decrypt(keyDoc.encryptedKey);
      apiSecret = decrypt(keyDoc.encryptedSecret);
    } catch {
      return await log(userId, 'error', 'Failed to decrypt API keys');
    }

    // 2. Settings (auto-create defaults)
    let settings = await BotSettings.findOne({ userId });
    if (!settings) settings = await BotSettings.create({ userId });

    const { timeframe, aggressiveMode } = settings;
    // Resolve which symbols to trade — multi-symbol list takes priority over legacy single field
    const tradingSymbols = settings.symbols?.length ? settings.symbols : [settings.symbol || 'BTCUSDT'];

    // 3. Check ALL open trades — SL/TP/force-exit runs unconditionally,
    //    regardless of subscription or balance status, so positions are
    //    always honoured even after subscription expires.
    const openTrades = await Trade.find({ userId, status: 'open', side: 'BUY' });

    for (const openTrade of openTrades) {
      // Repair missing SL/TP on old trades
      if (!openTrade.stopLoss || !openTrade.takeProfit) {
        const { stopLossPercent = 2, takeProfitPercent = 4 } = settings;
        const sl = parseFloat((openTrade.price * (1 - stopLossPercent / 100)).toFixed(6));
        const tp = parseFloat((openTrade.price * (1 + takeProfitPercent / 100)).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, { stopLoss: sl, takeProfit: tp });
        openTrade.stopLoss   = sl;
        openTrade.takeProfit = tp;
      }

      const tradePrice = await getCurrentPrice(openTrade.symbol);
      const exitReason = checkExitConditions(openTrade, tradePrice);
      if (exitReason) {
        await closePosition(userId, apiKey, apiSecret, openTrade, exitReason, isTestnet);
        continue;
      }

      const holdMins = (Date.now() - new Date(openTrade.createdAt).getTime()) / 60000;
      if (holdMins >= 60) {
        const pnl = ((tradePrice - openTrade.price) / openTrade.price * 100).toFixed(2);
        await closePosition(
          userId, apiKey, apiSecret, openTrade,
          `Force exit after ${Math.floor(holdMins)}m | P&L: ${pnl}%`,
          isTestnet
        );
        continue;
      }

      await log(userId, 'info',
        `Holding ${openTrade.symbol} @ $${openTrade.price} for ${holdMins.toFixed(0)}m | Now: $${tradePrice} | SL:$${openTrade.stopLoss} TP:$${openTrade.takeProfit}`
      );
    }

    // 4. Gate new entries — subscription and balance checks only block opening new trades,
    //    never the exit loop above.
    const subActive = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date();
    if (!subActive) {
      await log(userId, 'warn', 'No active subscription — skipping new entries');
      return;
    }
    if ((user.assetBalance ?? 0) < 10) {
      await log(userId, 'warn', `Low asset balance $${(user.assetBalance ?? 0).toFixed(2)} — skipping new entries`);
      return;
    }

    // 5. Fetch USDT balance once — shared across all symbol iterations
    const usdtBalance = await getUSDTBalance(apiKey, apiSecret);

    // 6. Run new-entry logic for each configured symbol independently
    const maxConcurrent = settings.maxConcurrentTrades ?? 1;

    for (const sym of tradingSymbols) {
      const openOnSym = openTrades.filter(t => t.symbol === sym);

      // At concurrent limit for this symbol — check SELL signal to close
      if (openOnSym.length >= maxConcurrent) {
        const candles    = await getCandles(sym, timeframe, 100);
        const indicators = calculateIndicators(candles);
        const signal     = detectSignal(indicators);
        if (signal === 'SELL') {
          for (const t of openOnSym) {
            await closePosition(userId, apiKey, apiSecret, t, `SELL signal — RSI:${indicators.rsi}`, isTestnet);
          }
        }
        continue;
      }

      // Fetch candles + indicators for this symbol
      const currentPrice = await getCurrentPrice(sym);
      const candles      = await getCandles(sym, timeframe, 100);
      const indicators   = calculateIndicators(candles);

      await log(userId, 'info',
        `[${sym}] RSI:${indicators.rsi} | Trend:${indicators.uptrend ? '↑' : '↓'} | MACD:${indicators.bullishCrossover ? '↑cross' : indicators.bearishCrossover ? '↓cross' : 'flat'} | Vol:${indicators.volumeIncreasing ? '↑' : '→'} | $${currentPrice}`
      );

      const signal = detectSignal(indicators, aggressiveMode);
      await log(userId, 'info', `[${sym}] Signal: ${signal}${aggressiveMode ? ' [AGGRESSIVE]' : ''}`);

      // Force-trade: if no trade on this symbol in last 1h and signal not SELL
      const lastSymTrade = await Trade.findOne({ userId, symbol: sym }).sort({ createdAt: -1 });
      const hoursSinceLast = lastSymTrade
        ? (Date.now() - new Date(lastSymTrade.createdAt).getTime()) / 3_600_000
        : Infinity;
      const forceTrade = hoursSinceLast >= 1 && signal !== 'SELL';

      if (forceTrade) {
        await log(userId, 'warn', `[${sym}] Force trade — no trade in ${Math.floor(hoursSinceLast * 60)}m | Signal was: ${signal}`);
      }

      if (!forceTrade && signal === 'HOLD') continue;
      if (!forceTrade && signal === 'SELL') {
        await log(userId, 'info', `[${sym}] SELL signal but no open position — nothing to close`);
        continue;
      }

      // Risk checks
      const risk = await canTrade(userId, settings, usdtBalance, aggressiveMode);
      if (!risk.allowed) {
        await log(userId, 'info', `[${sym}] Skipped: ${risk.reason}`);
        continue;
      }

      // Groq sentiment filter
      let sentiment = { sentiment: 'neutral', confidence: 50, reason: 'Filter off' };
      if (settings.useGroqFilter && !forceTrade && !aggressiveMode) {
        sentiment = await getSentiment(sym, indicators);
        await log(userId, 'info', `[${sym}] Sentiment: ${sentiment.sentiment} (${sentiment.confidence}%) — ${sentiment.reason}`);
        if (shouldBlock(signal, sentiment)) {
          await log(userId, 'warn', `[${sym}] Trade BLOCKED — bearish sentiment (${sentiment.confidence}%)`);
          continue;
        }
      }

      // Execute BUY
      const tradeSettings = { ...settings.toObject(), symbol: sym };
      const amount = Math.min(settings.tradeUSDT || 50, usdtBalance * 0.99);
      await openPosition(userId, apiKey, apiSecret, tradeSettings, amount, indicators, sentiment, isTestnet);
    }

  } catch (err) {
    await log(userId, 'error', `Bot error: ${err.message}`);
  }
}
