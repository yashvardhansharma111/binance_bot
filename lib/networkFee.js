/**
 * Per-network exchange withdrawal fee estimates (USDT).
 * These are the fees exchanges (Binance, Bybit, OKX, etc.) deduct from the
 * sent amount when withdrawing — NOT blockchain gas, which is paid separately
 * in the native token. Values are conservative (≥ the most common exchange's fee)
 * so partial-payment failures are avoided even on the most expensive exchange.
 *
 * Sources: Binance / Bybit withdrawal fee pages (June 2026)
 */
const FEES = {
  usdttrc20:    1.0,   // Binance: 1, Bybit: 1, OKX: 1
  usdtbsc:      0.8,   // Binance: 0.8, Bybit: 1  → use 1 to be safe
  usdterc20:    5.0,   // Binance: 3.68–15 (gas-variable) → 5 as safe floor
  usdtpolygon:  0.5,   // Binance: 0.3, Bybit: 1  → 0.5
  usdtsol:      1.0,   // Binance: 1
  usdtton:      0.5,   // Binance: 0.5
  usdtavaxc:    1.0,   // Binance: 1
  usdtop:       0.5,   // Optimism
  usdtarb:      0.5,   // Arbitrum — Binance: 0.8
  usdtdot:      0.5,
};

const DEFAULT_FEE = 1.5; // unknown network — conservative fallback

/**
 * Returns the exchange withdrawal fee buffer (USD) for the given NOWPayments
 * currency code (e.g. "usdttrc20"). Always ≥ 0.1.
 */
export function getNetworkFee(currency = '') {
  const fee = FEES[currency.toLowerCase()];
  return fee ?? DEFAULT_FEE;
}
