import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import BotLog from '@/lib/models/BotLog';
import BotSettings from '@/lib/models/BotSettings';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const uid  = user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [apiKey, settings, openTrade, recentLogs, todayTrades, allTrades] = await Promise.all([
    ApiKey.findOne({ userId: uid }),
    BotSettings.findOne({ userId: uid }),
    Trade.findOne({ userId: uid, status: 'open', side: 'BUY' }),
    BotLog.find({ userId: uid }).sort({ createdAt: -1 }).limit(60),
    Trade.find({ userId: uid, createdAt: { $gte: today } }).sort({ createdAt: -1 }),
    Trade.find({ userId: uid, status: 'closed' }),
  ]);

  const totalProfit = allTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const wins        = allTrades.filter(t => t.profit > 0).length;
  const losses      = allTrades.filter(t => t.profit < 0).length;
  const todayProfit = todayTrades.reduce((s, t) => s + (t.profit || 0), 0);

  return NextResponse.json({
    botActive:   user.botActive,
    hasApiKey:   !!apiKey,
    testnet:     process.env.BINANCE_TESTNET === 'true',
    dryRun:      process.env.DRY_RUN === 'true',
    settings:    settings || {},
    openTrade:   openTrade || null,
    logs:        recentLogs,
    stats: {
      totalTrades:  allTrades.length,
      todayTrades:  todayTrades.length,
      todayProfit,
      totalProfit,
      wins,
      losses,
      winRate: allTrades.length ? ((wins / allTrades.length) * 100).toFixed(1) : 0,
    },
    todayTrades,
  });
}
