import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import { decrypt } from '@/lib/encryption';
import { placeMarketSell } from '@/bot/services/binance';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tradeId } = await req.json();
  if (!tradeId) return NextResponse.json({ error: 'tradeId required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const trade = await Trade.findOne({ _id: tradeId, userId: user._id, status: 'open' });
  if (!trade) return NextResponse.json({ error: 'Open trade not found' }, { status: 404 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key' }, { status: 400 });

  const isTestnet = keyDoc.accountType === 'testnet';
  const apiKey    = decrypt(keyDoc.encryptedKey);
  const apiSecret = decrypt(keyDoc.encryptedSecret);

  const order  = await placeMarketSell(apiKey, apiSecret, trade.symbol, trade.qty, isTestnet);
  const profit = parseFloat(((order.price - trade.price) * trade.qty).toFixed(6));

  await Trade.findByIdAndUpdate(trade._id, {
    status:    'closed',
    closedAt:  new Date(),
    profit,
    reason:    'Manual exit',
  });

  return NextResponse.json({ order, profit });
}
