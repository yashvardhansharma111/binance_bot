import mongoose from 'mongoose';

const BotSettingsSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  symbol:           { type: String, default: 'BTCUSDT' },
  timeframe:        { type: String, default: '5m' },
  tradePercent:     { type: Number, default: 5 },       // % of fund balance per trade
  stopLossPercent:  { type: Number, default: 2 },       // 2% below entry
  takeProfitPercent:{ type: Number, default: 4 },       // 4% above entry
  cooldownMinutes:  { type: Number, default: 15 },
  maxDailyTrades:   { type: Number, default: 10 },
  useGroqFilter:    { type: Boolean, default: true },
  aggressiveMode:   { type: Boolean, default: false },
  lastTradeAt:      { type: Date, default: null },
  lastTickAt:       { type: Date, default: null },      // updated every cron tick — proves process is alive
  dailyTradeCount:  { type: Number, default: 0 },
  dailyTradeDate:   { type: String, default: null },    // YYYY-MM-DD
}, { timestamps: true });

export default mongoose.models.BotSettings || mongoose.model('BotSettings', BotSettingsSchema);
