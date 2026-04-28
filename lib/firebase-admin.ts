/**
 * SANKALP — Firebase Admin SDK (server-only)
 *
 * Singleton initializer for Firestore + Storage + Auth on the server.
 * Import this from API routes and Cloud Functions ONLY — never from a
 * client component (the Admin SDK uses the GOOGLE_APPLICATION_CREDENTIALS
 * service-account, which must never be shipped to the browser).
 *
 * Credential resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT_BASE64  — base64-encoded JSON service account
 *      (preferred for Vercel / Next.js env vars).
 *   2. GOOGLE_APPLICATION_CREDENTIALS  — path to a JSON file (local dev).
 *   3. Application Default Credentials  — for Cloud Run / Cloud Functions.
 */

import 'server-only';
import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let _app: App | null = null;

function decodeServiceAccount(b64: string): ServiceAccount {
  try {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    return JSON.parse(json) as ServiceAccount;
  } catch (err) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_BASE64 is set but could not be decoded as JSON. ' +
        'Run: `cat service-account.json | base64` and paste the result.',
    );
  }
}

function initAdminApp(): App {
  // Reuse existing app if hot-reload re-imports this module
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return initializeApp({
      credential: cert(
        decodeServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64),
      ),
      projectId,
      storageBucket,
    });
  }

  // Local dev with GOOGLE_APPLICATION_CREDENTIALS, or production ADC on
  // Cloud Run / Cloud Functions / GKE.
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
}

export function getAdminApp(): App {
  if (!_app) _app = initAdminApp();
  return _app;
}

// Cached service accessors — instantiated once per process
let _db: Firestore | null = null;
let _storage: Storage | null = null;
let _auth: Auth | null = null;
let _messaging: Messaging | null = null;

export function adminDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getAdminApp());
    // Strict undefined behaviour — drop undefined fields rather than throw
    _db.settings({ ignoreUndefinedProperties: true });
  }
  return _db;
}

export function adminStorage(): Storage {
  if (!_storage) _storage = getStorage(getAdminApp());
  return _storage;
}

export function adminAuth(): Auth {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
}

export function adminMessaging(): Messaging {
  if (!_messaging) _messaging = getMessaging(getAdminApp());
  return _messaging;
}
