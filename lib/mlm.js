import User from './models/User.js';

// Trade: 15% total cut from user's profit
// Platform always gets 5%; remaining 10% split across up to 3 referral levels
export const TRADE_PLATFORM_RATE = 5;
export const TRADE_MLM_RATES     = [6, 3, 1]; // L1, L2, L3 (must sum to 10)

// Subscription: 20% total split across up to 3 referral levels
export const SUB_MLM_RATES = [0.12, 0.05, 0.03]; // 12%, 5%, 3% of plan price

// Walk up the referredBy chain from userId, returns [L1, L2, L3] User docs
export async function getReferralChain(userId, maxLevels = 3) {
  const chain = [];
  let currentUserId = userId;

  for (let i = 0; i < maxLevels; i++) {
    const currentUser = await User.findById(currentUserId).select('referredBy');
    if (!currentUser?.referredBy) break;
    const referrer = await User.findOne({ referralCode: currentUser.referredBy }).select('_id referredBy');
    if (!referrer) break;
    chain.push(referrer);
    currentUserId = referrer._id;
  }

  return chain; // index 0 = direct referrer (L1), index 1 = L2, index 2 = L3
}
