import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:        { type: Number, required: true },
  walletAddress: { type: String, required: true },
  currency:      { type: String, required: true },   // USDT, BTC, ETH …
  network:       { type: String, default: '' },       // TRC20, ERC20, …
  status:        { type: String, default: 'pending',
                   enum: ['pending', 'approved', 'rejected', 'paid'] },
  txHash:        { type: String, default: '' },       // filled by admin on payment
  adminNote:     { type: String, default: '' },
  processedAt:   { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.Withdrawal || mongoose.model('Withdrawal', WithdrawalSchema);
