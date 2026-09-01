import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';
import SubscriptionCommission from '@/lib/models/SubscriptionCommission';
import { getReferralChain, SUB_MLM_RATES } from '@/lib/mlm';

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
      sub.expiresAt   = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
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

      // Credit MLM subscription commissions up to 3 levels
      const planAmount = sub.amount || 1;
      const chain = await getReferralChain(sub.userId, SUB_MLM_RATES.length);
      for (let i = 0; i < chain.length; i++) {
        const referrer = chain[i];
        const rate     = SUB_MLM_RATES[i];                              // 0.12, 0.05, 0.03
        const amount   = parseFloat((planAmount * rate).toFixed(4));
        const level    = i + 1;

        await User.findByIdAndUpdate(referrer._id, { $inc: { assetBalance: amount } });

        // Idempotent: unique index on { subscriptionId, level } prevents double-credit on webhook retries
        await SubscriptionCommission.updateOne(
          { subscriptionId: sub._id, level },
          { $setOnInsert: {
              subscriptionId: sub._id,
              userId:         sub.userId,
              referrerId:     referrer._id,
              level,
              planAmount,
              referrerRate:   rate,
              referrerAmount: amount,
          } },
          { upsert: true },
        );
        console.log(`[webhook] Sub MLM L${level}: referrer ${referrer._id} credited $${amount} (${(rate * 100).toFixed(0)}% of $${planAmount})`);
      }
    } else {
      await sub.save();
    }
    return NextResponse.json({ ok: true });
  }

  // ── Deposit payment ─────────────────────────────────────────────────────────
  const payment = await Payment.findOne({ nowpaymentsId: String(payment_id) });
  if (!payment) return NextResponse.json({ ok: true });

  // For USDT payments, actually_paid ≈ USD value (1:1 peg).
  // Credit whatever arrived immediately so users never lose funds to fees.
  const alreadyCredited = payment.creditedAmount || 0;

  if (payment_status === 'partially_paid' && actually_paid != null) {
    // Credit whatever came in (capped at priceAmount to avoid crediting overpay here)
    const creditNow = parseFloat(
      Math.max(0, Math.min(actually_paid, payment.priceAmount) - alreadyCredited).toFixed(2)
    );
    if (creditNow >= 0.01) {
      await User.findByIdAndUpdate(payment.userId, { $inc: { assetBalance: creditNow } });
      payment.creditedAmount = alreadyCredited + creditNow;
      console.log(`[webhook] Deposit partial — credited $${creditNow} to user:${payment.userId} (${actually_paid} paid / ${payment.priceAmount} requested)`);
    }
    payment.actuallyPaid = actually_paid;
    payment.status       = 'partially_paid';
    await payment.save();
    return NextResponse.json({ ok: true });
  }

  if (payment_status === 'finished') {
    payment.actuallyPaid = actually_paid ?? payment.payAmount;
    payment.completedAt  = new Date();
    payment.status       = 'finished';

    // Credit whatever hasn't been credited yet (partial may have already run)
    const remaining = parseFloat(
      Math.max(0, payment.priceAmount - alreadyCredited).toFixed(2)
    );
    if (remaining >= 0.01) {
      await User.findByIdAndUpdate(payment.userId, { $inc: { assetBalance: remaining } });
      payment.creditedAmount = payment.priceAmount;
      console.log(`[webhook] Deposit finished — credited remaining $${remaining} to user:${payment.userId}`);
    }

    // Overpayment: credit surplus above priceAmount
    if (actually_paid && actually_paid > payment.priceAmount * 1.01) {
      const surplus = parseFloat((actually_paid - payment.priceAmount).toFixed(2));
      if (surplus >= 0.01) {
        await User.findByIdAndUpdate(payment.userId, { $inc: { assetBalance: surplus } });
        console.log(`[webhook] Deposit overpay — credited extra $${surplus} to user:${payment.userId}`);
      }
    }

    await payment.save();
    console.log(`[webhook] Deposit fully finished — user:${payment.userId} priceAmount:$${payment.priceAmount}`);
    return NextResponse.json({ ok: true });
  }

  // Other status transitions (confirming, failed, expired, etc.)
  if (payment.status !== payment_status) {
    payment.status = payment_status;
    await payment.save();
  }

  return NextResponse.json({ ok: true });
}
