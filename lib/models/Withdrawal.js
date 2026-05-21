import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:        { type: Number, required: true },
  walletAddress: { type: String, required: true },
  currency:      { type: String, required: true },
  network:       { type: String, default: '' },
  source:        { type: String, default: 'fund', enum: ['fund', 'asset'] }, // which balance was debited
  status:        { type: String, default: 'pending',
                   enum: ['pending', 'approved', 'rejected', 'paid'] },
  txHash:        { type: String, default: '' },
  adminNote:     { type: String, default: '' },
  processedAt:   { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.Withdrawal || mongoose.model('Withdrawal', WithdrawalSchema);
