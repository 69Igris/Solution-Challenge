/**
 * SANKALP — Firebase Web SDK initializer
 *
 * Singleton-safe for Next.js App Router. Importable from any client component.
 * Server-side modules should NOT import this file — use Firebase Admin SDK
 * inside Cloud Functions / API routes for privileged operations.
 *
 * NOTE: All keys are intentionally read from NEXT_PUBLIC_* env variables so
 * Vercel / Firebase Hosting builds can inject them at build time.
 */

import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import {
  getMessaging,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ---------------------------------------------------------------------------
// Singleton accessors — safe across Next.js Fast Refresh and route transitions
// ---------------------------------------------------------------------------
function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let _firestore: Firestore | null = null;

/**
 * Firestore with offline persistence enabled.
 * Critical for citizens raising SOS over patchy 2G/3G networks during disasters.
 */
export function getDb(): Firestore {
  if (_firestore) return _firestore;
  const app = getFirebaseApp();

  if (typeof window === 'undefined') {
    _firestore = getFirestore(app);
    return _firestore;
  }

  try {
    _firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Fallback if persistence is already initialised (HMR re-runs)
    _firestore = getFirestore(app);
  }
  return _firestore;
}

let _auth: Auth | null = null;
export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  if (typeof window !== 'undefined') {
    setPersistence(_auth, browserLocalPersistence).catch(() => {
      /* swallow — persistence failure shouldn't crash UI */
    });
  }
  return _auth;
}

let _storage: FirebaseStorage | null = null;
export function getFirebaseStorage(): FirebaseStorage {
  if (_storage) return _storage;
  _storage = getStorage(getFirebaseApp());
  return _storage;
}

let _messaging: Messaging | null = null;
/**
 * Cloud Messaging — only available in supported browsers (no Safari iOS pre-16.4).
 * Returns null if unsupported so callers can degrade gracefully.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (_messaging) return _messaging;
  if (!(await isMessagingSupported())) return null;
  _messaging = getMessaging(getFirebaseApp());
  return _messaging;
}

export { getFirebaseApp };
