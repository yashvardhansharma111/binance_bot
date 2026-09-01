import { connectDB } from '@/lib/db';

let admin = null;
let firebaseInitialized = false;
let initAttempted = false;

function initFirebase() {
  if (initAttempted) return;
  initAttempted = true;

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountEnv) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT env var not set — push notifications disabled');
    return;
  }

  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    firebaseInitialized = true;
  } catch (err) {
    console.warn('[FCM] firebase-admin init failed:', err.message);
    admin = null;
  }
}

export async function sendPush(userId, title, body, data = {}) {
  try {
    initFirebase();

    if (!firebaseInitialized || !admin) return;

    await connectDB();
    const FcmToken = (await import('@/lib/models/FcmToken.js')).default;
    const tokens = await FcmToken.find({ userId });

    if (!tokens || tokens.length === 0) return;

    for (const tokenDoc of tokens) {
      try {
        await admin.messaging().send({
          token: tokenDoc.token,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
        });
      } catch (err) {
        const errCode = err.code || err.errorInfo?.code || '';
        const isInvalid =
          errCode.includes('invalid-argument') ||
          errCode.includes('registration-token-not-registered') ||
          errCode.includes('invalid-registration-token') ||
          errCode.includes('messaging/invalid-registration-token') ||
          errCode.includes('messaging/registration-token-not-registered');

        if (isInvalid) {
          try {
            await FcmToken.deleteOne({ _id: tokenDoc._id });
          } catch {}
        }
      }
    }
  } catch {
    // Never throw — silently swallow all errors
  }
}
