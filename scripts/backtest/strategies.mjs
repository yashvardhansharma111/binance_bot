// Strategy simulators for the backtester.
//
// simulateRsiBot — the CURRENT live bot (normal mode, default settings), using the
//   bot's own calculateIndicators/detectSignal/checkMacroTrend on the same
//   120-candle window it sees each 5-minute tick. Groq sentiment cannot be
//   replayed and is treated as "off".
// simulateTrend  — 4h Donchian breakout + EMA50/200 trend filter, ATR stop,
//   ATR chandelier trailing stop, 1% equity risk per trade. Spot = long only,
//   futures = long + short with funding.
import { calculateIndicators, detectSignal, checkMacroTrend } from '../../bot/services/indicators.js';
import { aggregate, MS } from './data.mjs';
import { runChecklist, checklistIndicators } from '../../bot/engine/checklist.js';

const DAY = 86_400_000;

/* ═════════════════════════ current RSI bot ═════════════════════════ */

export const RSI_DEFAULTS = {
  tradeUSDT: 50, stopLossPercent: 2, takeProfitPercent: 4,
  cooldownMinutes: 15, maxDailyTrades: 10, maxConcurrentTrades: 3,
  minEntryGapPct: 1.5, maxPositionsPerSymbol: 5,
  legacySymbol: 'BTCUSDT',       // settings.symbol — canTrade() counts open trades on THIS symbol only
  fee: 0.001,                    // Binance spot taker 0.1% per side
  startEquity: 10_000,
  checklistMinPass: 0,           // 0 = off; otherwise require this many of the 10 pre-trade checks
};

export function simulateRsiBot(series, symbols, o = {}) {
  o = { ...RSI_DEFAULTS, ...o };
  const S = {};
  for (const sym of symbols) {
    const c = series[sym];
    const idx = new Map(c.map((x, i) => [x.t, i]));
    const hours = aggregate(c, MS['1h']);
    const hourIdx = new Map(hours.map((h, i) => [h.t, i]));
    S[sym] = { c, idx, hours, hourIdx };
  }
  const timeline = [...new Set(symbols.flatMap(s => series[s].map(x => x.t)))].sort((a, b) => a - b);

  const open = Object.fromEntries(symbols.map(s => [s, []]));
  const lastCloses = Object.fromEntries(symbols.map(s => [s, []]));   // pre-fee profit of closed trades, for the loss-streak guard
  const trades = [];
  const equity = [];
  let realized = 0, fees = 0, lastTradeAt = null, dailyDate = null, dailyCount = 0;

  const recordTrade = (t) => {
    const d = new Date(t).toISOString().slice(0, 10);
    if (dailyDate !== d) { dailyDate = d; dailyCount = 0; }
    dailyCount++; lastTradeAt = t;
  };
  const closeTrade = (sym, pos, price, t, reason) => {
    const gross = (price - pos.entry) * pos.qty;
    const fee = price * pos.qty * o.fee;
    fees += fee; realized += gross - fee;
    trades.push({ symbol: sym, side: 'LONG', entryT: pos.t, exitT: t, entry: pos.entry, exit: price, qty: pos.qty,
      pnl: gross - pos.entryFee - fee, fees: pos.entryFee + fee, reason });
    lastCloses[sym].push({ profit: gross, t });
    open[sym] = open[sym].filter(p => p !== pos);
    recordTrade(t);
  };
  const indAt = (sym, i) => calculateIndicators(S[sym].c.slice(i - 119, i + 1));

  for (const t of timeline) {
    const at = {};
    for (const sym of symbols) { const i = S[sym].idx.get(t); if (i !== undefined) at[sym] = i; }

    // 1. exits — SL / TP at the tick price (the bot checks every 5 minutes, no exchange-side orders)
    for (const sym of symbols) {
      if (at[sym] === undefined) continue;
      const price = S[sym].c[at[sym]].close;
      for (const pos of [...open[sym]]) {
        if (price <= pos.sl) closeTrade(sym, pos, price, t, 'Stop-loss');
        else if (price >= pos.tp) closeTrade(sym, pos, price, t, 'Take-profit');
      }
    }

    // 2. entries, symbol by symbol (shared cooldown / daily limit, like one user's tick)
    for (const sym of symbols) {
      const i = at[sym];
      if (i === undefined || i < 288 + 120) continue;
      const { c } = S[sym];
      const price = c[i].close;
      const mine = open[sym];

      if (mine.length >= o.maxConcurrentTrades) {
        const sig = detectSignal(indAt(sym, i), false, true);
        if (sig === 'SELL') for (const pos of [...mine]) if (t - pos.t >= 15 * 60_000) closeTrade(sym, pos, price, t, 'SELL signal');
        continue;
      }

      const change24h = ((price - c[i - 287].open) / c[i - 287].open) * 100;
      if (change24h < -2) continue;

      const hb = Math.floor(t / MS['1h']) * MS['1h'];
      const hi = S[sym].hourIdx.get(hb);
      if (hi !== undefined && hi >= 59) {
        const closes = S[sym].hours.slice(hi - 59, hi).map(h => ({ close: h.close }));
        closes.push({ close: price });
        if (!checkMacroTrend(closes)) continue;
      }

      const lc = lastCloses[sym];
      if (lc.length >= 2 && lc.at(-1).profit < 0 && lc.at(-2).profit < 0 && t - lc.at(-1).t < 6 * 3_600_000) continue;

      if (mine.length > 0) {
        if (mine.length >= o.maxPositionsPerSymbol) continue;
        const lowest = Math.min(...mine.map(p => p.entry));
        if (((lowest - price) / lowest) * 100 < o.minEntryGapPct) continue;
      }

      const sig = detectSignal(indAt(sym, i), false, true);
      if (sig !== 'BUY') continue;

      if (o.checklistMinPass > 0) {
        const hb2 = Math.floor(t / MS['1h']) * MS['1h'];
        const h1 = (sy) => {
          const hi2 = S[sy]?.hourIdx.get(hb2);
          if (hi2 === undefined) return [];
          const px = S[sy].c[S[sy].idx.get(t)]?.close;
          return [...S[sy].hours.slice(Math.max(0, hi2 - 220), hi2).map(h => h.close), ...(px ? [px] : [])];
        };
        const btcI = S.BTCUSDT?.idx.get(t);
        const btc24h = btcI !== undefined && btcI >= 288
          ? ((S.BTCUSDT.c[btcI].close - S.BTCUSDT.c[btcI - 287].open) / S.BTCUSDT.c[btcI - 287].open) * 100 : null;
        const res = runChecklist({
          direction: 'LONG', signal: sig, ind: checklistIndicators(c.slice(i - 119, i + 1)),
          h1Closes: h1(sym), btcH1Closes: sym === 'BTCUSDT' ? null : (S.BTCUSDT ? h1('BTCUSDT') : null), btc24h,
          takeProfitPercent: o.takeProfitPercent, sentiment: null, minPass: o.checklistMinPass,
        });
        if (!res.ok) continue;
      }

      // canTrade()
      if (lastTradeAt !== null && t - lastTradeAt < o.cooldownMinutes * 60_000) continue;
      const d = new Date(t).toISOString().slice(0, 10);
      if (dailyDate === d && dailyCount >= o.maxDailyTrades) continue;
      if ((open[o.legacySymbol]?.length || 0) >= o.maxConcurrentTrades) continue;

      const qty = o.tradeUSDT / price;
      const entryFee = o.tradeUSDT * o.fee;
      fees += entryFee; realized -= entryFee;
      mine.push({ entry: price, qty, t, entryFee,
        sl: price * (1 - o.stopLossPercent / 100), tp: price * (1 + o.takeProfitPercent / 100) });
      recordTrade(t);
    }

    if (t % MS['1h'] === 0) {
      let unreal = 0;
      for (const sym of symbols) if (at[sym] !== undefined) for (const p of open[sym]) unreal += (S[sym].c[at[sym]].close - p.entry) * p.qty;
      equity.push({ t, equity: o.startEquity + realized + unreal });
    }
  }

  const openAtEnd = symbols.reduce((n, s) => n + open[s].length, 0);
  return { name: o.checklistMinPass ? `RSI bot + checklist ${o.checklistMinPass}/10` : 'RSI bot (current, 5m spot)', trades, equity, fees, funding: 0, openAtEnd, startEquity: o.startEquity };
}

/* ═════════════════════════ trend following ═════════════════════════ */

export const TREND_DEFAULTS = {
  mode: 'spot',            // 'spot' (long only) | 'futures' (long + short)
  riskPct: 1, atrStop: 2, atrTrail: 3, donchian: 20, emaFast: 50, emaSlow: 200, atrPeriod: 14,
  maxPositions: 4, maxLeverage: 3,
  tradeFrom: 0,            // no signals / equity before this time (indicator warm-up)
  spotFee: 0.001, futuresFee: 0.0005, slippage: 0.0005,
  startEquity: 10_000,
};

function ema(values, p) {
  const k = 2 / (p + 1); const out = new Array(values.length).fill(null);
  let e = null;
  for (let i = 0; i < values.length; i++) {
    if (i === p - 1) e = values.slice(0, p).reduce((a, b) => a + b, 0) / p;
    else if (i >= p) e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
function atr(c, p) {
  const out = new Array(c.length).fill(null);
  let a = null;
  for (let i = 1; i < c.length; i++) {
    const tr = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close));
    if (i < p) { a = (a ?? 0) + tr; if (i === p - 1) a /= p; continue; }
    a = (a * (p - 1) + tr) / p;
    out[i] = a;
  }
  return out;
}

export function simulateTrend(series4h, symbols, funding = {}, o = {}) {
  o = { ...TREND_DEFAULTS, ...o };
  const futures = o.mode === 'futures';
  const fee = futures ? o.futuresFee : o.spotFee;
  const S = {};
  for (const sym of symbols) {
    const c = series4h[sym];
    const closes = c.map(x => x.close);
    const dh = c.map((_, i) => (i < o.donchian ? null : Math.max(...c.slice(i - o.donchian, i).map(x => x.high))));
    const dl = c.map((_, i) => (i < o.donchian ? null : Math.min(...c.slice(i - o.donchian, i).map(x => x.low))));
    S[sym] = { c, idx: new Map(c.map((x, i) => [x.t, i])), ef: ema(closes, o.emaFast), es: ema(closes, o.emaSlow), atr: atr(c, o.atrPeriod), dh, dl,
      fund: (funding[sym] || []).slice().sort((a, b) => a.t - b.t), fi: 0 };
  }
  const timeline = [...new Set(symbols.flatMap(s => series4h[s].map(x => x.t)))].sort((a, b) => a - b);

  const pos = {};            // sym → position
  const pending = {};        // sym → 'LONG' | 'SHORT' (enter at next open)
  const lastPx = {};
  const trades = []; const equity = [];
  let cash = o.startEquity;  // spot: real cash. futures: realised equity (margin not modelled separately)
  let fees = 0, fundingPaid = 0;

  const markEquity = () => {
    let v = cash;
    for (const [sym, p] of Object.entries(pos)) {
      const px = lastPx[sym];
      v += futures ? (p.dir === 'LONG' ? px - p.entry : p.entry - px) * p.qty : px * p.qty;
    }
    return v;
  };
  const exit = (sym, p, rawPx, t, reason) => {
    const px = p.dir === 'LONG' ? rawPx * (1 - o.slippage) : rawPx * (1 + o.slippage);
    const f = px * p.qty * fee; fees += f;
    const gross = (p.dir === 'LONG' ? px - p.entry : p.entry - px) * p.qty;
    cash += futures ? gross - f : px * p.qty - f;
    trades.push({ symbol: sym, side: p.dir, entryT: p.t, exitT: t, entry: p.entry, exit: px, qty: p.qty,
      pnl: gross - p.entryFee - f - p.funding, fees: p.entryFee + f, funding: p.funding, reason });
    delete pos[sym];
  };

  for (const t of timeline) {
    // 1. pending entries at this bar's open
    for (const sym of symbols) {
      const i = S[sym].idx.get(t);
      if (i === undefined || !pending[sym]) continue;
      const dir = pending[sym]; delete pending[sym];
      if (pos[sym] || Object.keys(pos).length >= o.maxPositions) continue;
      const a = S[sym].atr[i - 1]; if (!a) continue;
      const raw = S[sym].c[i].open;
      const entry = dir === 'LONG' ? raw * (1 + o.slippage) : raw * (1 - o.slippage);
      const stop = dir === 'LONG' ? entry - o.atrStop * a : entry + o.atrStop * a;
      const eq = markEquity();
      let qty = (eq * o.riskPct / 100) / Math.abs(entry - stop);
      if (futures) {
        const used = Object.values(pos).reduce((s, p) => s + p.qty * lastPx[p.sym], 0);
        qty = Math.min(qty, Math.max(0, eq * o.maxLeverage - used) / entry);
      } else {
        qty = Math.min(qty, (cash * 0.998) / entry);
      }
      if (qty * entry < 10) continue;
      const f = qty * entry * fee; fees += f;
      cash -= futures ? f : qty * entry + f;
      pos[sym] = { sym, dir, entry, qty, stop, t, best: dir === 'LONG' ? S[sym].c[i].high : S[sym].c[i].low, entryFee: f, funding: 0 };
    }

    // 2. stops (intrabar, exchange-side), 3. funding, 4. trail update
    for (const sym of symbols) {
      const i = S[sym].idx.get(t);
      if (i === undefined) continue;
      const bar = S[sym].c[i];
      lastPx[sym] = bar.close;
      const p = pos[sym];
      if (p) {
        if (p.dir === 'LONG' && bar.low <= p.stop) exit(sym, p, Math.min(bar.open, p.stop), t, 'Stop');
        else if (p.dir === 'SHORT' && bar.high >= p.stop) exit(sym, p, Math.max(bar.open, p.stop), t, 'Stop');
      }
      const q = pos[sym];
      if (futures) {
        const F = S[sym].fund;
        while (S[sym].fi < F.length && F[S[sym].fi].t <= t + MS['4h']) {
          const f = F[S[sym].fi++];
          if (q && f.t > t) {
            const pay = q.qty * bar.close * f.rate * (q.dir === 'LONG' ? 1 : -1);
            q.funding += pay; fundingPaid += pay; cash -= pay;
          }
        }
      }
      if (q) {
        const a = S[sym].atr[i];
        if (q.dir === 'LONG') { q.best = Math.max(q.best, bar.high); q.stop = Math.max(q.stop, q.best - o.atrTrail * a); }
        else { q.best = Math.min(q.best, bar.low); q.stop = Math.min(q.stop, q.best + o.atrTrail * a); }
      }

      // 5. signal on this close → enter next bar
      const { ef, es, dh, dl } = S[sym];
      if (t >= o.tradeFrom && !pos[sym] && ef[i] != null && es[i] != null && dh[i] != null) {
        if (bar.close > dh[i] && ef[i] > es[i]) pending[sym] = 'LONG';
        else if (futures && bar.close < dl[i] && ef[i] < es[i]) pending[sym] = 'SHORT';
      }
    }
    if (t >= o.tradeFrom) equity.push({ t, equity: markEquity() });
  }

  return {
    name: futures ? 'Trend 4h — futures long+short' : 'Trend 4h — spot long only',
    trades, equity, fees, funding: fundingPaid, openAtEnd: Object.keys(pos).length, startEquity: o.startEquity,
  };
}

/* ═════════════════════════ benchmark + metrics ═════════════════════════ */

export function buyAndHold(series4h, symbols, startEquity = 10_000, fee = 0.001) {
  const per = startEquity / symbols.length;
  const holdings = symbols.map(s => ({ s, qty: (per * (1 - fee)) / series4h[s][0].close }));
  const timeline = [...new Set(symbols.flatMap(s => series4h[s].map(x => x.t)))].sort((a, b) => a - b);
  const idx = Object.fromEntries(symbols.map(s => [s, new Map(series4h[s].map(x => [x.t, x.close]))]));
  const last = {};
  const equity = timeline.map(t => {
    for (const s of symbols) { const px = idx[s].get(t); if (px) last[s] = px; }
    return { t, equity: holdings.reduce((v, h) => v + h.qty * (last[h.s] || 0), 0) };
  });
  return { name: 'Buy & hold (equal weight)', trades: [], equity, fees: startEquity * fee, funding: 0, openAtEnd: symbols.length, startEquity };
}

export function metrics(r) {
  const eq = r.equity;
  const start = r.startEquity, end = eq.at(-1)?.equity ?? start;
  let peak = start, maxDD = 0;
  for (const e of eq) { peak = Math.max(peak, e.equity); maxDD = Math.max(maxDD, (peak - e.equity) / peak); }
  const years = (eq.at(-1).t - eq[0].t) / (365 * DAY);
  const wins = r.trades.filter(t => t.pnl > 0), losses = r.trades.filter(t => t.pnl <= 0);
  const gw = wins.reduce((s, t) => s + t.pnl, 0), gl = -losses.reduce((s, t) => s + t.pnl, 0);
  const bySym = {};
  for (const t of r.trades) bySym[t.symbol] = (bySym[t.symbol] || 0) + t.pnl;
  const byYear = {};
  for (const t of r.trades) { const y = new Date(t.exitT).getUTCFullYear(); byYear[y] = (byYear[y] || 0) + t.pnl; }
  return {
    name: r.name,
    finalEquity: end,
    returnPct: ((end - start) / start) * 100,
    cagrPct: (Math.pow(end / start, 1 / years) - 1) * 100,
    maxDrawdownPct: maxDD * 100,
    trades: r.trades.length,
    winRatePct: r.trades.length ? (wins.length / r.trades.length) * 100 : null,
    profitFactor: gl > 0 ? gw / gl : null,
    avgWin: wins.length ? gw / wins.length : null,
    avgLoss: losses.length ? -gl / losses.length : null,
    fees: r.fees, funding: r.funding, openAtEnd: r.openAtEnd,
    bySymbol: bySym, byYear,
  };
}
