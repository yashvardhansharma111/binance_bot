import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import { encrypt, decrypt } from '@/lib/encryption';

async function getUser(session) {
  return User.findOne({ email: session.user.email });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await getUser(session);
  const apiKey = await ApiKey.findOne({ userId: user._id });
  if (!apiKey) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected:   true,
    exchange:    apiKey.exchange,
    accountType: apiKey.accountType,
    label:       apiKey.label,
    isActive:    apiKey.isActive,
    createdAt:   apiKey.createdAt,
    maskedKey:   `****${decrypt(apiKey.encryptedKey).slice(-6)}`,
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { apiKey, apiSecret, label, accountType, exchange } = await req.json();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'API Key and Secret required' }, { status: 400 });
  await connectDB();
  const user = await getUser(session);
  const type = accountType === 'testnet' ? 'testnet' : 'real';
  const exch = exchange === 'bingx' ? 'bingx' : 'binance';
  const defaultLabel = exch === 'bingx'
    ? 'BingX'
    : type === 'testnet' ? 'Binance Testnet' : 'Binance';
  await ApiKey.findOneAndUpdate(
    { userId: user._id },
    {
      userId:          user._id,
      encryptedKey:    encrypt(apiKey),
      encryptedSecret: encrypt(apiSecret),
      label:           label || defaultLabel,
      accountType:     type,
      exchange:        exch,
      isActive:        true,
    },
    { upsert: true, new: true }
  );
  console.log(`[apikeys] Saved ${type} key for user ${user._id}`);
  return NextResponse.json({ message: 'API key saved' });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await getUser(session);
  await ApiKey.findOneAndDelete({ userId: user._id });
  await User.findOneAndUpdate({ email: session.user.email }, { botActive: false });
  return NextResponse.json({ message: 'API key removed' });
}
