import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import BotLog from '@/lib/models/BotLog';

export async function GET(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const level = searchParams.get('level');
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const filter = { userId: user._id };
  if (level) filter.level = level;
  const logs = await BotLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  return NextResponse.json({ logs });
}
