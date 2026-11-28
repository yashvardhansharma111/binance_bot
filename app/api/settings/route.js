import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import BotSettings from '@/lib/models/BotSettings';
import User from '@/lib/models/User';
import { maxFuturesStopLoss, MAX_FUTURES_LEVERAGE } from '@/bot/services/binanceFutures';
import { spotEnabled, futuresConfig, TIMEFRAMES, riskRewardError } from '@/lib/marketSettings';

/** Settings JSON with the split config resolved, so the UI always gets spotEnabled + a full futures object. */
function present(doc) {
  const s = doc.toObject ? doc.toObject() : doc;
  return { ...s, spotEnabled: spotEnabled(s), futures: futuresConfig(s) };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  let settings = await BotSettings.findOne({ userId: user._id });
  if (!settings) settings = await BotSettings.create({ userId: user._id });
  return NextResponse.json(present(settings));
}

const bad = (error) => NextResponse.json({ error }, { status: 400 });

/** Validate + normalise the futures config. Returns { value } or { error }. */
function validateFutures(input, current) {
  const f = { ...current, ...(input || {}) };
  const num = (v) => Number(v);
  f.enabled = !!f.enabled;
  if (!Array.isArray(f.symbols)) return { error: 'Futures pairs must be a list' };
  f.symbols = [...new Set(f.symbols.map(s => String(s).trim().toUpperCase()).filter(s => /^[A-Z0-9]{2,20}$/.test(s)))].slice(0, 10);
  if (f.enabled && !f.symbols.length) return { error: 'Add at least one futures pair, or switch futures off' };
  if (!TIMEFRAMES.includes(f.timeframe)) return { error: 'Futures timeframe is not valid' };
  f.tradeUSDT = num(f.tradeUSDT);
  if (!(f.tradeUSDT >= 5 && f.tradeUSDT <= 100000)) return { error: 'Futures margin per trade must be $5–$100,000' };
  f.leverage = num(f.leverage);
  if (!Number.isInteger(f.leverage) || f.leverage < 1 || f.leverage > MAX_FUTURES_LEVERAGE)
    return { error: `Futures leverage must be a whole number 1–${MAX_FUTURES_LEVERAGE}` };
  f.allowShort = !!f.allowShort;
  f.stopLossPercent = num(f.stopLossPercent);
  const maxSl = maxFuturesStopLoss(f.leverage);
  if (!(f.stopLossPercent >= 0.1 && f.stopLossPercent <= maxSl))
    return { error: `Futures at ${f.leverage}x: stop loss must be 0.1%–${maxSl}% so it triggers before liquidation. Lower the stop loss or the leverage.` };
  f.takeProfitPercent = num(f.takeProfitPercent);
  if (!(f.takeProfitPercent >= 0.1 && f.takeProfitPercent <= 100)) return { error: 'Futures take profit must be 0.1%–100%' };
  const rr = riskRewardError(f.stopLossPercent, f.takeProfitPercent, 'Futures stop loss');
  if (rr) return { error: rr };
  f.trailingStopPercent = num(f.trailingStopPercent) || 0;
  if (f.trailingStopPercent < 0 || f.trailingStopPercent > 20) return { error: 'Futures trailing stop must be 0–20%' };
  f.maxLossPercent = num(f.maxLossPercent) || 0;
  if (f.maxLossPercent < 0 || f.maxLossPercent > 100) return { error: 'Futures max loss must be 0–100%' };
  f.aggressiveMode = !!f.aggressiveMode;
  f.useGroqFilter = !!f.useGroqFilter;
  f.entryChecklist = !!f.entryChecklist;
  f.checklistMinPass = num(f.checklistMinPass);
  if (!Number.isInteger(f.checklistMinPass) || f.checklistMinPass < 6 || f.checklistMinPass > 10)
    return { error: 'Futures checklist must require 6–10 checks' };
  return { value: f };
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  // Top-level fields = the SPOT config. Futures lives in `futures`.
  const allowed = ['symbol','symbols','timeframe','tradeUSDT','stopLossPercent','takeProfitPercent',
                   'cooldownMinutes','maxDailyTrades','maxConcurrentTrades','useGroqFilter','aggressiveMode',
                   'trailingStopPercent','symbolConfigs','useStopLoss','entryChecklist','checklistMinPass','spotEnabled'];
  const update = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (update.symbols !== undefined) {
    if (!Array.isArray(update.symbols)) return bad('symbols must be an array');
    update.symbols = [...new Set(update.symbols.map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 10);
  }
  if (update.tradeUSDT !== undefined && (update.tradeUSDT < 1 || update.tradeUSDT > 100000))
    return bad('tradeUSDT must be $1–$100,000');
  if (update.maxConcurrentTrades !== undefined && (update.maxConcurrentTrades < 1 || update.maxConcurrentTrades > 10))
    return bad('maxConcurrentTrades must be 1–10');
  if (update.stopLossPercent && (update.stopLossPercent < 0.1 || update.stopLossPercent > 50))
    return bad('stopLossPercent must be 0.1–50');
  if (update.takeProfitPercent && (update.takeProfitPercent < 0.1 || update.takeProfitPercent > 100))
    return bad('takeProfitPercent must be 0.1–100');

  if (update.symbolConfigs !== undefined) {
    if (!Array.isArray(update.symbolConfigs)) return bad('symbolConfigs must be an array');
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
  if (update.spotEnabled !== undefined) update.spotEnabled = !!update.spotEnabled;
  if (update.entryChecklist !== undefined) update.entryChecklist = !!update.entryChecklist;
  if (update.checklistMinPass !== undefined) {
    const n = Number(update.checklistMinPass);
    if (!Number.isInteger(n) || n < 6 || n > 10) return bad('Checklist must require 6–10 checks');
    update.checklistMinPass = n;
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const current = (await BotSettings.findOne({ userId: user._id }).lean()) || {};

  // Spot stop loss vs take profit (incl. per-symbol overrides), unless the stop loss is switched off.
  const spotTouched = ['stopLossPercent', 'takeProfitPercent', 'symbolConfigs', 'useStopLoss'].some(k => update[k] !== undefined);
  const merged = { ...current, ...update };
  if (spotTouched && merged.useStopLoss !== false) {
    const sl = merged.stopLossPercent ?? 2, tp = merged.takeProfitPercent ?? 4;
    const err = riskRewardError(sl, tp, 'Spot stop loss');
    if (err) return bad(err);
    for (const c of merged.symbolConfigs || []) {
      const e = riskRewardError(c.stopLossPercent ?? sl, c.takeProfitPercent ?? tp, `${c.symbol} stop loss`);
      if (e) return bad(e);
    }
  }

  if (body.futures !== undefined) {
    const r = validateFutures(body.futures, futuresConfig(current));
    if (r.error) return bad(r.error);
    update.futures = r.value;
    // Freeze the spot switch the first time the split config is saved.
    if (update.spotEnabled === undefined) update.spotEnabled = spotEnabled(current);
    // The old single-config mode no longer decides anything once the split exists.
    update.tradingMode = 'spot';
  }

  const settings = await BotSettings.findOneAndUpdate(
    { userId: user._id },
    { $set: update },
    { new: true, upsert: true }
  );
  return NextResponse.json(present(settings));
}
