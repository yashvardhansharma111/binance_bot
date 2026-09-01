import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '30d';

  const periodMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const days = periodMap[period] || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const trades = await Trade.find({
    userId: user._id,
    status: 'closed',
    closedAt: { $gte: startDate },
  });

  // Summary
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.profit > 0).length;
  const losses = trades.filter(t => t.profit < 0).length;
  const winRate = totalTrades > 0 ? parseFloat(((wins / totalTrades) * 100).toFixed(2)) : 0;
  const totalProfit = parseFloat(trades.reduce((sum, t) => sum + (t.profit || 0), 0).toFixed(6));
  const avgProfit = totalTrades > 0 ? parseFloat((totalProfit / totalTrades).toFixed(6)) : 0;
  const profits = trades.map(t => t.profit || 0);
  const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
  const worstTrade = profits.length > 0 ? Math.min(...profits) : 0;

  // Daily breakdown — group by YYYY-MM-DD of closedAt
  const dailyMap = {};
  for (const trade of trades) {
    const dateStr = new Date(trade.closedAt).toISOString().slice(0, 10);
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, profit: 0, trades: 0, wins: 0 };
    }
    dailyMap[dateStr].profit += trade.profit || 0;
    dailyMap[dateStr].trades += 1;
    if ((trade.profit || 0) > 0) dailyMap[dateStr].wins += 1;
  }
  const daily = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, profit: parseFloat(d.profit.toFixed(6)) }));

  // Symbols breakdown — group by symbol, top 10 by profit
  const symbolMap = {};
  for (const trade of trades) {
    const sym = trade.symbol;
    if (!symbolMap[sym]) {
      symbolMap[sym] = { symbol: sym, profit: 0, trades: 0, wins: 0 };
    }
    symbolMap[sym].profit += trade.profit || 0;
    symbolMap[sym].trades += 1;
    if ((trade.profit || 0) > 0) symbolMap[sym].wins += 1;
  }
  const symbols = Object.values(symbolMap)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)
    .map(s => ({ ...s, profit: parseFloat(s.profit.toFixed(6)) }));

  // Drawdown — sort by closedAt ascending, compute cumulative loss streaks
  const sortedTrades = [...trades].sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));

  let maxDrawdown = 0;
  let currentStreak = 0;
  let currentDrawdown = 0;

  for (const trade of sortedTrades) {
    const p = trade.profit || 0;
    if (p < 0) {
      currentStreak += p;
      if (currentStreak < maxDrawdown) maxDrawdown = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Current drawdown: sum of losses since last winning trade
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    const p = sortedTrades[i].profit || 0;
    if (p > 0) break;
    if (p < 0) currentDrawdown += p;
  }

  const drawdown = {
    max: parseFloat(Math.abs(maxDrawdown).toFixed(6)),
    current: parseFloat(Math.abs(currentDrawdown).toFixed(6)),
  };

  return NextResponse.json({
    period,
    summary: {
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      avgProfit,
      bestTrade: parseFloat(bestTrade.toFixed(6)),
      worstTrade: parseFloat(worstTrade.toFixed(6)),
    },
    daily,
    symbols,
    drawdown,
  });
}
