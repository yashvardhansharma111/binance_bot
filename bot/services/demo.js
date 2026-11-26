/**
 * Demo exchange — real Binance prices, simulated fills, virtual balances.
 *
 * Spot functions keep the binance.js signature so the bot's executor works
 * unchanged; the `apiKey` argument carries the userId (there is no real key).
 * Futures are exposed as a "venue" object, the same shape as liveFuturesVenue().
 */
import mongoose from 'mongoose';
import DemoAccount, { DEMO_START_USDT } from '../../lib/models/DemoAccount.js';
import * as spot from './binance.js';
import * as fx from './binanceFutures.js';

export const SPOT_FEE    = 0.001;   // Binance spot taker
export const FUTURES_FEE = 0.0005;  // Binance USDⓈ-M taker

export const getCandles      = spot.getCandles;
export const getCurrentPrice = spot.getCurrentPrice;
export const get24hChange    = spot.get24hChange;

const baseAsset = (symbol) => symbol.replace(/USDT$|BTC$|ETH$|BNB$/, '');
const oid = () => `DEMO_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const toId = (userId) => new mongoose.Types.ObjectId(String(userId));

export async function getDemoAccount(userId) {
  return DemoAccount.findOneAndUpdate(
    { userId: toId(userId) },
    { $setOnInsert: { usdt: DEMO_START_USDT, startingBalance: DEMO_START_USDT, holdings: {} } },
    { upsert: true, new: true },
  );
}

/* ── spot (binance.js-compatible) ──────────────────────────────────────── */

export async function getUSDTBalance(userId) {
  return (await getDemoAccount(userId)).usdt;
}

export async function getAssetBalance(userId, _secret, symbol) {
  const acct = await getDemoAccount(userId);
  return acct.holdings?.get(baseAsset(symbol)) || 0;
}

export async function placeMarketBuy(userId, _secret, symbol, usdtAmount) {
  const price = await getCurrentPrice(symbol);
  if (!price) throw new Error(`No price for ${symbol}`);
  if (usdtAmount < 5) throw new Error('Demo: minimum order is $5');
  await getDemoAccount(userId);
  const qty = parseFloat(((usdtAmount / price) * (1 - SPOT_FEE)).toFixed(8));  // fee taken in the coin, like Binance
  const res = await DemoAccount.updateOne(
    { userId: toId(userId), usdt: { $gte: usdtAmount } },
    { $inc: { usdt: -usdtAmount, [`holdings.${baseAsset(symbol)}`]: qty } },
  );
  if (!res.modifiedCount) throw new Error('Demo: insufficient balance (virtual USDT)');
  return { orderId: oid(), price, qty, total: usdtAmount };
}

export async function placeMarketSell(userId, _secret, symbol, qty) {
  const price = await getCurrentPrice(symbol);
  if (!price) throw new Error(`No price for ${symbol}`);
  const asset = baseAsset(symbol);
  await getDemoAccount(userId);
  const sellQty = parseFloat(Number(qty).toFixed(8));
  const proceeds = sellQty * price * (1 - SPOT_FEE);
  const res = await DemoAccount.updateOne(
    { userId: toId(userId), [`holdings.${asset}`]: { $gte: sellQty - 1e-9 } },
    { $inc: { usdt: proceeds, [`holdings.${asset}`]: -sellQty } },
  );
  // Same wording the executor already understands for "coins are not there".
  if (!res.modifiedCount) throw new Error('Demo: insufficient balance to sell');
  return { orderId: oid(), price, qty: sellQty, total: sellQty * price };
}

/* ── futures venue ─────────────────────────────────────────────────────── */

/** Isolated-margin liquidation estimate (same formula the UI warns with). */
export function estimateLiquidation(entry, direction, leverage) {
  const d = fx.liquidationDistancePct(leverage) / 100;
  return direction === 'LONG' ? entry * (1 - d) : entry * (1 + d);
}

export function demoFuturesVenue(userId) {
  const leverageBy = {};
  return {
    demo: true,
    async getAvailableBalance() { return (await getDemoAccount(userId)).usdt; },
    async getPosition() { return null; },                       // no exchange — the bot is the only manager
    async prepareSymbol(symbol, leverage) { leverageBy[symbol] = leverage; },
    async openMarket(symbol, direction, qty) {
      const price = await fx.getMarkPrice(symbol);
      const lev = leverageBy[symbol] || 1;
      const margin = (price * qty) / lev;
      const fee = price * qty * FUTURES_FEE;
      await getDemoAccount(userId);
      const res = await DemoAccount.updateOne(
        { userId: toId(userId), usdt: { $gte: margin + fee } },
        { $inc: { usdt: -(margin + fee) } },
      );
      if (!res.modifiedCount) throw new Error('Demo: insufficient virtual margin');
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
 * Credit a closed demo futures position back to the account: margin + P&L − close fee.
 * Isolated margin means the loss can never exceed the margin. Returns the P&L used.
 */
export async function settleDemoFutures(userId, trade, profit, exitPrice, qty) {
  const margin = trade.margin || 0;
  const capped = Math.max(profit, -margin);
  const fee = exitPrice * qty * FUTURES_FEE;
  await getDemoAccount(userId);
  await DemoAccount.updateOne({ userId: toId(userId) }, { $inc: { usdt: Math.max(0, margin + capped - fee) } });
  return capped;
}

/** Trade-collection filter for the user's current account mode. */
export function tradeScope(userOrMode) {
  const mode = typeof userOrMode === 'string' ? userOrMode : userOrMode?.tradingAccount;
  return mode === 'demo' ? { demo: true } : { demo: { $ne: true } };
}

export const isDemoUser = (user) => user?.tradingAccount === 'demo';
