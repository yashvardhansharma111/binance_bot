import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import TradingSymbol from '@/lib/models/TradingSymbol';

const SEED_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','DOGEUSDT','SHIBUSDT','PEPEUSDT',
  'TONUSDT','LINKUSDT','DOTUSDT','ATOMUSDT','AAVEUSDT','UNIUSDT',
  'ZECUSDT','XAUTUSDT','DASHUSDT','NEOUSDT','FILUSDT','GRTUSDT',
  'SANDUSDT','MANAUSDT','CAKEUSDT','COMPUSDT','CRVUSDT','HBARUSDT',
  'IOTAUSDT','IOTXUSDT','WINUSDT','XECUSDT','XTZUSDT','YFIUSDT',
  'SUSHIUSDT','SXPUSDT','XVGUSDT','ICPUSDT','1000SATSUSDT',
];

export async function GET() {
  await connectDB();

  // Auto-seed on first run
  const count = await TradingSymbol.countDocuments();
  if (count === 0) {
    await TradingSymbol.insertMany(
      SEED_SYMBOLS.map(symbol => ({ symbol, isEnabled: true }))
    );
  }

  const docs = await TradingSymbol.find({ isEnabled: true }).sort({ symbol: 1 }).lean();
  return NextResponse.json({ symbols: docs.map(d => d.symbol) });
}
