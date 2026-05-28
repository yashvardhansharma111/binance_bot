import cron from 'node-cron';
import User from '../../lib/models/User.js';
import { runBotForUser } from '../engine/bot.js';

let running = false;

async function tick() {
  if (running) return console.log('[Cron] Still running — skipping tick');
  running = true;

  try {
    const users = await User.find({ botActive: true, status: 'active' });
    if (!users.length) return console.log('[Cron] No active bots');

    console.log(`[Cron] Tick — ${users.length} active bot(s)`);
    for (const user of users) {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Bot tick timed out after 60s')), 60_000)
      );
      await Promise.race([runBotForUser(user), timeout]).catch(err => {
        console.error(`[Cron] Bot ${user._id} error: ${err.message}`);
      });
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    console.error('[Cron] Error:', err.message);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  cron.schedule('*/5 * * * *', tick, { timezone: 'UTC' });
  console.log('[Cron] Started — every 5 minutes');
  setTimeout(tick, 2000); // first tick shortly after boot
}
