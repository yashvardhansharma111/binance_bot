import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  await User.findOneAndUpdate({ email: session.user.email }, { botActive: false });
  return NextResponse.json({ message: 'Bot stopped' });
}
