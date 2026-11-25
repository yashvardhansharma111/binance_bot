import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/lib/models/User';
import { getAdmin, notifyBotChange, startBlocker } from '@/lib/adminBots';

/** Start or stop one user's bot. Body: { userId, action: 'start' | 'stop' } */
export async function POST(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, action } = await req.json().catch(() => ({}));
  if (!mongoose.isValidObjectId(userId) || !['start', 'stop'].includes(action)) {
    return NextResponse.json({ error: 'userId and action (start|stop) required' }, { status: 400 });
  }

  const user = await User.findById(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (action === 'start') {
    const reason = await startBlocker(user);
    if (reason) return NextResponse.json({ error: `Cannot start: ${reason}` }, { status: 400 });
    await User.updateOne({ _id: user._id }, { $set: { botActive: true, botStoppedByAdmin: false } });
  } else {
    await User.updateOne({ _id: user._id }, { $set: { botActive: false, botStoppedByAdmin: true } });
  }
  await notifyBotChange([user._id], action);

  console.log(`[Admin] ${admin.email} ${action === 'start' ? 'started' : 'stopped'} bot for ${user.email}`);
  return NextResponse.json({ botActive: action === 'start' });
}
