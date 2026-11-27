import SystemConfig from '@/lib/models/SystemConfig';

/**
 * Wallet profit → Asset Balance payouts are switched OFF in code.
 *
 * Wallet credits trade on simulated fills. Paying their profit out as real
 * Asset Balance would mean the platform pays real winnings from its own pocket,
 * so wallet credits stay virtual. Requests created before this change can still
 * be decided by an admin (/api/admin/wallet/payouts), so nothing is left on hold.
 */
export const WALLET_PAYOUTS_ENABLED = false;

export const PAYOUT_DEFAULTS = { percent: 100, min: 10 };

export async function getPayoutConfig() {
  if (!WALLET_PAYOUTS_ENABLED) return { percent: 0, min: PAYOUT_DEFAULTS.min, enabled: false };
  const rows = await SystemConfig.find({ key: { $in: ['wallet_payout_percent', 'wallet_payout_min'] } }).lean();
  const v = Object.fromEntries(rows.map(r => [r.key, Number(r.value)]));
  const percent = Number.isFinite(v.wallet_payout_percent) ? Math.min(100, Math.max(0, v.wallet_payout_percent)) : PAYOUT_DEFAULTS.percent;
  const min = Number.isFinite(v.wallet_payout_min) ? Math.max(0, v.wallet_payout_min) : PAYOUT_DEFAULTS.min;
  return { percent, min, enabled: percent > 0 };
}

/** Profit that may be paid out: free wallet USDT above the net credits put in. */
export function payoutableProfit(acct) {
  const principal = (acct.totalCredited || 0) - (acct.totalDebited || 0);
  return Math.max(0, Math.floor(((acct.usdt || 0) - principal) * 100) / 100);
}
