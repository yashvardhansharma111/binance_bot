import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import PriceAlert from '@/lib/models/PriceAlert';
import { getCurrentPrice } from '@/bot/services/binance';
import { getMarkPrice } from '@/bot/services/binanceFutures';

export const dynamic = 'force-dynamic';
const MAX_ACTIVE = 20;

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  return User.findOne({ email: session.user.email }).select('_id');
}

/** GET ?symbol=&market= — active alerts (optionally for one chart) + the 10 most recent triggered ones. */
export async function GET(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const filter = { userId: user._id, status: 'active' };
  if (sp.get('symbol')) filter.symbol = sp.get('symbol').toUpperCase();
  if (sp.get('market')) filter.market = sp.get('market') === 'futures' ? 'futures' : 'spot';
  const [active, triggered] = await Promise.all([
    PriceAlert.find(filter).sort({ createdAt: -1 }).lean(),
    PriceAlert.find({ userId: user._id, status: 'triggered' }).sort({ triggeredAt: -1 }).limit(10).lean(),
  ]);
  return NextResponse.json({ active, triggered, max: MAX_ACTIVE });
}

/** POST { symbol, market, price, note } — direction is set from the current price. */
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { symbol, market = 'spot', price, note = '' } = await req.json().catch(() => ({}));
  const sym = String(symbol || '').toUpperCase();
  const mkt = market === 'futures' ? 'futures' : 'spot';
  const target = Number(price);
  if (!/^[A-Z0-9]{2,20}$/.test(sym)) return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  if (!Number.isFinite(target) || target <= 0) return NextResponse.json({ error: 'Enter a valid price' }, { status: 400 });

  if ((await PriceAlert.countDocuments({ userId: user._id, status: 'active' })) >= MAX_ACTIVE)
    return NextResponse.json({ error: `You can have at most ${MAX_ACTIVE} active alerts` }, { status: 400 });

  let now;
  try { now = mkt === 'futures' ? await getMarkPrice(sym) : await getCurrentPrice(sym); }
  catch { return NextResponse.json({ error: `${sym} not found on Binance ${mkt}` }, { status: 400 }); }
  if (!now) return NextResponse.json({ error: 'Could not read the current price' }, { status: 502 });
  if (Math.abs(target - now) / now < 0.0005)
    return NextResponse.json({ error: 'Alert price is too close to the current price' }, { status: 400 });

  const alert = await PriceAlert.create({
    userId: user._id, symbol: sym, market: mkt, price: target,
    condition: target > now ? 'above' : 'below', note: String(note).slice(0, 120),
  });
  return NextResponse.json({ alert, currentPrice: now });
}

/** DELETE ?id= — cancel one of your active alerts. */
export async function DELETE(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const r = await PriceAlert.updateOne({ _id: id, userId: user._id, status: 'active' }, { $set: { status: 'cancelled' } });
  return NextResponse.json({ cancelled: r.modifiedCount === 1 });
}
