import axios from 'axios';
import { createHmac } from 'crypto';

const BASES = ['https://open-api.bingx.com', 'https://open-api.bingx.pro'];

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
      const { data } = await axios.get(`${base}/openApi/spot/v2/market/kline`, {
        params: { symbol: toSymbol(symbol), interval, limit },
        timeout: 10000,
      });
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
      const { data } = await axios.get(`${base}/openApi/spot/v1/ticker/price`, {
        params: { symbol: toSymbol(symbol) },
        timeout: 5000,
      });
      return parseFloat(data?.data?.price || 0);
    } catch (e) {
      if (base === BASES[BASES.length - 1]) throw e;
    }
  }
}

// ── Authenticated ─────────────────────────────────────────────────────────────

export async function getUSDTBalance(apiKey, apiSecret) {
  if (process.env.DRY_RUN === 'true') return 10000;
  for (const base of BASES) {
    try {
      const { data } = await axios.get(`${base}/openApi/spot/v1/account/balance`, {
        params:  buildSigned(apiSecret),
        headers: headers(apiKey),
        timeout: 12000,
      });
      const list = data?.data?.balance?.balances || data?.data?.balances || [];
      const usdt = list.find(b => b.asset === 'USDT');
      return parseFloat(usdt?.free || 0);
    } catch (e) {
      if (base === BASES[BASES.length - 1]) throw e;
    }
  }
  return 0;
}

export async function placeMarketBuy(apiKey, apiSecret, symbol, usdtAmount) {
  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    const qty   = usdtAmount / price;
    return { orderId: `DRY_${Date.now()}`, price, qty, total: usdtAmount };
  }

  const params = buildSigned(apiSecret, {
    symbol:        toSymbol(symbol),
    side:          'BUY',
    type:          'MARKET',
    quoteOrderQty: parseFloat(usdtAmount.toFixed(2)),
  });

  try {
    const { data } = await axios.post(`${BASES[0]}/openApi/spot/v1/trade/order`, null, {
      params, headers: headers(apiKey), timeout: 15000,
    });
    const r     = data?.data || {};
    const qty   = parseFloat(r.executedQty   || 0);
    const total = parseFloat(r.cummulativeQuoteQty || usdtAmount);
    const price = qty > 0 ? total / qty : await getCurrentPrice(symbol);
    return { orderId: String(r.orderId || Date.now()), price, qty, total };
  } catch (e) { throw orderError(e); }
}

export async function placeMarketSell(apiKey, apiSecret, symbol, qty) {
  if (process.env.DRY_RUN === 'true') {
    const price = await getCurrentPrice(symbol);
    return { orderId: `DRY_${Date.now()}`, price, qty, total: qty * price };
  }

  const params = buildSigned(apiSecret, {
    symbol:   toSymbol(symbol),
    side:     'SELL',
    type:     'MARKET',
    quantity: qty,
  });

  try {
    const { data } = await axios.post(`${BASES[0]}/openApi/spot/v1/trade/order`, null, {
      params, headers: headers(apiKey), timeout: 15000,
    });
    const r           = data?.data || {};
    const executedQty = parseFloat(r.executedQty || qty);
    const total       = parseFloat(r.cummulativeQuoteQty || 0);
    const price       = executedQty > 0 ? total / executedQty : await getCurrentPrice(symbol);
    return { orderId: String(r.orderId || Date.now()), price, qty: executedQty, total };
  } catch (e) { throw orderError(e); }
}
