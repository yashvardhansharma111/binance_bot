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
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  orderId: { type: String },
  source: { type: String, enum: ['bot', 'manual'], default: 'bot' },
  reason: { type: String },
  closedAt: { type: Date },
}, { timestamps: true });

TradeSchema.index({ userId: 1, status: 1 });
TradeSchema.index({ userId: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, symbol: 1, status: 1 });

export default mongoose.models.Trade || mongoose.model('Trade', TradeSchema);
