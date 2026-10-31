/**
 * Makes the users collection safe for wallet-only accounts.
 *
 * Mongo will not alter an existing index in place, so a legacy non-sparse
 * unique index on `email` rejects a second document with no email — which is
 * exactly what wallet signups create. This drops and recreates the affected
 * indexes as sparse.
 *
 * Run:  node --env-file=.env.local scripts/migrate-wallet-indexes.js
 *       node --env-file=.env.local scripts/migrate-wallet-indexes.js --apply
 *
 * Without --apply it only reports what it would change.
 */
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

// name -> { key, options } we want to end up with
const WANTED = {
  email:         { key: { email: 1 },         options: { unique: true, sparse: true, name: 'email_1' } },
  walletAddress: { key: { walletAddress: 1 }, options: { unique: true, sparse: true, name: 'walletAddress_1' } },
  referralCode:  { key: { referralCode: 1 },  options: { unique: true, sparse: true, name: 'referralCode_1' } },
};

function describe(ix) {
  const bits = [];
  if (ix.unique) bits.push('unique');
  if (ix.sparse) bits.push('sparse');
  return bits.length ? bits.join('+') : 'plain';
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Run with: node --env-file=.env.local scripts/migrate-wallet-indexes.js');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('users');
  console.log(`connected: ${mongoose.connection.name}\nmode: ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to execute)'}\n`);

  const existing = await col.indexes();
  console.log('current indexes:');
  for (const ix of existing) console.log(`  ${ix.name.padEnd(22)} ${describe(ix)}`);
  console.log('');

  // Sanity check before touching anything: duplicate nulls would block a
  // unique+sparse rebuild anyway, so surface them instead of failing midway.
  for (const field of Object.keys(WANTED)) {
    const dupes = await col.aggregate([
      { $match: { [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $limit: 5 },
    ]).toArray();
    if (dupes.length) {
      console.error(`ABORT: duplicate ${field} values exist, fix these first:`);
      for (const d of dupes) console.error(`  ${d._id} x${d.n}`);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  const plan = [];
  for (const [field, want] of Object.entries(WANTED)) {
    const cur = existing.find((ix) => ix.name === want.options.name);
    if (!cur) {
      plan.push({ field, action: 'create', reason: 'missing' });
    } else if (!cur.sparse || !cur.unique) {
      plan.push({ field, action: 'recreate', reason: `is ${describe(cur)}, want unique+sparse` });
    }
  }

  if (!plan.length) {
    console.log('nothing to do — all indexes already unique+sparse.');
    await mongoose.disconnect();
    return;
  }

  console.log('planned changes:');
  for (const p of plan) console.log(`  ${p.action.padEnd(9)} ${p.field.padEnd(14)} (${p.reason})`);
  console.log('');

  if (!APPLY) {
    console.log('dry run — nothing written. Re-run with --apply to execute.');
    await mongoose.disconnect();
    return;
  }

  for (const p of plan) {
    const want = WANTED[p.field];
    if (p.action === 'recreate') {
      await col.dropIndex(want.options.name);
      console.log(`  dropped  ${want.options.name}`);
    }
    await col.createIndex(want.key, want.options);
    console.log(`  created  ${want.options.name} (unique+sparse)`);
  }

  console.log('\nfinal indexes:');
  for (const ix of await col.indexes()) console.log(`  ${ix.name.padEnd(22)} ${describe(ix)}`);

  await mongoose.disconnect();
  console.log('\ndone.');
}

main().catch(async (err) => {
  console.error('migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
