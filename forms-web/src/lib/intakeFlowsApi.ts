import { getAuthed, postAuthed } from "./authedApi";
import type { IntakeSession } from "./intakeSessions";

export type IntakeFlowProgress = {
  done: Record<string, boolean>;
  checks: Record<string, number[]>;
  tssVariant?: "payer" | "nonpayer";
  intakeTypes?: string[];
};

/** One hop in a flow's hand-off history (claimed = taken, not sent). */
export type TransferHop = { uid: string; name: string | null; atISO: string; claimed?: boolean };

export type RemoteIntakeFlow = {
  id: string;
  ownerUid: string;
  customerId: string;
  session: IntakeSession;
  progress: IntakeFlowProgress;
  updatedAtISO: string;
  transferredByUid?: string | null;
  transferredByName?: string | null;
  transferChain?: TransferHop[];
};

export async function listRemoteIntakeFlows(): Promise<RemoteIntakeFlow[]> {
  const out = await getAuthed<{ ok: true; items: RemoteIntakeFlow[] }>("formsIntakeFlowsList");
  return out.items || [];
}

/**
 * Every unfinished intake in the org — compliance/admin only (the backend
 * 403s otherwise; callers treat null as "not allowed, hide the section").
 */
export async function listOrgIntakeFlows(): Promise<RemoteIntakeFlow[] | null> {
  try {
    const out = await getAuthed<{ ok: true; items: RemoteIntakeFlow[] }>("formsIntakeFlowsList", { scope: "org" });
    return out.items || [];
  } catch {
    return null;
  }
}

/** Compliance/admin takes over another staff member's saved intake. */
export function claimIntakeFlow(ownerUid: string, customerId: string) {
  return postAuthed<{ ok: true; id: string }>("formsIntakeFlowClaim", { ownerUid, customerId });
}

export function saveRemoteIntakeFlow(session: IntakeSession, progress: IntakeFlowProgress) {
  return postAuthed<{ ok: true; id: string }>("formsIntakeFlowSave", { session, progress });
}

export function transferIntakeFlow(targetUid: string, session: IntakeSession, progress: IntakeFlowProgress) {
  return postAuthed<{ ok: true; id: string }>("formsIntakeFlowTransfer", { targetUid, session, progress });
}

/**
 * Deletes the caller's own flow by default. Compliance/admin may pass
 * `ownerUid` to close another staff member's flow (All Intakes page) — the
 * backend 403s that for anyone else.
 */
export function deleteRemoteIntakeFlow(customerId: string, ownerUid?: string) {
  return postAuthed<{ ok: true; deleted: boolean }>("formsIntakeFlowDelete", { customerId, ...(ownerUid ? { ownerUid } : {}) });
}

/** Manual backstop confirming the step-13 compliance hand-off happened. */
export function confirmEligibilityHandoff(customerId: string, submissionId: string) {
  return postAuthed<{ ok: true; id: string }>("intakeEligibilityConfirm", { customerId, submissionId });
}
