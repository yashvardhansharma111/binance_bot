import mongoose from 'mongoose';

const BotLogSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:   { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
  message: { type: String, required: true },
  data:    { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

// Auto-expire logs after 7 days
BotLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.models.BotLog || mongoose.model('BotLog', BotLogSchema);
