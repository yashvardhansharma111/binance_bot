import cron from 'node-cron';
import User from '../../lib/models/User.js';
import { runBotForUser } from '../engine/bot.js';

// How many users to process simultaneously.
// Each user makes ~5-10 Binance API calls; keep this low enough to avoid rate limits.
const CONCURRENCY = 5;
const USER_TIMEOUT = 55_000; // ms per user before giving up

let running = false;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)),
  ]);
}

async function runBatch(users) {
  return Promise.all(
    users.map(user =>
      withTimeout(runBotForUser(user), USER_TIMEOUT).catch(err => {
        console.error(`[Cron] User ${user._id} error: ${err.message}`);
      })
    )
  );
}

async function tick() {
  if (running) {
    console.log('[Cron] Previous tick still running — skipping');
    return;
  }
  running = true;
  const start = Date.now();

  try {
    const users = await User.find({ botActive: true, status: 'active' });
    if (!users.length) {
      console.log('[Cron] No active bots');
      return;
    }

    console.log(`[Cron] Tick — ${users.length} user(s) in batches of ${CONCURRENCY}`);

    for (let i = 0; i < users.length; i += CONCURRENCY) {
      await runBatch(users.slice(i, i + CONCURRENCY));
    }

    console.log(`[Cron] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error('[Cron] Fatal error:', err.message);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  cron.schedule('*/5 * * * *', tick, { timezone: 'UTC' });
  console.log('[Cron] Started — every 5 minutes');
  setTimeout(tick, 2000);
}
