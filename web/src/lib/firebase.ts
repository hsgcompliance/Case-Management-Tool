// web/src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { shouldUseEmulators } from './runtimeEnv';

// -------- Static env reads (required for Next/Turbopack) --------
const USE_EMU = shouldUseEmulators();

const AUTH_EMU_PORT = Number(process.env.NEXT_PUBLIC_AUTH_EMU_PORT ?? 5005);

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'housing-db-v2';

const API_KEY_RAW = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const API_KEY =
  API_KEY_RAW || (USE_EMU ? 'AIzaSyD-EMU-FAKE-KEY-OK-FOR-LOCAL' : '');

const AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`;

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${PROJECT_ID}.appspot.com`;

const MSG_SENDER_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000';

const APP_ID =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'emu-app-id';

const APPCHECK_SITE_KEY = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_KEY || '';
const DBG_FLAG = String(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN ?? '');
const DBG_VALUE = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN_VALUE || 'griff-local-dev-001';

// -------- Config + gentle validation --------
const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: AUTH_DOMAIN,
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
  messagingSenderId: MSG_SENDER_ID,
  appId: APP_ID,
} as const;

if (!firebaseConfig.apiKey) {
  // eslint-disable-next-line no-console
  console.error('[Firebase] Missing or invalid NEXT_PUBLIC_FIREBASE_API_KEY');
}

// -------- Core --------
export const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Firestore
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
getFirestore(app);

// -------- Emulators --------
if (USE_EMU && typeof window !== 'undefined') {
  const HOST = 'localhost';
  try { connectFirestoreEmulator(db, HOST, 5002); } catch {}
  try { connectAuthEmulator(auth, `http://${HOST}:${AUTH_EMU_PORT}`, { disableWarnings: true }); } catch {}
}

// -------- App Check (browser-only; SSR-safe) --------
import type { AppCheck } from 'firebase/app-check';
export let appCheck: AppCheck | null = null;
export let appCheckReady = false;
export let appCheckReadyPromise: Promise<void>;

const isTruthy = (v: any) => ['1','true','yes','on'].includes(String(v ?? '').toLowerCase());
const resolveDebugToken = (): string | null => {
  if (isTruthy(DBG_FLAG)) return DBG_VALUE;
  if (DBG_FLAG && !['false','0','off','no',''].includes(DBG_FLAG.toLowerCase())) return DBG_FLAG.trim();
  return null;
};

if (typeof window !== 'undefined' && !USE_EMU) {
  appCheckReadyPromise = (async () => {
    const {
      initializeAppCheck,
      ReCaptchaV3Provider,
      getToken: getAppCheckToken,
      onTokenChanged,
    } = await import('firebase/app-check');

    const isLocalhost = ['localhost','127.0.0.1'].includes(window.location.hostname);
    const debugToken = resolveDebugToken();
    if (debugToken && isLocalhost) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken; // set BEFORE init
    }

    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });

    (window as any).__HDB_APP_ID = APP_ID;
    (window as any).__HDB_APPCHECK_KEY_PRESENT = !!APPCHECK_SITE_KEY;
    (window as any).__HDB_APPCHECK_DEBUG = !!debugToken && isLocalhost;

    onTokenChanged(appCheck, (t) => {
      if (t && !appCheckReady) appCheckReady = true;
    });

    try { await getAppCheckToken(appCheck); } catch {}
  })();
} else {
  appCheckReadyPromise = Promise.resolve();
}
