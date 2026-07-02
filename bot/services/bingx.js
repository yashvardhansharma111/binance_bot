import axios from 'axios';
import https from 'https';
import { createHmac } from 'crypto';

const BASES = ['https://open-api.bingx.com', 'https://open-api.bingx.pro'];

// BingX uses intermediate CAs not always in outdated server CA bundles.
// Disable strict SSL only for BingX calls — all other outbound traffic unaffected.
const bingxAxios = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// BingX uses "BTC-USDT" format; Binance uses "BTCUSDT"
function toSymbol(s) {
  if (s.endsWith('USDT')) return s.slice(0, -4) + '-USDT';
  if (s.endsWith('BTC'))  return s.slice(0, -3)  + '-BTC';
  if (s.endsWith('ETH'))  return s.slice(0, -3)  + '-ETH';
  return s;
}

// BingX requires keys sorted alphabetically before signing
function buildSigned(apiSecret, params = {}) {
  const p  = { ...params, timestamp: Date.now() };
  const qs = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&');
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return { ...p, signature: sig };
}

function headers(apiKey) {
  return { 'X-BX-APIKEY': apiKey };
}

function orderError(e) {
  const code = e.response?.data?.code;
  const msg  = e.response?.data?.msg || e.message;
  return new Error(code ? `BingX error ${code}: ${msg}` : msg);
}

// ── Market data ───────────────────────────────────────────────────────────────

export async function getCandles(symbol, interval = '5m', limit = 100) {
  for (const base of BASES) {
    try {
      const { data } = await bingxAxios.get(`${base}/openApi/spot/v2/market/kline`, {
        params: { symbol: toSymbol(symbol), interval, limit },
        timeout: 10000,
      });
      if (data?.code !== 0) {
        // Symbol not available on BingX — return empty so bot's candle guard handles it
        console.warn(`[BingX] getCandles ${symbol}: code=${data?.code} msg=${data?.msg}`);
        return [];
      }
      // BingX v2 returns data.data as the array directly (not data.data.klines)
      const klines = Array.isArray(data?.data) ? data.data : (data?.data?.klines || []);
      return klines.map(c => ({
        open:   parseFloat(c[1]),
        high:   parseFloat(c[2]),
        low:    parseFloat(c[3]),
        close:  parseFloat(c[4]),
        volume: parseFloat(c[5]),
      }));
    } catch (e) {
      if (base === BASES[BASES.length - 1]) throw e;
    }
  }
}

export async function getCurrentPrice(symbol) {
  for (const base of BASES) {
    try {
      const { data } = await bingxAxios.get(`${base}/openApi/spot/v1/ticker/price`, {
        params: { symbol: toSymbol(symbol) },
        timeout: 5000,
      });
      // BingX returns data.data as object OR array depending on version/symbol
      const priceData = Array.isArray(data?.data) ? data.data[0] : data?.data;
      const price = parseFloat(priceData?.price);
      if (price > 0) return price;
      // fallthrough to kline fallback
    } catch { /* try next */ }

    // Fallback: last 1m kline close price
    try {
      const { data } = await bingxAxios.get(`${base}/openApi/spot/v2/market/kline`, {
        params: { symbol: toSymbol(symbol), interval: '1m', limit: 1 },
        timeout: 5000,
      });
      if (data?.code === 0 && Array.isArray(data?.data) && data.data.length > 0) {
        const price = parseFloat(data.data[0][4]); // index 4 = close
        if (price > 0) return price;
      }
    } catch { /* try next base */ }
  }
  throw new Error(`Cannot fetch price for ${symbol} on BingX — ticker and kline both failed`);
}

// ── Authenticated ─────────────────────────────────────────────────────────────

async function fetchBingXBalances(apiKey, apiSecret) {
  for (const base of BASES) {
    try {
      const { data } = await bingxAxios.get(`${base}/openApi/spot/v1/account/balance`, {
        params:  buildSigned(apiSecret),
        headers: headers(apiKey),
        timeout: 12000,
      });
      return data?.data?.balance?.balances || data?.data?.balances || [];
    } catch (e) {
      if (base === BASES[BASES.length - 1]) throw e;
    }
  }
  return [];
}

export async function getUSDTBalance(apiKey, apiSecret) {
  if (process.env.DRY_RUN === 'true') return 10000;
  const list = await fetchBingXBalances(apiKey, apiSecret);
  const usdt = list.find(b => b.asset === 'USDT');
  return parseFloat(usdt?.free || 0);
}

export async function getAssetBalance(apiKey, apiSecret, symbol) {
  if (process.env.DRY_RUN === 'true') return 0;
  const asset = symbol.replace(/USDT$|BTC$|ETH$/, '');
  try {
    const list = await fetchBingXBalances(apiKey, apiSecret);
    const b = list.find(b => b.asset === asset);
    return parseFloat(b?.free || 0);
  } catch {
    return 0;
  }
}

// BingX POST orders: params must go in the request BODY as form-encoded,
// NOT in the URL query string. Signature covers the sorted body string.
function buildOrderBody(apiSecret, params) {
  const p  = { ...params, timestamp: Date.now() };
  const qs = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&');
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return `${qs}&signature=${sig}`;
}

export async function placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount) {
  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    const qty   = usdtAmount / price;
    return { orderId: `DRY_${Date.now()}`, price, qty, total: usdtAmount };
  }

  const body = buildOrderBody(apiSecret, {
    symbol:        toSymbol(symbol),
    side:          'BUY',
    type:          'MARKET',
    quoteOrderQty: parseFloat(usdtAmount.toFixed(2)),
  });

  try {
    const { data } = await bingxAxios.post(`${BASES[0]}/openApi/spot/v1/trade/order`, body, {
      headers: { ...headers(apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    if (data.code !== 0) throw new Error(data.msg || `BingX order error ${data.code}`);
    const r     = data?.data || {};
    const qty   = parseFloat(r.executedQty   || 0);
    const total = parseFloat(r.cummulativeQuoteQty || usdtAmount);
    const price = qty > 0 ? total / qty : await getCurrentPrice(symbol);
    if (!price || !qty) throw new Error(`BingX order returned empty fill — qty:${qty} price:${price}`);
    return { orderId: String(r.orderId || Date.now()), price, qty, total };
  } catch (e) { throw orderError(e); }
}

export async function placeMarketSell(apiKey, apiSecret, symbol, qty) {
  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    return { orderId: `DRY_${Date.now()}`, price, qty, total: qty * price };
  }

  const body = buildOrderBody(apiSecret, {
    symbol:   toSymbol(symbol),
    side:     'SELL',
    type:     'MARKET',
    quantity: qty,
  });

  try {
    const { data } = await bingxAxios.post(`${BASES[0]}/openApi/spot/v1/trade/order`, body, {
      headers: { ...headers(apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    if (data.code !== 0) throw new Error(data.msg || `BingX order error ${data.code}`);
    const r           = data?.data || {};
    const executedQty = parseFloat(r.executedQty || qty);
    const total       = parseFloat(r.cummulativeQuoteQty || 0);
    const price       = executedQty > 0 ? total / executedQty : await getCurrentPrice(symbol);
    return { orderId: String(r.orderId || Date.now()), price, qty: executedQty, total };
  } catch (e) { throw orderError(e); }
}
