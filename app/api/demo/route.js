import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import DemoAccount, { DEMO_START_USDT } from '@/lib/models/DemoAccount';
import WalletTransaction from '@/lib/models/WalletTransaction';
import {
  getVirtualAccount, placeMarketSell, settleDemoFutures, virtualKey, virtualKindOf, virtualScope, tradeKind,
} from '@/bot/services/demo';
import { getCurrentPrice } from '@/bot/services/binance';
import * as fx from '@/bot/services/binanceFutures';

export const dynamic = 'force-dynamic';
const MODES = ['live', 'demo', 'wallet'];

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  return User.findOne({ email: session.user.email });
}

const isFut = (t) => t.market === 'futures';
const dirOf = (t) => t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT');

/** Opening records of finished trades in one virtual account (closing records repeat the P&L). */
const closedOpening = (userId, kind) => ({
  userId, ...virtualScope(kind), status: 'closed',
  $or: [
    { market: { $ne: 'futures' }, side: 'BUY' },
    { market: 'futures', side: 'BUY', positionSide: 'LONG' },
    { market: 'futures', side: 'SELL', positionSide: 'SHORT' },
  ],
});

/** Balance, equity (marked to market) and stats for one virtual account. */
async function accountSummary(userId, kind) {
  const acct = await getVirtualAccount(userId, kind);
  const open = await Trade.find({ userId, ...virtualScope(kind), status: 'open' }).lean();
  const closed = await Trade.find(closedOpening(userId, kind)).select('profit').lean();

  const cache = {};
  const priceOf = async (sym, fut) => {
    const k = `${fut ? 'F' : 'S'}:${sym}`;
    if (cache[k] === undefined) cache[k] = await (fut ? fx.getMarkPrice(sym) : getCurrentPrice(sym)).catch(() => null);
    return cache[k];
  };
  let holdingsValue = 0;
  const holdings = [];
  for (const [asset, qty] of acct.holdings || new Map()) {
    if (qty <= 1e-9) continue;
    const px = await priceOf(`${asset}USDT`, false);
    holdingsValue += px ? qty * px : 0;
    holdings.push({ asset, qty, value: px ? qty * px : null });
  }
  let futuresValue = 0;
  for (const t of open.filter(isFut)) {
    const px = await priceOf(t.symbol, true);
    futuresValue += Math.max(0, (t.margin || 0) + (px ? fx.futuresPnl(dirOf(t), t.price, px, t.qty) : 0));
  }

  const equity = acct.usdt + holdingsValue + futuresValue;
  // Demo P&L is against its starting balance; wallet P&L is against net admin credits.
  const base = kind === 'wallet' ? (acct.totalCredited || 0) - (acct.totalDebited || 0) : acct.startingBalance;
  const wins = closed.filter(t => (t.profit || 0) > 0).length;
  return {
    kind, usdt: acct.usdt, holdings, equity,
    startingBalance: base,
    pnl: equity - base,
    pnlPct: base > 0 ? ((equity - base) / base) * 100 : 0,
    openTrades: open.length,
    closedTrades: closed.length,
    winRate: closed.length ? (wins / closed.length) * 100 : null,
    ...(kind === 'wallet' ? { totalCredited: acct.totalCredited || 0, totalDebited: acct.totalDebited || 0 } : { resetAt: acct.resetAt }),
  };
}

async function summary(user) {
  const mode = user.tradingAccount || 'live';
  const kind = virtualKindOf(mode);
  const current = kind ? await accountSummary(user._id, kind) : null;
  const walletAcct = await getVirtualAccount(user._id, 'wallet');
  const credits = await WalletTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10)
    .select('amount balanceAfter note createdAt').lean();
  return {
    mode,
    botActive: user.botActive,
    ...(current || {}),                              // banner fields for the active virtual account
    wallet: { usdt: walletAcct.usdt, totalCredited: walletAcct.totalCredited || 0, credits },
  };
}

/** Close every open position of one virtual account at market (virtual). */
async function closeVirtualPositions(user, kind, label) {
  const open = await Trade.find({ userId: user._id, ...virtualScope(kind), status: 'open' });
  for (const t of open) {
    let exit, profit;
    try {
      if (isFut(t)) {
        exit = await fx.getMarkPrice(t.symbol);
        profit = await settleDemoFutures(user._id, t, fx.futuresPnl(dirOf(t), t.price, exit, t.qty), exit, t.qty);
      } else {
        const o = await placeMarketSell(virtualKey(user._id, tradeKind(t)), '', t.symbol, t.qty);
        exit = o.price; profit = (o.price - t.price) * o.qty;
      }
    } catch {
      exit = t.price; profit = 0;
    }
    await Trade.updateOne({ _id: t._id }, {
      $set: { status: 'closed', closedAt: new Date(), profit: parseFloat(profit.toFixed(6)),
        reason: `${t.reason || ''} | EXIT:Closed when switching to ${label} @ $${exit}` },
    });
  }
  return open.length;
}

export async function GET(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ?kind=wallet → everything the Wallet page needs, whatever mode the user is in.
  if (new URL(req.url).searchParams.get('kind') === 'wallet') {
    const [acct, credits, trades] = await Promise.all([
      accountSummary(user._id, 'wallet'),
      WalletTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50)
        .select('amount balanceAfter note createdAt').lean(),
      Trade.find({ userId: user._id, ...virtualScope('wallet') }).sort({ createdAt: -1 }).limit(30)
        .select('symbol side market positionSide leverage price qty total profit status source reason createdAt closedAt').lean(),
    ]);
    return NextResponse.json({ mode: user.tradingAccount || 'live', botActive: user.botActive, ...acct, credits, trades });
  }
  return NextResponse.json(await summary(user));
}

/**
 * { action: 'mode', mode: 'live' | 'demo' | 'wallet' } — switch account; always stops the bot.
 * { action: 'reset' }  — demo only: wipe demo trades, back to the starting balance.
 */
export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, mode } = await req.json().catch(() => ({}));
  const from = user.tradingAccount || 'live';

  if (action === 'reset') {
    if (from !== 'demo') return NextResponse.json({ error: 'Only the demo account can be reset' }, { status: 400 });
    await Trade.deleteMany({ userId: user._id, ...virtualScope('demo') });
    await getVirtualAccount(user._id, 'demo');
    await DemoAccount.updateOne({ userId: user._id }, {
      $set: { usdt: DEMO_START_USDT, startingBalance: DEMO_START_USDT, holdings: {}, resetAt: new Date() },
    });
    return NextResponse.json(await summary(await User.findById(user._id)));
  }

  if (action === 'mode') {
    if (!MODES.includes(mode)) return NextResponse.json({ error: 'mode must be live, demo or wallet' }, { status: 400 });
    if (from === mode) return NextResponse.json(await summary(user));

    if (from === 'live') {
      // Live positions would be left unmanaged while the bot runs on a virtual account.
      const liveOpen = await Trade.countDocuments({ userId: user._id, status: 'open', demo: { $ne: true } });
      if (liveOpen)
        return NextResponse.json({
          error: `You have ${liveOpen} open live trade${liveOpen > 1 ? 's' : ''}. Close ${liveOpen > 1 ? 'them' : 'it'} before switching.`,
        }, { status: 409 });
    } else {
      await closeVirtualPositions(user, from, mode === 'live' ? 'Live' : mode === 'wallet' ? 'Wallet' : 'Demo');
    }
    if (mode !== 'live') await getVirtualAccount(user._id, mode);

    await User.updateOne({ _id: user._id }, { $set: { tradingAccount: mode, botActive: false, botStoppedByAdmin: false } });
    return NextResponse.json({ ...(await summary(await User.findById(user._id))), switched: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
