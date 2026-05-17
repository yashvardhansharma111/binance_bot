import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';
import DepositCommission from '@/lib/models/DepositCommission';

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

  const { payment_id, payment_status, order_id, actually_paid,
          pay_amount: ipnPayAmount, price_amount: ipnPriceAmount } = body;
  if (!payment_id) return NextResponse.json({ ok: true });

  await connectDB();

  // ── Subscription payment ────────────────────────────────────────────────────
  if (order_id?.startsWith('sub_')) {
    const sub = await Subscription.findOne({ nowpaymentsId: String(payment_id) });
    if (!sub || sub.status === payment_status) return NextResponse.json({ ok: true });

    sub.status = payment_status;
    if (payment_status === 'finished') {
      sub.activatedAt = new Date();
      sub.expiresAt   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      await sub.save();
      await User.findByIdAndUpdate(sub.userId, { subscriptionExpiry: sub.expiresAt });

      // Credit overpayment to fundBalance
      // e.g. plan = $1, user sent $5 worth → $4 goes to their fundBalance
      const expectedCrypto  = ipnPayAmount  || sub.payAmount;   // crypto amount for $1
      const planPriceUsd    = ipnPriceAmount || sub.amount || 1; // plan price in USD
      if (actually_paid && expectedCrypto && actually_paid > expectedCrypto * 1.01) {
        // 1.01 threshold to ignore tiny rounding differences from the payment gateway
        const overpayRatio = (actually_paid - expectedCrypto) / expectedCrypto;
        const overpayUsd   = parseFloat((overpayRatio * planPriceUsd).toFixed(2));
        if (overpayUsd >= 0.01) {
          await User.findByIdAndUpdate(sub.userId, { $inc: { fundBalance: overpayUsd } });
          console.log(`[webhook] Sub overpayment: $${overpayUsd} credited to user ${sub.userId}`);
        }
      }

      // Credit 20% of subscription price to referrer (if any)
      const buyer = await User.findById(sub.userId).select('referredBy');
      if (buyer?.referredBy) {
        const referrer = await User.findOne({ referralCode: buyer.referredBy }).select('_id');
        if (referrer) {
          const referrerCut = parseFloat(((sub.amount || 1) * 0.20).toFixed(4));
          await User.findByIdAndUpdate(referrer._id, { $inc: { fundBalance: referrerCut } });
          console.log(`[webhook] Sub referral: referrer ${referrer._id} credited $${referrerCut}`);
        }
      }
    } else {
      await sub.save();
    }
    return NextResponse.json({ ok: true });
  }

  // ── Deposit payment ─────────────────────────────────────────────────────────
  const payment = await Payment.findOne({ nowpaymentsId: String(payment_id) });
  if (!payment || payment.status === payment_status) return NextResponse.json({ ok: true });

  payment.status = payment_status;

  if (payment_status === 'finished') {
    payment.actuallyPaid = actually_paid ?? payment.payAmount;
    payment.completedAt  = new Date();
    await payment.save();

    const depositAmount = payment.priceAmount;

    // Commission split
    const COMMISSION_RATE = 0.15;
    const REFERRER_RATE   = 0.10;
    const PLATFORM_RATE   = 0.05;

    const totalCommission = +(depositAmount * COMMISSION_RATE).toFixed(2);
    const netCredited     = +(depositAmount - totalCommission).toFixed(2);

    // Load depositing user to check for referrer
    const depositor = await User.findById(payment.userId).select('referredBy');
    let referrerId     = null;
    let referrerAmount = 0;
    let platformAmount = totalCommission; // default: all 15% to platform

    if (depositor?.referredBy) {
      const referrer = await User.findOne({ referralCode: depositor.referredBy }).select('_id');
      if (referrer) {
        referrerId     = referrer._id;
        referrerAmount = +(depositAmount * REFERRER_RATE).toFixed(2);
        platformAmount = +(depositAmount * PLATFORM_RATE).toFixed(2);

        // Credit referrer's fundBalance
        await User.findByIdAndUpdate(referrer._id, { $inc: { fundBalance: referrerAmount } });
        console.log(`[webhook] Referrer ${referrer._id} credited $${referrerAmount}`);
      }
    }

    // Credit depositor's assetBalance (net after commission)
    await User.findByIdAndUpdate(payment.userId, { $inc: { assetBalance: netCredited } });

    // Record commission
    await DepositCommission.create({
      paymentId:      payment._id,
      userId:         payment.userId,
      referrerId,
      depositAmount,
      netCredited,
      referrerAmount,
      platformAmount,
    });

    console.log(
      `[webhook] Deposit finished — user:${payment.userId} deposit:$${depositAmount} ` +
      `net:$${netCredited} referrer:$${referrerAmount} platform:$${platformAmount}`
    );
  } else {
    await payment.save();
  }

  return NextResponse.json({ ok: true });
}
