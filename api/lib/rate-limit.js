import { db } from './firebase.js';

const LIMITS = { anonymous: 15, free: 50 };

export async function checkRateLimit(userId, tier) {
  const today = new Date().toISOString().split('T')[0];
  const docId = `${userId}_${today}`;
  const ref = db.collection('usage').doc(docId);

  try {
    const doc = await ref.get();
    const data = doc.exists ? doc.data() : { totalCalls: 0 };
    const limit = LIMITS[tier] || LIMITS.free;
    const remaining = Math.max(0, limit - data.totalCalls);

    if (data.totalCalls >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    await ref.set({ totalCalls: (data.totalCalls || 0) + 1, lastCall: new Date().toISOString() }, { merge: true });
    return { allowed: true, remaining: remaining - 1, limit };
  } catch (error) {
    // If Firestore fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: 99, limit: 99 };
  }
}
