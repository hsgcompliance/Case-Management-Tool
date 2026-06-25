// functions/src/features/jotformManager/service.ts
// Server-side Jotform API proxy for the staff Submission Manager. Uses the
// JOTFORM_API_KEY_SECRET (Secret Manager) so forms-web never sees it. Ports the
// next-dashboard "edit a clone" flow: clone answers → new submission → /edit URL.
import { db, FieldValue, isoNow, normId } from "../../core";

function jfBase(): string {
  return String(process.env.JOTFORM_API || "https://api.jotform.com").trim().replace(/\/+$/, "");
}
function jfWeb(): string {
  return String(process.env.JOTFORM_WEB || "https://www.jotform.com").trim().replace(/\/+$/, "");
}
function jfKey(): string {
  // Prefer the bound Secret Manager secret; fall back to the .env value (local/emulator).
  return String(process.env.JOTFORM_API_KEY_SECRET || process.env.JOTFORM_API_KEY || "").trim();
}
function isValidId(id: string): boolean {
  return /^\d{6,24}$/.test(String(id || ""));
}

async function jfGet(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const key = jfKey();
  if (!key) throw Object.assign(new Error("missing_jotform_api_key"), { code: 500 });
  const url = new URL(`${jfBase()}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const resp = await fetch(url.toString());
  const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: unknown; message?: string } | null;
  if (!resp.ok || Number(json?.responseCode) !== 200) {
    throw Object.assign(new Error(`jotform_error_${resp.status}`), { code: resp.status === 429 ? 429 : 502 });
  }
  return json?.content ?? null;
}

export type JfForm = { id: string; title: string; count: number; status: string; updatedAt: string | null };

export async function listForms(): Promise<JfForm[]> {
  const content = (await jfGet("/user/forms", { limit: 1000, orderby: "title" })) as Array<Record<string, unknown>> | null;
  return (content || [])
    .map((f) => ({
      id: String(f.id || ""),
      title: String(f.title || "Untitled form"),
      count: Number(f.count || 0) || 0,
      status: String(f.status || ""),
      updatedAt: (f.updated_at as string) || (f.created_at as string) || null,
    }))
    .filter((f) => isValidId(f.id))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function listSubmissions(formId: string, max = 1000): Promise<Array<Record<string, unknown>>> {
  if (!isValidId(formId)) throw Object.assign(new Error("invalid_form_id"), { code: 400 });
  const limit = 100;
  let offset = 0;
  const all: Array<Record<string, unknown>> = [];
  for (;;) {
    const chunk = (await jfGet(`/form/${formId}/submissions`, { limit, offset })) as Array<Record<string, unknown>> | null;
    const rows = chunk || [];
    all.push(...rows);
    if (rows.length < limit || all.length >= max) break;
    offset += limit;
  }
  return all;
}

/* ── edit a clone ── */

function append(params: URLSearchParams, parts: string[], value: unknown): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => append(params, [...parts, String(i)], v));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => append(params, [...parts, k], v));
    return;
  }
  const key = parts.reduce((acc, p, idx) => (idx === 0 ? p : `${acc}[${p}]`), "");
  params.append(key, String(value));
}

export async function cloneSubmission(formId: string, submissionId: string): Promise<{ newSubmissionId: string; editUrl: string }> {
  if (!isValidId(formId) || !isValidId(submissionId)) throw Object.assign(new Error("invalid_id"), { code: 400 });
  const key = jfKey();

  const props = (await jfGet(`/form/${formId}/properties`)) as Record<string, unknown> | null;
  if (String(props?.disabled || "").toLowerCase() === "disabled") {
    throw Object.assign(new Error("form_disabled"), { code: 409 });
  }

  const source = (await jfGet(`/submission/${submissionId}`)) as { answers?: Record<string, Record<string, unknown>> } | null;
  const answers = source?.answers || {};
  const body = new URLSearchParams();
  for (const [qid, a] of Object.entries(answers)) {
    const val = (a as Record<string, unknown>)?.answer;
    if (val === "" || val === null || val === undefined) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (String((a as Record<string, unknown>)?.type || "") === "control_fileupload") continue; // files don't re-upload via API
    append(body, ["submission", qid], val);
  }

  const resp = await fetch(`${jfBase()}/form/${formId}/submissions?apiKey=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: { submissionID?: string; id?: string } } | null;
  if (!resp.ok || Number(json?.responseCode) !== 200) throw Object.assign(new Error("clone_failed"), { code: 502 });
  const newId = String(json?.content?.submissionID || json?.content?.id || "");
  if (!newId) throw Object.assign(new Error("no_new_submission_id"), { code: 502 });

  return { newSubmissionId: newId, editUrl: `${jfWeb()}/edit/${newId}` };
}

/* ── submission → customer links ── */

function linkId(formId: string, submissionId: string): string {
  return `${formId}_${submissionId}`;
}

export async function setSubmissionLink(args: {
  orgId: string | null;
  formId: string;
  submissionId: string;
  customerId: string;
  customerName: string;
  cwId: string | null;
  byUid: string | null;
}): Promise<{ id: string }> {
  if (!isValidId(args.formId) || !isValidId(args.submissionId)) throw Object.assign(new Error("invalid_id"), { code: 400 });
  if (!args.customerId) throw Object.assign(new Error("missing_customer"), { code: 400 });
  const id = linkId(args.formId, args.submissionId);
  await db.collection("submissionLinks").doc(id).set(
    {
      orgId: normId(args.orgId) || null,
      formId: args.formId,
      submissionId: args.submissionId,
      customerId: args.customerId,
      customerName: args.customerName || "",
      cwId: args.cwId || null,
      linkedByUid: args.byUid,
      linkedAtISO: isoNow(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { id };
}

export type SubmissionLink = { submissionId: string; customerId: string; customerName: string; cwId: string | null };

export async function listSubmissionLinks(orgId: string | null, formId: string): Promise<Record<string, SubmissionLink>> {
  if (!isValidId(formId)) return {};
  const org = normId(orgId);
  const snap = await db.collection("submissionLinks").where("formId", "==", formId).limit(2000).get();
  const out: Record<string, SubmissionLink> = {};
  for (const d of snap.docs) {
    const r = d.data() || {};
    if (org && normId(r.orgId) && normId(r.orgId) !== org) continue;
    const sid = String(r.submissionId || "");
    if (!sid) continue;
    out[sid] = {
      submissionId: sid,
      customerId: String(r.customerId || ""),
      customerName: String(r.customerName || ""),
      cwId: (r.cwId as string | null) ?? null,
    };
  }
  return out;
}
