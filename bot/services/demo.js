/**
 * Virtual exchange — real Binance prices, simulated fills, virtual balances.
 *
 * Two virtual accounts per user:
 *   'demo'   → DemoAccount   (free $10k, user can reset)
 *   'wallet' → WalletAccount (admin-funded credits, no user reset)
 *
 * Spot functions keep the binance.js signature so the bot's executor works
 * unchanged; the `apiKey` argument carries a virtual key: "<userId>" for demo,
 * "<userId>:wallet" for the wallet (see virtualKey / parseVirtualKey).
 * Futures are exposed as a "venue" object, the same shape as liveFuturesVenue().
 */
import mongoose from 'mongoose';
import DemoAccount, { DEMO_START_USDT } from '../../lib/models/DemoAccount.js';
import WalletAccount from '../../lib/models/WalletAccount.js';
import * as spot from './binance.js';
import * as fx from './binanceFutures.js';

export const SPOT_FEE    = 0.001;   // Binance spot taker
export const FUTURES_FEE = 0.0005;  // Binance USDⓈ-M taker
export const VIRTUAL_KINDS = ['demo', 'wallet'];

export const getCandles      = spot.getCandles;
export const getCurrentPrice = spot.getCurrentPrice;
export const get24hChange    = spot.get24hChange;

const baseAsset = (symbol) => symbol.replace(/USDT$|BTC$|ETH$|BNB$/, '');
const oid = () => `DEMO_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const toId = (userId) => new mongoose.Types.ObjectId(String(userId));
const Model = (kind) => (kind === 'wallet' ? WalletAccount : DemoAccount);

/** "Key" passed through the spot executor in place of an API key. */
export const virtualKey = (userId, kind = 'demo') => (kind === 'wallet' ? `${userId}:wallet` : String(userId));
export function parseVirtualKey(key) {
  const [userId, kind] = String(key).split(':');
  return { userId, kind: kind === 'wallet' ? 'wallet' : 'demo' };
}

/** Virtual account kind for a user's current mode, or null when live. */
export function virtualKindOf(userOrMode) {
  const mode = typeof userOrMode === 'string' ? userOrMode : userOrMode?.tradingAccount;
  return VIRTUAL_KINDS.includes(mode) ? mode : null;
}

/** Which virtual account a trade belongs to (old demo trades have no virtualAccount). */
export const tradeKind = (trade) => (trade.virtualAccount === 'wallet' ? 'wallet' : 'demo');

export async function getVirtualAccount(userId, kind = 'demo') {
  const insert = kind === 'wallet'
    ? { usdt: 0, holdings: {}, totalCredited: 0, totalDebited: 0 }
    : { usdt: DEMO_START_USDT, startingBalance: DEMO_START_USDT, holdings: {} };
  return Model(kind).findOneAndUpdate({ userId: toId(userId) }, { $setOnInsert: insert }, { upsert: true, new: true });
}
export const getDemoAccount = (userId) => getVirtualAccount(userId, 'demo');

/* ── spot (binance.js-compatible) ──────────────────────────────────────── */

export async function getUSDTBalance(key) {
  const { userId, kind } = parseVirtualKey(key);
  return (await getVirtualAccount(userId, kind)).usdt;
}

export async function getAssetBalance(key, _secret, symbol) {
  const { userId, kind } = parseVirtualKey(key);
  const acct = await getVirtualAccount(userId, kind);
  return acct.holdings?.get(baseAsset(symbol)) || 0;
}

export async function placeMarketBuy(key, _secret, symbol, usdtAmount) {
  const { userId, kind } = parseVirtualKey(key);
  const price = await getCurrentPrice(symbol);
  if (!price) throw new Error(`No price for ${symbol}`);
  if (usdtAmount < 5) throw new Error('Virtual account: minimum order is $5');
  await getVirtualAccount(userId, kind);
  const qty = parseFloat(((usdtAmount / price) * (1 - SPOT_FEE)).toFixed(8));  // fee taken in the coin, like Binance
  const res = await Model(kind).updateOne(
    { userId: toId(userId), usdt: { $gte: usdtAmount } },
    { $inc: { usdt: -usdtAmount, [`holdings.${baseAsset(symbol)}`]: qty } },
  );
  if (!res.modifiedCount) throw new Error(`${kind === 'wallet' ? 'Wallet' : 'Demo'}: insufficient balance (virtual USDT)`);
  return { orderId: oid(), price, qty, total: usdtAmount };
}

export async function placeMarketSell(key, _secret, symbol, qty) {
  const { userId, kind } = parseVirtualKey(key);
  const price = await getCurrentPrice(symbol);
  if (!price) throw new Error(`No price for ${symbol}`);
  const asset = baseAsset(symbol);
  await getVirtualAccount(userId, kind);
  const sellQty = parseFloat(Number(qty).toFixed(8));
  const proceeds = sellQty * price * (1 - SPOT_FEE);
  const res = await Model(kind).updateOne(
    { userId: toId(userId), [`holdings.${asset}`]: { $gte: sellQty - 1e-9 } },
    { $inc: { usdt: proceeds, [`holdings.${asset}`]: -sellQty } },
  );
  // Same wording the executor already understands for "coins are not there".
  if (!res.modifiedCount) throw new Error('Virtual account: insufficient balance to sell');
  return { orderId: oid(), price, qty: sellQty, total: sellQty * price };
}

/* ── futures venue ─────────────────────────────────────────────────────── */

/** Isolated-margin liquidation estimate (same formula the UI warns with). */
export function estimateLiquidation(entry, direction, leverage) {
  const d = fx.liquidationDistancePct(leverage) / 100;
  return direction === 'LONG' ? entry * (1 - d) : entry * (1 + d);
}

export function demoFuturesVenue(userId, kind = 'demo') {
  const leverageBy = {};
  const M = Model(kind);
  return {
    demo: true,
    kind,
    async getAvailableBalance() { return (await getVirtualAccount(userId, kind)).usdt; },
    async getPosition() { return null; },                       // no exchange — the bot is the only manager
    async prepareSymbol(symbol, leverage) { leverageBy[symbol] = leverage; },
    async openMarket(symbol, direction, qty) {
      const price = await fx.getMarkPrice(symbol);
      const lev = leverageBy[symbol] || 1;
      const margin = (price * qty) / lev;
      const fee = price * qty * FUTURES_FEE;
      await getVirtualAccount(userId, kind);
      const res = await M.updateOne(
        { userId: toId(userId), usdt: { $gte: margin + fee } },
        { $inc: { usdt: -(margin + fee) } },
      );
      if (!res.modifiedCount) throw new Error(`${kind === 'wallet' ? 'Wallet' : 'Demo'}: insufficient virtual margin`);
      return { orderId: oid(), price, qty, liquidationPrice: estimateLiquidation(price, direction, lev) };
    },
    async closeMarket(symbol, _direction, qty) {
      return { orderId: oid(), price: await fx.getMarkPrice(symbol), qty };
    },
    async placeProtection() { return { stopLossId: null, takeProfitId: null, errors: [] }; },
    async cancelAllOrders() {},
  };
}

/**
 * Credit a closed virtual futures position back to its account: margin + P&L − close fee.
 * Isolated margin means the loss can never exceed the margin. Returns the P&L used.
 */
export async function settleDemoFutures(userId, trade, profit, exitPrice, qty) {
  const kind = tradeKind(trade);
  const margin = trade.margin || 0;
  const capped = Math.max(profit, -margin);
  const fee = exitPrice * qty * FUTURES_FEE;
  await getVirtualAccount(userId, kind);
  await Model(kind).updateOne({ userId: toId(userId) }, { $inc: { usdt: Math.max(0, margin + capped - fee) } });
  return capped;
}

/** Trade-collection filter for the user's current account mode. */
export function tradeScope(userOrMode) {
  const kind = virtualKindOf(userOrMode);
  if (kind === 'wallet') return { demo: true, virtualAccount: 'wallet' };
  if (kind === 'demo')   return { demo: true, virtualAccount: { $ne: 'wallet' } };
  return { demo: { $ne: true } };
}

/** Filter for one virtual account's trades. */
export const virtualScope = (kind) => tradeScope(kind);

export const isDemoUser = (user) => virtualKindOf(user) !== null;
