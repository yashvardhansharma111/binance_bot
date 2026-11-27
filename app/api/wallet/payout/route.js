import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import WalletAccount from '@/lib/models/WalletAccount';
import WalletPayout from '@/lib/models/WalletPayout';
import { getVirtualAccount } from '@/bot/services/demo';
import { getPayoutConfig, withdrawableBalance } from '@/lib/walletPayout';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  return User.findOne({ email: session.user.email }).select('_id email');
}

/** GET — how much can be withdrawn, the minimum, and the user's withdrawal requests. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [acct, cfg, requests] = await Promise.all([
    getVirtualAccount(user._id, 'wallet'),
    getPayoutConfig(),
    WalletPayout.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return NextResponse.json({
    available: withdrawableBalance(acct),
    enabled: cfg.enabled, minPayout: cfg.min,
    hasPending: requests.some(r => r.status === 'pending'),
    requests,
  });
}

/**
 * POST { amount } — request a withdrawal of free wallet USDT to Asset Balance.
 * The amount leaves the wallet at once (held) and an admin approves or rejects it.
 */
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { amount } = await req.json().catch(() => ({}));
  const amt = Math.floor(Number(amount) * 100) / 100;

  const cfg = await getPayoutConfig();
  if (!cfg.enabled) return NextResponse.json({ error: 'Wallet withdrawals are currently disabled' }, { status: 400 });
  if (!Number.isFinite(amt) || amt < cfg.min)
    return NextResponse.json({ error: `Minimum withdrawal is $${cfg.min}` }, { status: 400 });
  if (await WalletPayout.exists({ userId: user._id, status: 'pending' }))
    return NextResponse.json({ error: 'You already have a withdrawal request waiting for approval' }, { status: 409 });

  const acct = await getVirtualAccount(user._id, 'wallet');
  const available = withdrawableBalance(acct);
  if (amt > available)
    return NextResponse.json({ error: `Only $${available.toFixed(2)} is free in your wallet (money in open positions can't be withdrawn)` }, { status: 400 });

  // Hold: take it out of the wallet only if it is still there (atomic — no double spend).
  const held = await WalletAccount.findOneAndUpdate(
    { userId: user._id, usdt: { $gte: amt } },
    { $inc: { usdt: -amt } },
    { new: true },
  );
  if (!held) return NextResponse.json({ error: 'Wallet balance changed — please try again' }, { status: 409 });

  const payout = await WalletPayout.create({ userId: user._id, amount: amt, payoutPercent: 100, creditAmount: amt });
  console.log(`[wallet-withdraw] ${user.email} requested $${amt} (wallet now $${held.usdt})`);
  return NextResponse.json({ payout, walletUsdt: held.usdt });
}
