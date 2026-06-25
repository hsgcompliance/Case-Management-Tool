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

// Hard cap: never list forms not edited in the last 2 years. Default look-back is
// one month; advanced callers can widen up to the cap.
const MAX_FORM_AGE_DAYS = 730;

export async function listForms(maxAgeDays = 30): Promise<JfForm[]> {
  const days = Math.max(1, Math.min(MAX_FORM_AGE_DAYS, Number(maxAgeDays) || 30));
  const cutoff = Date.now() - days * 86_400_000;
  const content = (await jfGet("/user/forms", { limit: 1000, orderby: "updated_at" })) as Array<Record<string, unknown>> | null;
  return (content || [])
    .map((f) => ({
      id: String(f.id || ""),
      title: String(f.title || "Untitled form"),
      count: Number(f.count || 0) || 0,
      status: String(f.status || ""),
      updatedAt: (f.updated_at as string) || (f.created_at as string) || null,
    }))
    .filter((f) => isValidId(f.id))
    .filter((f) => {
      // Keep if edited within the window; drop stale forms. Unknown dates kept.
      const t = f.updatedAt ? Date.parse(f.updatedAt) : NaN;
      return !Number.isFinite(t) || t >= cutoff;
    })
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

/* ── submission → customer links ───────────────────────────────────────────
 * Canonical store = customers/{id}.meta.linkedSubmissions[] (read by the web
 * customer modal). We also write a derived reverse index `submissionLinks/{sid}`
 * (rebuildable) so the forms-app Submission Manager can show "linked" badges.
 * Multiple customers per submission allowed (households).
 */
export type LinkedCustomer = { customerId: string; customerName: string; cwId: string | null };
export type SubmissionLink = { submissionId: string; customers: LinkedCustomer[] };

/** Canonical lightweight ref appended to customers.meta.linkedSubmissions[]. */
type LinkedSubmissionRef = {
  formId: string;
  formName: string;
  submissionId: string;
  alias: string | null;
  cwId: string | null;
  linkedAt: string;
  linkedBy: string | null;
};

export async function linkSubmissionToCustomer(args: {
  orgId: string | null;
  formId: string;
  formName: string;
  submissionId: string;
  customerId: string;
  customerName: string;
  cwId: string | null;
  alias: string | null;
  byUid: string | null;
}): Promise<{ ok: true }> {
  if (!isValidId(args.formId) || !isValidId(args.submissionId)) throw Object.assign(new Error("invalid_id"), { code: 400 });
  if (!args.customerId) throw Object.assign(new Error("missing_customer"), { code: 400 });
  const org = normId(args.orgId);

  // 1) Canonical: append/update the ref on the customer doc.
  const ref: LinkedSubmissionRef = {
    formId: args.formId,
    formName: args.formName || "",
    submissionId: args.submissionId,
    alias: args.alias || null,
    cwId: args.cwId || null,
    linkedAt: isoNow(),
    linkedBy: args.byUid,
  };
  await db.runTransaction(async (tx) => {
    const cref = db.collection("customers").doc(args.customerId);
    const snap = await tx.get(cref);
    if (!snap.exists) throw Object.assign(new Error("customer_not_found"), { code: 404 });
    const data = snap.data() || {};
    if (org && normId(data.orgId) && normId(data.orgId) !== org) throw Object.assign(new Error("forbidden"), { code: 403 });
    const meta = (data.meta && typeof data.meta === "object" ? data.meta : {}) as Record<string, unknown>;
    const list = Array.isArray(meta.linkedSubmissions) ? (meta.linkedSubmissions as LinkedSubmissionRef[]) : [];
    const idx = list.findIndex((x) => String(x?.submissionId) === args.submissionId);
    const next = idx >= 0 ? list.map((x, i) => (i === idx ? { ...x, ...ref } : x)) : [...list, ref];
    tx.set(cref, { meta: { ...meta, linkedSubmissions: next } }, { merge: true });
  });

  // 2) Derived reverse index (best-effort; rebuildable). Keyed by submissionId,
  //    customers as a map so re-links dedupe by customerId.
  try {
    await db.collection("submissionLinks").doc(args.submissionId).set(
      {
        orgId: org || null,
        formId: args.formId,
        submissionId: args.submissionId,
        customers: { [args.customerId]: { customerName: args.customerName || "", cwId: args.cwId || null, linkedAtISO: isoNow() } },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    /* index is derived; ignore */
  }

  return { ok: true };
}

export async function listSubmissionLinks(orgId: string | null, formId: string): Promise<Record<string, SubmissionLink>> {
  if (!isValidId(formId)) return {};
  const org = normId(orgId);
  const snap = await db.collection("submissionLinks").where("formId", "==", formId).limit(3000).get();
  const out: Record<string, SubmissionLink> = {};
  for (const d of snap.docs) {
    const r = d.data() || {};
    if (org && normId(r.orgId) && normId(r.orgId) !== org) continue;
    const sid = String(r.submissionId || d.id || "");
    if (!sid) continue;
    const map = (r.customers && typeof r.customers === "object" ? r.customers : {}) as Record<string, { customerName?: string; cwId?: string | null }>;
    const customers: LinkedCustomer[] = Object.entries(map).map(([customerId, v]) => ({
      customerId,
      customerName: String(v?.customerName || ""),
      cwId: (v?.cwId as string | null) ?? null,
    }));
    if (customers.length) out[sid] = { submissionId: sid, customers };
  }
  return out;
}
