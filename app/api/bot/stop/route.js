import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  await User.findOneAndUpdate({ email: session.user.email }, { botActive: false });

  try {
    const dbUser = await User.findOne({ email: session.user.email });
    const { sendPush } = await import('@/lib/fcm.js');
    await sendPush(dbUser._id, '⏹ Bot Stopped', 'Your trading bot has been stopped');
  } catch {}

  return NextResponse.json({ message: 'Bot stopped' });
}
