import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import User from '@/lib/models/User';
import crypto from 'crypto';

const NP_BASE = process.env.NOWPAYMENTS_SANDBOX === 'true'
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

export async function POST(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, currency } = await req.json();
  if (!amount || amount < 1) return NextResponse.json({ error: 'Minimum deposit is $1' }, { status: 400 });
  if (!currency) return NextResponse.json({ error: 'Currency required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const orderId = `dep_${user._id}_${Date.now()}`;
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/payments/webhook`;

  const npRes = await fetch(`${NP_BASE}/payment`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount:    amount,
      price_currency:  'usd',
      pay_currency:    currency.toLowerCase(),
      ipn_callback_url: callbackUrl,
      order_id:        orderId,
      order_description: `Fund deposit for ${user.email}`,
    }),
  });

  if (!npRes.ok) {
    const err = await npRes.text();
    console.error('NOWPayments error:', err);
    return NextResponse.json({ error: 'Payment gateway error' }, { status: 502 });
  }

  const npData = await npRes.json();

  const payment = await Payment.create({
    userId:        user._id,
    nowpaymentsId: String(npData.payment_id),
    orderId,
    priceAmount:   amount,
    priceCurrency: 'usd',
    payCurrency:   npData.pay_currency,
    payAddress:    npData.pay_address,
    payAmount:     npData.pay_amount,
    status:        npData.payment_status || 'waiting',
  });

  return NextResponse.json({
    paymentId:   payment._id,
    nowId:       npData.payment_id,
    payAddress:  npData.pay_address,
    payAmount:   npData.pay_amount,
    payCurrency: npData.pay_currency,
    status:      payment.status,
  });
}
