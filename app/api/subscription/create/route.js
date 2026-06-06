import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Subscription from '@/lib/models/Subscription';
import User from '@/lib/models/User';
import { getNetworkFee } from '@/lib/networkFee';

const NP_BASE = process.env.NOWPAYMENTS_SANDBOX === 'true'
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

const PLAN_PRICE = 49;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currency } = await req.json();
  if (!currency) return NextResponse.json({ error: 'Currency required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date()) {
    return NextResponse.json({ error: 'Already has active subscription' }, { status: 400 });
  }

  const gasFee   = getNetworkFee(currency);
  const totalAsk = PLAN_PRICE + gasFee;

  const orderId     = `sub_${user._id}_${Date.now()}`;
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/payments/webhook`;

  const npRes = await fetch(`${NP_BASE}/payment`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount:      totalAsk,
      price_currency:    'usd',
      pay_currency:      currency.toLowerCase(),
      ipn_callback_url:  callbackUrl,
      order_id:          orderId,
      order_description: `TrickyX.ai Bot — 6-month subscription for ${user.email}`,
    }),
  });

  if (!npRes.ok) {
    const err = await npRes.text();
    console.error('NOWPayments subscription error:', err);
    return NextResponse.json({ error: 'Payment gateway error' }, { status: 502 });
  }

  const npData = await npRes.json();

  const sub = await Subscription.create({
    userId:        user._id,
    nowpaymentsId: String(npData.payment_id),
    orderId,
    amount:        PLAN_PRICE,   // actual plan price for referral/commission calculations
    payCurrency:   npData.pay_currency,
    payAddress:    npData.pay_address,
    payAmount:     npData.pay_amount,
    status:        npData.payment_status || 'waiting',
  });

  return NextResponse.json({
    subscriptionId: sub._id,
    nowId:          npData.payment_id,
    payAddress:     npData.pay_address,
    payAmount:      npData.pay_amount,
    payCurrency:    npData.pay_currency,
    gasFee,
    planPrice:      PLAN_PRICE,
    status:         sub.status,
  });
}
