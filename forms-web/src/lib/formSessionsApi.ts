// Staff-side client for listing form sessions (form-submission access).
import { getAuthed } from "./authedApi";

export type FormSessionListItem = {
  id: string;
  workflowId: string;
  status: string;
  source: string;
  customerName: string | null;
  grantName: string | null;
  amountCents: number | null;
  paymentMonth: string | null;
  vendor: string | null;
  jotformFormId: string | null;
  jotformSubmissionId: string | null;
  customerId: string | null;
  grantId: string | null;
  paymentQueueId: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
};

export async function listFormSessions(
  query: { limit?: number; workflowId?: string; status?: string } = {}
): Promise<FormSessionListItem[]> {
  const out = await getAuthed<{ ok: true; items: FormSessionListItem[] }>("listFormSessions", query);
  return out.items ?? [];
}
