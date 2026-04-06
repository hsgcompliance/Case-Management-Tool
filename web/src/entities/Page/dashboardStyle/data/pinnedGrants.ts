"use client";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "@lib/firebase";

export const MAX_PINNED_GRANTS = 4;

type ExtrasShape = { grantPrefs?: { pinnedGrantIds?: unknown } };

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

export function parsePinnedGrantIds(data: unknown): string[] {
  const shape = (data || {}) as ExtrasShape;
  return Array.from(new Set(asStringArray(shape.grantPrefs?.pinnedGrantIds))).slice(
    0,
    MAX_PINNED_GRANTS,
  );
}

function extrasRef(uid: string, firestore: Firestore = db) {
  return doc(firestore, "userExtras", uid);
}

export async function getPinnedGrantIds(uid: string): Promise<string[]> {
  if (!uid) return [];
  const snap = await getDoc(extrasRef(uid));
  return parsePinnedGrantIds(snap.data());
}

export async function togglePinnedGrant(
  uid: string,
  grantId: string,
): Promise<{ pinned: boolean; ids: string[] }> {
  return runTransaction(db, async (tx) => {
    const ref = extrasRef(uid);
    const snap = await tx.get(ref);
    const current = parsePinnedGrantIds(snap.data());
    const isPinned = current.includes(grantId);
    const next = isPinned
      ? current.filter((id) => id !== grantId)
      : [grantId, ...current.filter((id) => id !== grantId)].slice(0, MAX_PINNED_GRANTS);
    tx.set(
      ref,
      { grantPrefs: { pinnedGrantIds: next, updatedAt: serverTimestamp() } },
      { merge: true },
    );
    return { pinned: !isPinned, ids: next };
  });
}
