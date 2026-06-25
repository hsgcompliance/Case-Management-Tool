// forms-web Firebase — Auth only, for the staff (form-submission access) side.
// Customer token routes (/checkout, /invoice, …) do NOT use this; they stay
// public + token-gated. No App Check / Firestore here to keep the bundle light;
// staff data is read over authed HTTP (Authorization: Bearer <idToken>).
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
} from "firebase/auth";
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

export const googleProvider = new GoogleAuthProvider();

if (USE_EMU) {
  try { connectAuthEmulator(auth, "http://localhost:5005", { disableWarnings: true }); } catch {}
}
