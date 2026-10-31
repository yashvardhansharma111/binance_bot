import mongoose from 'mongoose';

/** One simulated swap. Priced from a real Uniswap quote, settled virtually. */
const PaperTradeSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chainId:   { type: Number, required: true },
  chain:     { type: String },
  tokenIn:   { type: String, required: true },
  tokenOut:  { type: String, required: true },
  amountIn:  { type: Number, required: true },
  amountOut: { type: Number, required: true },
  rate:      { type: Number },
  poolFee:   { type: Number },   // Uniswap tier in hundredths of a bip (500 = 0.05%)
}, { timestamps: true });

PaperTradeSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.PaperTrade || mongoose.model('PaperTrade', PaperTradeSchema);
