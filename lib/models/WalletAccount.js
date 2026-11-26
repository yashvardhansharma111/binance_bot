import mongoose from 'mongoose';

/**
 * Admin-funded virtual trading wallet (bonus / contest credits).
 * Same shape as DemoAccount, but starts at 0, is only topped up by an admin,
 * and the user cannot reset it. Never withdrawable — it is not real money.
 */
const WalletAccountSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  usdt:          { type: Number, default: 0 },                     // free virtual USDT
  holdings:      { type: Map, of: Number, default: () => ({}) },   // spot coins
  totalCredited: { type: Number, default: 0 },                     // sum of admin credits
  totalDebited:  { type: Number, default: 0 },                     // sum of admin debits
}, { timestamps: true });

export default mongoose.models.WalletAccount || mongoose.model('WalletAccount', WalletAccountSchema);
