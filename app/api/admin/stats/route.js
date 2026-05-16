import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import Commission from '@/lib/models/Commission';
import Subscription from '@/lib/models/Subscription';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const caller = await User.findOne({ email: session.user.email });
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();

  const [
    totalUsers, activeUsers, blockedUsers, activeBots,
    totalTrades, closedTrades, recentTrades,
    totalSubs, activeSubs,
    commissions,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'blocked' }),
    User.countDocuments({ botActive: true }),
    Trade.countDocuments({}),
    Trade.countDocuments({ status: 'closed' }),
    Trade.find({}).sort({ createdAt: -1 }).limit(10).populate('userId', 'name email'),
    Subscription.countDocuments({ status: 'finished' }),
    User.countDocuments({ subscriptionExpiry: { $gt: now } }),
    Commission.find({}).select('platformAmount referrerAmount totalAmount createdAt'),
  ]);

  const totalPlatformRevenue = commissions.reduce((s, c) => s + c.platformAmount, 0);
  const totalReferrerPaid    = commissions.reduce((s, c) => s + c.referrerAmount, 0);
  const totalCommission      = commissions.reduce((s, c) => s + c.totalAmount, 0);
  const totalProfit          = await Trade.aggregate([
    { $match: { status: 'closed', profit: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$profit' } } },
  ]);

  return NextResponse.json({
    totalUsers, activeUsers, blockedUsers, activeBots,
    totalTrades, closedTrades, recentTrades,
    totalSubs, activeSubs,
    totalPlatformRevenue: parseFloat(totalPlatformRevenue.toFixed(4)),
    totalReferrerPaid:    parseFloat(totalReferrerPaid.toFixed(4)),
    totalCommission:      parseFloat(totalCommission.toFixed(4)),
    totalProfit:          parseFloat((totalProfit[0]?.total || 0).toFixed(4)),
    commissionCount:      commissions.length,
  });
}
