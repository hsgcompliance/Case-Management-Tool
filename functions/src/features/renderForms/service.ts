// functions/src/features/renderForms/service.ts
// Smart render engine: org-access-only Jotforms can't be opened by external
// customers, so we render the fields ourselves on a token-gated page and submit
// on the backend. The API submit bypasses Jotform workflows/webhooks, so we
// capture our OWN event (jotformWebhookEvents, source "render-engine").
import crypto from "node:crypto";
import { randomUUID as uuid } from "node:crypto";
import Busboy from "busboy";
import type { Request } from "express";
import * as logger from "firebase-functions/logger";
import admin from "../../core/admin";
import { db, FieldValue, isoNow, normId, FORMS_APP_BASE_URL, type Claims } from "../../core";
import { getFormSchema } from "../webhooks/service";

const COLLECTION = "renderSessions";
const DEFAULT_TTL_MIN = 60 * 24 * 7; // customer links live 7 days
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function genToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
function hashToken(t: string): string {
  return crypto.createHash("sha256").update(String(t)).digest("hex");
}
function isValidFormId(formId: string): boolean {
  return /^\d{6,24}$/.test(String(formId || ""));
}
function err(code: number, message: string): Error & { code: number } {
  const e = new Error(message) as Error & { code: number };
  e.code = code;
  return e;
}
function formsAppBase(): string {
  const fromEnv =
    FORMS_APP_BASE_URL && typeof FORMS_APP_BASE_URL.value === "function" ? String(FORMS_APP_BASE_URL.value() || "") : "";
  return (fromEnv || process.env.FORMS_APP_BASE_URL || "https://housing-db-forms.web.app").trim().replace(/\/+$/, "");
}

/* ───────────────────────── create (staff) ───────────────────────── */

export async function createRenderSession(args: {
  formId: string;
  customerId: string | null;
  caller: Claims;
  orgId: string;
}): Promise<{ renderUrl: string; expiresAt: string; formSessionId: string }> {
  const formId = String(args.formId || "");
  if (!isValidFormId(formId)) throw err(400, "invalid_form_id");

  // Only forms whitelisted for customer send may be rendered to customers.
  const reg = await db.collection("formsRegistry").doc(formId).get();
  if (!reg.exists || !reg.data()?.customerSendable) throw err(403, "form_not_sendable");

  let customerName = "";
  const customerId = normId(args.customerId) || null;
  if (customerId) {
    const c = await db.collection("customers").doc(customerId).get();
    if (c.exists) {
      const d = c.data() || {};
      customerName = [d.firstName, d.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    }
  }

  const token = genToken();
  const id = uuid();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MIN * 60_000).toISOString();
  await db.collection(COLLECTION).doc(id).set({
    id,
    orgId: normId(args.orgId),
    formId,
    customerId,
    customerName,
    title: String(reg.data()?.title || ""),
    tokenHash: hashToken(token),
    status: "created",
    expiresAt,
    createdByUid: (args.caller as { uid?: string })?.uid || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { renderUrl: `${formsAppBase()}/f/${token}`, expiresAt, formSessionId: id };
}

/* ───────────────────────── resolve (public, token) ───────────────────────── */

async function findByToken(token: string) {
  const snap = await db.collection(COLLECTION).where("tokenHash", "==", hashToken(token)).limit(1).get();
  const hit = snap.docs[0];
  if (!hit) return null;
  return { ref: hit.ref, data: { id: hit.id, ...(hit.data() || {}) } as Record<string, unknown> };
}

export async function resolveRenderSession(token: string) {
  const found = await findByToken(token);
  if (!found) throw err(404, "session_not_found");
  const d = found.data;
  const expired = Date.parse(String(d.expiresAt || "")) < Date.now();
  const submitted = d.status === "submitted";
  const revoked = d.status === "revoked";
  const fields = expired || submitted || revoked ? [] : await getFormSchema(String(d.formId));
  return {
    formId: String(d.formId),
    title: String(d.title || ""),
    customerName: (d.customerName as string) || null,
    status: expired ? "expired" : String(d.status),
    expired,
    submitted,
    revoked,
    fields,
  };
}

/* ───────────────────────── submit (public, token, multipart) ───────────────────────── */

type ParsedSubmit = { values: Record<string, string>; files: Array<{ qid: string; filename: string; buffer: Buffer; contentType: string }> };

export async function parseSubmit(req: Request): Promise<ParsedSubmit> {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("multipart/form-data") || !raw?.length) {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) values[k] = typeof v === "string" ? v : JSON.stringify(v);
    return { values, files: [] };
  }
  return await new Promise<ParsedSubmit>((resolve, reject) => {
    const values: Record<string, string> = {};
    const files: ParsedSubmit["files"] = [];
    const bb = Busboy({ headers: req.headers, limits: { files: 20, fileSize: MAX_UPLOAD_BYTES, fieldSize: 1024 * 1024 } });
    bb.on("field", (name: string, val: string) => { values[name] = val; });
    bb.on("file", (name: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => stream.resume());
      stream.on("end", () => {
        if (info.filename) files.push({ qid: name, filename: info.filename, buffer: Buffer.concat(chunks), contentType: info.mimeType || "application/octet-stream" });
      });
    });
    bb.on("close", () => resolve({ values, files }));
    bb.on("error", (e: Error) => reject(e));
    bb.end(raw);
  });
}

async function jotformCreateSubmission(formId: string, scalarByQid: Record<string, string>): Promise<string> {
  const key = String(process.env.JOTFORM_API_KEY_SECRET || process.env.JOTFORM_API_KEY || "").trim();
  const base = String(process.env.JOTFORM_API || "https://api.jotform.com").trim().replace(/\/+$/, "");
  if (!key) return "";
  const params = new URLSearchParams();
  for (const [qid, value] of Object.entries(scalarByQid)) {
    if (value == null || value === "") continue;
    params.set(`submission[${qid}]`, String(value).slice(0, 4000));
  }
  const resp = await fetch(`${base}/form/${encodeURIComponent(formId)}/submissions?apiKey=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await resp.json().catch(() => null)) as { responseCode?: number; content?: { submissionID?: string } } | null;
  if (!resp.ok || Number(json?.responseCode) !== 200) return "";
  return String(json?.content?.submissionID || "");
}

export async function submitRenderSession(token: string, parsed: ParsedSubmit) {
  const found = await findByToken(token);
  if (!found) throw err(404, "session_not_found");
  const { ref, data } = found;
  if (data.status === "submitted") throw err(409, "already_submitted");
  if (data.status === "revoked") throw err(410, "revoked");
  if (Date.parse(String(data.expiresAt || "")) < Date.now()) throw err(410, "expired");

  const formId = String(data.formId);
  const sessionId = String(data.id);

  // Strip the q_/f_ prefixes the client uses → keyed by qid.
  const scalarByQid: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.values)) {
    if (k.startsWith("q_")) scalarByQid[k.slice(2)] = v;
  }

  // Files → our Storage (reliable). Path stored on the event; viewing is a follow-up.
  const fileRefs: Array<{ qid: string; filename: string; path: string; size: number }> = [];
  try {
    const bucket = admin.storage().bucket();
    for (const f of parsed.files) {
      const qid = f.qid.startsWith("f_") ? f.qid.slice(2) : f.qid;
      const safe = f.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const path = `renderUploads/${sessionId}/${Date.now()}_${safe}`;
      await bucket.file(path).save(f.buffer, { contentType: f.contentType, resumable: false });
      fileRefs.push({ qid, filename: f.filename, path, size: f.buffer.length });
    }
  } catch (e) {
    logger.warn("render_upload_failed", { sessionId, message: (e as Error)?.message });
  }

  // Best-effort Jotform submit (scalar fields). Our event is the source of truth.
  let submissionId = "";
  try {
    submissionId = await jotformCreateSubmission(formId, scalarByQid);
  } catch (e) {
    logger.warn("render_jotform_submit_failed", { formId, message: (e as Error)?.message });
  }

  const submitterName = String(data.customerName || scalarByQid_name(scalarByQid) || "").slice(0, 200);

  // Internal event (#9 seed) — surfaces in the Webhooks tab + name-match.
  await db.collection("jotformWebhookEvents").add({
    source: "render-engine",
    kind: "render",
    orgId: (data.orgId as string) || null,
    formId,
    submissionId,
    submitterName,
    customerId: (data.customerId as string) || null,
    renderSessionId: sessionId,
    answersByQid: scalarByQid,
    files: fileRefs,
    apiPulled: !!submissionId,
    receivedAtISO: isoNow(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await ref.set(
    { status: "submitted", submissionId, submittedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { submitted: true, submissionId, files: fileRefs.length };
}

function scalarByQid_name(scalars: Record<string, string>): string {
  // No schema here; just take the first non-empty value as a weak name fallback.
  const v = Object.values(scalars).find((x) => String(x || "").trim());
  return v ? String(v).slice(0, 120) : "";
}
