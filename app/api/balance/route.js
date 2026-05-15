import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import { decrypt } from '@/lib/encryption';
import Binance from 'node-binance-api';

const TESTNET        = process.env.BINANCE_TESTNET === 'true';
const TESTNET_CLIENT = 'https://testnet.binance.vision/api/';
const TESTNET_WS     = 'wss://testnet.binance.vision/ws';

function client(apiKey, apiSecret) {
  const opts = { APIKEY: apiKey, APISECRET: apiSecret, useServerTime: true, recvWindow: 60000, family: 4 };
  if (TESTNET) opts.urls = { base: TESTNET_CLIENT, stream: TESTNET_WS };
  return new Binance().options(opts);
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (process.env.DRY_RUN === 'true') {
    return NextResponse.json({
      balances: [
        { asset: 'USDT', free: 10000, locked: 0 },
        { asset: 'BTC',  free: 0.123, locked: 0 },
        { asset: 'ETH',  free: 1.5,   locked: 0 },
      ],
      dryRun: true,
    });
  }

  await connectDB();
  const keyDoc = await ApiKey.findOne({
    userId: session.user.id,
    isActive: true,
  });
  if (!keyDoc) return NextResponse.json({ error: 'No API key configured' }, { status: 404 });

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  return new Promise(resolve => {
    client(apiKey, apiSecret).balance((err, data) => {
      if (err) {
        resolve(NextResponse.json({ error: err.body || err.message }, { status: 502 }));
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
      resolve(NextResponse.json({ balances, dryRun: false }));
    });
  });
}
