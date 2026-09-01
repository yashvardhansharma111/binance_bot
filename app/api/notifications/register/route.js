import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import FcmToken from '@/lib/models/FcmToken';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, platform } = await req.json();
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await FcmToken.findOneAndUpdate(
    { userId: user._id, token },
    { userId: user._id, token, platform: platform || 'android' },
    { upsert: true, new: true }
  );

  return NextResponse.json({ message: 'Token registered' });
}
