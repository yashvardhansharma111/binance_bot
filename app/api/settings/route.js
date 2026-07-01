import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import BotSettings from '@/lib/models/BotSettings';
import User from '@/lib/models/User';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  let settings = await BotSettings.findOne({ userId: user._id });
  if (!settings) settings = await BotSettings.create({ userId: user._id });
  return NextResponse.json(settings);
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['symbol','symbols','timeframe','tradeUSDT','stopLossPercent','takeProfitPercent',
                   'cooldownMinutes','maxDailyTrades','maxConcurrentTrades','useGroqFilter','aggressiveMode',
                   'trailingStopPercent','symbolConfigs','useStopLoss'];
  const update = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  // Validate symbols array
  if (update.symbols !== undefined) {
    if (!Array.isArray(update.symbols)) return NextResponse.json({ error: 'symbols must be an array' }, { status: 400 });
    update.symbols = [...new Set(update.symbols.map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 10);
  }

  // Validate ranges
  if (update.tradeUSDT !== undefined && (update.tradeUSDT < 1 || update.tradeUSDT > 100000))
    return NextResponse.json({ error: 'tradeUSDT must be $1–$100,000' }, { status: 400 });
  if (update.maxConcurrentTrades !== undefined && (update.maxConcurrentTrades < 1 || update.maxConcurrentTrades > 10))
    return NextResponse.json({ error: 'maxConcurrentTrades must be 1–10' }, { status: 400 });
  if (update.stopLossPercent && (update.stopLossPercent < 0.1 || update.stopLossPercent > 50))
    return NextResponse.json({ error: 'stopLossPercent must be 0.1–50' }, { status: 400 });
  if (update.takeProfitPercent && (update.takeProfitPercent < 0.1 || update.takeProfitPercent > 100))
    return NextResponse.json({ error: 'takeProfitPercent must be 0.1–100' }, { status: 400 });

  if (update.symbolConfigs !== undefined) {
    if (!Array.isArray(update.symbolConfigs))
      return NextResponse.json({ error: 'symbolConfigs must be an array' }, { status: 400 });
    update.symbolConfigs = update.symbolConfigs
      .filter(c => c?.symbol)
      .map(c => ({
        symbol: String(c.symbol).trim().toUpperCase(),
        tradeUSDT:           c.tradeUSDT           != null ? Number(c.tradeUSDT)           : null,
        stopLossPercent:     c.stopLossPercent     != null ? Number(c.stopLossPercent)     : null,
        takeProfitPercent:   c.takeProfitPercent   != null ? Number(c.takeProfitPercent)   : null,
        trailingStopPercent: c.trailingStopPercent != null ? Number(c.trailingStopPercent) : null,
      }));
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const settings = await BotSettings.findOneAndUpdate(
    { userId: user._id },
    { $set: update },
    { new: true, upsert: true }
  );
  return NextResponse.json(settings);
}
