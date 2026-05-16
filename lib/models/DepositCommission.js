import mongoose from 'mongoose';

const DepositCommissionSchema = new mongoose.Schema({
  paymentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  depositAmount:  { type: Number, required: true },  // original USD amount user paid
  netCredited:    { type: Number, required: true },  // 85% → user assetBalance
  referrerAmount: { type: Number, default: 0 },      // 10% → referrer fundBalance (0 if no referrer)
  platformAmount: { type: Number, required: true },  // 5% or 15% → platform
}, { timestamps: true });

export default mongoose.models.DepositCommission || mongoose.model('DepositCommission', DepositCommissionSchema);
