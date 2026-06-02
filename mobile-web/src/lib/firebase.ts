import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import type { AppCheck } from "firebase/app-check";
import { shouldUseEmulators } from "./runtimeEnv";

const USE_EMU = shouldUseEmulators();

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "housing-db-v2";
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || (USE_EMU ? "AIzaSyD-EMU-FAKE-KEY-OK-FOR-LOCAL" : "");
const AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`;
const STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${PROJECT_ID}.appspot.com`;
const MSG_SENDER_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000";
const APP_ID = import.meta.env.VITE_FIREBASE_APP_ID || "emu-app-id";

export const app = initializeApp({
  apiKey: API_KEY,
  authDomain: AUTH_DOMAIN,
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
  messagingSenderId: MSG_SENDER_ID,
  appId: APP_ID,
});

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar");

if (USE_EMU) {
  try { connectFirestoreEmulator(db, "localhost", 5002); } catch {}
  try { connectAuthEmulator(auth, "http://localhost:5005", { disableWarnings: true }); } catch {}
}

// ── App Check (browser-only; best-effort) ────────────────────────────────────
export let appCheck: AppCheck | null = null;
export let appCheckReadyPromise: Promise<void> = Promise.resolve();

const APPCHECK_KEY = import.meta.env.VITE_FIREBASE_APPCHECK_KEY || "";

if (typeof window !== "undefined" && !USE_EMU && APPCHECK_KEY) {
  appCheckReadyPromise = (async () => {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider, getToken } = await import("firebase/app-check");
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APPCHECK_KEY),
        isTokenAutoRefreshEnabled: true,
      });
      // Warm up — get first token so subsequent calls don't block.
      await getToken(appCheck).catch(() => {});
    } catch {
      // App Check init failure is non-fatal — API calls will get 401 and surface the error.
    }
  })();
}
