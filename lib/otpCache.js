import NodeCache from 'node-cache';

// Global singleton so hot-reload doesn't wipe OTPs in development
const otpCache = globalThis.__otpCache
  || (globalThis.__otpCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }));

export default otpCache;

export function setOtp(purpose, email, otp) {
  otpCache.set(`${purpose}:${email.toLowerCase()}`, otp, 600); // 10 min TTL
}

export function getOtp(purpose, email) {
  return otpCache.get(`${purpose}:${email.toLowerCase()}`);
}

export function deleteOtp(purpose, email) {
  otpCache.del(`${purpose}:${email.toLowerCase()}`);
}
