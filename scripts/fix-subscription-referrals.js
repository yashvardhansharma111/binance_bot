/**
 * Backfill subscription referral commissions.
 *
 * Two independent, idempotent repairs:
 *
 *  A) BALANCE — subscriptions were created without an `amount`, so it defaulted
 *     to 1. The webhook credited the referrer `amount * 20%` = $0.20 instead of
 *     20% of the real $49 plan price ($9.80). For finished, referred subs whose
 *     stored amount is still below the real price, credit the referrer the
 *     missing difference and bump `amount` to PLAN_PRICE (also the idempotency
 *     marker — rows already at PLAN_PRICE are skipped).
 *
 *  B) RECORD — subscription referral payouts were never written to any
 *     commission collection, so they don't show in "Total Earned" / history.
 *     For every finished, referred sub, ensure a SubscriptionCommission record
 *     exists (idempotent via the unique subscriptionId index).
 *
 * Usage (on the server, with env loaded):
 *   node --env-file=.env.local scripts/fix-subscription-referrals.js          # dry run (default)
 *   node --env-file=.env.local scripts/fix-subscription-referrals.js --apply  # actually write
 */
import mongoose from 'mongoose';
import User from '../lib/models/User.js';
import Subscription from '../lib/models/Subscription.js';
import SubscriptionCommission from '../lib/models/SubscriptionCommission.js';

const MONGODB_URI   = process.env.MONGODB_URI || 'mongodb://localhost:27017/trickyx';
const PLAN_PRICE    = 49;     // real USD plan price — keep in sync with subscription/create
const REFERRER_RATE = 0.20;   // 20% of subscription price
const APPLY         = process.argv.includes('--apply');

function round2(n) { return parseFloat(n.toFixed(2)); }

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB${APPLY ? '' : '  (DRY RUN — no writes; pass --apply to commit)'}\n`);

  // Every finished subscription that had a referrer needs both repairs checked.
  const finished = await Subscription.find({ status: 'finished' });
  console.log(`Scanning ${finished.length} finished subscription(s)\n`);

  let balanceCredited = 0, totalCredited = 0, amountFixed = 0;
  let recordsCreated  = 0, recordsExisted = 0, skipped = 0;

  for (const sub of finished) {
    const buyer = await User.findById(sub.userId).select('referredBy email');
    if (!buyer?.referredBy) { skipped++; continue; }

    const referrer = await User.findOne({ referralCode: buyer.referredBy }).select('_id email');
    if (!referrer) {
      console.log(`  ! sub ${sub._id} — referrer code "${buyer.referredBy}" not found, skipping`);
      skipped++;
      continue;
    }

    const correctCommission = round2(PLAN_PRICE * REFERRER_RATE);   // $9.80

    // ── A) Balance shortfall ──────────────────────────────────────────────────
    const oldAmount = sub.amount ?? 1;
    if (oldAmount < PLAN_PRICE) {
      const alreadyCredited = round2(oldAmount * REFERRER_RATE);    // what webhook gave (e.g. $0.20)
      const delta           = round2(correctCommission - alreadyCredited);
      if (delta > 0) {
        if (APPLY) await User.findByIdAndUpdate(referrer._id, { $inc: { assetBalance: delta } });
        balanceCredited++;
        totalCredited += delta;
        console.log(
          `  ✓ sub ${sub._id} — ${buyer.email} → ${referrer.email}: balance +$${delta.toFixed(2)} ` +
          `(was $${alreadyCredited.toFixed(2)}, now $${correctCommission.toFixed(2)})`
        );
      }
      if (APPLY) { sub.amount = PLAN_PRICE; await sub.save(); }
      amountFixed++;
    }

    // ── B) Missing commission record ──────────────────────────────────────────
    const existing = await SubscriptionCommission.findOne({ subscriptionId: sub._id }).select('_id');
    if (existing) {
      recordsExisted++;
    } else {
      if (APPLY) {
        await SubscriptionCommission.create({
          subscriptionId: sub._id,
          userId:         sub.userId,
          referrerId:     referrer._id,
          planAmount:     PLAN_PRICE,
          referrerRate:   REFERRER_RATE,
          referrerAmount: correctCommission,
        });
      }
      recordsCreated++;
      console.log(`    + commission record for sub ${sub._id} → referrer ${referrer.email}: $${correctCommission.toFixed(2)}`);
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`balance shortfalls credited: ${balanceCredited}  (total $${round2(totalCredited).toFixed(2)})`);
  console.log(`subscription amount fixed:   ${amountFixed}`);
  console.log(`commission records created:  ${recordsCreated}  (already existed: ${recordsExisted})`);
  console.log(`skipped (no/unknown referrer): ${skipped}`);
  if (!APPLY) console.log(`\nDRY RUN — nothing was written. Re-run with --apply to commit.`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
