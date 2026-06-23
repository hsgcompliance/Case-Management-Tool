// Offline session outbox (framework foundation).
//
// When a session is saved while offline (or the Firestore write fails), we stash
// it here in localStorage so nothing is lost. The Sessions list merges these
// drafts in as "unsynced" rows; the sync engine flushes the outbox (creates the
// real cmActivities doc, then runs the calendar/workbook pushes) when back online.
//
// This is intentionally simple/local — a durable foundation we can later swap for
// IndexedDB or Firestore's own offline queue without changing call sites.

import type { TCmActivityCreateBody } from "@hdb/contracts";

const KEY_PREFIX = "hdb_session_outbox_v1:";

/** Push intent captured at save time, replayed when the draft is flushed. */
export interface OutboxPushIntent {
  calendar: boolean;
  workbook: boolean;
  /** "Goal #N" linked-plan-goal numbers selected at save time. */
  linkedGoals: number[];
}

export interface OutboxEntry {
  /** Local-only id (also used as the React key + optimistic row id). */
  localId: string;
  body: TCmActivityCreateBody;
  intent: OutboxPushIntent;
  createdAt: string; // ISO
}

function keyFor(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function readAll(uid: string): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(uid: string, entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(entries));
  } catch {
    // Quota / private-mode failures are non-fatal — the draft just isn't persisted.
  }
  notify();
}

/** newest-first */
export function listOutbox(uid: string | undefined): OutboxEntry[] {
  if (!uid) return [];
  return readAll(uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function enqueueOutbox(
  uid: string,
  body: TCmActivityCreateBody,
  intent: OutboxPushIntent,
): OutboxEntry {
  const entry: OutboxEntry = {
    localId: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    body,
    intent,
    createdAt: new Date().toISOString(),
  };
  writeAll(uid, [...readAll(uid), entry]);
  return entry;
}

export function removeOutbox(uid: string, localId: string): void {
  writeAll(uid, readAll(uid).filter((e) => e.localId !== localId));
}

export function outboxCount(uid: string | undefined): number {
  return uid ? readAll(uid).length : 0;
}

// ── Cross-component change notification ──────────────────────────────────────
// A tiny subscribe/notify so list views re-render when the outbox changes without
// pulling in a state library. Also bridges other tabs via the storage event.

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) {
    try { l(); } catch { /* ignore */ }
  }
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(KEY_PREFIX)) notify();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** navigator.onLine with a sensible SSR/default fallback. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}
