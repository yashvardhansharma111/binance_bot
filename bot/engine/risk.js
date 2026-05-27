import BotSettings from '../../lib/models/BotSettings.js';
import Trade from '../../lib/models/Trade.js';

export async function canTrade(userId, settings, usdtBalance, aggressive = false) {
  if (usdtBalance < 10)
    return { allowed: false, reason: `Low balance: $${usdtBalance.toFixed(2)}` };

  if (!aggressive && settings.lastTradeAt) {
    const elapsed = Date.now() - new Date(settings.lastTradeAt).getTime();
    const cooldown = settings.cooldownMinutes * 60_000;
    if (elapsed < cooldown)
      return { allowed: false, reason: `Cooldown: ${((cooldown - elapsed) / 60000).toFixed(1)}m left` };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (settings.dailyTradeDate === today && settings.dailyTradeCount >= settings.maxDailyTrades)
    return { allowed: false, reason: `Daily limit reached (${settings.maxDailyTrades})` };

  const open = await Trade.findOne({ userId, status: 'open', side: 'BUY', symbol: settings.symbol });
  if (open)
    return { allowed: false, reason: `Position already open on ${settings.symbol}` };

  return { allowed: true, reason: null };
}

export function calcTradeAmount(usdtBalance, tradePercent) {
  return Math.max((usdtBalance * tradePercent) / 100, 1);
}

export function calcRiskLevels(entryPrice, slPct, tpPct) {
  return {
    stopLoss:   parseFloat((entryPrice * (1 - slPct / 100)).toFixed(6)),
    takeProfit: parseFloat((entryPrice * (1 + tpPct / 100)).toFixed(6)),
  };
}

export function checkExitConditions(trade, currentPrice) {
  if (trade.stopLoss && currentPrice <= trade.stopLoss)
    return `Stop-loss hit @ $${currentPrice}`;
  if (trade.takeProfit && currentPrice >= trade.takeProfit)
    return `Take-profit hit @ $${currentPrice}`;
  return null;
}

export async function recordTrade(userId) {
  const today = new Date().toISOString().slice(0, 10);
  // Atomic: reset counter if date changed, otherwise increment
  const result = await BotSettings.findOneAndUpdate(
    { userId, dailyTradeDate: today },
    { $inc: { dailyTradeCount: 1 }, $set: { lastTradeAt: new Date() } },
    { new: true }
  );
  if (!result) {
    // Date changed or first trade — reset counter atomically
    await BotSettings.findOneAndUpdate(
      { userId },
      { $set: { dailyTradeDate: today, dailyTradeCount: 1, lastTradeAt: new Date() } },
      { upsert: true }
    );
  }
}
