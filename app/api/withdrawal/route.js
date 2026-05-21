import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Withdrawal from '@/lib/models/Withdrawal';

const MIN_WITHDRAWAL = 5;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();

  const user = await User.findOne({ email: session.user.email }).select('_id fundBalance assetBalance');
  const withdrawals = await Withdrawal.find({ userId: user._id }).sort({ createdAt: -1 });

  return NextResponse.json({
    withdrawals,
    fundBalance:  user.fundBalance  ?? 0,
    assetBalance: user.assetBalance ?? 0,
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, walletAddress, currency, network, source = 'fund' } = await req.json();

  if (!['fund', 'asset'].includes(source))
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  if (!amount || amount < MIN_WITHDRAWAL)
    return NextResponse.json({ error: `Minimum withdrawal is $${MIN_WITHDRAWAL}` }, { status: 400 });
  if (!walletAddress?.trim())
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  if (!currency)
    return NextResponse.json({ error: 'Currency is required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const balanceField = source === 'asset' ? 'assetBalance' : 'fundBalance';
  if ((user[balanceField] ?? 0) < amount)
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

  // Hold funds immediately
  await User.findByIdAndUpdate(user._id, { $inc: { [balanceField]: -amount } });

  const withdrawal = await Withdrawal.create({
    userId:        user._id,
    amount,
    walletAddress: walletAddress.trim(),
    currency,
    network:       network?.trim() || '',
    source,
  });

  return NextResponse.json({ withdrawal });
}
