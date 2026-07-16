import type { FormsCustomer } from "./customersApi";
import type { IntakeTypeId } from "./formsCatalog";

// Local registry of the signed-in user's active intake sessions. Deliberately
// throwaway: lives in localStorage next to the per-customer intake progress,
// easy to delete one-by-one or clear entirely, never persisted to the backend.
// (Viewing OTHER users' active intakes would need a backend projection — this
// store is intentionally this-browser-only.)
//
// Surfaced in the header notification bell (active/incomplete intakes) and as
// the customer prev/next nav list on the Intake tab.

export type IntakeSession = {
  /** null = intake started before a customer doc was created/linked. */
  customerId: string | null;
  customerName: string | null;
  cwId: string | null;
  dob: string | null;
  caseManagerName: string | null;
  intakeType: IntakeTypeId | null;
  doneCount: number;
  totalSteps: number;
  startedAtISO: string;
  updatedAtISO: string;
};

const KEY = "hdb:forms:intake-sessions";

/** Same-tab change signal (the native "storage" event only fires cross-tab). */
export const INTAKE_SESSIONS_EVENT = "hdb:intake-sessions-changed";

function emit(): void {
  try { window.dispatchEvent(new Event(INTAKE_SESSIONS_EVENT)); } catch { /* ignore */ }
}

function keyOf(customerId: string | null): string {
  return customerId ?? "no-customer";
}

function save(sessions: IntakeSession[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(sessions)); } catch { /* ignore */ }
  emit();
}

/** All sessions, most recently touched first. */
export function listIntakeSessions(): IntakeSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as IntakeSession[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s === "object")
      .sort((a, b) => String(b.updatedAtISO || "").localeCompare(String(a.updatedAtISO || "")));
  } catch {
    return [];
  }
}

export function upsertIntakeSession(
  s: Omit<IntakeSession, "startedAtISO" | "updatedAtISO">
): void {
  const now = new Date().toISOString();
  const sessions = listIntakeSessions();
  const idx = sessions.findIndex((x) => keyOf(x.customerId) === keyOf(s.customerId));
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...s, updatedAtISO: now };
  } else {
    sessions.push({ ...s, startedAtISO: now, updatedAtISO: now });
  }
  save(sessions);
}

export function removeIntakeSession(customerId: string | null): void {
  const sessions = listIntakeSessions().filter((x) => keyOf(x.customerId) !== keyOf(customerId));
  save(sessions);
}

export function clearIntakeSessions(): void {
  save([]);
}

/** The session's customer as a FormsCustomer (for setCustomer / nav), if linked. */
export function sessionCustomer(s: IntakeSession): FormsCustomer | null {
  if (!s.customerId) return null;
  return {
    id: s.customerId,
    name: s.customerName ?? "(unnamed)",
    caseManagerName: s.caseManagerName,
    cwId: s.cwId,
    dob: s.dob,
  };
}

/** Subscribe to session-list changes (same tab + cross-tab). Returns unsubscribe. */
export function onIntakeSessionsChange(fn: () => void): () => void {
  window.addEventListener(INTAKE_SESSIONS_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(INTAKE_SESSIONS_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
