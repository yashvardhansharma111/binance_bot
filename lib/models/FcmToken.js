import mongoose from 'mongoose';

const FcmTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
}, { timestamps: true });

FcmTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export default mongoose.models.FcmToken || mongoose.model('FcmToken', FcmTokenSchema);
