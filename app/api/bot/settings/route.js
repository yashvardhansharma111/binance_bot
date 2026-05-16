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

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const allowed = ['symbol','timeframe','tradePercent','stopLossPercent','takeProfitPercent','cooldownMinutes','maxDailyTrades','useGroqFilter'];
  const update = {};
  allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
  const settings = await BotSettings.findOneAndUpdate(
    { userId: user._id },
    { $set: update },
    { upsert: true, new: true }
  );
  return NextResponse.json(settings);
}
