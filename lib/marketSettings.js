/**
 * Spot and Futures each have their own bot configuration.
 *
 *   Spot    → the original top-level BotSettings fields (unchanged for every
 *             existing user) + `spotEnabled`.
 *   Futures → the `futures` sub-document.
 *
 * Both can run at the same time. Documents written before this split (which
 * only had `tradingMode` / `futuresLeverage` / `futuresAllowShort`) are read
 * through the same helpers, so nobody has to be migrated by hand.
 *
 * No `@/` imports — the bot process uses this file too.
 */

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

export const FUTURES_DEFAULTS = Object.freeze({
  enabled: false,
  symbols: [],
  timeframe: '5m',
  tradeUSDT: 50,          // margin per trade
  leverage: 3,
  allowShort: true,
  stopLossPercent: 2,
  takeProfitPercent: 4,
  trailingStopPercent: 0,
  maxLossPercent: 0,
  aggressiveMode: false,
  useGroqFilter: true,
  entryChecklist: false,
  checklistMinPass: 10,
});

/**
 * Risk rules every config must meet (spot, futures and per-symbol overrides).
 * Live data showed the losses came from wide stops with small targets
 * (e.g. SL 10% / TP 4%) and from 5 same-direction futures opened at once.
 */
export const MAX_STOP_LOSS_PERCENT = 5;
export const MAX_SAME_DIRECTION_FUTURES = 2;

/** Error text when a stop-loss / take-profit pair is unsafe, else null. */
export function riskRewardError(stopLossPercent, takeProfitPercent, label = 'Stop loss') {
  const sl = Number(stopLossPercent), tp = Number(takeProfitPercent);
  if (!(sl > 0) || !(tp > 0)) return null;
  if (sl > MAX_STOP_LOSS_PERCENT)
    return `${label} ${sl}% is too wide — use ${MAX_STOP_LOSS_PERCENT}% or less`;
  if (tp < sl)
    return `${label} ${sl}% is bigger than take profit ${tp}% — one loss would wipe out more than one win. Set take profit at least equal to stop loss.`;
  return null;
}

const plain = (s) => (s && typeof s.toObject === 'function' ? s.toObject() : (s || {}));

/** Has this user ever saved the new split config? */
const hasSplit = (s) => s.futures && typeof s.futures.enabled === 'boolean';

/** Is spot trading on? Legacy docs: on unless the old mode was 'futures'. */
export function spotEnabled(settings) {
  const s = plain(settings);
  if (typeof s.spotEnabled === 'boolean') return s.spotEnabled;
  return s.tradingMode !== 'futures';
}

/** The futures config, with defaults filled in (and derived from legacy fields when needed). */
export function futuresConfig(settings) {
  const s = plain(settings);
  if (hasSplit(s)) {
    const f = { ...FUTURES_DEFAULTS, ...Object.fromEntries(Object.entries(s.futures).filter(([, v]) => v !== undefined && v !== null)) };
    f.symbols = Array.isArray(f.symbols) ? f.symbols : [];
    return f;
  }
  // Legacy: futures was a mode of the single config — carry those values over.
  const legacyOn = s.tradingMode === 'futures';
  return {
    ...FUTURES_DEFAULTS,
    enabled: legacyOn,
    symbols: legacyOn ? (s.symbols?.length ? [...s.symbols] : [s.symbol || 'BTCUSDT']) : [],
    timeframe: legacyOn ? s.timeframe || '5m' : '5m',
    tradeUSDT: legacyOn ? s.tradeUSDT ?? 50 : 50,
    leverage: s.futuresLeverage ?? 3,
    allowShort: s.futuresAllowShort !== false,
    stopLossPercent: legacyOn ? s.stopLossPercent ?? 2 : 2,
    takeProfitPercent: legacyOn ? s.takeProfitPercent ?? 4 : 4,
    trailingStopPercent: legacyOn ? s.trailingStopPercent ?? 0 : 0,
    maxLossPercent: legacyOn ? s.maxLossPercent ?? 0 : 0,
    aggressiveMode: legacyOn ? !!s.aggressiveMode : false,
    useGroqFilter: legacyOn ? s.useGroqFilter !== false : true,
    entryChecklist: legacyOn ? s.entryChecklist === true : false,
    checklistMinPass: s.checklistMinPass ?? 10,
  };
}

/**
 * A settings-shaped object for the futures engine (bot/engine/futures.js reads
 * the same field names as spot). Shared counters — cooldown, daily limit,
 * lastTradeAt — stay account-wide.
 */
export function futuresView(settings) {
  const s = plain(settings);
  const f = futuresConfig(s);
  return {
    ...s,
    symbols: f.symbols,
    symbol: f.symbols[0] || 'BTCUSDT',
    timeframe: f.timeframe,
    tradeUSDT: f.tradeUSDT,
    stopLossPercent: f.stopLossPercent,
    takeProfitPercent: f.takeProfitPercent,
    trailingStopPercent: f.trailingStopPercent,
    maxLossPercent: f.maxLossPercent,
    symbolConfigs: [],                 // per-symbol overrides are a spot feature
    futuresLeverage: f.leverage,
    futuresAllowShort: f.allowShort,
    aggressiveMode: f.aggressiveMode,
    useGroqFilter: f.useGroqFilter,
    entryChecklist: f.entryChecklist,
    checklistMinPass: f.checklistMinPass,
  };
}
