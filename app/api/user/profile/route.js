import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select('-password -sessionToken');
  return NextResponse.json(user);
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, phone } = await req.json();
  const update = {};
  if (name?.trim())  update.name  = name.trim();
  if (phone !== undefined) update.phone = phone?.trim() || null;

  await connectDB();
  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    { $set: update },
    { new: true }
  ).select('-password -sessionToken');

  return NextResponse.json(user);
}
