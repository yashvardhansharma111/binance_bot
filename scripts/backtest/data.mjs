// Historical data for the backtester — Binance public endpoints, cached on disk.
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const CACHE = path.resolve(process.cwd(), '.cache/backtest');
const SPOT  = 'https://api.binance.com/api/v3/klines';
const FUND  = 'https://fapi.binance.com/fapi/v1/fundingRate';
const MS = { '5m': 300_000, '1h': 3_600_000, '4h': 14_400_000 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });

async function get(url, params, tries = 5) {
  for (let i = 0; ; i++) {
    try { return (await axios.get(url, { params, timeout: 30000 })).data; }
    catch (e) {
      const st = e.response?.status;
      if (i >= tries || (st && st < 500 && st !== 429 && st !== 418)) throw e;
      await sleep(st === 429 || st === 418 ? 30_000 : 2000 * (i + 1));
    }
  }
}

/**
 * Closed spot candles [start, end) as { t, open, high, low, close, volume }.
 * Cached per symbol/interval/range, so re-runs are instant.
 */
export async function loadCandles(symbol, interval, start, end, onProgress) {
  const file = path.join(CACHE, `${symbol}_${interval}_${start}_${end}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).map(unpack);

  const rows = [];
  for (let from = start; from < end;) {
    const data = await get(SPOT, { symbol, interval, startTime: from, endTime: end - 1, limit: 1000 });
    if (!data.length) break;
    for (const k of data) if (k[0] < end && k[6] < end) rows.push([k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    from = data.at(-1)[0] + MS[interval];
    onProgress?.(rows.length);
    await sleep(120);
  }
  fs.writeFileSync(file, JSON.stringify(rows));
  return rows.map(unpack);
}

const unpack = ([t, open, high, low, close, volume]) => ({ t, open, high, low, close, volume });

/** Futures funding history: [{ t, rate }], cached. Empty array if the symbol has no perpetual. */
export async function loadFunding(symbol, start, end) {
  const file = path.join(CACHE, `${symbol}_funding_${start}_${end}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  try {
    for (let from = start; from < end;) {
      const data = await get(FUND, { symbol, startTime: from, endTime: end - 1, limit: 1000 });
      if (!data.length) break;
      for (const f of data) out.push({ t: f.fundingTime, rate: +f.fundingRate });
      from = data.at(-1).fundingTime + 1;
      await sleep(250);
    }
  } catch { return []; }
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

/** Aggregate lower-timeframe candles into a higher one (e.g. 5m → 1h). */
export function aggregate(candles, intervalMs) {
  const out = [];
  let cur = null;
  for (const c of candles) {
    const bucket = Math.floor(c.t / intervalMs) * intervalMs;
    if (!cur || cur.t !== bucket) {
      if (cur) out.push(cur);
      cur = { t: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export { MS };
