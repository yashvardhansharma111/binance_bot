import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select('-password');
  return NextResponse.json(user);
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  await connectDB();
  const allowed = ['name', 'fundBalance', 'assetBalance'];
  const update = {};
  allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    { $set: update },
    { new: true }
  ).select('-password');
  return NextResponse.json(user);
}
