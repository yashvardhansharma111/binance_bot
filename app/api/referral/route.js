import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Commission from '@/lib/models/Commission';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const referrals = await User.find({ referredBy: user.referralCode }).select('name email createdAt botActive status');
  const commissions = await Commission.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20);
  const totalEarned = commissions.reduce((s, c) => s + c.amount, 0);
  return NextResponse.json({ referrals, commissions, totalEarned, referralCode: user.referralCode });
}
