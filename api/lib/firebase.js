import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } catch {
      // Fallback: initialize without credentials (for local dev)
      initializeApp({ projectId: 'scraitch-a7f9a' });
    }
  } else {
    initializeApp({ projectId: 'scraitch-a7f9a' });
  }
}

export const db = getFirestore();
export const adminAuth = getAuth();
