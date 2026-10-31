/**
 * Referral code from a display name plus random suffix.
 * Shared by the email signup route and wallet sign-in.
 */
export function generateReferralCode(name) {
  const base = String(name || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'USER';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${rand}`;
}
