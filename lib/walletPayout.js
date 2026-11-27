import SystemConfig from '@/lib/models/SystemConfig';

/** Admin-editable payout rules (Admin → Config). */
export const PAYOUT_DEFAULTS = { percent: 100, min: 10 };

export async function getPayoutConfig() {
  const rows = await SystemConfig.find({ key: { $in: ['wallet_payout_percent', 'wallet_payout_min'] } }).lean();
  const v = Object.fromEntries(rows.map(r => [r.key, Number(r.value)]));
  const percent = Number.isFinite(v.wallet_payout_percent) ? Math.min(100, Math.max(0, v.wallet_payout_percent)) : PAYOUT_DEFAULTS.percent;
  const min = Number.isFinite(v.wallet_payout_min) ? Math.max(0, v.wallet_payout_min) : PAYOUT_DEFAULTS.min;
  return { percent, min };
}

/**
 * Profit that may be paid out: free wallet USDT above the net credits the admin
 * put in. Admin credits themselves never become real money.
 */
export function payoutableProfit(acct) {
  const principal = (acct.totalCredited || 0) - (acct.totalDebited || 0);
  return Math.max(0, Math.floor(((acct.usdt || 0) - principal) * 100) / 100);
}
