import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const monthly = await Trade.aggregate([
    { $match: { userId: user._id, status: 'closed', profit: { $ne: null }, closedAt: { $ne: null } } },
    {
      $group: {
        _id:         { year: { $year: '$closedAt' }, month: { $month: '$closedAt' } },
        totalProfit: { $sum: '$profit' },
        tradeCount:  { $sum: 1 },
        wins:        { $sum: { $cond: [{ $gt: ['$profit', 0] }, 1, 0] } },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 24 },
  ]);

  return NextResponse.json({ monthly });
}
