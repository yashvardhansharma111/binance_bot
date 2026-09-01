import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const isSubscribed = !!(user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date());

  const apiKey = await ApiKey.findOne({ userId: user._id, isActive: true });

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      botActive: user.botActive,
      isSubscribed,
      networkOk: true,
    });
  }

  // Last trade
  const lastTrade = await Trade.findOne({ userId: user._id })
    .sort({ createdAt: -1 })
    .select('createdAt');

  // Network check — ping Binance with 3s timeout
  let networkOk = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const pingRes = await fetch('https://api.binance.com/api/v3/ping', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    networkOk = pingRes.ok;
  } catch {
    networkOk = false;
  }

  // Permissions — simplification: testnet = all true; real = spot only
  const isTestnet = apiKey.accountType === 'testnet';
  const permissions = {
    spot: true,
    futures: isTestnet,
    withdrawal: isTestnet,
  };

  return NextResponse.json({
    connected: true,
    botActive: user.botActive,
    isSubscribed,
    networkOk,
    exchange: apiKey.exchange || 'binance',
    accountType: apiKey.accountType,
    label: apiKey.label || '',
    lastTradeAt: lastTrade ? lastTrade.createdAt : null,
    permissions,
  });
}
