import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nowpaymentsId:   { type: String, required: true, unique: true },
  orderId:         { type: String, required: true, unique: true },
  priceAmount:     { type: Number, required: true },
  priceCurrency:   { type: String, required: true, default: 'usd' },
  payCurrency:     { type: String, required: true },
  payAddress:      { type: String },
  payAmount:       { type: Number },
  actuallyPaid:    { type: Number, default: 0 },
  status:          { type: String, default: 'waiting',
                     enum: ['waiting','confirming','confirmed','sending','partially_paid','finished','failed','expired','refunded'] },
  completedAt:     { type: Date },
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
