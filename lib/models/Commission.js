import mongoose from 'mongoose';

const CommissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade' },
  amount: { type: Number, required: true },
  percentage: { type: Number },
  type: { type: String, enum: ['referral', 'trading'], default: 'referral' },
}, { timestamps: true });

export default mongoose.models.Commission || mongoose.model('Commission', CommissionSchema);
