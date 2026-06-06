import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import { decrypt } from '@/lib/encryption';
import { getCurrentPrice } from '@/bot/services/binance';
import { createHmac } from 'crypto';
import axios from 'axios';

const FAPI_LIVE    = 'https://fapi.binance.com';
const FAPI_TESTNET = 'https://testnet.binancefuture.com';

function fapiBase(isTestnet) {
  return isTestnet ? FAPI_TESTNET : FAPI_LIVE;
}

function signedParams(apiSecret, params) {
  const p   = { ...params, timestamp: Date.now(), recvWindow: 60000 };
  const qs  = new URLSearchParams(p).toString();
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return `${qs}&signature=${sig}`;
}

function fapiHeaders(apiKey) {
  return { 'X-MBX-APIKEY': apiKey };
}

function fapiError(e) {
  const code = e.response?.data?.code;
  const msg  = e.response?.data?.msg || e.message;
  if (code === -2015) return new Error('Futures API key missing Futures Trading permission (code -2015)');
  if (code === -4061) return new Error('Order side must match position side in hedge mode');
  return new Error(code ? `Binance Futures error ${code}: ${msg}` : msg);
}

async function setLeverage(apiKey, apiSecret, symbol, leverage, isTestnet) {
  const base = fapiBase(isTestnet);
  const qs   = signedParams(apiSecret, { symbol, leverage });
  await axios.post(`${base}/fapi/v1/leverage?${qs}`, null, {
    headers: fapiHeaders(apiKey), timeout: 8000,
  });
}

async function placeFuturesMarket(apiKey, apiSecret, symbol, side, qty, isTestnet) {
  const base = fapiBase(isTestnet);
  const qs   = signedParams(apiSecret, { symbol, side, type: 'MARKET', quantity: qty });
  const { data } = await axios.post(`${base}/fapi/v1/order?${qs}`, null, {
    headers: fapiHeaders(apiKey), timeout: 15000,
  });
  return data;
}

async function placeFuturesStopOrder(apiKey, apiSecret, symbol, side, type, stopPrice, isTestnet) {
  const base = fapiBase(isTestnet);
  const qs   = signedParams(apiSecret, {
    symbol, side, type,
    stopPrice: stopPrice.toFixed(2),
    closePosition: 'true',
    timeInForce: 'GTE_GTC',
  });
  await axios.post(`${base}/fapi/v1/order?${qs}`, null, {
    headers: fapiHeaders(apiKey), timeout: 8000,
  }).catch(e => {
    // Log but don't fail the whole trade if SL/TP order fails
    console.warn(`[futures] ${type} order failed: ${e.response?.data?.msg || e.message}`);
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { symbol, side, usdtMargin, leverage = 10, stopLossPercent, takeProfitPercent } = await req.json();

  if (!symbol || !/^[A-Z0-9]{2,20}$/.test(symbol))
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  if (!['BUY', 'SELL'].includes(side))
    return NextResponse.json({ error: 'Side must be BUY or SELL' }, { status: 400 });
  if (!usdtMargin || usdtMargin < 5)
    return NextResponse.json({ error: 'Minimum margin is $5' }, { status: 400 });
  if (leverage < 1 || leverage > 125)
    return NextResponse.json({ error: 'Leverage must be 1–125' }, { status: 400 });
  if (stopLossPercent !== undefined && (stopLossPercent < 0.1 || stopLossPercent > 50))
    return NextResponse.json({ error: 'Stop loss must be 0.1–50%' }, { status: 400 });
  if (takeProfitPercent !== undefined && (takeProfitPercent < 0.1 || takeProfitPercent > 500))
    return NextResponse.json({ error: 'Take profit must be 0.1–500%' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key. Add one in API Keys.' }, { status: 400 });

  const isTestnet = keyDoc.accountType === 'testnet';
  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  try {
    // Get current price to calculate qty
    const entryPrice = await getCurrentPrice(symbol);
    const positionSize = usdtMargin * leverage;
    // Round qty to 3 decimal places (most futures pairs allow this)
    const qty = parseFloat((positionSize / entryPrice).toFixed(3));

    if (qty <= 0) return NextResponse.json({ error: 'Calculated qty is 0 — increase margin' }, { status: 400 });

    // Set leverage
    await setLeverage(apiKey, apiSecret, symbol, leverage, isTestnet);

    // Place market order
    const order = await placeFuturesMarket(apiKey, apiSecret, symbol, side, qty, isTestnet);

    const fillPrice = parseFloat(order.avgPrice) || entryPrice;
    const filledQty = parseFloat(order.executedQty) || qty;

    // Calculate SL/TP price levels
    const isLong = side === 'BUY';
    const sl = stopLossPercent
      ? parseFloat((fillPrice * (isLong ? 1 - stopLossPercent / 100 : 1 + stopLossPercent / 100)).toFixed(2))
      : null;
    const tp = takeProfitPercent
      ? parseFloat((fillPrice * (isLong ? 1 + takeProfitPercent / 100 : 1 - takeProfitPercent / 100)).toFixed(2))
      : null;

    // Place SL/TP stop orders on the exchange (non-blocking failures)
    const closeSide = isLong ? 'SELL' : 'BUY';
    if (sl) await placeFuturesStopOrder(apiKey, apiSecret, symbol, closeSide, 'STOP_MARKET', sl, isTestnet);
    if (tp) await placeFuturesStopOrder(apiKey, apiSecret, symbol, closeSide, 'TAKE_PROFIT_MARKET', tp, isTestnet);

    // Record the trade
    const trade = await Trade.create({
      userId:     user._id,
      symbol,
      side,
      price:      fillPrice,
      qty:        filledQty,
      total:      fillPrice * filledQty,
      stopLoss:   sl,
      takeProfit: tp,
      orderId:    String(order.orderId),
      status:     'open',
      source:     'manual',
      reason:     `Futures ${isLong ? 'LONG' : 'SHORT'} ${leverage}x`,
    });

    return NextResponse.json({ trade, leverage, margin: usdtMargin });
  } catch (err) {
    console.error('[futures] Order failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
