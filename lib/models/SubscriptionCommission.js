import mongoose from 'mongoose';

const SubscriptionCommissionSchema = new mongoose.Schema({
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // buyer
  referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  level:          { type: Number, default: 1 },  // 1=direct referrer, 2=L2, 3=L3
  planAmount:     { type: Number, required: true },   // USD plan price the % is based on
  referrerRate:   { type: Number, default: 0 },       // % of plan credited to this referrer
  referrerAmount: { type: Number, default: 0 },       // amount credited to referrer's assetBalance
}, { timestamps: true });

// Idempotent per subscription+level — safe to replay webhooks
SubscriptionCommissionSchema.index({ subscriptionId: 1, level: 1 }, { unique: true });
SubscriptionCommissionSchema.index({ referrerId: 1, createdAt: -1 });

export default mongoose.models.SubscriptionCommission || mongoose.model('SubscriptionCommission', SubscriptionCommissionSchema);
