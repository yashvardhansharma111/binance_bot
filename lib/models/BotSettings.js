import mongoose from 'mongoose';

const BotSettingsSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  symbol:           { type: String, default: 'BTCUSDT' },      // legacy primary symbol
  symbols:          { type: [String], default: [] },           // multi-symbol list; overrides symbol when non-empty
  timeframe:        { type: String, default: '5m' },
  tradeUSDT:        { type: Number, default: 50 },      // fixed USDT amount per trade
  tradePercent:     { type: Number, default: 5 },       // legacy — kept for migration
  stopLossPercent:  { type: Number, default: 2 },       // 2% below entry
  takeProfitPercent:{ type: Number, default: 4 },       // 4% above entry
  cooldownMinutes:  { type: Number, default: 15 },
  maxDailyTrades:      { type: Number, default: 10 },
  maxConcurrentTrades: { type: Number, default: 3 },
  minEntryGapPct:      { type: Number, default: 1.5 }, // min % drop from lowest open entry before adding another position
  trailingStopPercent: { type: Number, default: 0 }, // 0 = disabled; >0 = callback % (replaces fixed SL)
  symbolConfigs: [{
    symbol:              { type: String, required: true },
    tradeUSDT:           { type: Number, default: null },
    stopLossPercent:     { type: Number, default: null },
    takeProfitPercent:   { type: Number, default: null },
    trailingStopPercent: { type: Number, default: null },
  }],
  useStopLoss:      { type: Boolean, default: true },   // false = only TP exits, no SL

  // Hard circuit breaker. Applies even when useStopLoss is false, because
  // "no stop loss" was never meant to mean "hold a -36% position forever".
  //
  // DEFAULT IS 0 (OFF) ON PURPOSE. Enabling it retroactively would liquidate
  // every position already past the threshold on the next tick — measured at
  // 136 positions / -$8.4k on the current book. Owners opt in per account.
  maxLossPercent:   { type: Number, default: 0 },

  // Cap how many open positions one symbol may accumulate via DCA.
  // Averaging down into a downtrend is what turned PENGU into 25 losing lots.
  maxPositionsPerSymbol: { type: Number, default: 5 },

  // Aggressive mode skips the trend filters, but still refusing to check
  // macro direction means buying every dip of a falling knife.
  respectMacroInAggressive: { type: Boolean, default: true },
  // LEGACY single-config fields (before Spot and Futures got separate configs).
  // Still read by lib/marketSettings.js so old documents keep working; new saves use
  // spotEnabled + futures below.
  tradingMode:       { type: String, enum: ['spot', 'futures'], default: 'spot' },
  futuresLeverage:   { type: Number, default: 3 },
  futuresAllowShort: { type: Boolean, default: true },

  // Spot uses the top-level fields above. No default: an unset value means
  // "legacy document" and lib/marketSettings.js derives it from tradingMode.
  spotEnabled:       { type: Boolean },

  // Futures has its own config (Binance USDⓈ-M, isolated, one-way). Runs alongside
  // spot when both are enabled. No defaults here — see FUTURES_DEFAULTS.
  futures: {
    enabled:             { type: Boolean },
    symbols:             { type: [String], default: undefined },
    timeframe:           { type: String },
    tradeUSDT:           { type: Number },   // margin per trade
    leverage:            { type: Number },   // 1–20, enforced in /api/settings
    allowShort:          { type: Boolean },
    stopLossPercent:     { type: Number },
    takeProfitPercent:   { type: Number },
    trailingStopPercent: { type: Number },
    maxLossPercent:      { type: Number },
    aggressiveMode:      { type: Boolean },
    useGroqFilter:       { type: Boolean },
    entryChecklist:      { type: Boolean },
    checklistMinPass:    { type: Number },
  },
  // 10-point pre-trade checklist (bot/engine/checklist.js). OFF by default so existing
  // users trade exactly as before; when on, an entry needs checklistMinPass of the 10 checks.
  entryChecklist:    { type: Boolean, default: false },
  checklistMinPass:  { type: Number, default: 10 },
  useGroqFilter:    { type: Boolean, default: true },
  aggressiveMode:   { type: Boolean, default: false },
  lastTradeAt:      { type: Date, default: null },
  lastTickAt:       { type: Date, default: null },      // updated every cron tick — proves process is alive
  dailyTradeCount:  { type: Number, default: 0 },
  dailyTradeDate:   { type: String, default: null },    // YYYY-MM-DD
}, { timestamps: true });

export default mongoose.models.BotSettings || mongoose.model('BotSettings', BotSettingsSchema);
