import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { quoteSwap } from '@/lib/quoteSwap';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const quote = await quoteSwap(body);
    return NextResponse.json(quote);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[swap/quote]', err.message);
    return NextResponse.json(
      { error: status === 500 ? 'Could not fetch quote' : err.message },
      { status }
    );
  }
}
