/**
 * TrickyX.ai Bot Runner
 * Run with: npm run bot
 *
 * This process ONLY runs the trading cron scheduler.
 * All UI/CRUD is handled by the Next.js app (npm run dev).
 * Both share the same MongoDB and .env.local.
 */
import mongoose from 'mongoose';
import { startScheduler } from './scheduler/cron.js';

async function boot() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('[Bot] MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('[Bot] Connected to MongoDB');

  startScheduler();

  console.log(`\n🤖  TrickyX Bot running`);
  console.log(`    Mode : ${process.env.DRY_RUN === 'true' ? '🟡 DRY RUN (no real orders)' : '🟢 LIVE'}`);
  console.log(`    Groq : ${process.env.GROQ_API_KEY ? '✅ enabled' : '⚠️  disabled'}\n`);
}

boot().catch(err => { console.error('[Bot] Fatal:', err); process.exit(1); });
