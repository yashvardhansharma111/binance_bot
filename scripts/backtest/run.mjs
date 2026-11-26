#!/usr/bin/env node
// Backtest: current RSI bot vs 4h trend following (spot + futures) vs buy & hold.
//
//   node scripts/backtest/run.mjs                       # 730 days, 6 majors
//   node scripts/backtest/run.mjs --days 365 --symbols BTCUSDT,ETHUSDT --no-rsi
//
// Data comes from Binance public endpoints and is cached in .cache/backtest.
// Results are NOT a promise of future returns.
import fs from 'fs';
import path from 'path';
import { loadCandles, loadFunding, MS } from './data.mjs';
import { simulateRsiBot, simulateTrend, buyAndHold, metrics } from './strategies.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DAYS    = parseInt(arg('days', '730'), 10);
const SYMBOLS = arg('symbols', 'BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,DOGEUSDT,BNBUSDT').split(',');
const RUN_RSI = !process.argv.includes('--no-rsi');

const DAY = 86_400_000;
const end   = Math.floor(Date.now() / DAY) * DAY;          // today 00:00 UTC
const start = end - DAYS * DAY;
const warm4h = start - 40 * DAY;                             // EMA200 on 4h needs ~34 days
const warm5m = start - 2 * DAY;                              // 24h change + 120-bar window

const fmt  = (n, d = 2) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct  = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${fmt(n, 1)}%`);
const iso  = (t) => new Date(t).toISOString().slice(0, 10);

console.log(`\nBacktest ${iso(start)} → ${iso(end)} (${DAYS} days) | ${SYMBOLS.join(', ')}\n`);

const s4h = {}, s5m = {}, funding = {};
for (const sym of SYMBOLS) {
  process.stdout.write(`  loading ${sym} 4h…`);
  s4h[sym] = await loadCandles(sym, '4h', warm4h, end);
  funding[sym] = await loadFunding(sym, start, end);
  process.stdout.write(` ${s4h[sym].length} bars, ${funding[sym].length} funding`);
  if (RUN_RSI) {
    s5m[sym] = await loadCandles(sym, '5m', warm5m, end, n => process.stdout.write(`\r  loading ${sym} 5m… ${n} bars        `));
    process.stdout.write(`\r  loaded ${sym}: 4h ${s4h[sym].length}, 5m ${s5m[sym].length}, funding ${funding[sym].length}        `);
  }
  process.stdout.write('\n');
}

const inWindow = (series) => Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.filter(c => c.t >= start)]));

const results = [];
const t0 = Date.now();
if (RUN_RSI) {
  process.stdout.write('\n  simulating current RSI bot (5m)… ');
  const r = simulateRsiBot(s5m, SYMBOLS);
  r.equity = r.equity.filter(e => e.t >= start);
  r.trades = r.trades.filter(t => t.entryT >= start);
  results.push(r);
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
results.push(simulateTrend(s4h, SYMBOLS, funding, { mode: 'spot', tradeFrom: start }));
results.push(simulateTrend(s4h, SYMBOLS, funding, { mode: 'futures', tradeFrom: start }));
results.push(buyAndHold(inWindow(s4h), SYMBOLS));

const M = results.map(metrics);

const rows = [
  ['Final equity ($10k start)', m => `$${fmt(m.finalEquity, 0)}`],
  ['Total return',              m => pct(m.returnPct)],
  ['Yearly (CAGR)',             m => pct(m.cagrPct)],
  ['Max drawdown',              m => `-${fmt(m.maxDrawdownPct, 1)}%`],
  ['Trades',                    m => (m.trades ? String(m.trades) : '—')],
  ['Win rate',                  m => (m.winRatePct == null ? '—' : `${fmt(m.winRatePct, 1)}%`)],
  ['Profit factor',             m => (m.profitFactor == null ? '—' : fmt(m.profitFactor, 2))],
  ['Avg win / avg loss',        m => (m.avgWin == null ? '—' : `$${fmt(m.avgWin)} / $${fmt(m.avgLoss)}`)],
  ['Fees paid',                 m => `$${fmt(m.fees, 0)}`],
  ['Funding paid',              m => (m.funding ? `$${fmt(m.funding, 0)}` : '—')],
  ['Open at end',               m => String(m.openAtEnd)],
];
const w0 = 28, w = 30;
console.log('\n' + ''.padEnd(w0) + M.map(m => m.name.slice(0, w - 2).padEnd(w)).join(''));
for (const [label, f] of rows) console.log(label.padEnd(w0) + M.map(m => f(m).padEnd(w)).join(''));

for (const m of M.filter(m => m.trades)) {
  console.log(`\n${m.name} — P&L by symbol: ` + Object.entries(m.bySymbol).map(([s, v]) => `${s.replace('USDT', '')} ${v >= 0 ? '+' : ''}$${fmt(v, 0)}`).join(' | '));
  console.log(`${' '.repeat(m.name.length)} — P&L by year:   ` + Object.entries(m.byYear).map(([y, v]) => `${y} ${v >= 0 ? '+' : ''}$${fmt(v, 0)}`).join(' | '));
}

const out = path.resolve('.cache/backtest', `report-${iso(end)}-${DAYS}d.json`);
fs.writeFileSync(out, JSON.stringify({ start: iso(start), end: iso(end), symbols: SYMBOLS, metrics: M,
  trades: Object.fromEntries(results.map(r => [r.name, r.trades])) }, null, 1));
console.log(`\nFull report (with every trade): ${out}\n`);
