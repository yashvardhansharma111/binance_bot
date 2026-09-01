import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const key  = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!key) return NextResponse.json({ error: 'Connect your Binance API key first' }, { status: 400 });
  await User.findByIdAndUpdate(user._id, { botActive: true });

  // Push notification — fire and forget
  try {
    const { sendPush } = await import('@/lib/fcm.js');
    await sendPush(user._id, '🤖 Bot Started', 'Your trading bot is now active and scanning markets');
  } catch {}

  return NextResponse.json({ message: 'Bot started', botActive: true });
}
