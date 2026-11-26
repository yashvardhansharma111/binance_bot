import mongoose from 'mongoose';

/** Ledger of admin credits/debits to a user's virtual trading wallet. */
const WalletTransactionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:       { type: Number, required: true },          // + credit, − debit (USDT)
  balanceAfter: { type: Number, required: true },
  note:         { type: String, default: '' },
  adminId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminEmail:   { type: String },
}, { timestamps: true });

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', WalletTransactionSchema);
