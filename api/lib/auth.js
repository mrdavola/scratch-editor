import { adminAuth } from './firebase.js';
import crypto from 'crypto';

export async function authenticateRequest(request) {
  const authHeader = request.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { userId: decoded.uid, tier: 'free', authenticated: true };
    } catch {
      // Invalid token — fall through to anonymous
    }
  }

  // Anonymous — hash IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  return { userId: `anon_${ipHash}`, tier: 'anonymous', authenticated: false };
}
