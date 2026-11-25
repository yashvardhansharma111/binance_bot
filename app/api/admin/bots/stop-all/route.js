import { NextResponse } from 'next/server';
import User from '@/lib/models/User';
import { getAdmin, notifyBotChange } from '@/lib/adminBots';

/**
 * Admin kill switch: turns off every running bot and marks it as stopped by
 * the admin, so "Start All" can later resume exactly these bots.
 * Open trades are left as they are.
 */
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const running = await User.find({ botActive: true }).select('_id').lean();
  const ids = running.map(u => u._id);
  if (!ids.length) return NextResponse.json({ stopped: 0 });

  const { modifiedCount } = await User.updateMany(
    { _id: { $in: ids }, botActive: true },
    { $set: { botActive: false, botStoppedByAdmin: true } }
  );
  await notifyBotChange(ids, 'stop');

  console.log(`[Admin] ${admin.email} stopped all bots (${modifiedCount})`);
  return NextResponse.json({ stopped: modifiedCount });
}
