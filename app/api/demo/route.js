import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import DemoAccount, { DEMO_START_USDT } from '@/lib/models/DemoAccount';
import { getDemoAccount, placeMarketSell, settleDemoFutures } from '@/bot/services/demo';
import { getCurrentPrice } from '@/bot/services/binance';
import * as fx from '@/bot/services/binanceFutures';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  return User.findOne({ email: session.user.email });
}

const isFut = (t) => t.market === 'futures';
const dirOf = (t) => t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT');

/** Opening records of finished demo trades (closing records carry the same P&L). */
const closedOpeningFilter = (userId) => ({
  userId, demo: true, status: 'closed',
  // Futures opening record: side matches the position (BUY+LONG / SELL+SHORT); closing records are the opposite side.
  $or: [
    { market: { $ne: 'futures' }, side: 'BUY' },
    { market: 'futures', side: 'BUY', positionSide: 'LONG' },
    { market: 'futures', side: 'SELL', positionSide: 'SHORT' },
  ],
});

async function summary(user) {
  const acct = await getDemoAccount(user._id);
  const open = await Trade.find({ userId: user._id, demo: true, status: 'open' }).lean();
  const closed = await Trade.find(closedOpeningFilter(user._id)).select('profit').lean();

  const prices = {};
  const priceOf = async (sym, fut) => {
    const k = `${fut ? 'F' : 'S'}:${sym}`;
    if (prices[k] === undefined) prices[k] = await (fut ? fx.getMarkPrice(sym) : getCurrentPrice(sym)).catch(() => null);
    return prices[k];
  };

  let holdingsValue = 0;
  const holdings = [];
  for (const [asset, qty] of acct.holdings || new Map()) {
    if (qty <= 1e-9) continue;
    const px = await priceOf(`${asset}USDT`, false);
    const value = px ? qty * px : 0;
    holdingsValue += value;
    holdings.push({ asset, qty, value });
  }

  let futuresValue = 0;
  for (const t of open.filter(isFut)) {
    const px = await priceOf(t.symbol, true);
    const upnl = px ? fx.futuresPnl(dirOf(t), t.price, px, t.qty) : 0;
    futuresValue += Math.max(0, (t.margin || 0) + upnl);
  }

  const equity = acct.usdt + holdingsValue + futuresValue;
  const wins = closed.filter(t => (t.profit || 0) > 0).length;
  return {
    mode: user.tradingAccount || 'live',
    botActive: user.botActive,
    usdt: acct.usdt,
    holdings,
    equity,
    startingBalance: acct.startingBalance,
    pnl: equity - acct.startingBalance,
    pnlPct: ((equity - acct.startingBalance) / acct.startingBalance) * 100,
    openTrades: open.length,
    closedTrades: closed.length,
    winRate: closed.length ? (wins / closed.length) * 100 : null,
    resetAt: acct.resetAt,
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await summary(user));
}

/**
 * { action: 'mode', mode: 'demo' | 'live' }  — switch account; always stops the bot.
 * { action: 'reset' }                        — wipe demo trades, back to the starting balance.
 */
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, mode } = await req.json().catch(() => ({}));

  if (action === 'reset') {
    await Trade.deleteMany({ userId: user._id, demo: true });
    await getDemoAccount(user._id);
    await DemoAccount.updateOne({ userId: user._id }, {
      $set: { usdt: DEMO_START_USDT, startingBalance: DEMO_START_USDT, holdings: {}, resetAt: new Date() },
    });
    return NextResponse.json(await summary(await User.findById(user._id)));
  }

  if (action === 'mode') {
    if (!['demo', 'live'].includes(mode)) return NextResponse.json({ error: 'mode must be demo or live' }, { status: 400 });
    if ((user.tradingAccount || 'live') === mode) return NextResponse.json(await summary(user));

    if (mode === 'demo') {
      // Live positions would be left unmanaged while the bot runs in demo.
      const liveOpen = await Trade.countDocuments({ userId: user._id, status: 'open', demo: { $ne: true } });
      if (liveOpen)
        return NextResponse.json({
          error: `You have ${liveOpen} open live trade${liveOpen > 1 ? 's' : ''}. Close ${liveOpen > 1 ? 'them' : 'it'} before switching to Demo.`,
        }, { status: 409 });
      await getDemoAccount(user._id);
    } else {
      // Going live: close every open demo position at the market (virtual).
      const open = await Trade.find({ userId: user._id, demo: true, status: 'open' });
      for (const t of open) {
        let exit, profit;
        try {
          if (isFut(t)) {
            exit = await fx.getMarkPrice(t.symbol);
            profit = await settleDemoFutures(user._id, t, fx.futuresPnl(dirOf(t), t.price, exit, t.qty), exit, t.qty);
          } else {
            const o = await placeMarketSell(String(user._id), '', t.symbol, t.qty);
            exit = o.price; profit = (o.price - t.price) * o.qty;
          }
        } catch {
          exit = t.price; profit = 0;
        }
        await Trade.updateOne({ _id: t._id }, {
          $set: { status: 'closed', closedAt: new Date(), profit: parseFloat(profit.toFixed(6)),
            reason: `${t.reason || ''} | EXIT:Closed when switching to Live @ $${exit}` },
        });
      }
    }

    await User.updateOne({ _id: user._id }, { $set: { tradingAccount: mode, botActive: false, botStoppedByAdmin: false } });
    return NextResponse.json({ ...(await summary(await User.findById(user._id))), switched: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
