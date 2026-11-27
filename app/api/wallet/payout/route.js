import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import WalletAccount from '@/lib/models/WalletAccount';
import WalletPayout from '@/lib/models/WalletPayout';
import { getVirtualAccount } from '@/bot/services/demo';
import { getPayoutConfig, payoutableProfit } from '@/lib/walletPayout';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  return User.findOne({ email: session.user.email }).select('_id email');
}

/** GET — profit available to pay out, the rules, and the user's payout requests. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [acct, cfg, requests] = await Promise.all([
    getVirtualAccount(user._id, 'wallet'),
    getPayoutConfig(),
    WalletPayout.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return NextResponse.json({
    profitAvailable: payoutableProfit(acct),
    enabled: cfg.enabled, payoutPercent: cfg.percent, minPayout: cfg.min,
    hasPending: requests.some(r => r.status === 'pending'),
    requests,
  });
}

/** POST { amount } — request a payout of wallet profit to Asset Balance (held until an admin decides). */
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { amount } = await req.json().catch(() => ({}));
  const amt = Math.floor(Number(amount) * 100) / 100;

  const cfg = await getPayoutConfig();
  if (cfg.percent <= 0) return NextResponse.json({ error: 'Wallet payouts are currently disabled' }, { status: 400 });
  if (!Number.isFinite(amt) || amt < cfg.min)
    return NextResponse.json({ error: `Minimum payout is $${cfg.min}` }, { status: 400 });
  if (await WalletPayout.exists({ userId: user._id, status: 'pending' }))
    return NextResponse.json({ error: 'You already have a payout request waiting for approval' }, { status: 409 });

  const acct = await getVirtualAccount(user._id, 'wallet');
  const available = payoutableProfit(acct);
  if (amt > available)
    return NextResponse.json({ error: `Only $${available.toFixed(2)} of profit is available (free wallet USDT above your credits)` }, { status: 400 });

  // Hold the amount: take it out of the wallet only if the profit is still there (atomic).
  const principal = (acct.totalCredited || 0) - (acct.totalDebited || 0);
  const held = await WalletAccount.findOneAndUpdate(
    { userId: user._id, usdt: { $gte: principal + amt } },
    { $inc: { usdt: -amt } },
    { new: true },
  );
  if (!held) return NextResponse.json({ error: 'Wallet balance changed — please try again' }, { status: 409 });

  const payout = await WalletPayout.create({
    userId: user._id, amount: amt, payoutPercent: cfg.percent,
    creditAmount: Math.floor(amt * cfg.percent) / 100,
  });
  console.log(`[wallet-payout] ${user.email} requested ${amt} (→ $${payout.creditAmount} at ${cfg.percent}%)`);
  return NextResponse.json({ payout, walletUsdt: held.usdt });
}
