import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';

export async function POST(req) {
  const rawBody = await req.text();
  const sig     = req.headers.get('x-nowpayments-sig');

  if (sig && process.env.NOWPAYMENTS_IPN_SECRET) {
    const expected = crypto
      .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET)
      .update(rawBody)
      .digest('hex');
    if (sig.toLowerCase() !== expected.toLowerCase()) {
      console.warn('IPN signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  let body;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const { payment_id, payment_status, order_id, actually_paid } = body;
  if (!payment_id) return NextResponse.json({ ok: true });

  await dbConnect();

  // Route by order_id prefix
  if (order_id?.startsWith('sub_')) {
    // ── Subscription payment ──────────────────────────────────────────────────
    const sub = await Subscription.findOne({ nowpaymentsId: String(payment_id) });
    if (!sub || sub.status === payment_status) return NextResponse.json({ ok: true });

    sub.status = payment_status;
    if (payment_status === 'finished') {
      sub.activatedAt = new Date();
      sub.expiresAt   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months
      await sub.save();
      await User.findByIdAndUpdate(sub.userId, { subscriptionExpiry: sub.expiresAt });
    } else {
      await sub.save();
    }

  } else {
    // ── Deposit payment ───────────────────────────────────────────────────────
    const payment = await Payment.findOne({ nowpaymentsId: String(payment_id) });
    if (!payment || payment.status === payment_status) return NextResponse.json({ ok: true });

    payment.status = payment_status;
    if (payment_status === 'finished') {
      payment.actuallyPaid = actually_paid ?? payment.payAmount;
      payment.completedAt  = new Date();
      await payment.save();
      await User.findByIdAndUpdate(payment.userId, { $inc: { fundBalance: payment.priceAmount } });
    } else {
      await payment.save();
    }
  }

  return NextResponse.json({ ok: true });
}
