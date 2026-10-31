import mongoose from 'mongoose';

export const PAPER_START_USDT = 10000;

/**
 * Virtual balances for the swap playground. Kept entirely separate from the
 * live Trade collection so simulated fills can never contaminate real PnL,
 * which the dashboard computes from Trade.
 */
const PaperAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // symbol -> amount, e.g. { USDT: 9500, WETH: 0.21 }
  balances: { type: Map, of: Number, default: () => ({ USDT: PAPER_START_USDT }) },

  startingValue: { type: Number, default: PAPER_START_USDT },
  tradeCount:    { type: Number, default: 0 },
  resetAt:       { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.PaperAccount || mongoose.model('PaperAccount', PaperAccountSchema);
