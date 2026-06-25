import { getAuthed, postAuthed } from "./authedApi";

export type SubmissionLink = {
  submissionId: string;
  customerId: string;
  customerName: string;
  cwId: string | null;
};

export async function getSubmissionLinks(formId: string): Promise<Record<string, SubmissionLink>> {
  const out = await getAuthed<{ ok: true; links: Record<string, SubmissionLink> }>("submissionLinksGet", { formId });
  return out.links ?? {};
}

export async function setSubmissionLink(args: {
  formId: string;
  submissionId: string;
  customerId: string;
  customerName: string;
  cwId: string | null;
}): Promise<void> {
  await postAuthed("submissionLinkSet", args);
}
