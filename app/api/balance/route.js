import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createHmac } from 'crypto';
import axios from 'axios';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import { decrypt } from '@/lib/encryption';

// ── Binance ───────────────────────────────────────────────────────────────────
const REAL_BASES   = ['https://api.binance.com', 'https://api2.binance.com', 'https://api3.binance.com'];
const TESTNET_BASE = 'https://testnet.binance.vision';

function hmac(secret, str) {
  return createHmac('sha256', secret).update(str).digest('hex');
}

async function fetchBinanceBalance(apiKey, apiSecret, isTestnet) {
  const bases = isTestnet ? [TESTNET_BASE] : REAL_BASES;
  let lastError = null;

  for (const base of bases) {
    const timestamp = Date.now();
    const qs        = `timestamp=${timestamp}&recvWindow=10000`;
    const url       = `${base}/api/v3/account?${qs}&signature=${hmac(apiSecret, qs)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res  = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey }, signal: controller.signal });
      const data = await res.json();
      clearTimeout(timer);

      if (!res.ok) {
        const msg = data?.msg || `Binance error ${res.status}`;
        if (data?.code === -1101 || res.status === 451 || res.status === 403) {
          lastError = new Error(msg); continue;
        }
        throw new Error(msg);
      }

      return data.balances
        .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
        .filter(b => b.free > 0 || b.locked > 0)
        .sort((a, b) => b.free - a.free);
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') { lastError = new Error('Request timed out'); continue; }
      if (lastError !== null)      { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error('All Binance endpoints unreachable');
}

// ── BingX ─────────────────────────────────────────────────────────────────────
const BINGX_BASE = 'https://open-api.bingx.com';

async function fetchBingXBalance(apiKey, apiSecret) {
  // Step 1: Test public connectivity (no auth) — fast 5s check
  try {
    await axios.get(`${BINGX_BASE}/openApi/spot/v1/ticker/price`, {
      params:  { symbol: 'BTC-USDT' },
      timeout: 5000,
    });
  } catch {
    throw new Error('Cannot reach BingX servers — check your internet connection or VPN');
  }

  // Step 2: Authenticated balance fetch — connectivity is confirmed
  // BingX requires params sorted alphabetically before signing
  const p   = { recvWindow: 5000, timestamp: Date.now() };
  const qs  = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&');
  const sig = hmac(apiSecret, qs);

  try {
    const { data } = await axios.get(`${BINGX_BASE}/openApi/spot/v1/account/balance`, {
      params:  { ...p, signature: sig },
      headers: { 'X-BX-APIKEY': apiKey },
      timeout: 10000,
    });

    if (data.code !== 0) throw new Error(data.msg || `BingX error ${data.code}`);

    // Response nests under data.balance.balances or data.balances depending on API version
    const list = data.data?.balance?.balances || data.data?.balances || [];
    return list
      .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
      .filter(b => b.free > 0 || b.locked > 0)
      .sort((a, b) => b.free - a.free);
  } catch (e) {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || e.message?.includes('timeout')) {
      // Public endpoint worked but auth timed out → almost certainly IP restriction on the API key
      throw new Error('BingX auth timed out — your API key likely has IP restriction enabled. Go to BingX → API Management → edit the key → disable IP restriction (or add your IP to the whitelist)');
    }
    const msg = e.response?.data?.msg || e.message;
    throw new Error(`BingX: ${msg}`);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user   = await User.findOne({ email: session.user.email });
  if (!user)   return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No API key configured' });

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  const exchange = keyDoc.exchange || 'binance';

  try {
    const balances = exchange === 'bingx'
      ? await fetchBingXBalance(apiKey, apiSecret)
      : await fetchBinanceBalance(apiKey, apiSecret, keyDoc.accountType === 'testnet');

    return NextResponse.json({ balances, exchange, dryRun: false, accountType: keyDoc.accountType });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
