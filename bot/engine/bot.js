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

  try {
    // 0. Subscription check
    if (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) <= new Date()) {
      return await log(userId, 'warn', 'No active subscription — bot paused. Subscribe at /dashboard/subscribe');
    }

    // 1. API keys
    const keyDoc = await ApiKey.findOne({ userId, isActive: true });
    if (!keyDoc) return await log(userId, 'warn', 'No active API key — skipped');

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

    const { symbol, timeframe } = settings;

    // 3. Current price + open position check
    const currentPrice = await getCurrentPrice(symbol);
    const openTrade = await Trade.findOne({ userId, status: 'open', side: 'BUY' });

    if (openTrade) {
      // Repair missing SL/TP on old trades (schema was missing those fields)
      if (!openTrade.stopLoss || !openTrade.takeProfit) {
        const { stopLossPercent = 2, takeProfitPercent = 4 } = settings;
        const sl = parseFloat((openTrade.price * (1 - stopLossPercent / 100)).toFixed(6));
        const tp = parseFloat((openTrade.price * (1 + takeProfitPercent / 100)).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, { stopLoss: sl, takeProfit: tp });
        openTrade.stopLoss   = sl;
        openTrade.takeProfit = tp;
      }

      const exitReason = checkExitConditions(openTrade, currentPrice);
      if (exitReason) {
        await closePosition(userId, apiKey, apiSecret, openTrade, exitReason);
        return;
      }

      // Also exit on SELL signal (RSI overbought / bearish MACD cross)
      const candles    = await getCandles(symbol, timeframe, 100);
      const indicators = calculateIndicators(candles);
      const signal     = detectSignal(indicators);

      const holdMins = ((Date.now() - new Date(openTrade.createdAt).getTime()) / 60000).toFixed(0);
      await log(userId, 'info',
        `Holding ${symbol} @ $${openTrade.price} for ${holdMins}m | Now: $${currentPrice} | SL:$${openTrade.stopLoss} TP:$${openTrade.takeProfit} | Signal:${signal}`
      );

      if (signal === 'SELL') {
        await closePosition(userId, apiKey, apiSecret, openTrade, `SELL signal — RSI:${indicators.rsi}`);
      }

      return;
    }

    // 4. Fetch candles + indicators
    const candles    = await getCandles(symbol, timeframe, 100);
    const indicators = calculateIndicators(candles);

    await log(userId, 'info',
      `${symbol} RSI:${indicators.rsi} | Trend:${indicators.uptrend ? '↑' : '↓'} | MACD:${indicators.bullishCrossover ? '↑cross' : indicators.bearishCrossover ? '↓cross' : 'flat'} | Vol:${indicators.volumeIncreasing ? '↑' : '→'} | $${currentPrice}`
    );

    // 5. Signal
    const signal = detectSignal(indicators);
    await log(userId, 'info', `Signal: ${signal}`);

    if (signal === 'HOLD') return;

    if (signal === 'SELL') {
      await log(userId, 'info', 'SELL signal but no open position — nothing to close');
      return;
    }

    // 6. Risk checks
    const usdtBalance = await getUSDTBalance(apiKey, apiSecret);
    const risk = await canTrade(userId, settings, usdtBalance);
    if (!risk.allowed) {
      await log(userId, 'info', `Skipped: ${risk.reason}`);
      return;
    }

    // 7. Groq sentiment filter (BUY only)
    let sentiment = { sentiment: 'neutral', confidence: 50, reason: 'Filter off' };
    if (settings.useGroqFilter) {
      sentiment = await getSentiment(symbol, indicators);
      await log(userId, 'info', `Sentiment: ${sentiment.sentiment} (${sentiment.confidence}%) — ${sentiment.reason}`);
      if (shouldBlock(signal, sentiment)) {
        await log(userId, 'warn', `Trade BLOCKED — bearish sentiment (${sentiment.confidence}%)`);
        return;
      }
    }

    // 8. Execute BUY
    const amount = calcTradeAmount(usdtBalance, settings.tradePercent);
    await openPosition(userId, apiKey, apiSecret, settings, amount, indicators, sentiment);

  } catch (err) {
    await log(userId, 'error', `Bot error: ${err.message}`);
  }
}
