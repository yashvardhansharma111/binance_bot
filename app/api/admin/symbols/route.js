import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import TradingSymbol from '@/lib/models/TradingSymbol';

async function adminGuard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  return user?.role === 'admin' ? user : null;
}

// GET — all symbols (enabled + disabled)
export async function GET() {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const symbols = await TradingSymbol.find().sort({ symbol: 1 }).lean();
  return NextResponse.json({ symbols });
}

// POST — add new symbol
export async function POST(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol } = await req.json();
  const clean = symbol?.trim().toUpperCase();
  if (!clean || !/^[A-Z0-9]{2,20}$/.test(clean))
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });

  const doc = await TradingSymbol.findOneAndUpdate(
    { symbol: clean },
    { symbol: clean, isEnabled: true },
    { upsert: true, new: true }
  );
  return NextResponse.json({ symbol: doc });
}

// PATCH — toggle isEnabled
export async function PATCH(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol, isEnabled } = await req.json();
  const doc = await TradingSymbol.findOneAndUpdate(
    { symbol: symbol?.toUpperCase() },
    { isEnabled },
    { new: true }
  );
  if (!doc) return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
  return NextResponse.json({ symbol: doc });
}

// DELETE — remove symbol
export async function DELETE(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol } = await req.json();
  await TradingSymbol.deleteOne({ symbol: symbol?.toUpperCase() });
  return NextResponse.json({ ok: true });
}
