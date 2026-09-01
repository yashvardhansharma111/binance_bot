import mongoose from 'mongoose';

const NotificationPrefsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  tradeOpen: { type: Boolean, default: true },
  tradeClose: { type: Boolean, default: true },
  signal: { type: Boolean, default: true },
  botStatus: { type: Boolean, default: true },
  announcement: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.NotificationPrefs || mongoose.model('NotificationPrefs', NotificationPrefsSchema);
