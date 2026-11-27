#!/usr/bin/env node
// Backtest the 10-point pre-trade checklist on the current RSI bot.
//   node scripts/backtest/checklist.mjs --min 10        # one variant per process (run several in parallel)
// Uses the cached 2-year 5m data written by run.mjs.
import fs from 'fs';
import path from 'path';
import { loadCandles } from './data.mjs';
import { simulateRsiBot, metrics } from './strategies.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MIN = parseInt(arg('min', '10'), 10);
const DAYS = parseInt(arg('days', '730'), 10);
const SYMBOLS = arg('symbols', 'BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,DOGEUSDT,BNBUSDT').split(',');
const DAY = 86_400_000;
const end = Math.floor(Date.now() / DAY) * DAY, start = end - DAYS * DAY;

const s5m = {};
for (const sym of SYMBOLS) s5m[sym] = await loadCandles(sym, '5m', start - 2 * DAY, end);
const r = simulateRsiBot(s5m, SYMBOLS, { checklistMinPass: MIN });
r.equity = r.equity.filter(e => e.t >= start);
r.trades = r.trades.filter(t => t.entryT >= start);
const m = metrics(r);
const out = path.resolve('.cache/backtest', `checklist-${MIN}-${DAYS}d.json`);
fs.writeFileSync(out, JSON.stringify({ metrics: m, trades: r.trades }, null, 1));
const gross = r.trades.reduce((s, t) => s + (t.exit - t.entry) * t.qty, 0);
console.log(JSON.stringify({ variant: m.name, return: m.returnPct.toFixed(2) + '%', trades: m.trades, winRate: m.winRatePct?.toFixed(1),
  profitFactor: m.profitFactor?.toFixed(2), net: (m.finalEquity - 10000).toFixed(2), grossBeforeFees: gross.toFixed(2), fees: m.fees.toFixed(2),
  maxDD: m.maxDrawdownPct.toFixed(2) + '%', bySymbol: Object.fromEntries(Object.entries(m.bySymbol).map(([k, v]) => [k, +v.toFixed(1)])) }));
