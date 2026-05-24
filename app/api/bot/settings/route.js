import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import BotSettings from '@/lib/models/BotSettings';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  let settings = await BotSettings.findOne({ userId: user._id });
  if (!settings) settings = await BotSettings.create({ userId: user._id });
  return NextResponse.json(settings);
}

const VALID_TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  await connectDB();

  const update = {};
  if (body.symbol !== undefined) {
    if (!/^[A-Z0-9]{2,20}$/.test(String(body.symbol)))
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
    update.symbol = body.symbol;
  }
  if (body.timeframe !== undefined) {
    if (!VALID_TIMEFRAMES.includes(body.timeframe))
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    update.timeframe = body.timeframe;
  }
  const numericFields = { tradePercent: [1, 100], stopLossPercent: [0.1, 50], takeProfitPercent: [0.1, 100], cooldownMinutes: [0, 1440], maxDailyTrades: [1, 100] };
  for (const [k, [min, max]] of Object.entries(numericFields)) {
    if (body[k] !== undefined) {
      const v = parseFloat(body[k]);
      if (!Number.isFinite(v) || v < min || v > max)
        return NextResponse.json({ error: `${k} must be between ${min} and ${max}` }, { status: 400 });
      update[k] = v;
    }
  }
  if (body.useGroqFilter !== undefined) update.useGroqFilter = Boolean(body.useGroqFilter);

  const user = await User.findOne({ email: session.user.email });
  const settings = await BotSettings.findOneAndUpdate(
    { userId: user._id },
    { $set: update },
    { upsert: true, new: true }
  );
  return NextResponse.json(settings);
}
