import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

const LEVELS = [
  { name: 'Bronze', min: 0,  max: 4  },
  { name: 'Silver', min: 5,  max: 19 },
  { name: 'Gold',   min: 20, max: 49 },
  { name: 'Platinum', min: 50, max: Infinity },
];

const LEVEL_PERKS = {
  Bronze:   ['Community access'],
  Silver:   ['Priority support', '5% fee discount'],
  Gold:     ['10% fee discount', 'Exclusive signals'],
  Platinum: ['15% fee discount', 'VIP support', 'Early feature access'],
};

const MILESTONES = [
  { count: 3,  reward: 5  },
  { count: 5,  reward: 10 },
  { count: 10, reward: 25 },
  { count: 25, reward: 50 },
  { count: 50, reward: 100 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const referralCount = await User.countDocuments({ referredBy: user.referralCode });

  // Determine current level
  const currentLevel = LEVELS.find(l => referralCount >= l.min && referralCount <= l.max) || LEVELS[0];
  const currentLevelIndex = LEVELS.indexOf(currentLevel);
  const isMaxLevel = currentLevelIndex === LEVELS.length - 1;

  // Next level info
  let nextLevel = null;
  let nextLevelAt = null;
  let progress = 1;

  if (!isMaxLevel) {
    const next = LEVELS[currentLevelIndex + 1];
    nextLevel = next.name;
    nextLevelAt = next.min;
    progress = Math.min(1, referralCount / nextLevelAt);
  }

  // Milestones with reached flag
  const milestones = MILESTONES.map(m => ({
    count: m.count,
    reward: m.reward,
    reached: referralCount >= m.count,
  }));

  // Perks for current level
  const perks = LEVEL_PERKS[currentLevel.name] || [];

  const isSubscribed = !!(user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date());

  return NextResponse.json({
    referralCount,
    level: currentLevel.name,
    nextLevel,
    nextLevelAt,
    progress: parseFloat(progress.toFixed(4)),
    milestones,
    perks,
    isSubscribed,
  });
}
