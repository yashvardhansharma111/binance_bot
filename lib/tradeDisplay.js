// Client-side helpers for showing open trades — spot and futures (long/short).

export const isFuturesTrade = (t) =>
  t.market === 'futures' || /^Futures (LONG|SHORT)/.test(t.reason || '');

/** 'BUY' for spot, 'LONG' / 'SHORT' for futures. */
export function tradeDirection(t) {
  if (!isFuturesTrade(t)) return 'BUY';
  return t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT');
}

/** Key for the live-price map — the same symbol can trade on spot and futures. */
export const priceKey = (t) => `${isFuturesTrade(t) ? 'F' : 'S'}:${t.symbol}`;

/** Live prices for a list of trades: spot ticker for spot, futures mark price for futures. */
export async function fetchLivePrices(list) {
  const keys = [...new Set(list.map(priceKey))];
  const pairs = await Promise.all(keys.map(async (key) => {
    const [kind, sym] = key.split(':');
    const url = kind === 'F'
      ? `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`
      : `https://api.binance.com/api/v3/ticker/price?symbol=${sym}`;
    try {
      const d = await (await fetch(url)).json();
      const p = parseFloat(kind === 'F' ? d.markPrice : d.price);
      return [key, Number.isFinite(p) ? p : null];
    } catch { return [key, null]; }
  }));
  return Object.fromEntries(pairs);
}

/**
 * Unrealised P&L. pnlPct is the price move for spot and the return on margin
 * for futures (what the exchange shows as ROI).
 */
export function unrealized(t, live) {
  if (!live) return { pnl: null, pnlPct: null };
  const dir = tradeDirection(t);
  const diff = dir === 'SHORT' ? t.price - live : live - t.price;
  const pnl = parseFloat((diff * t.qty).toFixed(4));
  const pct = isFuturesTrade(t) && t.margin
    ? (pnl / t.margin) * 100
    : (diff / t.price) * 100;
  return { pnl, pnlPct: pct.toFixed(2) };
}

/** SPOT / FUTURES badge so users can tell which market a trade is on. */
export function marketBadge(t) {
  return isFuturesTrade(t)
    ? { label: 'FUTURES', className: 'bg-amber-100 text-amber-700' }
    : { label: 'SPOT', className: 'bg-sky-100 text-sky-700' };
}

/** Badge text + Tailwind classes for the side of an open trade. */
export function sideBadge(t) {
  const dir = tradeDirection(t);
  const lev = isFuturesTrade(t) && t.leverage ? ` ${t.leverage}x` : '';
  if (dir === 'SHORT') return { label: `SHORT${lev}`, className: 'bg-red-100 text-red-600' };
  if (dir === 'LONG')  return { label: `LONG${lev}`,  className: 'bg-emerald-100 text-emerald-700' };
  return { label: 'BUY', className: 'bg-emerald-100 text-emerald-700' };
}
