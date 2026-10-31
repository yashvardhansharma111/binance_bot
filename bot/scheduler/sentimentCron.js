import cron from 'node-cron';
import User from '../../lib/models/User.js';
import BotSettings from '../../lib/models/BotSettings.js';
import Trade from '../../lib/models/Trade.js';
import MarketSentiment from '../../lib/models/MarketSentiment.js';
import { refreshSentiment } from '../services/sentiment.js';

/**
 * Refreshes market sentiment once per SYMBOL on a schedule.
 *
 * The trading cron used to ask Groq per user per symbol — roughly 245 calls
 * every 5 minutes across the user base, which the free tier rejects with 429.
 * Sentiment does not differ by user, so it is computed here and cached.
 *
 * Calls are spaced out to stay under the per-minute quota.
 */

/* Budget, measured from Groq's own rate-limit headers on the free tier:
     x-ratelimit-limit-requests: 1000   per day
     x-ratelimit-limit-tokens:   8000   per minute
   At 48 runs/day (every 30 min), 15 symbols costs 720 requests/day — under the
   1000 ceiling with headroom for manual refreshes. A 4s gap keeps each run far
   below the per-minute token ceiling (~320 tokens per call). */
const GAP_MS = 4000;
const MAX_SYMBOLS = 15;

let running = false;

/**
 * Symbols worth spending budget on, most important first:
 * open positions, then whatever the most users are trading.
 */
async function activeSymbols() {
  const users = await User.find({ botActive: true, status: 'active' }).select('_id').lean();
  const ids = users.map((u) => u._id);

  const score = new Map();
  const bump = (sym, n) => {
    if (!sym) return;
    const k = sym.toUpperCase();
    score.set(k, (score.get(k) || 0) + n);
  };

  // Open positions carry the most risk — always refresh these first.
  const open = await Trade.find({ status: 'open' }).select('symbol').lean();
  open.forEach((t) => bump(t.symbol, 100));

  if (ids.length) {
    const settings = await BotSettings.find({ userId: { $in: ids } }).select('symbol symbols').lean();
    for (const s of settings) {
      if (Array.isArray(s.symbols) && s.symbols.length) s.symbols.forEach((x) => bump(x, 1));
      else bump(s.symbol || 'BTCUSDT', 1);
    }
  }

  return Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SYMBOLS)
    .map(([sym]) => sym);
}

async function tick() {
  if (running) {
    console.log('[Sentiment] Previous refresh still running — skipping');
    return;
  }
  running = true;
  const start = Date.now();

  try {
    const symbols = await activeSymbols();
    if (!symbols.length) {
      console.log('[Sentiment] No active symbols');
      return;
    }

    console.log(`[Sentiment] Refreshing ${symbols.length} symbol(s)…`);

    let ok = 0;
    let failed = 0;

    for (const sym of symbols) {
      try {
        const r = await refreshSentiment(sym);
        if (r.source === 'groq') {
          ok++;
          console.log(`[Sentiment] ${sym}: ${r.sentiment} ${r.confidence}% — ${r.reason}`);
        } else {
          failed++;
          console.warn(`[Sentiment] ${sym}: ${r.reason}`);
        }
      } catch (err) {
        failed++;
        console.warn(`[Sentiment] ${sym} threw: ${err.message}`);
      }
      // Spacing is what keeps the free tier happy.
      await new Promise((r) => setTimeout(r, GAP_MS));
    }

    console.log(
      `[Sentiment] Done in ${((Date.now() - start) / 1000).toFixed(1)}s — ${ok} ok, ${failed} failed`
    );
  } catch (err) {
    console.error('[Sentiment] Fatal error:', err.message);
  } finally {
    running = false;
  }
}

export function startSentimentScheduler() {
  // Every 30 minutes — sentiment moves far slower than price, and this fits
  // the 1000 requests/day free-tier ceiling (48 runs x 15 symbols = 720/day).
  cron.schedule('*/30 * * * *', tick, { timezone: 'UTC' });
  console.log('[Sentiment] Scheduler started — every 30 minutes (15 symbols max)');

  // Warm the cache shortly after boot so the first trading tick has data.
  setTimeout(tick, 8000);
}

export { tick as refreshAllSentiment };
