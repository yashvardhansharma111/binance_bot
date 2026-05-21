import { NextResponse } from 'next/server';

let cache = { symbols: [], at: 0 };
const TTL = 10 * 60 * 1000; // 10 min

export async function GET() {
  if (Date.now() - cache.at < TTL && cache.symbols.length) {
    return NextResponse.json({ symbols: cache.symbols });
  }

  try {
    const res  = await fetch('https://api.binance.com/api/v3/exchangeInfo', { next: { revalidate: 600 } });
    const data = await res.json();

    const symbols = data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map(s => s.symbol)
      .sort();

    cache = { symbols, at: Date.now() };
    return NextResponse.json({ symbols });
  } catch {
    // Return stale cache or empty on error
    return NextResponse.json({ symbols: cache.symbols });
  }
}
