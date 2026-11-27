import mongoose from 'mongoose';

/** A user's price alert. Checked every minute by the bot process (bot/scheduler/alertsCron.js). */
const PriceAlertSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:         { type: String, required: true },
  market:         { type: String, enum: ['spot', 'futures'], default: 'spot' },
  condition:      { type: String, enum: ['above', 'below'], required: true }, // trigger when price crosses above / below
  price:          { type: Number, required: true },
  note:           { type: String, default: '' },
  status:         { type: String, enum: ['active', 'triggered', 'cancelled'], default: 'active' },
  triggeredAt:    { type: Date, default: null },
  triggeredPrice: { type: Number, default: null },
}, { timestamps: true });

PriceAlertSchema.index({ status: 1 });
PriceAlertSchema.index({ userId: 1, status: 1, createdAt: -1 });

export default mongoose.models.PriceAlert || mongoose.model('PriceAlert', PriceAlertSchema);
