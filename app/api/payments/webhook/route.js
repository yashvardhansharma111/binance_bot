import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';
import DepositCommission from '@/lib/models/DepositCommission';
import SubscriptionCommission from '@/lib/models/SubscriptionCommission';

export async function POST(req) {
  const rawBody = await req.text();
  const sig     = req.headers.get('x-nowpayments-sig');

  // Signature is mandatory when the secret is configured
  if (process.env.NOWPAYMENTS_IPN_SECRET) {
    const expected = crypto
      .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET)
      .update(rawBody)
      .digest('hex');
    if (!sig || sig.toLowerCase() !== expected.toLowerCase()) {
      console.warn('[webhook] IPN signature missing or mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  let body;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const { payment_id, payment_status, order_id, actually_paid,
          pay_amount: ipnPayAmount, price_amount: ipnPriceAmount } = body;
  if (!payment_id || !payment_status)
    return NextResponse.json({ error: 'Missing payment_id or payment_status' }, { status: 400 });

  await connectDB();

  // ── Subscription payment ────────────────────────────────────────────────────
  if (order_id?.startsWith('sub_')) {
    const sub = await Subscription.findOne({ nowpaymentsId: String(payment_id) });
    if (!sub) return NextResponse.json({ ok: true });

    // Accept partially_paid if the user paid ≥ 96% of the required crypto amount.
    // This covers exchange withdrawal fees (~1–2 USDT) that are deducted from the sent amount.
    const isPartiallyPaid = payment_status === 'partially_paid';
    const partialAccepted = isPartiallyPaid && actually_paid != null
      && (actually_paid / (ipnPayAmount || sub.payAmount)) >= 0.96;
    const effectiveStatus = partialAccepted ? 'finished' : payment_status;

    if (sub.status === effectiveStatus) return NextResponse.json({ ok: true });

    sub.status = effectiveStatus;
    if (effectiveStatus === 'finished') {
      if (partialAccepted) console.log(`[webhook] Sub partial accepted: paid ${actually_paid} / required ${ipnPayAmount || sub.payAmount}`);

      sub.activatedAt = new Date();
      sub.expiresAt   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      await sub.save();
      await User.findByIdAndUpdate(sub.userId, { subscriptionExpiry: sub.expiresAt });

      // Credit overpayment to assetBalance
      const expectedCrypto  = ipnPayAmount  || sub.payAmount;
      const planPriceUsd    = ipnPriceAmount || sub.amount || 1;
      if (actually_paid && expectedCrypto && actually_paid > expectedCrypto * 1.01) {
        const overpayRatio = (actually_paid - expectedCrypto) / expectedCrypto;
        const overpayUsd   = parseFloat((overpayRatio * planPriceUsd).toFixed(2));
        if (overpayUsd >= 0.01) {
          await User.findByIdAndUpdate(sub.userId, { $inc: { assetBalance: overpayUsd } });
          console.log(`[webhook] Sub overpayment: $${overpayUsd} credited to assetBalance ${sub.userId}`);
        }
      }

      // Credit 20% of subscription price to referrer's assetBalance
      const SUB_REFERRER_RATE = 0.20;
      const buyer = await User.findById(sub.userId).select('referredBy');
      if (buyer?.referredBy) {
        const referrer = await User.findOne({ referralCode: buyer.referredBy }).select('_id');
        if (referrer) {
          const planAmount  = sub.amount || 1;
          const referrerCut = parseFloat((planAmount * SUB_REFERRER_RATE).toFixed(4));
          await User.findByIdAndUpdate(referrer._id, { $inc: { assetBalance: referrerCut } });

          // Record the commission so it appears in referral totals / history.
          // unique index on subscriptionId makes this idempotent across webhook retries.
          await SubscriptionCommission.updateOne(
            { subscriptionId: sub._id },
            { $setOnInsert: {
                subscriptionId: sub._id,
                userId:         sub.userId,
                referrerId:     referrer._id,
                planAmount,
                referrerRate:   SUB_REFERRER_RATE,
                referrerAmount: referrerCut,
            } },
            { upsert: true },
          );
          console.log(`[webhook] Sub referral: referrer ${referrer._id} credited $${referrerCut} to assetBalance`);
        }
      }
    } else {
      await sub.save();
    }
    return NextResponse.json({ ok: true });
  }

  // ── Deposit payment ─────────────────────────────────────────────────────────
  const payment = await Payment.findOne({ nowpaymentsId: String(payment_id) });
  if (!payment) return NextResponse.json({ ok: true });

  // Accept partially_paid deposits when ≥ 96% received (covers exchange withdrawal fees)
  const isPartialDep    = payment_status === 'partially_paid';
  const partialDepOk    = isPartialDep && actually_paid != null
    && (actually_paid / (ipnPayAmount || payment.payAmount)) >= 0.96;
  const effectiveDepSt  = partialDepOk ? 'finished' : payment_status;

  if (payment.status === effectiveDepSt) return NextResponse.json({ ok: true });

  payment.status = effectiveDepSt;

  if (effectiveDepSt === 'finished') {
    if (partialDepOk) console.log(`[webhook] Deposit partial accepted: paid ${actually_paid} / required ${ipnPayAmount || payment.payAmount}`);
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

        // Credit referrer's assetBalance
        await User.findByIdAndUpdate(referrer._id, { $inc: { assetBalance: referrerAmount } });
        console.log(`[webhook] Referrer ${referrer._id} credited $${referrerAmount} to assetBalance`);
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
