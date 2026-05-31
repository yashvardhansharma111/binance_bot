import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Commission from '@/lib/models/Commission';
import DepositCommission from '@/lib/models/DepositCommission';
import SubscriptionCommission from '@/lib/models/SubscriptionCommission';

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

  // Subscription commissions where this user is the referrer
  const subComms = await SubscriptionCommission.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  // Merge and tag commissions for the UI (display list is capped)
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
    ...subComms.map(c => ({
      _id:       c._id,
      type:      'subscription',
      amount:    c.referrerAmount,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 40);

  // Total earned is the true all-time sum across every commission type — computed
  // from the DB (not the capped display list above, which would under-count).
  const sumField = async (Model) => {
    const [agg] = await Model.aggregate([
      { $match: { referrerId: user._id } },
      { $group: { _id: null, total: { $sum: '$referrerAmount' } } },
    ]);
    return agg?.total || 0;
  };
  const [tradeTotal, depositTotal, subTotal] = await Promise.all([
    sumField(Commission), sumField(DepositCommission), sumField(SubscriptionCommission),
  ]);
  const totalEarned = parseFloat((tradeTotal + depositTotal + subTotal).toFixed(2));

  return NextResponse.json({
    referralCode: user.referralCode,
    fundBalance:  user.fundBalance,
    referrals,
    commissions,
    totalEarned,
  });
}
