import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import User from '@/lib/models/User';

// Polled by the deposit page every 8 s to get payment status + updated assetBalance
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const payment = await Payment.findById(params.id);
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  const user = await User.findOne({ email: session.user.email }).select('assetBalance');

  return NextResponse.json({
    status:       payment.status,
    assetBalance: user?.assetBalance ?? 0,
  });
}
