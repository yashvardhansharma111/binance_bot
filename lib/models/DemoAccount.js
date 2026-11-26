import mongoose from 'mongoose';

export const DEMO_START_USDT = 10000;

/**
 * Virtual exchange account for demo trading (bot + manual, spot + futures).
 * Prices are real; orders and balances are simulated. Demo trades live in the
 * Trade collection with demo:true and are excluded from every real figure.
 */
const DemoAccountSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  usdt:            { type: Number, default: DEMO_START_USDT },     // free USDT (futures margin is taken out of this)
  holdings:        { type: Map, of: Number, default: () => ({}) }, // spot coins, e.g. { BTC: 0.01 }
  startingBalance: { type: Number, default: DEMO_START_USDT },
  resetAt:         { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.DemoAccount || mongoose.model('DemoAccount', DemoAccountSchema);
