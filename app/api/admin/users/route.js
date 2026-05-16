import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

async function adminGuard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (user?.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const users = await User.find({})
    .select('-password')
    .sort({ createdAt: -1 });
  const now = new Date();
  const result = users.map(u => ({
    ...u.toObject(),
    subscriptionActive: u.subscriptionExpiry && new Date(u.subscriptionExpiry) > now,
    subscriptionDaysLeft: u.subscriptionExpiry
      ? Math.max(0, Math.ceil((new Date(u.subscriptionExpiry) - now) / 86400000))
      : 0,
  }));
  return NextResponse.json(result);
}

export async function PATCH(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, status, role } = await req.json();
  const update = {};
  if (status) update.status = status;
  if (role) update.role = role;
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-password');
  return NextResponse.json(user);
}
