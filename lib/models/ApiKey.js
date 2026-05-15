import mongoose from 'mongoose';

const ApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  encryptedKey: { type: String, required: true },
  encryptedSecret: { type: String, required: true },
  exchange: { type: String, default: 'binance' },
  isActive: { type: Boolean, default: true },
  label: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
