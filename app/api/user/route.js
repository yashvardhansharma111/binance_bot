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
  // fundBalance / assetBalance are NOT user-editable — only changed via deposits, withdrawals, trades
  const update = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 100);
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    update.name = name;
  }
  if (!Object.keys(update).length)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    { $set: update },
    { new: true }
  ).select('-password');
  return NextResponse.json(user);
}
