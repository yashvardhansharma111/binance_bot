import axios from 'axios';
import Binance from 'node-binance-api';

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

function client(apiKey, apiSecret) {
  const opts = {
    APIKEY: apiKey, APISECRET: apiSecret,
    useServerTime: true, recvWindow: 60000, family: 4,
  };
  if (TESTNET) {
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
  if (stepCache[symbol]) return stepCache[symbol];
  const base = TESTNET ? TESTNET_API : BASE;
  const { data } = await axios.get(`${base}/api/v3/exchangeInfo`, { params: { symbol } });
  const lot = data.symbols[0].filters.find(f => f.filterType === 'LOT_SIZE');
  stepCache[symbol] = parseFloat(lot.stepSize);
  return stepCache[symbol];
}
function roundStep(qty, step) {
  return parseFloat(qty.toFixed(Math.round(-Math.log10(step))));
}

// ── Orders ────────────────────────────────────────────────────────────────────

function binanceError(err) {
  // node-binance-api passes raw JSON strings in err.body — parse for a clean message
  try {
    const parsed = JSON.parse(err.body || err.message);
    const code   = parsed.code ?? '';
    const msg    = parsed.msg  ?? err.message;
    if (code === -2015) return new Error(`Binance API key missing Spot Trading permission or VPS IP not whitelisted (code -2015)`);
    return new Error(`Binance error ${code}: ${msg}`);
  } catch {
    return new Error(err.body || err.message || String(err));
  }
}

export async function placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount) {
  const price = await getCurrentPrice(symbol);
  const step  = await getStepSize(symbol);
  const qty   = roundStep(usdtAmount / price, step);

  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY_RUN] BUY ${qty} ${symbol} @ $${price}`);
    return { orderId: `DRY_${Date.now()}`, price, qty, total: qty * price };
  }

  return new Promise((resolve, reject) => {
    try {
      client(apiKey, apiSecret).marketBuy(symbol, qty, (err, r) => {
        if (err) return reject(binanceError(err));
        const fill = parseFloat(r.fills?.[0]?.price || price);
        resolve({ orderId: String(r.orderId), price: fill, qty, total: qty * fill });
      });
    } catch (e) {
      reject(binanceError(e));
    }
  });
}

export async function placeMarketSell(apiKey, apiSecret, symbol, qty) {
  const step    = await getStepSize(symbol);
  const safeQty = roundStep(qty, step);
  const price   = await getCurrentPrice(symbol);

  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY_RUN] SELL ${safeQty} ${symbol} @ $${price}`);
    return { orderId: `DRY_${Date.now()}`, price, qty: safeQty, total: safeQty * price };
  }

  return new Promise((resolve, reject) => {
    try {
      client(apiKey, apiSecret).marketSell(symbol, safeQty, (err, r) => {
        if (err) return reject(binanceError(err));
        const fill = parseFloat(r.fills?.[0]?.price || price);
        resolve({ orderId: String(r.orderId), price: fill, qty: safeQty, total: safeQty * fill });
      });
    } catch (e) {
      reject(binanceError(e));
    }
  });
}
