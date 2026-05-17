import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Commission from '@/lib/models/Commission';
import DepositCommission from '@/lib/models/DepositCommission';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();

  const user = await User.findOne({ email: session.user.email }).select(
    'referralCode fundBalance'
  );

  const referrals = await User.find({ referredBy: user.referralCode })
    .select('name email createdAt botActive status subscriptionExpiry');

  // Trade commissions where this user is the referrer
  const tradeComms = await Commission.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(30);

  // Deposit commissions where this user is the referrer
  const depositComms = await DepositCommission.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  // Merge and tag commissions for the UI
  const commissions = [
    ...tradeComms.map(c => ({
      _id:       c._id,
      type:      'trade',
      amount:    c.referrerAmount,
      createdAt: c.createdAt,
    })),
    ...depositComms.map(c => ({
      _id:       c._id,
      type:      'deposit',
      amount:    c.referrerAmount,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 40);

  const totalEarned = commissions.reduce((s, c) => s + (c.amount || 0), 0);

  return NextResponse.json({
    referralCode: user.referralCode,
    fundBalance:  user.fundBalance,
    referrals,
    commissions,
    totalEarned,
  });
}
