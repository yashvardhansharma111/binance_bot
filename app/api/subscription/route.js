import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';

const NP_BASE = process.env.NOWPAYMENTS_SANDBOX === 'true'
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

export async function GET(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });

  const isActive = user?.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date();

  // Find latest pending subscription to poll status
  const pending = await Subscription.findOne({
    userId: user._id,
    status: { $nin: ['finished', 'failed', 'expired', 'refunded'] },
  }).sort({ createdAt: -1 });

  let pendingStatus = null;
  if (pending) {
    // Poll NOWPayments
    const npRes = await fetch(`${NP_BASE}/payment/${pending.nowpaymentsId}`, {
      headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY },
    }).catch(() => null);

    if (npRes?.ok) {
      const npData = await npRes.json();
      if (npData.payment_status !== pending.status) {
        pending.status = npData.payment_status;
        if (npData.payment_status === 'finished') {
          pending.activatedAt = new Date();
          pending.expiresAt   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months
          await pending.save();
          await User.findByIdAndUpdate(user._id, { subscriptionExpiry: pending.expiresAt });
          const updated = await User.findById(user._id);
          return NextResponse.json({
            active:   true,
            expiry:   updated.subscriptionExpiry,
            pending:  null,
          });
        }
        await pending.save();
      }
    }
    pendingStatus = {
      id:         pending._id,
      status:     pending.status,
      payAddress: pending.payAddress,
      payAmount:  pending.payAmount,
      payCurrency: pending.payCurrency,
    };
  }

  return NextResponse.json({
    active:  isActive,
    expiry:  user?.subscriptionExpiry || null,
    pending: pendingStatus,
  });
}
