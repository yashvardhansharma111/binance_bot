import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createHmac } from 'crypto';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import { decrypt } from '@/lib/encryption';

const REAL_BASE    = 'https://api.binance.com';
const TESTNET_BASE = 'https://testnet.binance.vision';

function sign(secret, queryString) {
  return createHmac('sha256', secret).update(queryString).digest('hex');
}

async function fetchBalance(apiKey, apiSecret, isTestnet) {
  const base      = isTestnet ? TESTNET_BASE : REAL_BASE;
  const timestamp = Date.now();
  const qs        = `timestamp=${timestamp}&recvWindow=10000`;
  const signature = sign(apiSecret, qs);
  const url       = `${base}/api/v3/account?${qs}&signature=${signature}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10s hard timeout

  try {
    const res = await fetch(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
      signal: controller.signal,
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.msg || `Binance error ${res.status}`;
      console.error(`[balance] Binance API error: ${msg} (code ${data?.code})`);
      throw new Error(msg);
    }

    return data.balances
      .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
      .filter(b => b.free > 0 || b.locked > 0)
      .sort((a, b) => b.free - a.free);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    console.log('[balance] No session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[balance] Request from: ${session.user?.email}`);

  await connectDB();

  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    console.log('[balance] User not found');
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) {
    console.log(`[balance] No API key for user ${user._id}`);
    return NextResponse.json({ error: 'No API key configured' }, { status: 404 });
  }

  console.log(`[balance] Found key — type:${keyDoc.accountType}`);

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch (e) {
    console.error('[balance] Decrypt error:', e.message);
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  try {
    const balances = await fetchBalance(apiKey, apiSecret, keyDoc.accountType === 'testnet');
    console.log(`[balance] OK — ${balances.length} assets`);
    return NextResponse.json({ balances, dryRun: false, accountType: keyDoc.accountType });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Binance request timed out' : e.message;
    console.error('[balance] Fetch failed:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
