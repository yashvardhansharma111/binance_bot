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

export async function GET(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';

  const filter = search
    ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
    : {};

  const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
  const now = new Date();

  // Referral counts: for each user count how many others have referredBy = their referralCode
  const refCodes = users.map(u => u.referralCode).filter(Boolean);
  const refCounts = await User.aggregate([
    { $match: { referredBy: { $in: refCodes } } },
    { $group: { _id: '$referredBy', count: { $sum: 1 } } },
  ]);
  const refMap = Object.fromEntries(refCounts.map(r => [r._id, r.count]));

  const result = users.map(u => ({
    ...u.toObject(),
    subscriptionActive: u.subscriptionExpiry && new Date(u.subscriptionExpiry) > now,
    subscriptionDaysLeft: u.subscriptionExpiry
      ? Math.max(0, Math.ceil((new Date(u.subscriptionExpiry) - now) / 86400000))
      : 0,
    referralCount: refMap[u.referralCode] || 0,
  }));
  return NextResponse.json(result);
}

export async function PATCH(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId, status, role, grantDays, canViewOverview } = await req.json();
  const update = {};
  if (status) update.status = status;
  if (role)   update.role   = role;
  if (canViewOverview !== undefined) update.canViewOverview = canViewOverview;
  if (grantDays) {
    const now  = new Date();
    const user = await User.findById(userId).select('subscriptionExpiry');
    const base = user?.subscriptionExpiry && new Date(user.subscriptionExpiry) > now
      ? new Date(user.subscriptionExpiry)
      : now;
    update.subscriptionExpiry = new Date(base.getTime() + Number(grantDays) * 86_400_000);
  }
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('-password');
  return NextResponse.json(user);
}

export async function DELETE(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (String(userId) === String(admin._id))
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  await User.findByIdAndDelete(userId);
  return NextResponse.json({ ok: true });
}
