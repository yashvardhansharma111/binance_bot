import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SiweMessage } from 'siwe';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import WalletNonce from '@/lib/models/WalletNonce';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Attach a verified wallet to the signed-in account. */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, signature } = await req.json();
    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    await connectDB();

    let fields;
    try {
      const siwe = new SiweMessage(JSON.parse(message));
      const result = await siwe.verify({ signature });
      if (!result.success) throw new Error('bad');
      fields = result.data;
    } catch {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const address = fields.address.toLowerCase();

    // Burn the nonce so the same signature cannot be reused.
    const record = await WalletNonce.findOne({ address });
    if (!record || record.nonce !== fields.nonce) {
      return NextResponse.json({ error: 'Nonce expired — try again' }, { status: 400 });
    }
    await WalletNonce.deleteOne({ _id: record._id });

    // A wallet may only belong to one account.
    const taken = await User.findOne({ walletAddress: address });
    if (taken && taken._id.toString() !== session.user.id) {
      return NextResponse.json(
        { error: 'This wallet is already linked to another account' },
        { status: 409 }
      );
    }

    await User.findByIdAndUpdate(session.user.id, { walletAddress: address });

    return NextResponse.json({ ok: true, walletAddress: address });
  } catch (err) {
    console.error('[wallet/link]', err.message);
    return NextResponse.json({ error: 'Could not link wallet' }, { status: 500 });
  }
}

/** Detach the wallet — refused if it is the account's only credential. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.user.id).select('email password walletAddress');
    if (!user?.walletAddress) {
      return NextResponse.json({ error: 'No wallet linked' }, { status: 400 });
    }
    if (!user.email || !user.password) {
      return NextResponse.json(
        { error: 'Set an email and password first — this wallet is your only way to sign in.' },
        { status: 400 }
      );
    }

    await User.findByIdAndUpdate(session.user.id, { $unset: { walletAddress: 1 } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[wallet/link DELETE]', err.message);
    return NextResponse.json({ error: 'Could not unlink wallet' }, { status: 500 });
  }
}
