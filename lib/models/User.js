import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },

  // Email/password are required only for classic signups. Wallet-only accounts
  // authenticate by signature, so they legitimately have neither.
  // `sparse` lets many docs omit the field while keeping uniqueness for those that have it.
  email: {
    type: String,
    lowercase: true,
    unique: true,
    sparse: true,
    required: function () { return !this.walletAddress; },
  },
  password: {
    type: String,
    required: function () { return !this.walletAddress; },
  },

  // Lowercased EVM checksum-insensitive address. Set only for wallet users.
  walletAddress: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true,
    default: undefined,
  },
  // Nonce the user must sign for the next SIWE login. Rotated on every attempt
  // so a captured signature cannot be replayed.
  walletNonce: { type: String, default: null },
  walletNonceAt: { type: Date, default: null },

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
  overviewPermissions: { type: [String], default: [] },
  phone: { type: String, default: null },
  sessionToken: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
