import { NextResponse } from 'next/server';
import User from '@/lib/models/User';
import { getAdmin, notifyBotChange, startBlocker } from '@/lib/adminBots';

/**
 * Resumes only the bots the admin stopped. Users who never started their bot,
 * or stopped it themselves, are not touched.
 */
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const candidates = await User.find({ botStoppedByAdmin: true, botActive: false });
  const startIds = [];
  const skipped = [];
  for (const u of candidates) {
    const reason = await startBlocker(u);
    if (reason) skipped.push({ email: u.email, reason });
    else startIds.push(u._id);
  }

  if (startIds.length) {
    await User.updateMany(
      { _id: { $in: startIds } },
      { $set: { botActive: true, botStoppedByAdmin: false } }
    );
    await notifyBotChange(startIds, 'start');
  }

  console.log(`[Admin] ${admin.email} started all admin-stopped bots (${startIds.length}, skipped ${skipped.length})`);
  return NextResponse.json({ started: startIds.length, skipped });
}
