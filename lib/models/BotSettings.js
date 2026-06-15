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
  trailingStopPercent: { type: Number, default: 0 }, // 0 = disabled; >0 = callback % (replaces fixed SL)
  symbolConfigs: [{
    symbol:              { type: String, required: true },
    tradeUSDT:           { type: Number, default: null },
    stopLossPercent:     { type: Number, default: null },
    takeProfitPercent:   { type: Number, default: null },
    trailingStopPercent: { type: Number, default: null },
  }],
  useGroqFilter:    { type: Boolean, default: true },
  aggressiveMode:   { type: Boolean, default: false },
  lastTradeAt:      { type: Date, default: null },
  lastTickAt:       { type: Date, default: null },      // updated every cron tick — proves process is alive
  dailyTradeCount:  { type: Number, default: 0 },
  dailyTradeDate:   { type: String, default: null },    // YYYY-MM-DD
}, { timestamps: true });

export default mongoose.models.BotSettings || mongoose.model('BotSettings', BotSettingsSchema);
