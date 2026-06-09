import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

let cache = null;
let cacheTs = 0;
const TTL = 10 * 60 * 1000; // 10 min

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (cache && Date.now() - cacheTs < TTL) {
    return NextResponse.json({ symbols: cache, cached: true });
  }

  const res = await fetch('https://api.binance.com/api/v3/exchangeInfo', {
    next: { revalidate: 600 },
  });
  if (!res.ok) return NextResponse.json({ error: 'Binance API error' }, { status: 502 });

  const data = await res.json();
  const symbols = data.symbols
    .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
    .map(s => ({ symbol: s.symbol, base: s.baseAsset }))
    .sort((a, b) => a.base.localeCompare(b.base));

  cache = symbols;
  cacheTs = Date.now();

  return NextResponse.json({ symbols });
}
