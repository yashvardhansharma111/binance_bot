import mongoose from 'mongoose';

/**
 * Short-lived SIWE nonces, kept out of the User collection so that merely
 * requesting a nonce cannot create account rows.
 * Mongo's TTL monitor drops each document 10 minutes after creation.
 */
const WalletNonceSchema = new mongoose.Schema({
  address: { type: String, required: true, lowercase: true, index: true },
  nonce:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export default mongoose.models.WalletNonce || mongoose.model('WalletNonce', WalletNonceSchema);
