// functions/src/features/webhooks/service.ts
// Experimental Jotform webhook landing zone. Jotform POSTs multipart/form-data on
// every submission (formID, submissionID, rawRequest JSON, pretty, …). We capture
// it to `jotformWebhookEvents` and log it; richer routing/normalization comes later.
import Busboy from "busboy";
import type { Request } from "express";
import { db, FieldValue, Timestamp, isoNow, normId } from "../../core";

const COLLECTION = "jotformWebhookEvents";
const REGISTRY = "formsRegistry";
const MAX_API_SUBMISSION_CHARS = 600_000; // stay well under Firestore's 1MB doc limit

/** Untrusted Jotform ids are numeric — reject anything else (defensive). */
function isValidFormId(formId: string): boolean {
  return /^\d{6,24}$/.test(String(formId || ""));
}

/** Cap an arbitrary value's stored size so one big submission can't blow the doc. */
function capForStorage<T>(value: T): T | { _truncated: true; reason: string } {
  try {
    const s = JSON.stringify(value);
    if (s && s.length > MAX_API_SUBMISSION_CHARS) {
      return { _truncated: true, reason: "exceeds_size_cap" };
    }
  } catch {
    return { _truncated: true, reason: "unserializable" };
  }
  return value;
}

/** Parse the request body into a flat field map (multipart via busboy; else req.body). */
export async function parseRequestFields(req: Request): Promise<Record<string, string>> {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  if (!contentType.includes("multipart/form-data")) {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) out[k] = typeof v === "string" ? v : JSON.stringify(v);
    return out;
  }

  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!raw || !raw.length) return {};

  return await new Promise<Record<string, string>>((resolve, reject) => {
    const fields: Record<string, string> = {};
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(fields);
    };
    try {
      const bb = Busboy({ headers: req.headers, limits: { files: 20, fieldSize: 2 * 1024 * 1024 } });
      bb.on("field", (name: string, val: string) => { fields[name] = val; });
      bb.on("file", (name: string, stream: NodeJS.ReadableStream) => { fields[name] = "[file]"; stream.resume(); });
      bb.on("close", () => finish());
      bb.on("error", (e: Error) => finish(e));
      bb.end(raw);
    } catch (e) {
      finish(e as Error);
    }
  });
}

/**
 * Pull the authoritative submission from the Jotform API. The webhook is only the
 * trigger; the API is the source of truth (full answers + generated PDF links).
 * Best-effort: returns null on any failure so the webhook still succeeds.
 */
async function fetchJotformSubmission(submissionId: string): Promise<Record<string, unknown> | null> {
  const key = String(process.env.JOTFORM_API_KEY_SECRET || process.env.JOTFORM_API_KEY || "").trim();
  const base = String(process.env.JOTFORM_API || "https://api.jotform.com").trim().replace(/\/+$/, "");
  if (!key || !submissionId) return null;
  try {
    const url = `${base}/submission/${encodeURIComponent(submissionId)}?apiKey=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: unknown } | null;
    if (!resp.ok || Number(json?.responseCode) !== 200) return null;
    return (json?.content as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/** Best-effort: pull a person's name out of a Jotform submission for matching. */
function nameFromAnswer(a: Record<string, unknown>): string {
  const ans = a?.answer;
  if (ans && typeof ans === "object") {
    const o = ans as Record<string, unknown>;
    const parts = [o.first, o.middle, o.last].map((x) => String(x || "").trim()).filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (typeof ans === "string" && ans.trim()) return ans.trim();
  if (typeof a?.prettyFormat === "string" && (a.prettyFormat as string).trim()) return (a.prettyFormat as string).trim();
  return "";
}

export function extractSubmitterName(apiSubmission: Record<string, unknown> | null, fields: Record<string, string>): string {
  const answers = apiSubmission?.answers;
  if (answers && typeof answers === "object") {
    const entries = Object.values(answers as Record<string, Record<string, unknown>>);
    // 1) A dedicated full-name control wins.
    for (const a of entries) {
      if (String(a?.type || "") === "control_fullname") {
        const n = nameFromAnswer(a);
        if (n) return n;
      }
    }
    // 2) A field labelled "name" that isn't a username/business/landlord/etc.
    for (const a of entries) {
      const label = `${a?.name || ""} ${a?.text || ""}`.toLowerCase();
      if (/\bname\b/.test(label) && !/user|file|form|business|landlord|employer|company|program/.test(label)) {
        const n = nameFromAnswer(a);
        if (n) return n;
      }
    }
  }
  // 3) Fallback: parse the "pretty" string for a Name: segment.
  const pretty = String(fields?.pretty || "");
  const m = /(?:^|,)\s*[^:,]*name[^:,]*:\s*([^,]+)/i.exec(pretty);
  if (m) return m[1].trim();
  return "";
}

export async function storeJotformWebhookEvent(
  fields: Record<string, string>,
  meta: { ip?: string | null; contentType?: string | null; kind?: string | null; orgId?: string | null }
): Promise<{ id: string; formId: string; submissionId: string }> {
  const formId = String(fields.formID || fields.formId || "").trim();
  const submissionId = String(fields.submissionID || fields.submissionId || "").trim();

  let answers: unknown = null;
  const rawReq = fields.rawRequest || "";
  if (rawReq) { try { answers = JSON.parse(rawReq); } catch { answers = null; } }

  // Wait for the webhook, THEN pull the authoritative submission from the API.
  const apiSubmission = await fetchJotformSubmission(submissionId);

  const submitterName = extractSubmitterName(apiSubmission, fields);
  const normalizedFields = fieldsFromEvent({
    apiSubmission,
    answers,
  });

  const doc = {
    source: "jotform-webhook",
    kind: String(meta.kind || "general"),
    orgId: normId(meta.orgId) || null,
    formId,
    submissionId,
    submitterName: String(submitterName || "").slice(0, 200),
    pretty: String(fields.pretty || "").slice(0, 8000),
    answers: capForStorage(answers),
    rawRequestRaw: answers ? null : String(rawReq || "").slice(0, 8000),
    fieldKeys: Object.keys(fields).slice(0, 200),
    // Authoritative API pull (source of truth). `apiPulled` flags whether it landed.
    apiPulled: !!apiSubmission,
    apiSubmission: apiSubmission ? capForStorage(apiSubmission) : null,
    // Compact read model used by the live sidebar. Raw payloads remain above
    // for explicit detail retrieval and troubleshooting.
    normalizedFields,
    ip: meta.ip ?? null,
    contentType: meta.contentType ?? null,
    receivedAtISO: isoNow(),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(COLLECTION).add(doc);
  return { id: ref.id, formId, submissionId };
}

export type WebhookEventListItem = {
  id: string;
  formId: string;
  submissionId: string;
  submitterName: string;
  pretty: string;
  answerKeys: number;
  apiPulled: boolean;
  receivedAtISO: string | null;
};

/* ───────────────────────── forms registry ─────────────────────────
 * Auto-discovered forms: when a webhook arrives tagged kind=payment|intake for a
 * form we don't know yet, register it under that category (purchases/intake) so it
 * shows up in the staff lists. Bridges to the org-config forms tool.
 */
const KIND_TO_CATEGORY: Record<string, string> = { payment: "purchases", intake: "intake" };
const VALID_CATEGORIES = new Set(["purchases", "intake", "referral", "other"]);

/** Best-effort: pull a form's title from the Jotform API (set once on discovery). */
async function fetchJotformFormTitle(formId: string): Promise<string> {
  const key = String(process.env.JOTFORM_API_KEY_SECRET || process.env.JOTFORM_API_KEY || "").trim();
  const base = String(process.env.JOTFORM_API || "https://api.jotform.com").trim().replace(/\/+$/, "");
  if (!key || !isValidFormId(formId)) return "";
  try {
    const url = `${base}/form/${encodeURIComponent(formId)}?apiKey=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: { title?: string } } | null;
    if (!resp.ok || Number(json?.responseCode) !== 200) return "";
    return String(json?.content?.title || "").slice(0, 200);
  } catch {
    return "";
  }
}

/* ───────────────────────── form schema (render-engine foundation) ─────────────────────────
 * Normalize a Jotform's questions into a flat field list. This is what a custom
 * render surface needs to render org-access-only forms to external customers.
 */
export type FormFieldDef = {
  qid: string;
  name: string;
  type: string;
  label: string;
  required: boolean;
  options: string[];
  order: number;
};

// Layout/content controls that aren't user inputs — skip them in the schema.
const NON_INPUT_TYPES = new Set([
  "control_head", "control_button", "control_pagebreak", "control_divider",
  "control_text", "control_collapse", "control_image", "control_captcha",
]);

function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split("|").map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function getFormSchema(formId: string): Promise<FormFieldDef[]> {
  if (!isValidFormId(formId)) return [];
  const key = String(process.env.JOTFORM_API_KEY_SECRET || process.env.JOTFORM_API_KEY || "").trim();
  const base = String(process.env.JOTFORM_API || "https://api.jotform.com").trim().replace(/\/+$/, "");
  if (!key) return [];
  try {
    const url = `${base}/form/${encodeURIComponent(formId)}/questions?apiKey=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: Record<string, Record<string, unknown>> } | null;
    if (!resp.ok || Number(json?.responseCode) !== 200) return [];
    const content = json?.content || {};
    return Object.entries(content)
      .map(([qid, q]) => ({
        qid: String(q?.qid || qid),
        name: String(q?.name || ""),
        type: String(q?.type || ""),
        label: String(q?.text || q?.name || ""),
        required: String(q?.required || "") === "Yes" || q?.required === true,
        options: parseOptions(q?.options),
        order: Number(q?.order) || 0,
      }))
      .filter((f) => f.type && !NON_INPUT_TYPES.has(f.type))
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export async function upsertFormRegistry(formId: string, kind: string): Promise<void> {
  if (!isValidFormId(formId)) return;
  const category = KIND_TO_CATEGORY[kind];
  if (!category) return; // only payment/intake auto-categorize; general is untagged
  const ref = db.collection(REGISTRY).doc(formId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.set(
      { lastKind: kind, lastSeenAt: FieldValue.serverTimestamp(), submissionCount: FieldValue.increment(1) },
      { merge: true }
    );
    return;
  }
  // First sighting: set category + pull a real title.
  const title = await fetchJotformFormTitle(formId);
  await ref.set(
    {
      formId,
      category,
      title,
      customerSendable: false,
      adminEdited: false,
      source: "webhook-auto",
      lastKind: kind,
      firstSeenAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      submissionCount: FieldValue.increment(1),
    },
    { merge: true }
  );
}

/** Admin override of a form's catalog metadata (creates the doc if needed). */
export async function updateFormRegistry(
  formId: string,
  patch: {
    title?: string;
    category?: string;
    /** Multi-category membership; first entry becomes the legacy `category`. */
    categories?: string[];
    customerSendable?: boolean;
    notifyOnSubmit?: boolean;
    followUpIntake?: boolean;
    buildHousehold?: boolean;
    showCreditCards?: boolean;
  }
): Promise<void> {
  if (!isValidFormId(formId)) {
    const e = new Error("invalid_form_id") as Error & { code: number };
    e.code = 400;
    throw e;
  }
  const update: Record<string, unknown> = { formId, adminEdited: true, updatedAt: FieldValue.serverTimestamp() };
  if (typeof patch.title === "string") update.title = patch.title.slice(0, 200);
  if (Array.isArray(patch.categories)) {
    const cats = [...new Set(patch.categories.map(String).filter((c) => VALID_CATEGORIES.has(c)))];
    if (cats.length) {
      update.categories = cats;
      update.category = cats[0]; // legacy single-category compat
    }
  } else if (patch.category && VALID_CATEGORIES.has(patch.category)) {
    update.category = patch.category;
  }
  if (typeof patch.customerSendable === "boolean") update.customerSendable = patch.customerSendable;
  if (typeof patch.notifyOnSubmit === "boolean") update.notifyOnSubmit = patch.notifyOnSubmit;
  if (typeof patch.followUpIntake === "boolean") update.followUpIntake = patch.followUpIntake;
  if (typeof patch.buildHousehold === "boolean") update.buildHousehold = patch.buildHousehold;
  if (typeof patch.showCreditCards === "boolean") update.showCreditCards = patch.showCreditCards;
  await db.collection(REGISTRY).doc(formId).set(update, { merge: true });
}

export type FormsRegistryItem = {
  formId: string;
  category: string;
  categories: string[];
  title: string;
  customerSendable: boolean;
  /** Tri-state flags: null = never set (hardcoded catalog default stays in charge). */
  notifyOnSubmit: boolean | null;
  followUpIntake: boolean | null;
  buildHousehold: boolean | null;
  showCreditCards: boolean | null;
  adminEdited: boolean;
  submissionCount: number;
  lastKind: string | null;
};

const triState = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

export async function listFormsRegistry(): Promise<FormsRegistryItem[]> {
  const snap = await db.collection(REGISTRY).limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) } as Record<string, unknown>))
    .map((r) => ({
      formId: String(r.formId || r.id || ""),
      category: String(r.category || "other"),
      categories: Array.isArray(r.categories)
        ? (r.categories as unknown[]).map(String).filter((c) => VALID_CATEGORIES.has(c))
        : [],
      title: String(r.title || ""),
      customerSendable: !!r.customerSendable,
      notifyOnSubmit: triState(r.notifyOnSubmit),
      followUpIntake: triState(r.followUpIntake),
      buildHousehold: triState(r.buildHousehold),
      showCreditCards: triState(r.showCreditCards),
      adminEdited: !!r.adminEdited,
      submissionCount: Number(r.submissionCount || 0) || 0,
      lastKind: (r.lastKind as string | null) ?? null,
    }))
    .filter((r) => /^\d{6,24}$/.test(r.formId));
}

/* ───────────────────────── event details (intake sidebar) ─────────────────────────
 * Flattened label/value rows per event so the forms-app Webhooks sidebar can build
 * structured household info and show copy-pastable raw fields. The authoritative
 * apiSubmission answers are preferred; the webhook rawRequest parse is the fallback.
 */
export type WebhookEventFieldRow = { label: string; value: string };

export type WebhookEventDetailItem = {
  id: string;
  formId: string;
  submissionId: string;
  submitterName: string;
  receivedAtISO: string | null;
  createdAtISO: string | null;
  pretty: string;
  fields: WebhookEventFieldRow[];
};

function flattenAnswerValue(a: Record<string, unknown>): string {
  const ans = a?.answer;
  const prettyFmt = typeof a?.prettyFormat === "string" ? (a.prettyFormat as string).trim() : "";
  if (ans == null || ans === "") return prettyFmt;
  if (typeof ans === "string") return ans.trim();
  if (Array.isArray(ans)) return ans.map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
  if (typeof ans === "object") {
    if (prettyFmt) return prettyFmt;
    const o = ans as Record<string, unknown>;
    const nameParts = [o.first, o.middle, o.last].map((x) => String(x || "").trim()).filter(Boolean);
    if (nameParts.length) return nameParts.join(" ");
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${String(v ?? "").trim()}`)
      .filter((s) => !/:\s*$/.test(s))
      .join(" · ");
  }
  return String(ans);
}

/** Deriving a label from a rawRequest key like "q12_incomeSource" (fallback path). */
function labelFromRawKey(key: string): string {
  return key
    .replace(/^q\d+_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function fieldsFromEvent(r: Record<string, unknown>): WebhookEventFieldRow[] {
  const api = r.apiSubmission as Record<string, unknown> | null;
  const answers = api?.answers;
  if (answers && typeof answers === "object") {
    return Object.values(answers as Record<string, Record<string, unknown>>)
      .filter((a) => a && !NON_INPUT_TYPES.has(String(a.type || "")))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((a) => ({
        label: String(a.text || a.name || "").trim().slice(0, 200),
        value: flattenAnswerValue(a).slice(0, 2000),
      }))
      .filter((f) => f.label && f.value);
  }
  // Fallback: the webhook's parsed rawRequest ({ q3_name: ..., q5_dob: ... }).
  const raw = r.answers;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([k]) => /^q\d+_/.test(k))
      .map(([k, v]) => ({
        label: labelFromRawKey(k).slice(0, 200),
        value: (typeof v === "object" ? flattenAnswerValue({ answer: v }) : String(v ?? "").trim()).slice(0, 2000),
      }))
      .filter((f) => f.label && f.value);
  }
  return [];
}

export async function listWebhookEventDetails(
  opts: {
    formIds?: string[];
    limit?: number;
    callerOrg?: string | null;
    sinceISO?: string | null;
    afterISO?: string | null;
  } = {}
): Promise<WebhookEventDetailItem[]> {
  const limit = Math.max(1, Math.min(100, Number(opts.limit || 50)));
  const org = normId(opts.callerOrg);
  const wanted = [...new Set((opts.formIds ?? []).filter(isValidFormId))];
  if (!org || !wanted.length) return [];

  const sinceDate = opts.sinceISO ? new Date(opts.sinceISO) : null;
  const since =
    sinceDate && Number.isFinite(sinceDate.getTime())
      ? Timestamp.fromDate(sinceDate)
      : null;
  const afterDate = opts.afterISO ? new Date(opts.afterISO) : null;
  const after =
    afterDate && Number.isFinite(afterDate.getTime())
      ? Timestamp.fromDate(afterDate)
      : null;

  // Firestore permits at most 30 values in an `in` filter. Query each chunk
  // against the same orgId + formId + createdAt composite index, then merge.
  // Unlike the former 300-document scan, only relevant documents enter memory.
  const chunks: string[][] = [];
  for (let i = 0; i < wanted.length; i += 30) chunks.push(wanted.slice(i, i + 30));
  const snapshots = await Promise.all(
    chunks.map((formIds) => {
      let query: FirebaseFirestore.Query = db
        .collection(COLLECTION)
        .where("orgId", "==", org)
        .where("formId", "in", formIds)
        .orderBy("createdAt", "desc")
        .select(
          "orgId",
          "formId",
          "submissionId",
          "submitterName",
          "receivedAtISO",
          "createdAt",
          "pretty",
          "normalizedFields"
        );
      if (after) query = query.where("createdAt", ">", after);
      else if (since) query = query.where("createdAt", ">=", since);
      return query.limit(limit).get();
    })
  );

  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const snap of snapshots) {
    for (const doc of snap.docs) docsById.set(doc.id, doc);
  }
  const docs = [...docsById.values()]
    .sort((a, b) => {
      const aMillis = (a.get("createdAt") as FirebaseFirestore.Timestamp | null)?.toMillis?.() ?? 0;
      const bMillis = (b.get("createdAt") as FirebaseFirestore.Timestamp | null)?.toMillis?.() ?? 0;
      return bMillis - aMillis;
    })
    .slice(0, limit);

  const out: WebhookEventDetailItem[] = [];
  for (const d of docs) {
    const r = { id: d.id, ...(d.data() || {}) } as Record<string, unknown>;
    const formId = String(r.formId || "");
    out.push({
      id: String(r.id),
      formId,
      submissionId: String(r.submissionId || ""),
      submitterName: String(r.submitterName || ""),
      receivedAtISO: (r.receivedAtISO as string | null) ?? null,
      createdAtISO:
        (r.createdAt as FirebaseFirestore.Timestamp | null)?.toDate?.().toISOString() ?? null,
      pretty: String(r.pretty || "").slice(0, 4000),
      fields: Array.isArray(r.normalizedFields)
        ? (r.normalizedFields as WebhookEventFieldRow[])
        : [],
    });
  }
  return out;
}

export async function listWebhookEvents(opts: { limit?: number; callerOrg?: string | null } = {}): Promise<WebhookEventListItem[]> {
  const limit = Math.max(1, Math.min(200, Number(opts.limit || 50)));
  const org = normId(opts.callerOrg);

  const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) } as Record<string, unknown>))
    .filter((r) => {
      const ro = normId(r.orgId);
      return !ro || !org || ro === org;
    })
    .map((r) => ({
      id: String(r.id),
      formId: String(r.formId || ""),
      submissionId: String(r.submissionId || ""),
      submitterName: String(r.submitterName || ""),
      pretty: String(r.pretty || "").slice(0, 2000),
      answerKeys: r.answers && typeof r.answers === "object" ? Object.keys(r.answers as object).length : 0,
      apiPulled: !!r.apiPulled,
      receivedAtISO: (r.receivedAtISO as string | null) ?? null,
    }));
}
