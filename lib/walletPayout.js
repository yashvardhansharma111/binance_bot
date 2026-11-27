import SystemConfig from '@/lib/models/SystemConfig';

/**
 * Wallet withdrawals → Asset Balance (admin approves every request).
 *
 * The owner chose to let users withdraw their FULL free wallet balance
 * (credits + profit). Wallet trades are simulated, so every approved request
 * is paid by the platform — that is why each one needs an admin decision and
 * the admin sees the user's wallet history next to it.
 */
export const WALLET_PAYOUTS_ENABLED = true;
export const PAYOUT_DEFAULTS = { percent: 100, min: 10 };

export async function getPayoutConfig() {
  if (!WALLET_PAYOUTS_ENABLED) return { percent: 0, min: PAYOUT_DEFAULTS.min, enabled: false };
  const row = await SystemConfig.findOne({ key: 'wallet_payout_min' }).lean();
  const min = Number.isFinite(Number(row?.value)) ? Math.max(1, Number(row.value)) : PAYOUT_DEFAULTS.min;
  return { percent: 100, min, enabled: true };
}

/** What may be withdrawn: the free wallet USDT (margin in open positions stays put). */
export function withdrawableBalance(acct) {
  return Math.max(0, Math.floor((acct.usdt || 0) * 100) / 100);
}
