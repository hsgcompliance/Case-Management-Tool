"use client";

import { auth } from "./firebase";

const STORAGE_KEY = "hdb_google_drive_access_token";

type StoredGoogleDriveAccessToken = {
  uid: string;
  accessToken: string;
  updatedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readStoredRecord(): StoredGoogleDriveAccessToken | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearGoogleDriveAccessToken() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
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
