import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import BotSettings from '@/lib/models/BotSettings';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';
import { createHmac } from 'crypto';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user     = await User.findOne({ email: session.user.email });
  const settings = await BotSettings.findOne({ userId: user._id });
  const symbol   = settings?.symbol || 'BTCUSDT';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Our DB trades for today
  const dbTrades = await Trade.find({ userId: user._id, createdAt: { $gte: today } })
    .sort({ createdAt: -1 });

  // Binance trades fetched directly from exchange
  let binanceTrades = [];
  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (keyDoc) {
    try {
      const apiKey    = decrypt(keyDoc.encryptedKey);
      const apiSecret = decrypt(keyDoc.encryptedSecret);
      const isTestnet = keyDoc.accountType === 'testnet';
      const base      = isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';

      const params = { symbol, limit: 50, timestamp: Date.now(), recvWindow: 60000 };
      const qs  = new URLSearchParams(params).toString();
      const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');

      const { data } = await axios.get(`${base}/api/v3/myTrades?${qs}&signature=${sig}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 5000,
      });

      binanceTrades = data
        .filter(t => t.time >= today.getTime())
        .map(t => ({
          _id:       `bnb_${t.id}`,
          orderId:   String(t.orderId),
          symbol:    t.symbol,
          side:      t.isBuyer ? 'BUY' : 'SELL',
          price:     parseFloat(t.price),
          qty:       parseFloat(t.qty),
          total:     parseFloat(t.quoteQty),
          profit:    0,
          source:    'binance',
          status:    'closed',
          createdAt: new Date(t.time),
        }));
    } catch { /* Silently skip if API key missing or network error */ }
  }

  // Merge: DB trades are authoritative; add Binance trades not already tracked
  const dbOrderIds = new Set(dbTrades.map(t => t.orderId).filter(Boolean));
  const extra = binanceTrades.filter(t => !dbOrderIds.has(t.orderId));

  const merged = [...dbTrades, ...extra]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return NextResponse.json({ trades: merged, symbol });
}
