import { getAuthed, postAuthed } from "./authedApi";

export type JfForm = { id: string; title: string; count: number; status: string; updatedAt: string | null };
export type JfSubmission = {
  id: string;
  form_id?: string;
  formId?: string;
  formTitle?: string | null;
  created_at?: string;
  createdAt?: string | null;
  status?: string;
  answers?: Record<string, JfAnswer>;
};
export type JfAnswer = {
  name?: string;
  text?: string;
  type?: string;
  order?: string | number;
  answer?: unknown;
  prettyFormat?: string;
  pdf?: { download_url?: string };
};

export async function listForms(maxAgeDays: number | "all" = 30): Promise<JfForm[]> {
  const out = await getAuthed<{ ok: true; items: JfForm[] }>("jfFormsList", { maxAgeDays });
  return out.items ?? [];
}

export async function listSubmissions(formId: string): Promise<JfSubmission[]> {
  const out = await getAuthed<{ ok: true; content: JfSubmission[] }>("jfSubmissionsList", { formId });
  return out.content ?? [];
}

/** Fetch one authoritative submission when a linked-submission row is expanded. */
export async function getSubmission(submissionId: string): Promise<JfSubmission> {
  const out = await getAuthed<{ ok: true; submission: JfSubmission }>("jotformApiSubmissionGet", {
    id: submissionId,
  });
  return out.submission;
}

export async function cloneSubmission(formId: string, submissionId: string): Promise<{ newSubmissionId: string; editUrl: string }> {
  return postAuthed("jfCloneSubmission", { formId, submissionId });
}
