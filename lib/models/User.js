import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  fundBalance: { type: Number, default: 0 },
  assetBalance: { type: Number, default: 0 },
  minAssetRequired: { type: Number, default: 100 },
  botActive: { type: Boolean, default: false },
  subscriptionExpiry: { type: Date, default: null },
  status: { type: String, enum: ['active', 'blocked', 'pending'], default: 'active' },
  canViewOverview: { type: Boolean, default: false },
  sessionToken: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
