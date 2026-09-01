import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Commission from '@/lib/models/Commission';
import SubscriptionCommission from '@/lib/models/SubscriptionCommission';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();

  const user = await User.findOne({ email: session.user.email }).select(
    'referralCode assetBalance'
  );

  // L1 referrals (direct)
  const l1Referrals = await User.find({ referredBy: user.referralCode })
    .select('name email createdAt botActive status subscriptionExpiry referralCode');

  // L2 referrals (referred by any L1)
  const l1Codes = l1Referrals.map(u => u.referralCode).filter(Boolean);
  const l2Referrals = l1Codes.length
    ? await User.find({ referredBy: { $in: l1Codes } })
        .select('name email createdAt botActive status subscriptionExpiry referralCode')
    : [];

  // L3 referrals (referred by any L2)
  const l2Codes = l2Referrals.map(u => u.referralCode).filter(Boolean);
  const l3Referrals = l2Codes.length
    ? await User.find({ referredBy: { $in: l2Codes } })
        .select('name email createdAt botActive status subscriptionExpiry')
    : [];

  const tradeComms = await Commission.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(40);

  const subComms = await SubscriptionCommission.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  const commissions = [
    ...tradeComms.map(c => ({
      _id:       c._id,
      type:      'trade',
      level:     c.level ?? 1,
      amount:    c.referrerAmount,
      createdAt: c.createdAt,
    })),
    ...subComms.map(c => ({
      _id:       c._id,
      type:      'subscription',
      level:     c.level ?? 1,
      amount:    c.referrerAmount,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 60);

  const sumField = async (Model) => {
    const [agg] = await Model.aggregate([
      { $match: { referrerId: user._id } },
      { $group: { _id: null, total: { $sum: '$referrerAmount' } } },
    ]);
    return agg?.total || 0;
  };
  const [tradeTotal, subTotal] = await Promise.all([
    sumField(Commission), sumField(SubscriptionCommission),
  ]);
  const totalEarned = parseFloat((tradeTotal + subTotal).toFixed(2));

  return NextResponse.json({
    referralCode: user.referralCode,
    referrals: {
      l1: l1Referrals,
      l2: l2Referrals,
      l3: l3Referrals,
    },
    commissions,
    totalEarned,
  });
}
