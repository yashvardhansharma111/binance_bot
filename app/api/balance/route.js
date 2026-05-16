import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import { decrypt } from '@/lib/encryption';
import Binance from 'node-binance-api';

const TESTNET_BASE = 'https://testnet.binance.vision/api/';
const TESTNET_WS   = 'wss://testnet.binance.vision/ws';

function makeClient(apiKey, apiSecret, isTestnet) {
  const opts = { APIKEY: apiKey, APISECRET: apiSecret, useServerTime: true, recvWindow: 60000, family: 4 };
  if (isTestnet) opts.urls = { base: TESTNET_BASE, stream: TESTNET_WS };
  console.log(`[balance] Creating Binance client — testnet:${isTestnet}`);
  return new Binance().options(opts);
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    console.log('[balance] No session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[balance] Session email: ${session.user?.email} | id: ${session.user?.id}`);

  await connectDB();

  // Always look up user by email — session.user.id may be missing without authOptions
  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    console.log('[balance] User not found in DB');
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  console.log(`[balance] Found user: ${user._id}`);

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) {
    console.log(`[balance] No active API key for userId: ${user._id}`);
    return NextResponse.json({ error: 'No API key configured' }, { status: 404 });
  }

  console.log(`[balance] Found API key — accountType:${keyDoc.accountType} label:${keyDoc.label}`);

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch (e) {
    console.error('[balance] Decrypt failed:', e.message);
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  const isTestnet = keyDoc.accountType === 'testnet';

  return new Promise(resolve => {
    makeClient(apiKey, apiSecret, isTestnet).balance((err, data) => {
      if (err) {
        const errMsg = err.body || err.message || String(err);
        console.error('[balance] Binance error:', errMsg);
        resolve(NextResponse.json({ error: errMsg }, { status: 502 }));
        return;
      }
      const balances = Object.entries(data)
        .map(([asset, { available, onOrder }]) => ({
          asset,
          free:   parseFloat(available),
          locked: parseFloat(onOrder),
        }))
        .filter(b => b.free > 0 || b.locked > 0)
        .sort((a, b) => b.free - a.free);

      console.log(`[balance] Success — ${balances.length} non-zero assets`);
      resolve(NextResponse.json({ balances, dryRun: false, accountType: keyDoc.accountType }));
    });
  });
}
