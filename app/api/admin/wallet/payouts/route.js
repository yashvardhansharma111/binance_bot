import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/lib/models/User';
import WalletAccount from '@/lib/models/WalletAccount';
import WalletPayout from '@/lib/models/WalletPayout';
import Trade from '@/lib/models/Trade';
import { getAdmin } from '@/lib/adminBots';

export const dynamic = 'force-dynamic';

/** GET ?status=pending|approved|rejected|all — payout requests with user emails. */
export async function GET(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const status = new URL(req.url).searchParams.get('status') || 'pending';
  const filter = status === 'all' ? {} : { status };
  const rows = await WalletPayout.find(filter).sort({ createdAt: status === 'pending' ? 1 : -1 }).limit(100)
    .populate('userId', 'name email').lean();

  // Wallet history next to each request, so the admin can judge it (e.g. bonus-only farming).
  const ids = [...new Set(rows.map(r => String(r.userId?._id)).filter(Boolean))].map(id => new mongoose.Types.ObjectId(id));
  const [accts, tradeAgg, paidAgg] = await Promise.all([
    WalletAccount.find({ userId: { $in: ids } }).lean(),
    Trade.aggregate([
      { $match: { userId: { $in: ids }, demo: true, virtualAccount: 'wallet', status: 'closed',
        $or: [{ market: { $ne: 'futures' }, side: 'BUY' }, { market: 'futures', side: 'BUY', positionSide: 'LONG' }, { market: 'futures', side: 'SELL', positionSide: 'SHORT' }] } },
      { $group: { _id: '$userId', trades: { $sum: 1 }, pnl: { $sum: '$profit' } } },
    ]),
    WalletPayout.aggregate([
      { $match: { userId: { $in: ids }, status: 'approved' } },
      { $group: { _id: '$userId', paid: { $sum: '$creditAmount' } } },
    ]),
  ]);
  const by = (arr, key = '_id') => Object.fromEntries(arr.map(x => [String(x[key]), x]));
  const A = by(accts, 'userId'), T = by(tradeAgg), PD = by(paidAgg);
  const payouts = rows.map(r => {
    const k = String(r.userId?._id);
    return { ...r, history: {
      credited: A[k]?.totalCredited || 0, debited: A[k]?.totalDebited || 0, walletUsdt: A[k]?.usdt || 0,
      trades: T[k]?.trades || 0, tradingPnl: T[k]?.pnl || 0, paidBefore: PD[k]?.paid || 0,
    } };
  });
  return NextResponse.json({ payouts });
}

/**
 * POST { payoutId, action: 'approve' | 'reject', note }
 * approve → Asset Balance += creditAmount; reject → amount goes back to the wallet.
 */
export async function POST(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { payoutId, action, note = '' } = await req.json().catch(() => ({}));
  if (!mongoose.isValidObjectId(payoutId) || !['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'payoutId and action (approve|reject) required' }, { status: 400 });

  // Claim the request atomically so it can only be decided once.
  const p = await WalletPayout.findOneAndUpdate(
    { _id: payoutId, status: 'pending' },
    { $set: { status: action === 'approve' ? 'approved' : 'rejected', adminId: admin._id, adminEmail: admin.email,
      note: String(note).slice(0, 200), decidedAt: new Date() } },
    { new: true },
  );
  if (!p) return NextResponse.json({ error: 'Request not found or already decided' }, { status: 409 });

  if (action === 'approve') {
    await User.updateOne({ _id: p.userId }, { $inc: { assetBalance: p.creditAmount } });
    await WalletAccount.updateOne({ userId: p.userId }, { $inc: { totalPaidOut: p.amount } });
  } else {
    await WalletAccount.updateOne({ userId: p.userId }, { $inc: { usdt: p.amount } });
  }
  console.log(`[Admin] ${admin.email} ${action}d wallet payout ${p._id}: ${p.amount} → $${action === 'approve' ? p.creditAmount : 0}`);
  return NextResponse.json({ payout: p });
}
