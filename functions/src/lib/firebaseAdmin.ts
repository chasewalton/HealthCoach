import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp = getApps()[0] ?? initializeApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export function nowIso() {
  return new Date().toISOString();
}
