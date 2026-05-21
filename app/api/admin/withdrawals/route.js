import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Withdrawal from '@/lib/models/Withdrawal';

async function requireAdmin(session) {
  if (!session) return false;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select('role');
  return user?.role === 'admin';
}

// GET /api/admin/withdrawals — list all (filter by status)
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!await requireAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';

  const withdrawals = await Withdrawal.find(status === 'all' ? {} : { status })
    .sort({ createdAt: -1 })
    .populate('userId', 'name email');

  return NextResponse.json({ withdrawals });
}

// PATCH /api/admin/withdrawals — approve or reject a request
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!await requireAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, action, txHash, adminNote } = await req.json();
  if (!id || !['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 });

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (withdrawal.status !== 'pending')
    return NextResponse.json({ error: 'Already processed' }, { status: 400 });

  if (action === 'approve') {
    withdrawal.status      = 'paid';
    withdrawal.txHash      = txHash || '';
    withdrawal.adminNote   = adminNote || '';
    withdrawal.processedAt = new Date();
    await withdrawal.save();
  } else {
    // Reject → refund the held funds back to the correct balance
    withdrawal.status      = 'rejected';
    withdrawal.adminNote   = adminNote || '';
    withdrawal.processedAt = new Date();
    await withdrawal.save();
    const balanceField = withdrawal.source === 'asset' ? 'assetBalance' : 'fundBalance';
    await User.findByIdAndUpdate(withdrawal.userId, { $inc: { [balanceField]: withdrawal.amount } });
  }

  return NextResponse.json({ withdrawal });
}
