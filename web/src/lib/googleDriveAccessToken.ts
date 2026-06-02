"use client";

import { auth } from "./firebase";

const STORAGE_KEY = "hdb_google_drive_access_token";
const PERSISTENCE_KEY = "hdb_google_drive_access_token_persistence";

export type GoogleDriveTokenPersistence = "session" | "local";

type StoredGoogleDriveAccessToken = {
  uid: string;
  accessToken: string;
  updatedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function primaryStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage ?? null;
}

function legacyStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

export function getGoogleDriveTokenPersistence(): GoogleDriveTokenPersistence {
  if (typeof window === "undefined") return "session";
  try {
    return window.localStorage?.getItem(PERSISTENCE_KEY) === "local" ? "local" : "session";
  } catch {
    return "session";
  }
}

export function setGoogleDriveTokenPersistence(mode: GoogleDriveTokenPersistence) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(PERSISTENCE_KEY, mode);
    if (mode === "session") {
      legacyStorage()?.removeItem(STORAGE_KEY);
    } else {
      const stored = readStoredRecord();
      if (stored) legacyStorage()?.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
  } catch {
    // Storage may be unavailable; keep the default session behavior.
  }
}

function readStoredRecord(): StoredGoogleDriveAccessToken | null {
  if (!canUseStorage()) return null;
  try {
    const storage = primaryStorage();
    const raw = storage?.getItem(STORAGE_KEY) || legacyStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredGoogleDriveAccessToken>;
    const uid = String(parsed?.uid || "").trim();
    const accessToken = String(parsed?.accessToken || "").trim();
    const updatedAt = Number(parsed?.updatedAt || 0);
    if (!uid || !accessToken) return null;
    return { uid, accessToken, updatedAt };
  } catch {
    return null;
  }
}

export function storeGoogleDriveAccessToken(uid: string, accessToken: string) {
  if (!canUseStorage()) return;
  const cleanUid = String(uid || "").trim();
  const cleanToken = String(accessToken || "").trim();
  if (!cleanUid || !cleanToken) return;
  const next: StoredGoogleDriveAccessToken = {
    uid: cleanUid,
    accessToken: cleanToken,
    updatedAt: Date.now(),
  };
  if (getGoogleDriveTokenPersistence() === "local") {
    legacyStorage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    primaryStorage()?.removeItem(STORAGE_KEY);
    return;
  }
  primaryStorage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  legacyStorage()?.removeItem(STORAGE_KEY);
}

export function clearGoogleDriveAccessToken() {
  primaryStorage()?.removeItem(STORAGE_KEY);
  legacyStorage()?.removeItem(STORAGE_KEY);
}

export function syncGoogleDriveAccessTokenOwner(uid: string | null | undefined) {
  const cleanUid = String(uid || "").trim();
  const stored = readStoredRecord();
  if (!stored) return;
  if (!cleanUid || stored.uid !== cleanUid) {
    clearGoogleDriveAccessToken();
  }
}

export function getGoogleDriveAccessToken() {
  const stored = readStoredRecord();
  const uid = String(auth.currentUser?.uid || "").trim();
  if (!stored || !uid || stored.uid !== uid) return null;
  return stored.accessToken;
}
