"use client";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "@lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PinnedItemType = "grant" | "creditCard" | "jotform";

export type PinnedItemRef = {
  type: PinnedItemType;
  id: string;
};

export const MAX_PINNED_ITEMS = 8;

// ─── Firestore helpers ────────────────────────────────────────────────────────

type ExtrasShape = {
  pinnedItems?: unknown;
};

function extrasRef(uid: string, firestore: Firestore = db) {
  return doc(firestore, "userExtras", uid);
}

function asItemRefArray(v: unknown): PinnedItemRef[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => {
      const type = String(x?.type || "").trim() as PinnedItemType;
      const id = String(x?.id || "").trim();
      if (!type || !id) return null;
      if (type !== "grant" && type !== "creditCard" && type !== "jotform") return null;
      return { type, id };
    })
    .filter((x): x is PinnedItemRef => x !== null);
}

function dedupe(items: PinnedItemRef[]): PinnedItemRef[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parsePinnedItems(data: unknown): PinnedItemRef[] {
  const shape = (data || {}) as ExtrasShape;
  return dedupe(asItemRefArray(shape.pinnedItems)).slice(0, MAX_PINNED_ITEMS);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getPinnedItems(uid: string): Promise<PinnedItemRef[]> {
  if (!uid) return [];
  const snap = await getDoc(extrasRef(uid));
  return parsePinnedItems(snap.data());
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export async function togglePinnedItem(
  uid: string,
  ref: PinnedItemRef,
): Promise<{ pinned: boolean; items: PinnedItemRef[] }> {
  return runTransaction(db, async (tx) => {
    const docRef = extrasRef(uid);
    const snap = await tx.get(docRef);
    const current = parsePinnedItems(snap.data());
    const key = `${ref.type}:${ref.id}`;
    const isPinned = current.some((x) => `${x.type}:${x.id}` === key);
    const next = isPinned
      ? current.filter((x) => `${x.type}:${x.id}` !== key)
      : dedupe([ref, ...current]).slice(0, MAX_PINNED_ITEMS);
    tx.set(
      docRef,
      { pinnedItems: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { pinned: !isPinned, items: next };
  });
}
