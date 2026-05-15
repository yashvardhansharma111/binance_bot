import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';

export async function GET(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const page = parseInt(searchParams.get('page') || '1');
  const symbol = searchParams.get('symbol') || null;
  const status = searchParams.get('status') || null;

  await connectDB();
  const user   = await User.findOne({ email: session.user.email });
  const filter = { userId: user._id };
  if (symbol) filter.symbol = symbol;
  if (status) filter.status = status;

  const total  = await Trade.countDocuments(filter);
  const trades = await Trade.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return NextResponse.json({ trades, total, page });
}
