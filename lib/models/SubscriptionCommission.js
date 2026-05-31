import mongoose from 'mongoose';

const SubscriptionCommissionSchema = new mongoose.Schema({
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, unique: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // buyer
  referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  planAmount:     { type: Number, required: true },   // USD plan price the % is based on
  referrerRate:   { type: Number, default: 0.20 },    // 20% of subscription price
  referrerAmount: { type: Number, default: 0 },       // amount credited to referrer's assetBalance
}, { timestamps: true });

SubscriptionCommissionSchema.index({ referrerId: 1, createdAt: -1 });

export default mongoose.models.SubscriptionCommission || mongoose.model('SubscriptionCommission', SubscriptionCommissionSchema);
