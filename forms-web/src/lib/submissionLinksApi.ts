import { getAuthed, postAuthed } from "./authedApi";

export type LinkedCustomer = { customerId: string; customerName: string; cwId: string | null };
export type SubmissionLink = { submissionId: string; customers: LinkedCustomer[] };

/** Reverse index (derived): submissionId → linked customers, for "linked" badges. */
export async function getSubmissionLinks(formId: string): Promise<Record<string, SubmissionLink>> {
  const out = await getAuthed<{ ok: true; links: Record<string, SubmissionLink> }>("submissionLinksGet", { formId });
  return out.links ?? {};
}

/** Canonical link: appends to customers.meta.linkedSubmissions[] (+ reverse index). */
export async function linkSubmission(args: {
  formId: string;
  formName: string;
  submissionId: string;
  customerId: string;
  customerName: string;
  cwId: string | null;
  alias?: string | null;
}): Promise<void> {
  await postAuthed("customerLinkSubmission", args);
}
