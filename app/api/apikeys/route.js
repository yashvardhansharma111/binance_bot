import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const apiKey = await ApiKey.findOne({ userId: user._id });
  if (!apiKey) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    exchange: apiKey.exchange,
    label: apiKey.label,
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
    maskedKey: `****${decrypt(apiKey.encryptedKey).slice(-6)}`,
  });
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { apiKey, apiSecret, label } = await req.json();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'API Key and Secret required' }, { status: 400 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  await ApiKey.findOneAndUpdate(
    { userId: user._id },
    { userId: user._id, encryptedKey: encrypt(apiKey), encryptedSecret: encrypt(apiSecret), label: label || 'Binance' },
    { upsert: true, new: true }
  );
  return NextResponse.json({ message: 'API key saved' });
}

export async function DELETE() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  await ApiKey.findOneAndDelete({ userId: user._id });
  await User.findOneAndUpdate({ email: session.user.email }, { botActive: false });
  return NextResponse.json({ message: 'API key removed' });
}
