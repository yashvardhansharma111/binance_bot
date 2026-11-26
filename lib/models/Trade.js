import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true },
  total: { type: Number },
  profit: { type: Number, default: 0 },
  stopLoss: { type: Number },
  takeProfit: { type: Number },
  // Best price since entry for the trailing stop: highest for spot/long, lowest for a futures short.
  trailingHighPrice: { type: Number, default: null },
  trailHoldLoggedAt: { type: Date, default: null },   // throttles the repeating "trail hit but holding" log
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  orderId: { type: String },
  source: { type: String, enum: ['bot', 'manual'], default: 'bot' },

  // Futures — absent/'spot' on every spot trade, so existing data is unchanged.
  market:           { type: String, enum: ['spot', 'futures'], default: 'spot' },
  demo:             { type: Boolean, default: false },  // virtual trade — never counted in real P&L / commission / admin stats
  positionSide:     { type: String, enum: ['LONG', 'SHORT', null], default: null },
  leverage:         { type: Number, default: null },
  margin:           { type: Number, default: null },   // USDT isolated margin committed
  liquidationPrice: { type: Number, default: null },
  protectionIds:    { stopLossId: String, takeProfitId: String }, // exchange algo order ids
  reason: { type: String },
  closedAt: { type: Date },
}, { timestamps: true });

TradeSchema.index({ userId: 1, status: 1 });
TradeSchema.index({ userId: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, symbol: 1, status: 1 });
TradeSchema.index({ userId: 1, demo: 1, status: 1 });

export default mongoose.models.Trade || mongoose.model('Trade', TradeSchema);
