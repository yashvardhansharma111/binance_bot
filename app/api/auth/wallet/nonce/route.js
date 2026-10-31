import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { connectDB } from '@/lib/db';
import WalletNonce from '@/lib/models/WalletNonce';

export const dynamic = 'force-dynamic';

const isAddress = (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a);

/**
 * Issues a one-time nonce for a wallet to sign (SIWE).
 * Deliberately does NOT touch the User collection — requesting a nonce is
 * unauthenticated, so creating rows here would let anyone spam accounts.
 * The row is consumed (deleted) during sign-in and expires via TTL otherwise.
 */
export async function POST(req) {
  try {
    const { address } = await req.json();
    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    await connectDB();

    const lower = address.toLowerCase();
    const nonce = randomBytes(16).toString('hex');

    // One live nonce per address — replace any previous one.
    await WalletNonce.findOneAndUpdate(
      { address: lower },
      { address: lower, nonce, createdAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ nonce });
  } catch (err) {
    console.error('[wallet/nonce]', err.message);
    return NextResponse.json({ error: 'Could not issue nonce' }, { status: 500 });
  }
}
