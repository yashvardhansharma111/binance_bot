import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import PaperAccount, { PAPER_START_USDT } from '@/lib/models/PaperAccount';
import PaperTrade from '@/lib/models/PaperTrade';
import { quoteSwap } from '@/lib/quoteSwap';

export const dynamic = 'force-dynamic';

const asObject = (map) => Object.fromEntries(map instanceof Map ? map : Object.entries(map || {}));

async function getOrCreate(userId) {
  let acct = await PaperAccount.findOne({ userId });
  if (!acct) {
    acct = await PaperAccount.create({
      userId,
      balances: { USDT: PAPER_START_USDT },
      startingValue: PAPER_START_USDT,
    });
  }
  return acct;
}

/** Current paper balances + recent simulated trades. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const acct = await getOrCreate(session.user.id);
    const trades = await PaperTrade.find({ userId: session.user.id })
      .sort({ createdAt: -1 }).limit(25).lean();

    return NextResponse.json({
      balances: asObject(acct.balances),
      startingValue: acct.startingValue,
      tradeCount: acct.tradeCount,
      resetAt: acct.resetAt,
      trades,
    });
  } catch (err) {
    console.error('[paper GET]', err.message);
    return NextResponse.json({ error: 'Could not load paper account' }, { status: 500 });
  }
}

/** Execute a simulated swap at live Uniswap prices. */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { chainId = 1, tokenIn, tokenOut, amountIn } = await req.json();

    await connectDB();
    const acct = await getOrCreate(session.user.id);

    const balances = asObject(acct.balances);
    const held = Number(balances[tokenIn] ?? 0);
    const want = Number(amountIn);

    if (!Number.isFinite(want) || want <= 0) {
      return NextResponse.json({ error: 'Enter an amount' }, { status: 400 });
    }
    if (want > held) {
      return NextResponse.json(
        { error: `Insufficient paper ${tokenIn} — you hold ${held}` },
        { status: 400 }
      );
    }

    // Re-quote server-side. Never trust a client-supplied rate, or the
    // simulated PnL stops meaning anything.
    let quote;
    try {
      quote = await quoteSwap({ chainId, tokenIn, tokenOut, amountIn: want, slippageBps: 50 });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: e.status || 500 });
    }

    const received = Number(quote.amountOut);

    balances[tokenIn]  = held - want;
    balances[tokenOut] = Number(balances[tokenOut] ?? 0) + received;

    acct.balances = balances;
    acct.tradeCount += 1;
    await acct.save();

    const trade = await PaperTrade.create({
      userId: session.user.id,
      chainId,
      chain: quote.chain,
      tokenIn, tokenOut,
      amountIn: want,
      amountOut: received,
      rate: quote.rate,
      poolFee: quote.fee,
    });

    return NextResponse.json({
      ok: true,
      balances,
      tradeCount: acct.tradeCount,
      trade,
      quote: { rate: quote.rate, feePercent: quote.feePercent, chain: quote.chain },
    });
  } catch (err) {
    console.error('[paper POST]', err.message);
    return NextResponse.json({ error: 'Simulated swap failed' }, { status: 500 });
  }
}

/** Reset the playground to its starting balance. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    await PaperTrade.deleteMany({ userId: session.user.id });
    await PaperAccount.findOneAndUpdate(
      { userId: session.user.id },
      {
        balances: { USDT: PAPER_START_USDT },
        startingValue: PAPER_START_USDT,
        tradeCount: 0,
        resetAt: new Date(),
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, balances: { USDT: PAPER_START_USDT } });
  } catch (err) {
    console.error('[paper DELETE]', err.message);
    return NextResponse.json({ error: 'Could not reset' }, { status: 500 });
  }
}
