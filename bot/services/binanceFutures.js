/**
 * Binance USDⓈ-M Futures — one-way mode, isolated margin.
 *
 * Prices and symbol rules come from mainnet (like spot); authenticated calls go
 * to testnet when the key is a futures-testnet key. DRY_RUN=true simulates every
 * order at the mark price and never touches the exchange.
 *
 * Conditional orders (STOP_MARKET / TAKE_PROFIT_MARKET) must use the Algo Order
 * API since 2025-12-09 — POST /fapi/v1/order rejects them with -4120.
 */
import axios from 'axios';
import { createHmac } from 'crypto';

const MAINNET = 'https://fapi.binance.com';
const TESTNET = 'https://testnet.binancefuture.com';

const isDryRun = () => process.env.DRY_RUN === 'true';
const base = (isTestnet) => (isTestnet ? TESTNET : MAINNET);

/* ── errors ─────────────────────────────────────────────────────────────── */

export function futuresError(e) {
  const status = e.response?.status;
  const code   = e.response?.data?.code;
  const msg    = e.response?.data?.msg || e.message;
  let err;
  if (status === 401 || code === -2015 || code === -2014)
    err = new Error('Binance API key rejected for Futures — enable "Enable Futures" on the key (and whitelist the server IP)');
  else if (code === -4061)
    err = new Error('Hedge Mode is on — switch Binance Futures to One-way Mode');
  else if (code === -2019)
    err = new Error('Insufficient futures margin — transfer USDT to your USDⓈ-M Futures wallet');
  else if (code === -4164 || code === -1013 || code === -4003)
    err = new Error(`Order too small for Binance Futures (${msg})`);
  else if (code === -1021)
    err = new Error('Server clock out of sync with Binance (-1021)');
  else
    err = new Error(code ? `Binance Futures error ${code}: ${msg}` : msg);
  err.code = code;
  return err;
}

async function signed(method, path, params, apiKey, apiSecret, isTestnet, timeout = 15000) {
  const p   = { ...params, timestamp: Date.now(), recvWindow: 60000 };
  const qs  = new URLSearchParams(p).toString();
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  try {
    const { data } = await axios({
      method, url: `${base(isTestnet)}${path}?${qs}&signature=${sig}`,
      headers: { 'X-MBX-APIKEY': apiKey }, timeout,
    });
    return data;
  } catch (e) {
    throw futuresError(e);
  }
}

/* ── market data (public, mainnet) ──────────────────────────────────────── */

export async function getMarkPrice(symbol) {
  const { data } = await axios.get(`${MAINNET}/fapi/v1/premiumIndex`, { params: { symbol }, timeout: 12000 });
  return parseFloat(data.markPrice);
}

/** Futures klines in the same shape as the spot getCandles(). */
export async function getFuturesCandles(symbol, interval = '5m', limit = 120) {
  const { data } = await axios.get(`${MAINNET}/fapi/v1/klines`, {
    params: { symbol, interval, limit }, timeout: 20000,
  });
  return data.map(c => ({
    open: parseFloat(c[1]), high: parseFloat(c[2]),
    low:  parseFloat(c[3]), close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

export async function getFutures24hChange(symbol) {
  try {
    const { data } = await axios.get(`${MAINNET}/fapi/v1/ticker/24hr`, { params: { symbol }, timeout: 12000 });
    return parseFloat(data.priceChangePercent);
  } catch { return 0; }
}

const RULES_TTL = 6 * 3600_000;
let rulesCache = { at: 0, map: null };

/** Lot/tick/notional rules for a symbol, or null if it is not a trading USDⓈ-M perpetual. */
export async function getSymbolRules(symbol) {
  if (!rulesCache.map || Date.now() - rulesCache.at > RULES_TTL) {
    const { data } = await axios.get(`${MAINNET}/fapi/v1/exchangeInfo`, { timeout: 20000 });
    const map = {};
    for (const s of data.symbols) {
      if (s.status !== 'TRADING' || s.contractType !== 'PERPETUAL') continue;
      const f = (t) => s.filters.find(x => x.filterType === t) || {};
      const lot = f('MARKET_LOT_SIZE').stepSize ? f('MARKET_LOT_SIZE') : f('LOT_SIZE');
      map[s.symbol] = {
        stepSize:    parseFloat(lot.stepSize),
        minQty:      parseFloat(lot.minQty),
        maxQty:      parseFloat(lot.maxQty),
        tickSize:    parseFloat(f('PRICE_FILTER').tickSize),
        minNotional: parseFloat(f('MIN_NOTIONAL').notional || 5),
      };
    }
    rulesCache = { at: Date.now(), map };
  }
  return rulesCache.map[symbol] || null;
}

function decimals(step) {
  const s = String(step);
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
  return s.includes('.') ? s.split('.')[1].replace(/0+$/, '').length : 0;
}

/** Floor qty to the lot step — never more than intended. */
export function roundQty(qty, step) {
  const d = decimals(step);
  return parseFloat((Math.floor(qty / step + 1e-9) * step).toFixed(d));
}

/** Round a price to the tick size. */
export function roundPrice(price, tick) {
  const d = decimals(tick);
  return parseFloat((Math.round(price / tick) * tick).toFixed(d));
}

/* ── account ────────────────────────────────────────────────────────────── */

export async function getAvailableBalance(apiKey, apiSecret, isTestnet) {
  if (isDryRun()) return 10000;
  const rows = await signed('GET', '/fapi/v2/balance', {}, apiKey, apiSecret, isTestnet);
  const usdt = rows.find(r => r.asset === 'USDT');
  return parseFloat(usdt?.availableBalance || 0);
}

/** Signed position size (+long / −short / 0 flat) and liquidation price, or null in DRY_RUN. */
export async function getPosition(apiKey, apiSecret, symbol, isTestnet) {
  if (isDryRun()) return null;
  const rows = await signed('GET', '/fapi/v3/positionRisk', { symbol }, apiKey, apiSecret, isTestnet);
  const row = rows.find(r => r.symbol === symbol && (r.positionSide || 'BOTH') === 'BOTH') || rows[0];
  return {
    positionAmt:      parseFloat(row?.positionAmt || 0),
    entryPrice:       parseFloat(row?.entryPrice || 0),
    liquidationPrice: parseFloat(row?.liquidationPrice || 0) || null,
  };
}

/** Isolated margin + leverage for the symbol. Safe to call before every entry. */
export async function prepareSymbol(apiKey, apiSecret, symbol, leverage, isTestnet) {
  if (isDryRun()) return;
  try {
    await signed('POST', '/fapi/v1/marginType', { symbol, marginType: 'ISOLATED' }, apiKey, apiSecret, isTestnet);
  } catch (e) {
    // -4046: already isolated. -4047/-4048: can't change with open orders/position — keep going.
    if (![-4046, -4047, -4048].includes(e.code)) throw e;
  }
  await signed('POST', '/fapi/v1/leverage', { symbol, leverage }, apiKey, apiSecret, isTestnet);
}

/* ── orders ─────────────────────────────────────────────────────────────── */

/**
 * Size a position: margin × leverage of notional, floored to the lot step.
 * Throws a readable error when the result is below the exchange minimums.
 */
export function sizePosition(rules, price, marginUSDT, leverage) {
  const qty = roundQty((marginUSDT * leverage) / price, rules.stepSize);
  const notional = qty * price;
  if (qty < rules.minQty || notional < rules.minNotional) {
    const needMargin = Math.ceil((Math.max(rules.minNotional, rules.minQty * price) * 1.02) / leverage * 100) / 100;
    throw new Error(`Position too small — needs at least $${needMargin} margin at ${leverage}x (min notional $${rules.minNotional})`);
  }
  if (qty > rules.maxQty) throw new Error(`Position above max market qty ${rules.maxQty}`);
  return qty;
}

/** Market entry. direction: 'LONG' | 'SHORT'. Returns { orderId, price, qty }. */
export async function openMarket(apiKey, apiSecret, symbol, direction, qty, isTestnet) {
  const side = direction === 'LONG' ? 'BUY' : 'SELL';
  if (isDryRun()) {
    const price = await getMarkPrice(symbol);
    console.log(`[DRY_RUN] FUTURES ${direction} ${qty} ${symbol} @ $${price}`);
    return { orderId: `DRY_F_${Date.now()}`, price, qty };
  }
  const r = await signed('POST', '/fapi/v1/order',
    { symbol, side, type: 'MARKET', quantity: qty, newOrderRespType: 'RESULT' },
    apiKey, apiSecret, isTestnet);
  const filled = parseFloat(r.executedQty) || 0;
  const price  = parseFloat(r.avgPrice) || await getMarkPrice(symbol);
  if (!filled) throw new Error(`Futures order ${r.orderId} not filled (status ${r.status})`);
  return { orderId: String(r.orderId), price, qty: filled };
}

/** Reduce-only market exit. Returns { orderId, price, qty } or { alreadyFlat: true }. */
export async function closeMarket(apiKey, apiSecret, symbol, direction, qty, isTestnet) {
  const side = direction === 'LONG' ? 'SELL' : 'BUY';
  if (isDryRun()) {
    const price = await getMarkPrice(symbol);
    console.log(`[DRY_RUN] FUTURES CLOSE ${direction} ${qty} ${symbol} @ $${price}`);
    return { orderId: `DRY_F_${Date.now()}`, price, qty };
  }
  try {
    const r = await signed('POST', '/fapi/v1/order',
      { symbol, side, type: 'MARKET', quantity: qty, reduceOnly: 'true', newOrderRespType: 'RESULT' },
      apiKey, apiSecret, isTestnet);
    const filled = parseFloat(r.executedQty) || 0;
    const price  = parseFloat(r.avgPrice) || await getMarkPrice(symbol);
    if (!filled) return { alreadyFlat: true, price };
    return { orderId: String(r.orderId), price, qty: filled };
  } catch (e) {
    // -2022: ReduceOnly rejected — there is no position left to reduce.
    if (e.code === -2022) return { alreadyFlat: true, price: await getMarkPrice(symbol) };
    throw e;
  }
}

/**
 * Exchange-side stop-loss / take-profit (Algo Order API, closePosition=true,
 * triggered on mark price). Failures are returned, not thrown, so the caller
 * can log them — the bot still monitors SL/TP on every tick.
 */
export async function placeProtection(apiKey, apiSecret, symbol, direction, { stopLoss, takeProfit }, tickSize, isTestnet) {
  const out = { stopLossId: null, takeProfitId: null, errors: [] };
  if (isDryRun()) return out;
  const side = direction === 'LONG' ? 'SELL' : 'BUY';
  const place = async (type, price) => {
    const r = await signed('POST', '/fapi/v1/algoOrder', {
      algoType: 'CONDITIONAL', symbol, side, type,
      triggerPrice: roundPrice(price, tickSize),
      closePosition: 'true', workingType: 'MARK_PRICE', priceProtect: 'true',
    }, apiKey, apiSecret, isTestnet);
    return String(r.algoId);
  };
  if (stopLoss) {
    try { out.stopLossId = await place('STOP_MARKET', stopLoss); }
    catch (e) { out.errors.push(`SL: ${e.message}`); }
  }
  if (takeProfit) {
    try { out.takeProfitId = await place('TAKE_PROFIT_MARKET', takeProfit); }
    catch (e) { out.errors.push(`TP: ${e.message}`); }
  }
  return out;
}

/** Cancel every open order (regular + algo) on the symbol. Never throws. */
export async function cancelAllOrders(apiKey, apiSecret, symbol, isTestnet) {
  if (isDryRun()) return;
  await signed('DELETE', '/fapi/v1/algoOpenOrders', { symbol }, apiKey, apiSecret, isTestnet).catch(() => {});
  await signed('DELETE', '/fapi/v1/allOpenOrders', { symbol }, apiKey, apiSecret, isTestnet).catch(() => {});
}

/** The real exchange as a venue — same shape as demoFuturesVenue() in demo.js. */
export function liveFuturesVenue(apiKey, apiSecret, isTestnet) {
  return {
    demo: false,
    getAvailableBalance: () => getAvailableBalance(apiKey, apiSecret, isTestnet),
    getPosition: (symbol) => getPosition(apiKey, apiSecret, symbol, isTestnet),
    prepareSymbol: (symbol, leverage) => prepareSymbol(apiKey, apiSecret, symbol, leverage, isTestnet),
    openMarket: (symbol, direction, qty) => openMarket(apiKey, apiSecret, symbol, direction, qty, isTestnet),
    closeMarket: (symbol, direction, qty) => closeMarket(apiKey, apiSecret, symbol, direction, qty, isTestnet),
    placeProtection: (symbol, direction, levels, tickSize) => placeProtection(apiKey, apiSecret, symbol, direction, levels, tickSize, isTestnet),
    cancelAllOrders: (symbol) => cancelAllOrders(apiKey, apiSecret, symbol, isTestnet),
  };
}

/* ── pure helpers (direction-aware) ─────────────────────────────────────── */

/** SL/TP price levels for a futures position. Percentages are of price, not ROI. */
export function futuresLevels(entry, direction, slPct, tpPct) {
  const long = direction === 'LONG';
  return {
    stopLoss:   slPct ? entry * (long ? 1 - slPct / 100 : 1 + slPct / 100) : null,
    takeProfit: tpPct ? entry * (long ? 1 + tpPct / 100 : 1 - tpPct / 100) : null,
  };
}

/** Rough isolated-margin liquidation distance in % of price (ignores fees/funding). */
export function liquidationDistancePct(leverage, maintenanceMarginPct = 0.5) {
  return 100 / leverage - maintenanceMarginPct;
}

export const MAX_FUTURES_LEVERAGE = 20;

/** Largest allowed stop loss (% of price) at this leverage: 80% of the liquidation distance. */
export function maxFuturesStopLoss(leverage) {
  return parseFloat((liquidationDistancePct(leverage) * 0.8).toFixed(2));
}

/** P&L in USDT for a closed futures position (fees not included, same as spot). */
export function futuresPnl(direction, entry, exit, qty) {
  const diff = direction === 'LONG' ? exit - entry : entry - exit;
  return parseFloat((diff * qty).toFixed(6));
}
