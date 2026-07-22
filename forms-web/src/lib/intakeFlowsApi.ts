import { getAuthed, postAuthed } from "./authedApi";
import type { IntakeSession } from "./intakeSessions";

export type IntakeFlowProgress = {
  done: Record<string, boolean>;
  checks: Record<string, number[]>;
  tssVariant?: "payer" | "nonpayer";
  intakeTypes?: string[];
};

export type RemoteIntakeFlow = {
  id: string;
  ownerUid: string;
  customerId: string;
  session: IntakeSession;
  progress: IntakeFlowProgress;
  updatedAtISO: string;
};

export async function listRemoteIntakeFlows(): Promise<RemoteIntakeFlow[]> {
  const out = await getAuthed<{ ok: true; items: RemoteIntakeFlow[] }>("formsIntakeFlowsList");
  return out.items || [];
}

export function saveRemoteIntakeFlow(session: IntakeSession, progress: IntakeFlowProgress) {
  return postAuthed<{ ok: true; id: string }>("formsIntakeFlowSave", { session, progress });
}

export function transferIntakeFlow(targetUid: string, session: IntakeSession, progress: IntakeFlowProgress) {
  return postAuthed<{ ok: true; id: string }>("formsIntakeFlowTransfer", { targetUid, session, progress });
}
