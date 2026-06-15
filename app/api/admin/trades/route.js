import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Trade from '@/lib/models/Trade';

async function adminGuard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  return user?.role === 'admin' ? user : null;
}

export async function GET(req) {
  const admin = await adminGuard();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'));
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const search = searchParams.get('search')?.trim() || '';
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() || '';
  const side   = searchParams.get('side')?.trim().toUpperCase() || '';
  const status = searchParams.get('status')?.trim() || '';

  const filter = {};
  if (symbol) filter.symbol = { $regex: symbol, $options: 'i' };
  if (side && ['BUY', 'SELL'].includes(side)) filter.side = side;
  if (status && ['open', 'closed'].includes(status)) filter.status = status;

  // Search by user name/email requires a user lookup first
  if (search) {
    const matchedUsers = await User.find({
      $or: [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    filter.userId = { $in: matchedUsers.map(u => u._id) };
  }

  const [total, trades] = await Promise.all([
    Trade.countDocuments(filter),
    Trade.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email'),
  ]);

  return NextResponse.json({ trades, total, page, limit, pages: Math.ceil(total / limit) });
}
