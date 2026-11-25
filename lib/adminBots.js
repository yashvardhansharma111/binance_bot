import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import ApiKey from '@/lib/models/ApiKey';
import BotLog from '@/lib/models/BotLog';

/** Returns the admin user, or null when the caller is not an admin. */
export async function getAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  return user?.role === 'admin' ? user : null;
}

/** Bot log entry + push notification for each user. Never throws. */
export async function notifyBotChange(userIds, action) {
  if (!userIds.length) return;
  const stopped = action === 'stop';
  await BotLog.insertMany(userIds.map(userId => ({
    userId,
    level: stopped ? 'warn' : 'info',
    message: stopped ? '⏹ Bot stopped by admin' : '▶️ Bot started by admin',
  }))).catch(() => {});
  try {
    const { sendPush } = await import('@/lib/fcm.js');
    await Promise.allSettled(userIds.map(id => sendPush(
      id,
      stopped ? '⏹ Bot Stopped' : '🤖 Bot Started',
      stopped ? 'Your trading bot was stopped by the admin' : 'Your trading bot was started by the admin',
    )));
  } catch {}
}

/**
 * Same rules as a user starting their own bot: account must be active and
 * have an active exchange API key. Returns null when OK, else the reason.
 */
export async function startBlocker(user) {
  if (user.status !== 'active') return `Account is ${user.status}`;
  const key = await ApiKey.exists({ userId: user._id, isActive: true });
  return key ? null : 'No active API key';
}
