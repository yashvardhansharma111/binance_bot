import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import User from '@/lib/models/User';

const NP_BASE = process.env.NOWPAYMENTS_SANDBOX === 'true'
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

const FINAL_STATUSES = ['finished', 'failed', 'expired', 'refunded'];

export async function GET(req, { params }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const payment = await Payment.findById(params.id);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await User.findOne({ email: session.user.email });
  if (!user || payment.userId.toString() !== user._id.toString()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Already settled — return cached status
  if (FINAL_STATUSES.includes(payment.status)) {
    return NextResponse.json({ status: payment.status, fundBalance: user.fundBalance });
  }

  // Poll NOWPayments for latest status
  const npRes = await fetch(`${NP_BASE}/payment/${payment.nowpaymentsId}`, {
    headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY },
  });

  if (!npRes.ok) {
    return NextResponse.json({ status: payment.status, fundBalance: user.fundBalance });
  }

  const npData = await npRes.json();
  const newStatus = npData.payment_status;

  if (newStatus !== payment.status) {
    payment.status = newStatus;
    if (newStatus === 'finished') {
      payment.actuallyPaid = npData.actually_paid ?? payment.payAmount;
      payment.completedAt  = new Date();
      await payment.save();

      // Credit user fund balance (price in USD)
      await User.findByIdAndUpdate(user._id, {
        $inc: { fundBalance: payment.priceAmount },
      });
      const updated = await User.findById(user._id);
      return NextResponse.json({ status: newStatus, fundBalance: updated.fundBalance });
    }
    await payment.save();
  }

  return NextResponse.json({ status: newStatus, fundBalance: user.fundBalance });
}
