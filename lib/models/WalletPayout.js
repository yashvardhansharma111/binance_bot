import mongoose from 'mongoose';

/**
 * A request to turn wallet-credit PROFIT into real Asset Balance.
 * The amount is held (taken out of the wallet) when requested; an admin either
 * approves it (Asset Balance += creditAmount) or rejects it (amount refunded).
 */
const WalletPayoutSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:        { type: Number, required: true },   // virtual USDT taken from the wallet
  payoutPercent: { type: Number, required: true },   // share of `amount` paid out, set by admin config
  creditAmount:  { type: Number, required: true },   // real USD credited to Asset Balance on approval
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminEmail:    { type: String, default: null },
  note:          { type: String, default: '' },
  decidedAt:     { type: Date, default: null },
}, { timestamps: true });

WalletPayoutSchema.index({ userId: 1, createdAt: -1 });
WalletPayoutSchema.index({ status: 1, createdAt: 1 });

export default mongoose.models.WalletPayout || mongoose.model('WalletPayout', WalletPayoutSchema);
