import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import NotificationPrefs from '@/lib/models/NotificationPrefs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const prefs = await NotificationPrefs.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        tradeOpen: true,
        tradeClose: true,
        signal: true,
        botStatus: true,
        announcement: true,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json(prefs);
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const allowedKeys = ['tradeOpen', 'tradeClose', 'signal', 'botStatus', 'announcement'];
  const updates = {};
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key];
  }

  const prefs = await NotificationPrefs.findOneAndUpdate(
    { userId: user._id },
    { $set: updates },
    { upsert: true, new: true }
  );

  return NextResponse.json(prefs);
}
