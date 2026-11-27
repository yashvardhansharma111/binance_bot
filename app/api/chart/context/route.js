import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import axios from 'axios';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';
import BotSettings from '@/lib/models/BotSettings';
import { tradeScope } from '@/bot/services/demo';
import { getCandles, get24hChange } from '@/bot/services/binance';
import * as fx from '@/bot/services/binanceFutures';
import { calculateIndicators, detectSignal } from '@/bot/services/indicators';
import { getSentiment } from '@/bot/services/sentiment';
import { runChecklist, checklistIndicators } from '@/bot/engine/checklist';
import { spotEnabled, futuresConfig, futuresView } from '@/lib/marketSettings';

export const dynamic = 'force-dynamic';

const isOpening = (t) => (t.market === 'futures'
  ? (t.side === 'BUY') === ((t.positionSide || 'LONG') === 'LONG')
  : t.side === 'BUY');

/**
 * GET ?symbol=&market=spot|futures
 * Everything the chart overlays need for the signed-in user:
 *   trades     – the user's entries/exits on this symbol (current account mode)
 *   positions  – open positions with entry / SL / TP / liquidation
 *   bot        – what the bot sees right now: signal, EMAs, 10-point checklist, AI sentiment
 *   futures    – mark price, funding rate + next funding time, open interest
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select('_id tradingAccount');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const sp = new URL(req.url).searchParams;
  const symbol = (sp.get('symbol') || 'BTCUSDT').toUpperCase();
  const futures = sp.get('market') === 'futures';
  if (!/^[A-Z0-9]{2,20}$/.test(symbol)) return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });

  const marketFilter = futures ? { market: 'futures' } : { market: { $ne: 'futures' } };
  const raw = (await BotSettings.findOne({ userId: user._id }).lean()) || {};
  // Bot view uses the config of the market being charted (Spot and Futures are separate).
  const settings = futures ? futuresView(raw) : raw;
  const marketOn = futures ? futuresConfig(raw).enabled : spotEnabled(raw);

  const tradeDocs = await Trade.find({ userId: user._id, symbol, ...marketFilter, ...tradeScope(user) })
    .sort({ createdAt: -1 }).limit(150)
    .select('side positionSide market leverage price qty profit status source stopLoss takeProfit liquidationPrice createdAt closedAt reason margin')
    .lean();
  const opening = tradeDocs.filter(isOpening);
  const trades = opening.map(t => ({
    id: t._id, side: t.market === 'futures' ? (t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT')) : 'BUY',
    price: t.price, qty: t.qty, leverage: t.leverage, source: t.source, status: t.status,
    openedAt: t.createdAt, closedAt: t.closedAt, profit: t.profit,
    exitReason: t.reason?.includes('EXIT:') ? t.reason.split('EXIT:').pop().trim() : null,
  }));
  const positions = opening.filter(t => t.status === 'open').map(t => ({
    id: t._id, side: t.market === 'futures' ? (t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT')) : 'BUY',
    entry: t.price, qty: t.qty, margin: t.margin, leverage: t.leverage,
    stopLoss: t.stopLoss, takeProfit: t.takeProfit, liquidationPrice: t.liquidationPrice, source: t.source,
  }));

  // What the bot sees, on the bot's own timeframe.
  let bot = null;
  try {
    const tf = settings.timeframe || '5m';
    const load = futures ? fx.getFuturesCandles : getCandles;
    const [candles, h1, btcH1, btc24h] = await Promise.all([
      load(symbol, tf, 120),
      load(symbol, '1h', 220).catch(() => []),
      symbol === 'BTCUSDT' ? Promise.resolve(null) : load('BTCUSDT', '1h', 220).catch(() => null),
      futures ? fx.getFutures24hChange('BTCUSDT') : get24hChange('BTCUSDT'),
    ]);
    if (candles.length >= 100) {
      const ind = calculateIndicators(candles);
      const signal = detectSignal(ind, !!settings.aggressiveMode, settings.respectMacroInAggressive !== false);
      const direction = signal === 'SELL' && futures ? 'SHORT' : 'LONG';
      const sentiment = await getSentiment(symbol, ind).catch(() => null);
      const checklist = runChecklist({
        direction, signal, ind: checklistIndicators(candles),
        h1Closes: h1.map(c => c.close), btcH1Closes: btcH1 ? btcH1.map(c => c.close) : null, btc24h,
        takeProfitPercent: settings.takeProfitPercent ?? 4,
        sentiment: settings.useGroqFilter !== false ? sentiment : null,
        minPass: settings.checklistMinPass ?? 10,
      });
      bot = {
        timeframe: tf, signal, direction, rsi: ind.rsi,
        ema20: ind.ema20, ema50: ind.ema50, ema100: ind.ema100,
        uptrend: ind.uptrend, macroUptrend: ind.macroUptrend,
        checklistOn: settings.entryChecklist === true, minPass: settings.checklistMinPass ?? 10,
        checklist: checklist.checks, passed: checklist.passed, total: checklist.total, wouldTrade: checklist.ok && signal !== 'HOLD',
        sentiment: sentiment ? { sentiment: sentiment.sentiment, confidence: sentiment.confidence, reason: sentiment.reason } : null,
        aggressive: !!settings.aggressiveMode, marketOn,
      };
    }
  } catch (e) {
    bot = { error: e.message };
  }

  let fut = null;
  if (futures) {
    try {
      const [{ data: pi }, { data: oi }] = await Promise.all([
        axios.get('https://fapi.binance.com/fapi/v1/premiumIndex', { params: { symbol }, timeout: 10000 }),
        axios.get('https://fapi.binance.com/fapi/v1/openInterest', { params: { symbol }, timeout: 10000 }),
      ]);
      const mark = parseFloat(pi.markPrice);
      fut = {
        markPrice: mark, indexPrice: parseFloat(pi.indexPrice),
        fundingRate: parseFloat(pi.lastFundingRate), nextFundingTime: pi.nextFundingTime,
        openInterest: parseFloat(oi.openInterest), openInterestUsd: parseFloat(oi.openInterest) * mark,
      };
    } catch (e) {
      fut = { error: e.response?.status === 400 ? `${symbol} is not a USDⓈ-M perpetual` : e.message };
    }
  }

  return NextResponse.json({ symbol, market: futures ? 'futures' : 'spot', mode: user.tradingAccount || 'live', trades, positions, bot, futures: fut });
}
