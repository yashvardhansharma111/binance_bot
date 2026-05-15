import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import SystemConfig from '@/lib/models/SystemConfig';

async function adminGuard() {
  const session = await getServerSession();
  if (!session) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (user?.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const configs = await SystemConfig.find({});
  return NextResponse.json(configs);
}

export async function POST(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { key, value, label } = await req.json();
  const config = await SystemConfig.findOneAndUpdate(
    { key },
    { key, value, label },
    { upsert: true, new: true }
  );
  return NextResponse.json(config);
}
