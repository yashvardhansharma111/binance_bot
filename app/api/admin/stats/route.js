import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import Commission from '@/lib/models/Commission';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const caller = await User.findOne({ email: session.user.email });
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [totalUsers, activeUsers, blockedUsers, activeBots, totalTrades, recentTrades] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'blocked' }),
    User.countDocuments({ botActive: true }),
    Trade.countDocuments({}),
    Trade.find({}).sort({ createdAt: -1 }).limit(10).populate('userId', 'name email'),
  ]);

  return NextResponse.json({ totalUsers, activeUsers, blockedUsers, activeBots, totalTrades, recentTrades });
}
