import axios from 'axios';
import Binance from 'node-binance-api';
import { createHmac } from 'crypto';

const TESTNET = process.env.BINANCE_TESTNET === 'true';

// Testnet uses real market prices for candles (public API stays on mainnet)
// but routes authenticated orders to the testnet exchange
const BASE             = 'https://api.binance.com';           // always mainnet for candles/price
const TESTNET_WS       = 'wss://testnet.binance.vision/ws';
const TESTNET_API      = 'https://testnet.binance.vision';    // for axios (appends /api/v3/... manually)
const TESTNET_CLIENT   = 'https://testnet.binance.vision/api/'; // node-binance-api appends 'v3/' directly

if (TESTNET) console.log('[Binance] ⚠️  TESTNET MODE — fake money, real prices');

// ── Market data — always mainnet (real prices) ────────────────────────────────

export async function getCandles(symbol, interval = '5m', limit = 100) {
  const { data } = await axios.get(`${BASE}/api/v3/klines`, {
    params: { symbol, interval, limit },
    timeout: 10000,
  });
  return data.map(c => ({
    open: parseFloat(c[1]), high: parseFloat(c[2]),
    low:  parseFloat(c[3]), close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

export async function getCurrentPrice(symbol) {
  const { data } = await axios.get(`${BASE}/api/v3/ticker/price`, {
    params: { symbol }, timeout: 5000,
  });
  return parseFloat(data.price);
}

// ── Authenticated client — testnet or live ────────────────────────────────────

// isTestnet: explicit per-call override; falls back to global TESTNET env var
function client(apiKey, apiSecret, isTestnet = TESTNET) {
  const opts = {
    APIKEY: apiKey, APISECRET: apiSecret,
    useServerTime: true, recvWindow: 60000, family: 4,
  };
  if (isTestnet) {
    opts.urls = {
      base:   TESTNET_CLIENT,
      stream: TESTNET_WS,
    };
  }
  return new Binance().options(opts);
}

// ── Balance ───────────────────────────────────────────────────────────────────

export async function getUSDTBalance(apiKey, apiSecret) {
  if (process.env.DRY_RUN === 'true') return 10000; // simulated balance in dry-run mode
  return new Promise((resolve, reject) => {
    client(apiKey, apiSecret).balance((err, b) => {
      if (err) return reject(new Error(err.body || err.message));
      resolve(parseFloat(b?.USDT?.available || 0));
    });
  });
}

export async function testConnection(apiKey, apiSecret) {
  const usdt = await getUSDTBalance(apiKey, apiSecret);
  return { connected: true, USDT: usdt, testnet: TESTNET };
}

// ── Step size (LOT_SIZE) ──────────────────────────────────────────────────────

const stepCache = {};
async function getStepSize(symbol) {
  // Always use mainnet for exchange info — testnet has the same symbols/lot sizes
  if (stepCache[symbol]) return stepCache[symbol];
  const { data } = await axios.get(`${BASE}/api/v3/exchangeInfo`, { params: { symbol } });
  const lot = data.symbols[0].filters.find(f => f.filterType === 'LOT_SIZE');
  stepCache[symbol] = parseFloat(lot.stepSize);
  return stepCache[symbol];
}
function roundStep(qty, step) {
  return parseFloat(qty.toFixed(Math.round(-Math.log10(step))));
}

// ── Orders (direct axios — node-binance-api hangs silently on testnet) ────────

function orderError(e) {
  const code = e.response?.data?.code;
  const msg  = e.response?.data?.msg || e.message;
  if (code === -2015) return new Error('Binance API key missing Spot Trading permission or IP not whitelisted (code -2015)');
  return new Error(code ? `Binance error ${code}: ${msg}` : msg);
}

function signedOrderUrl(base, apiSecret, params) {
  const p   = { ...params, timestamp: Date.now(), recvWindow: 60000 };
  const qs  = new URLSearchParams(p).toString();
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return `${base}/api/v3/order?${qs}&signature=${sig}`;
}

export async function placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount, isTestnet = TESTNET) {
  console.log(`[binance] placeMarketBuy symbol=${symbol} usdt=${usdtAmount} testnet=${isTestnet}`);

  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    const step  = await getStepSize(symbol);
    const qty   = roundStep(usdtAmount / price, step);
    console.log(`[DRY_RUN] BUY ${qty} ${symbol} @ $${price}`);
    return { orderId: `DRY_${Date.now()}`, price, qty, total: qty * price };
  }

  const base = isTestnet ? TESTNET_API : BASE;
  // quoteOrderQty = spend exactly this many USDT; Binance computes qty
  const url  = signedOrderUrl(base, apiSecret, { symbol, side: 'BUY', type: 'MARKET', quoteOrderQty: usdtAmount });
  console.log(`[binance] POST ${base}/api/v3/order BUY quoteOrderQty=${usdtAmount}`);

  try {
    const { data: r } = await axios.post(url, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000,
    });
    const qty   = parseFloat(r.executedQty);
    const total = parseFloat(r.cummulativeQuoteQty);
    const price = qty > 0 ? total / qty : await getCurrentPrice(symbol);
    console.log(`[binance] BUY success orderId=${r.orderId} qty=${qty} price=${price}`);
    return { orderId: String(r.orderId), price, qty, total };
  } catch (e) {
    console.error(`[binance] BUY failed:`, e.response?.data || e.message);
    throw orderError(e);
  }
}

export async function placeMarketSell(apiKey, apiSecret, symbol, qty, isTestnet = TESTNET) {
  console.log(`[binance] placeMarketSell symbol=${symbol} qty=${qty} testnet=${isTestnet}`);

  const step    = await getStepSize(symbol);
  const safeQty = roundStep(qty, step);

  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    console.log(`[DRY_RUN] SELL ${safeQty} ${symbol} @ $${price}`);
    return { orderId: `DRY_${Date.now()}`, price, qty: safeQty, total: safeQty * price };
  }

  const base = isTestnet ? TESTNET_API : BASE;
  const url  = signedOrderUrl(base, apiSecret, { symbol, side: 'SELL', type: 'MARKET', quantity: safeQty });
  console.log(`[binance] POST ${base}/api/v3/order SELL quantity=${safeQty}`);

  try {
    const { data: r } = await axios.post(url, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000,
    });
    const executedQty = parseFloat(r.executedQty);
    const total       = parseFloat(r.cummulativeQuoteQty);
    const price       = executedQty > 0 ? total / executedQty : await getCurrentPrice(symbol);
    console.log(`[binance] SELL success orderId=${r.orderId} qty=${executedQty} price=${price}`);
    return { orderId: String(r.orderId), price, qty: executedQty, total };
  } catch (e) {
    console.error(`[binance] SELL failed:`, e.response?.data || e.message);
    throw orderError(e);
  }
}
