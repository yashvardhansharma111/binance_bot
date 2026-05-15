import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nowpaymentsId: { type: String, required: true, unique: true },
  orderId:       { type: String, required: true, unique: true },
  plan:          { type: String, default: '6months' },
  amount:        { type: Number, default: 399 },
  payCurrency:   { type: String },
  payAddress:    { type: String },
  payAmount:     { type: Number },
  status:        { type: String, default: 'waiting',
                   enum: ['waiting','confirming','confirmed','sending','partially_paid','finished','failed','expired','refunded'] },
  activatedAt:   { type: Date },
  expiresAt:     { type: Date },
}, { timestamps: true });

export default mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
