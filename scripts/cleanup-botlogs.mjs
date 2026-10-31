/**
 * Frees space on the Atlas free tier by trimming bot logs.
 *
 * The TTL index was already correct (7 days) — the problem is volume:
 * ~290k logs/day means 7 days of retention alone exceeds the 512 MB cap,
 * which blocks ALL writes cluster-wide (trades included).
 *
 * Run:  node --env-file=.env.local scripts/cleanup-botlogs.mjs [--apply] [--days N]
 */
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const di = process.argv.indexOf('--days');
const DAYS = di !== -1 ? Number(process.argv[di + 1]) : 2;

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const col = db.collection('botlogs');

const before = await db.stats();
console.log(`before: ${((before.dataSize + before.indexSize) / 1048576).toFixed(1)} MB used`);

const cutoff = new Date(Date.now() - DAYS * 86400000);
const doomed = await col.countDocuments({ createdAt: { $lt: cutoff } });
const keep = await col.countDocuments({ createdAt: { $gte: cutoff } });

console.log(`cutoff: ${cutoff.toISOString()} (keep last ${DAYS}d)`);
console.log(`  delete: ${doomed}`);
console.log(`  keep  : ${keep}`);

if (!APPLY) {
  console.log('\ndry run — pass --apply to execute');
  await mongoose.disconnect();
  process.exit(0);
}

// Delete in batches so the oplog and a shared-tier cluster can keep up.
let removed = 0;
while (true) {
  const batch = await col.find({ createdAt: { $lt: cutoff } }).limit(5000).project({ _id: 1 }).toArray();
  if (!batch.length) break;
  const r = await col.deleteMany({ _id: { $in: batch.map((d) => d._id) } });
  removed += r.deletedCount;
  process.stdout.write(`\r  deleted ${removed}/${doomed}`);
}
console.log('');

// Tighten retention so this cannot recur.
const TTL_DAYS = 2;
try {
  await col.dropIndex('createdAt_1');
  console.log('dropped old 7d TTL index');
} catch (e) {
  console.log('drop index:', e.message);
}
await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 86400, name: 'createdAt_1' });
console.log(`created TTL index: ${TTL_DAYS} days`);

const after = await db.stats();
console.log(`after:  ${((after.dataSize + after.indexSize) / 1048576).toFixed(1)} MB used`);
console.log('(Atlas reclaims disk gradually; logical size drops immediately)');

await mongoose.disconnect();
process.exit(0);
