import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/lib/models/User';
import WalletAccount from '@/lib/models/WalletAccount';
import WalletTransaction from '@/lib/models/WalletTransaction';
import { getAdmin } from '@/lib/adminBots';
import { getVirtualAccount } from '@/bot/services/demo';

const MAX_PER_TX = 1_000_000;

/** GET ?userId= → wallet balance + last 50 ledger entries for one user. */
export async function GET(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = new URL(req.url).searchParams.get('userId');
  if (!mongoose.isValidObjectId(userId)) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const acct = await getVirtualAccount(userId, 'wallet');
  const tx = await WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  return NextResponse.json({
    usdt: acct.usdt, totalCredited: acct.totalCredited || 0, totalDebited: acct.totalDebited || 0, transactions: tx,
  });
}

/**
 * POST { userId, amount, note } — amount > 0 credits, amount < 0 debits.
 * A debit can only take free USDT (not margin locked in open positions).
 */
export async function POST(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, amount, note = '' } = await req.json().catch(() => ({}));
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!mongoose.isValidObjectId(userId)) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (!Number.isFinite(amt) || amt === 0 || Math.abs(amt) > MAX_PER_TX)
    return NextResponse.json({ error: `Amount must be non-zero and at most ${MAX_PER_TX.toLocaleString()} USDT` }, { status: 400 });

  const user = await User.findById(userId).select('email');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  await getVirtualAccount(userId, 'wallet');

  const inc = amt > 0 ? { usdt: amt, totalCredited: amt } : { usdt: amt, totalDebited: -amt };
  const acct = await WalletAccount.findOneAndUpdate(
    { userId, ...(amt < 0 ? { usdt: { $gte: -amt } } : {}) },
    { $inc: inc },
    { new: true },
  );
  if (!acct) {
    const cur = await WalletAccount.findOne({ userId }).lean();
    return NextResponse.json({ error: `Cannot debit ${-amt} — free wallet balance is only ${cur?.usdt?.toFixed(2) ?? 0} USDT` }, { status: 400 });
  }

  await WalletTransaction.create({
    userId, amount: amt, balanceAfter: acct.usdt, note: String(note).slice(0, 200),
    adminId: admin._id, adminEmail: admin.email,
  });
  console.log(`[Admin] ${admin.email} ${amt > 0 ? 'credited' : 'debited'} ${Math.abs(amt)} USDT wallet for ${user.email} → ${acct.usdt}`);
  return NextResponse.json({ usdt: acct.usdt, totalCredited: acct.totalCredited, totalDebited: acct.totalDebited });
}
