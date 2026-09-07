/**
 * Asset Recharge Report
 * Run: node scripts/balance-report.mjs
 */
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local manually ─────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val  = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

// ── Schemas (inline — no imports needed) ─────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name:         String,
  email:        String,
  assetBalance: { type: Number, default: 0 },
  fundBalance:  { type: Number, default: 0 },
  createdAt:    Date,
});

const PaymentSchema = new mongoose.Schema({
  userId:         mongoose.Schema.Types.ObjectId,
  priceAmount:    Number,
  creditedAmount: { type: Number, default: 0 },
  status:         String,
  completedAt:    Date,
  createdAt:      Date,
});

const DepositCommissionSchema = new mongoose.Schema({
  userId:        mongoose.Schema.Types.ObjectId,
  depositAmount: Number,
  netCredited:   Number,
  createdAt:     Date,
});

const SubscriptionSchema = new mongoose.Schema({
  userId:      mongoose.Schema.Types.ObjectId,
  amount:      Number,
  status:      String,
  activatedAt: Date,
  createdAt:   Date,
});

const User       = mongoose.models.User       || mongoose.model('User',       UserSchema);
const Payment    = mongoose.models.Payment    || mongoose.model('Payment',    PaymentSchema);
const DepComm    = mongoose.models.DepositCommission || mongoose.model('DepositCommission', DepositCommissionSchema);
const Subscription = mongoose.models.Subscription   || mongoose.model('Subscription',   SubscriptionSchema);

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const line = (char = '─', len = 60) => char.repeat(len);

// ── Main ─────────────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI);
console.log('\n' + line('═'));
console.log('  TrickyX.ai — Asset Recharge Report');
console.log(line('═'));

// 1. Finished payments
const payments = await Payment.find({ status: 'finished' }).lean();
const totalDeposited  = payments.reduce((s, p) => s + (p.creditedAmount || p.priceAmount || 0), 0);
const paymentCount    = payments.length;

// 2. Deposit commissions (source of truth for net credited per user)
const depComms = await DepComm.find({}).lean();
const totalNetCredited = depComms.reduce((s, d) => s + (d.netCredited || 0), 0);

// 3. Subscriptions
const activeSubs = await Subscription.find({ status: 'finished' }).lean();
const totalSubRevenue = activeSubs.reduce((s, sub) => s + (sub.amount || 0), 0);

// 4. Current live balances
const allUsers = await User.find({}).lean();
const totalAssetNow = allUsers.reduce((s, u) => s + (u.assetBalance || 0), 0);
const totalFundNow  = allUsers.reduce((s, u) => s + (u.fundBalance  || 0), 0);

// 5. Per-user deposit breakdown
const userMap = {};
for (const u of allUsers) userMap[String(u._id)] = u;

const perUser = {};
for (const p of payments) {
  const uid = String(p.userId);
  if (!perUser[uid]) perUser[uid] = { deposits: 0, count: 0 };
  perUser[uid].deposits += (p.creditedAmount || p.priceAmount || 0);
  perUser[uid].count++;
}

// ── Print Summary ─────────────────────────────────────────────────────────────
console.log('\n📊  TOTALS');
console.log(line());
console.log(`  Completed Deposits      : ${fmt(totalDeposited).padStart(14)}   (${paymentCount} payments)`);
console.log(`  Net Credited to Users   : ${fmt(totalNetCredited).padStart(14)}   (after 15% platform fee)`);
console.log(`  Subscription Revenue    : ${fmt(totalSubRevenue).padStart(14)}   (${activeSubs.length} subs)`);
console.log(line());
console.log(`  Total Revenue Collected : ${fmt(totalDeposited + totalSubRevenue).padStart(14)}`);

console.log('\n💰  LIVE BALANCES (current DB state)');
console.log(line());
console.log(`  Sum of all assetBalance : ${fmt(totalAssetNow).padStart(14)}`);
console.log(`  Sum of all fundBalance  : ${fmt(totalFundNow).padStart(14)}`);
console.log(`  Total held for users    : ${fmt(totalAssetNow + totalFundNow).padStart(14)}`);

// ── Per-User Breakdown ────────────────────────────────────────────────────────
const sorted = Object.entries(perUser)
  .map(([uid, d]) => ({ uid, ...d, user: userMap[uid] }))
  .sort((a, b) => b.deposits - a.deposits);

if (sorted.length === 0) {
  console.log('\n  No completed deposits found.');
} else {
  console.log(`\n👤  PER-USER BREAKDOWN (${sorted.length} depositors)`);
  console.log(line());
  console.log(`  ${'Name'.padEnd(24)} ${'Email'.padEnd(30)} ${'Deposited'.padStart(12)} ${'Count'.padStart(6)} ${'Asset Bal'.padStart(12)} ${'Fund Bal'.padStart(10)}`);
  console.log(line());
  for (const { uid, deposits, count, user } of sorted) {
    const name  = (user?.name  || 'Unknown').slice(0, 23).padEnd(24);
    const email = (user?.email || uid).slice(0, 29).padEnd(30);
    const dep   = fmt(deposits).padStart(12);
    const cnt   = String(count).padStart(6);
    const asset = fmt(user?.assetBalance || 0).padStart(12);
    const fund  = fmt(user?.fundBalance  || 0).padStart(10);
    console.log(`  ${name} ${email} ${dep} ${cnt} ${asset} ${fund}`);
  }
}

// ── Users with balance but NO deposits ───────────────────────────────────────
const noDeposit = allUsers.filter(u => !perUser[String(u._id)] && (u.assetBalance > 0 || u.fundBalance > 0));
if (noDeposit.length > 0) {
  console.log(`\n⚠️   USERS WITH BALANCE BUT NO COMPLETED PAYMENT (${noDeposit.length})`);
  console.log(line());
  for (const u of noDeposit) {
    console.log(`  ${(u.name || '').padEnd(24)} ${(u.email || '').padEnd(30)} asset:${fmt(u.assetBalance || 0)} fund:${fmt(u.fundBalance || 0)}`);
  }
}

console.log('\n' + line('═') + '\n');
await mongoose.disconnect();
