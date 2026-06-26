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
import { getExchange } from '../services/exchange.js';
import { get24hChange } from '../services/binance.js';
import { checkMacroTrend } from '../services/indicators.js';
import { calculateIndicators, detectSignal } from '../services/indicators.js';
import { getSentiment, shouldBlock, shouldSellOnSentiment } from '../services/sentiment.js';
import { canTrade, calcTradeAmount, checkExitConditions } from './risk.js';
import { openPosition, closePosition } from './executor.js';
import { decrypt } from '../../lib/encryption.js';
import ApiKey from '../../lib/models/ApiKey.js';
import BotSettings from '../../lib/models/BotSettings.js';
import Trade from '../../lib/models/Trade.js';
import BotLog from '../../lib/models/BotLog.js';

function symCfg(settings, sym) {
  const over = settings.symbolConfigs?.find(c => c.symbol === sym);
  return {
    tradeUSDT:           over?.tradeUSDT           ?? settings.tradeUSDT           ?? 50,
    stopLossPercent:     over?.stopLossPercent     ?? settings.stopLossPercent     ?? 2,
    takeProfitPercent:   over?.takeProfitPercent   ?? settings.takeProfitPercent   ?? 4,
    trailingStopPercent: over?.trailingStopPercent ?? settings.trailingStopPercent ?? 0,
  };
}

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

    // Exchange service — Binance or BingX based on saved key
    const exchangeName = keyDoc.exchange || 'binance';
    const svc = getExchange(exchangeName);
    const { getCandles, getCurrentPrice, getUSDTBalance } = svc;

    // 2. Settings (auto-create defaults)
    let settings = await BotSettings.findOne({ userId });
    if (!settings) settings = await BotSettings.create({ userId });

    const { timeframe, aggressiveMode } = settings;
    // Resolve which symbols to trade — multi-symbol list takes priority over legacy single field
    const tradingSymbols = settings.symbols?.length ? settings.symbols : [settings.symbol || 'BTCUSDT'];

    // 3. Check bot-opened trades only — manual trades are managed by the user,
    //    never auto-closed by the bot. SL/TP/force-exit runs unconditionally
    //    regardless of subscription or balance status.
    const openTrades = await Trade.find({ userId, status: 'open', side: 'BUY', source: 'bot' });

    for (const openTrade of openTrades) {
      // Repair missing SL/TP on old trades
      if (!openTrade.stopLoss || !openTrade.takeProfit) {
        const { stopLossPercent, takeProfitPercent } = symCfg(settings, openTrade.symbol);
        const sl = parseFloat((openTrade.price * (1 - stopLossPercent / 100)).toFixed(6));
        const tp = parseFloat((openTrade.price * (1 + takeProfitPercent / 100)).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, { stopLoss: sl, takeProfit: tp });
        openTrade.stopLoss   = sl;
        openTrade.takeProfit = tp;
      }

      const tradePrice = await getCurrentPrice(openTrade.symbol);

      // Trailing stop takes priority over fixed SL when enabled
      const trailPct = symCfg(settings, openTrade.symbol).trailingStopPercent;
      if (trailPct > 0) {
        const prevHigh    = openTrade.trailingHighPrice || openTrade.price;
        const newHigh     = Math.max(prevHigh, tradePrice);
        const trailPrice  = parseFloat((newHigh * (1 - trailPct / 100)).toFixed(6));

        if (newHigh !== prevHigh) {
          await Trade.findByIdAndUpdate(openTrade._id, { trailingHighPrice: newHigh });
          openTrade.trailingHighPrice = newHigh;
        }

        await log(userId, 'info',
          `[Trailing] ${openTrade.symbol} | High: $${newHigh} | Stop: $${trailPrice} | Now: $${tradePrice}`
        );

        if (tradePrice <= trailPrice) {
          await closePosition(userId, apiKey, apiSecret, openTrade,
            `Trailing stop hit — peak $${newHigh} → dropped ${trailPct}% → stop $${trailPrice}`, isTestnet, exchangeName);
          continue;
        }

        // Still check TP even in trailing mode
        if (openTrade.takeProfit && tradePrice >= openTrade.takeProfit) {
          await closePosition(userId, apiKey, apiSecret, openTrade,
            `Take-profit hit @ $${tradePrice}`, isTestnet, exchangeName);
          continue;
        }
      } else {
        const exitReason = checkExitConditions(openTrade, tradePrice);
        if (exitReason) {
          await closePosition(userId, apiKey, apiSecret, openTrade, exitReason, isTestnet, exchangeName);
          continue;
        }
      }

      const holdMins = (Date.now() - new Date(openTrade.createdAt).getTime()) / 60000;

      // Sentiment-driven exit: if Groq says strongly bearish on an open position, close it
      if (settings.useGroqFilter && holdMins >= 15) {
        try {
          const sCan  = await getCandles(openTrade.symbol, timeframe, 120);
          const sInd  = calculateIndicators(sCan);
          const sSent = await getSentiment(openTrade.symbol, sInd);
          await log(userId, 'info',
            `[${openTrade.symbol}] Exit-sentiment: ${sSent.sentiment} (${sSent.confidence}%) — ${sSent.reason}`
          );
          if (shouldSellOnSentiment(sSent)) {
            await closePosition(userId, apiKey, apiSecret, openTrade,
              `Bearish sentiment: ${sSent.reason} (${sSent.confidence}%)`, isTestnet, exchangeName);
            continue;
          }
        } catch { /* sentiment failure is non-fatal */ }
      }

      if (holdMins >= 240) {
        const pnl = ((tradePrice - openTrade.price) / openTrade.price * 100).toFixed(2);
        await closePosition(
          userId, apiKey, apiSecret, openTrade,
          `Force exit after ${Math.floor(holdMins)}m | P&L: ${pnl}%`,
          isTestnet, exchangeName
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
    const usdtBalance = await getUSDTBalance(apiKey, apiSecret, isTestnet, exchangeName);

    // 6. Run new-entry logic for each configured symbol independently
    const maxConcurrent = settings.maxConcurrentTrades ?? 1;

    for (const sym of tradingSymbols) {
      const openOnSym = openTrades.filter(t => t.symbol === sym);

      // At concurrent limit for this symbol — check SELL signal to close
      if (openOnSym.length >= maxConcurrent) {
        const candles    = await getCandles(sym, timeframe, 120);
        const indicators = calculateIndicators(candles);
        const signal     = detectSignal(indicators);
        if (signal === 'SELL') {
          for (const t of openOnSym) {
            const heldMins = (Date.now() - new Date(t.createdAt).getTime()) / 60000;
            if (heldMins < 15) {
              await log(userId, 'info', `[${sym}] SELL signal ignored — held only ${heldMins.toFixed(0)}m (min 15m required)`);
              continue;
            }
            await closePosition(userId, apiKey, apiSecret, t, `SELL signal — RSI:${indicators.rsi}`, isTestnet, exchangeName);
          }
        }
        continue;
      }

      // ── Guard 1: 24h market change ────────────────────────────────────────
      // Block new entries if the coin dropped more than 2% in the last 24h
      const change24h = await get24hChange(sym);
      if (change24h < -2) {
        await log(userId, 'warn', `[${sym}] BLOCKED — down ${change24h.toFixed(2)}% in 24h (threshold: -2%)`);
        continue;
      }

      // ── Guard 2: 1h macro trend ───────────────────────────────────────────
      // Only enter if the hourly chart is in an uptrend (EMA20 > EMA50 on 1h)
      const h1candles = await getCandles(sym, '1h', 60);
      const h1uptrend = checkMacroTrend(h1candles);
      if (!h1uptrend) {
        await log(userId, 'warn', `[${sym}] BLOCKED — 1h trend bearish (EMA20 < EMA50 on 1h)`);
        continue;
      }

      // ── Guard 3: Consecutive loss circuit breaker ─────────────────────────
      // After 2 consecutive losses on same symbol, cool down for 6 hours
      const lastSells = await Trade.find({ userId, symbol: sym, status: 'closed', side: 'SELL' })
        .sort({ createdAt: -1 }).limit(2);
      if (lastSells.length >= 2 && lastSells.every(t => (t.profit || 0) < 0)) {
        const lastLossAt     = new Date(lastSells[0].closedAt || lastSells[0].createdAt);
        const hoursSinceLoss = (Date.now() - lastLossAt.getTime()) / 3_600_000;
        if (hoursSinceLoss < 6) {
          await log(userId, 'warn',
            `[${sym}] BLOCKED — 2 consecutive losses, cooling down for ${(6 - hoursSinceLoss).toFixed(1)}h more`);
          continue;
        }
      }

      // Fetch candles + indicators for this symbol
      const currentPrice = await getCurrentPrice(sym);
      const candles      = await getCandles(sym, timeframe, 120);
      const indicators   = calculateIndicators(candles);

      await log(userId, 'info',
        `[${sym}] 24h:${change24h.toFixed(2)}% | RSI:${indicators.rsi} | Macro:${indicators.macroUptrend ? '🟢Bull' : '🔴Bear'} | 1h:${h1uptrend ? '↑' : '↓'} | Trend:${indicators.uptrend ? '↑' : '↓'} | Vol:${indicators.volumeIncreasing ? '↑' : '→'} | $${currentPrice}`
      );

      const signal = detectSignal(indicators, aggressiveMode);
      await log(userId, 'info', `[${sym}] Signal: ${signal}${aggressiveMode ? ' [AGGRESSIVE]' : ''}`);

      if (signal === 'HOLD') continue;
      if (signal === 'SELL') {
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
      if (settings.useGroqFilter && !aggressiveMode) {
        sentiment = await getSentiment(sym, indicators);
        await log(userId, 'info', `[${sym}] Sentiment: ${sentiment.sentiment} (${sentiment.confidence}%) — ${sentiment.reason}`);
        if (shouldBlock(signal, sentiment)) {
          await log(userId, 'warn', `[${sym}] Trade BLOCKED — bearish sentiment (${sentiment.confidence}%)`);
          continue;
        }
      }

      // Execute BUY — merge per-symbol overrides on top of global settings
      const sc = symCfg(settings, sym);
      const tradeSettings = { ...settings.toObject(), symbol: sym, ...sc };
      const amount = Math.min(sc.tradeUSDT, usdtBalance * 0.99);
      await openPosition(userId, apiKey, apiSecret, tradeSettings, amount, indicators, sentiment, isTestnet, exchangeName);
    }

  } catch (err) {
    await log(userId, 'error', `Bot error: ${err.message}`);
  }
}
