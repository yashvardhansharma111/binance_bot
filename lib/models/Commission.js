import mongoose from 'mongoose';

const CommissionSchema = new mongoose.Schema({
  tradeId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  level:          { type: Number, default: 1 },  // 1=direct referrer, 2=L2, 3=L3
  profit:         { type: Number, required: true },
  platformRate:   { type: Number },
  referrerRate:   { type: Number, default: 0 },
  platformAmount: { type: Number, required: true },
  referrerAmount: { type: Number, default: 0 },
  totalAmount:    { type: Number, required: true },
}, { timestamps: true });

CommissionSchema.index({ userId: 1, createdAt: -1 });
CommissionSchema.index({ referrerId: 1, createdAt: -1 });
CommissionSchema.index({ referrerId: 1, level: 1, createdAt: -1 });

export default mongoose.models.Commission || mongoose.model('Commission', CommissionSchema);
