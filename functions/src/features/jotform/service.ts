// functions/src/features/jotform/service.ts
import { randomUUID as uuid } from "node:crypto";
import * as logger from "firebase-functions/logger";
import {
  db,
  FieldValue,
  FieldPath,
  Timestamp,
  withTxn,
  sanitizeNestedObject,
  stripReservedFields,
  normId,
  orgIdFromClaims,
  requireOrg,
  isDev,
  newBulkWriter,
  toDate,
  toUtcIso,
  JOTFORM_API_KEY_SECRET,
  type Claims,
} from "../../core";
import {
  JotformSubmission,
  JotformFormSummary,
  JotformDigestMap,
  JotformSubmissionCalc,
  JotformSubmissionPatchBody,
  JotformSubmissionUpsertBody,
  TJotformSubmission,
  TJotformBudget,
  TJotformDigestMap,
  toArray,
} from "./schemas";
import { isSpendingFormId, extractSpendItems, type ExtractedSpendItem } from "../paymentQueue/extractor";
import { upsertPaymentQueueItems } from "../paymentQueue/service";
import { refreshCreditCardBudgets } from "../creditCards/refreshBudget";

const CC_FORM_ID = "251878265158166";

function resolveCreditCardId(card: string, cards: Array<Record<string, unknown>>): string {
  if (!card) return "";
  const needle = card.trim().toLowerCase();
  for (const c of cards) {
    if (String(c.id || "").trim().toLowerCase() === needle) return String(c.id);
    if (c.code && String(c.code).trim().toLowerCase() === needle) return String(c.id);
    const m = c.matching as Record<string, unknown> | null | undefined;
    const vals = Array.isArray(m?.cardAnswerValues) ? (m!.cardAnswerValues as unknown[]) : [];
    if (vals.some((v) => String(v || "").trim().toLowerCase() === needle)) return String(c.id);
  }
  return "";
}

/* ---------------- Jotform API helpers ---------------- */

const JOTFORM_API = process.env.JOTFORM_API || "https://api.jotform.com";

function syncError(stage: "config" | "jotform" | "write" | "validation" | "unknown", error: unknown, meta?: Record<string, unknown>) {
  const src = error as { code?: number | string; message?: string; meta?: Record<string, unknown> };
  const err: any = new Error(src?.message || "sync_failed");
  err.code = typeof src?.code === "number" ? src.code : Number(src?.code) || 500;
  err.meta = {
    stage,
    ...((src?.meta && typeof src.meta === "object") ? src.meta : {}),
    ...(meta || {}),
  };
  logger.error("jotform_sync_failure", { stage, code: err.code, message: err.message, meta: err.meta });
  return err;
}

function readSyncStageFromError(error: unknown): "config" | "jotform" | "write" | "validation" | "unknown" {
  const stage = String((error as any)?.meta?.stage || "");
  if (stage === "config" || stage === "jotform" || stage === "write" || stage === "validation") return stage;
  return "unknown";
}

function getJotformApiKey(): string {
  const fromSecret =
    JOTFORM_API_KEY_SECRET && typeof JOTFORM_API_KEY_SECRET.value === "function"
      ? String(JOTFORM_API_KEY_SECRET.value() || "")
      : "";
  const fromSecretEnv = String(process.env.JOTFORM_API_KEY_SECRET || "");
  const fromEnv = String(process.env.JOTFORM_API_KEY || "");
  return (fromSecret || fromSecretEnv || fromEnv).trim();
}

type JotformApiResponse<T> = {
  responseCode: number;
  message?: string;
  content?: T;
};

async function jotformFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const apiKey = getJotformApiKey();
  if (!apiKey) {
    throw syncError("config", { code: 500, message: "missing_jotform_api_key", meta: { hint: "Set JOTFORM_API_KEY_SECRET (prod) or JOTFORM_API_KEY (local/emulator)." } });
  }

  const url = new URL(path, JOTFORM_API);
  url.searchParams.set("apiKey", apiKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString());
  const raw = await res.text();

  let json: JotformApiResponse<T> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as JotformApiResponse<T>) : null;
  } catch {
    json = null;
  }

  const responseCode = Number(json?.responseCode || 0);
  if (!res.ok || responseCode !== 200) {
    throw syncError("jotform", {
      code: res.status || 502,
      message: "jotform_api_error",
      meta: {
        status: res.status,
        responseCode,
        message: json?.message || null,
        contentType: res.headers.get("content-type") || null,
        bodyPreview: raw ? raw.slice(0, 500) : null,
        path,
      },
    });
  }

  return (json?.content ?? null) as T;
}

function normalizeAlias(input: unknown): string {
  const s = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  return s || "form";
}

type JotformFormApi = {
  id?: string;
  title?: string;
  count?: number | string;
  submissionsCount?: number | string;
  last_submission?: string;
  url?: string;
};

/* ---------------- Budget helpers (server-derived totals) ---------------- */

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function normalizeBudget(input?: TJotformBudget | null): TJotformBudget | null {
  if (!input) return null;

  const items = (Array.isArray(input.lineItems) ? input.lineItems : []).map((li) => ({
    id: li.id || uuid(),
    label: li.label ?? null,
    amount: Number(li.amount || 0),
    projected: Number(li.projected || 0),
    spent: Number(li.spent || 0),
    projectedInWindow: Number((li as any).projectedInWindow || 0),
    spentInWindow: Number((li as any).spentInWindow || 0),
    locked: li.locked ?? null,
  }));

  const capFromItems = sum(items.map((i) => i.amount));
  const total = Number((input as any).total ?? NaN);
  const totalCap = Number.isFinite(total) && total >= 0 ? total : capFromItems;

  const projected = sum(items.map((i) => i.projected));
  const spent = sum(items.map((i) => i.spent));
  const balance = totalCap - spent;
  const projectedBalance = totalCap - (spent + projected);

  const projectedInWindow = sum(items.map((i) => i.projectedInWindow || 0));
  const spentInWindow = sum(items.map((i) => i.spentInWindow || 0));
  const windowBalance = totalCap - spentInWindow;
  const windowProjectedBalance = totalCap - (spentInWindow + projectedInWindow);

  const totals = {
    total: totalCap,
    projected,
    spent,
    balance,
    projectedBalance,
    remaining: balance,
    projectedInWindow,
    spentInWindow,
    windowBalance,
    windowProjectedBalance,
  };

  return {
    total: totalCap,
    totals,
    lineItems: items,
    createdAt: (input as any).createdAt,
    updatedAt: (input as any).updatedAt,
  };
}

const cleanExtras = (v: Record<string, unknown> | null | undefined) =>
  v ? sanitizeNestedObject(stripReservedFields(v as Record<string, unknown>)) : null;

/* ---------------- Reserved keys (server-owned / protected) ---------------- */

const RESERVED = new Set<string>([
  "id",
  "orgId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "_tags",
  "active",
  "deleted",
]);

function isReserved(k: string) {
  return RESERVED.has(k) || k.startsWith("_");
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/* ---------------- Org access helpers ---------------- */

function assertTargetOrgAllowed(caller: Claims, targetOrg: string) {
  const callerOrg = orgIdFromClaims(caller);
  const t = normId(targetOrg);

  if (callerOrg && normId(callerOrg) !== t && !isDev(caller)) {
    const e: any = new Error("forbidden_cross_org");
    e.code = 403;
    e.meta = { callerOrg: normId(callerOrg), targetOrg: t };
    throw e;
  }

  if (!callerOrg && !isDev(caller)) {
    requireOrg(caller);
  }
}

function assertDocOrgWritable(caller: Claims, targetOrg: string, doc: any) {
  const docOrg = normId(doc?.orgId);
  const t = normId(targetOrg);

  if (docOrg && docOrg !== t && !isDev(caller)) {
    const e: any = new Error("forbidden_org");
    e.code = 403;
    e.meta = { docOrg, targetOrg: t };
    throw e;
  }
}

/* ---------------- Calc helpers ---------------- */

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function collectNumbersFromAnswer(v: any, out: number[]) {
  const direct = parseMoney(v);
  if (direct != null) out.push(direct);

  if (v && typeof v === "object") {
    if ("answer" in v) collectNumbersFromAnswer((v as any).answer, out);
    if ("value" in v) collectNumbersFromAnswer((v as any).value, out);
    if ("text" in v) collectNumbersFromAnswer((v as any).text, out);
    if (Array.isArray(v)) v.forEach((x) => collectNumbersFromAnswer(x, out));
  }
}

function deriveCalc(inputCalc: any, answers: Record<string, unknown> | null | undefined) {
  const base = (inputCalc || {}) as any;
  const amounts: number[] = Array.isArray(base.amounts) ? base.amounts : [];

  if (answers && typeof answers === "object") {
    for (const v of Object.values(answers)) {
      collectNumbersFromAnswer(v, amounts);
    }
  }

  const amount = Number.isFinite(base.amount)
    ? Number(base.amount)
    : amounts.length
    ? sum(amounts)
    : 0;

  const parsed = JotformSubmissionCalc.parse({
    ...base,
    amount,
    amounts,
  });

  return parsed;
}

/* ---------------- Patch sanitizer ---------------- */

function sanitizeSubmissionPatch(patch: Partial<TJotformSubmission>): Partial<TJotformSubmission> {
  const out: any = { ...(patch || {}) };

  for (const k of Object.keys(out)) {
    if (isReserved(k)) delete out[k];
  }

  if ("createdAt" in out) delete out.createdAt;
  if ("updatedAt" in out) delete out.updatedAt;

  if (out.answers !== undefined) out.answers = cleanExtras(out.answers as any);
  if (out.raw !== undefined) out.raw = out.raw;

  return out;
}

/* ---------------- Normalize single submission for storage ---------------- */

export function normalizeOne(input: TJotformSubmission, caller: Claims, targetOrg: string) {
  const parsed = JotformSubmission.parse(input);

  const id = parsed.id || parsed.submissionId || uuid();
  const status = (parsed.status || "active") as TJotformSubmission["status"];

  const active = status === "active";
  const deleted = status === "deleted";

  const answers = cleanExtras(parsed.answers as any);
  const calc = deriveCalc(parsed.calc, answers || undefined);
  const budget = normalizeBudget(parsed.budget ?? null);

  const jotformCreatedAt = toUtcIso(parsed.createdAt as any) || null;
  const jotformUpdatedAt = toUtcIso(parsed.updatedAt as any) || null;

  return {
    id,
    orgId: normId(targetOrg),

    formId: parsed.formId,
    formTitle: parsed.formTitle ?? null,
    submissionId: parsed.submissionId ?? parsed.id ?? null,

    status,
    active,
    deleted,
    source: parsed.source ?? "manual",

    grantId: parsed.grantId ?? null,
    programId: parsed.programId ?? null,
    customerId: parsed.customerId ?? null,
    enrollmentId: parsed.enrollmentId ?? null,
    cwId: parsed.cwId ?? null,
    hmisId: parsed.hmisId ?? null,
    formAlias: parsed.formAlias ?? null,
    fieldMap: parsed.fieldMap ?? null,

    ip: parsed.ip ?? null,
    statusRaw: parsed.statusRaw ?? null,
    submissionUrl: parsed.submissionUrl ?? null,
    editUrl: parsed.editUrl ?? null,
    pdfUrl: parsed.pdfUrl ?? null,

    answers,
    raw: parsed.raw ?? null,

    calc,
    budget,

    jotformCreatedAt,
    jotformUpdatedAt,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* ---------------- Upsert (bulk) ---------------- */

export async function upsertJotformSubmissions(body: unknown, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const items = toArray(JotformSubmissionUpsertBody.parse(body)).map((s) =>
    normalizeOne(s as any, caller, targetOrg)
  );

  const refs = items.map((s) => db.collection("jotformSubmissions").doc(s.id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < items.length; i++) {
    writer.set(refs[i], items[i], { merge: true });
  }
  await writer.close();

  return { ids: items.map((i) => i.id) };
}

/* ---------------- Patch (bulk; supports unset[]; budget-aware merges) ---------------- */

export async function patchJotformSubmissions(body: unknown, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const rows = toArray(JotformSubmissionPatchBody.parse(body));
  const ids = rows.map((r) => r.id);

  const refs = ids.map((id) => db.collection("jotformSubmissions").doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e: any = new Error("not_found");
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  const budgetRows: Array<{ id: string; patch: any; unset?: string[] }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { id, patch, unset } = rows[i] as any;
    const prev = (snaps[i].data() || {}) as any;

    const safePatch = sanitizeSubmissionPatch(patch as Partial<TJotformSubmission>);

    const touchesBudget = hasOwn(safePatch, "budget");

    if (touchesBudget) {
      budgetRows.push({ id, patch: safePatch, unset });
      continue;
    }

    const nextStatus = (safePatch.status ?? prev.status ?? "active") as TJotformSubmission["status"];
    const active = nextStatus === "active";
    const deleted = nextStatus === "deleted";

    const data: any = {
      ...safePatch,
      status: nextStatus,
      active,
      deleted,
      ...(normId(prev.orgId) ? {} : { orgId: normId(targetOrg) }),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = db.collection("jotformSubmissions").doc(id);
    writer.set(ref, data, { merge: true });

    if (Array.isArray(unset) && unset.length) {
      const delMap: Record<string, any> = {};
      for (const path of unset) delMap[path] = FieldValue.delete();
      writer.set(ref, delMap, { merge: true });
    }
  }

  await writer.close();

  // Budget patches: transact per-doc for deterministic merge + re-derive totals.
  for (const row of budgetRows) {
    const { id, patch, unset } = row;

    await withTxn(
      async (tx) => {
        const ref = db.collection("jotformSubmissions").doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) {
          const e: any = new Error("not_found");
          e.code = 404;
          throw e;
        }

        const prev = snap.data() || {};
        assertDocOrgWritable(caller, targetOrg, prev);

        const nextStatus = ((patch as any).status ?? (prev as any).status ?? "active") as TJotformSubmission["status"];
        const active = nextStatus === "active";
        const deleted = nextStatus === "deleted";

        let nextBudget: TJotformBudget | null = null;

        if (hasOwn(patch, "budget") && (patch as any).budget === null) {
          nextBudget = null;
        } else {
          const prevBudget = ((prev as any).budget || {}) as Partial<TJotformBudget>;
          const patchBudget = (((patch as any).budget || {}) as Partial<TJotformBudget>);
          const mergedInput: Partial<TJotformBudget> = {
            ...prevBudget,
            ...patchBudget,
            ...(Array.isArray((patchBudget as any).lineItems)
              ? { lineItems: (patchBudget as any).lineItems }
              : {}),
          };
          nextBudget = normalizeBudget(
            Object.keys(mergedInput).length ? (mergedInput as TJotformBudget) : null
          );
        }

        const data: any = {
          ...patch,
          status: nextStatus,
          active,
          deleted,
          budget: nextBudget,
          ...(normId((prev as any).orgId) ? {} : { orgId: normId(targetOrg) }),
          updatedAt: FieldValue.serverTimestamp(),
        };

        tx.set(ref, data, { merge: true });

        if (Array.isArray(unset) && unset.length) {
          const delMap: Record<string, any> = {};
          for (const path of unset) delMap[path] = FieldValue.delete();
          tx.set(ref, delMap, { merge: true });
        }
      },
      "jotform_submissions_patch_with_budget"
    );
  }

  return { ids };
}

/* ---------------- Delete (soft) ---------------- */

export async function softDeleteJotformSubmissions(ids: string | string[], caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const arr = toArray(ids);
  const snaps = await Promise.all(arr.map((id) => db.collection("jotformSubmissions").doc(id).get()));

  snaps.forEach((s) => {
    if (!s.exists) {
      const e: any = new Error("not_found");
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  const writer = newBulkWriter(2);
  for (const id of arr) {
    writer.set(
      db.collection("jotformSubmissions").doc(id),
      {
        status: "deleted",
        active: false,
        deleted: true,
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
        ...(normId((snaps.find((s) => s.id === id)?.data() as any)?.orgId) ? {} : { orgId: normId(targetOrg) }),
      },
      { merge: true }
    );
  }
  await writer.close();

  return { ids: arr, deleted: true as const };
}

/* ---------------- Delete (hard) ---------------- */

export async function hardDeleteJotformSubmissions(ids: string | string[], caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const arr = toArray(ids);
  const snaps = await Promise.all(arr.map((id) => db.collection("jotformSubmissions").doc(id).get()));

  snaps.forEach((s) => {
    if (!s.exists) return;
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  const batch = db.batch();
  for (const id of arr) {
    batch.delete(db.collection("jotformSubmissions").doc(id));
  }
  await batch.commit();

  return { ids: arr, deleted: true };
}

/* ---------------- List ---------------- */

export async function listJotformSubmissions(src: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const {
    status,
    active,
    formId,
    formAlias,
    submissionId,
    grantId,
    programId,
    customerId,
    enrollmentId,
    cwId,
    hmisId,
    limit = 200,
    cursorUpdatedAt,
    cursorId,
  } = src;

  const lim = Math.max(1, Math.min(500, Number(limit) || 200));

  let q: FirebaseFirestore.Query = db
    .collection("jotformSubmissions")
    .where("orgId", "==", targetOrg);

  const statusStr = typeof status === "string" ? status.trim().toLowerCase() : undefined;
  if (statusStr) q = q.where("status", "==", statusStr);

  if (active === "true" || active === true) q = q.where("active", "==", true);
  if (active === "false" || active === false) q = q.where("active", "==", false);

  const formIdStr = typeof formId === "string" ? normId(formId) : undefined;
  if (formIdStr) q = q.where("formId", "==", formIdStr);

  const formAliasStr = typeof formAlias === "string" ? normalizeAlias(formAlias) : undefined;
  if (formAliasStr) q = q.where("formAlias", "==", formAliasStr);

  const submissionIdStr = typeof submissionId === "string" ? normId(submissionId) : undefined;
  if (submissionIdStr) q = q.where("submissionId", "==", submissionIdStr);

  const grantIdStr = typeof grantId === "string" ? normId(grantId) : undefined;
  if (grantIdStr) q = q.where("grantId", "==", grantIdStr);

  const programIdStr = typeof programId === "string" ? normId(programId) : undefined;
  if (programIdStr) q = q.where("programId", "==", programIdStr);

  const customerIdStr = typeof customerId === "string" ? normId(customerId) : undefined;
  if (customerIdStr) q = q.where("customerId", "==", customerIdStr);

  const enrollmentIdStr = typeof enrollmentId === "string" ? normId(enrollmentId) : undefined;
  if (enrollmentIdStr) q = q.where("enrollmentId", "==", enrollmentIdStr);

  const cwIdStr = typeof cwId === "string" ? String(cwId).trim() : "";
  if (cwIdStr) q = q.where("cwId", "==", cwIdStr);

  const hmisIdStr = typeof hmisId === "string" ? String(hmisId).trim() : "";
  if (hmisIdStr) q = q.where("hmisId", "==", hmisIdStr);

  q = q
    .orderBy("updatedAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(lim);

  const parseCursorTs = (v: unknown): FirebaseFirestore.Timestamp => {
    if (typeof v === "string" || typeof v === "number") {
      // Handle numeric strings as epoch millis
      const num = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
      const d = toDate(num as any);
      if (d) return Timestamp.fromDate(d);
    }
    const sec = Number((v as any)?.seconds ?? (v as any)?._seconds ?? 0) || 0;
    const ns = Number((v as any)?.nanoseconds ?? (v as any)?._nanoseconds ?? 0) || 0;
    return new Timestamp(sec, ns);
  };

  if (cursorUpdatedAt && cursorId) {
    const ts = parseCursorTs(cursorUpdatedAt);
    q = q.startAfter(ts, String(cursorId));
  }

  const snap = await q.get();
  const docs = snap.docs;
  const items = docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  const last = docs.length ? docs[docs.length - 1] : null;
  const lastUpdated = (last?.get("updatedAt") ??
    null) as FirebaseFirestore.Timestamp | null | undefined;

  const next = last
    ? {
        cursorUpdatedAt: lastUpdated ?? Timestamp.fromMillis(0),
        cursorId: last.id,
      }
    : null;

  return { items, next };
}

/* ---------------- Get ---------------- */

export async function getJotformSubmission(id: string) {
  const snap = await db.collection("jotformSubmissions").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() || {}) };
}

/* ---------------- Forms list from Jotform API ---------------- */

export async function listJotformForms(src: any) {
  const includeNoSubmissions =
    src?.includeNoSubmissions === true || String(src?.includeNoSubmissions || "").toLowerCase() === "true";
  const search = String(src?.search || "").trim().toLowerCase();
  const max = Math.max(1, Math.min(500, Number(src?.limit) || 200));

  const pageLimit = 100;
  let offset = 0;
  const all: JotformFormApi[] = [];

  while (true) {
    const chunk = await jotformFetch<JotformFormApi[]>("/user/forms", { limit: pageLimit, offset });
    const rows = Array.isArray(chunk) ? chunk : [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageLimit) break;
    offset += rows.length;
    if (all.length >= 5000) break;
  }

  const items = all
    .map((f) => {
      const id = String(f.id || "").trim();
      const title = String(f.title || "").trim();
      const count = Number(f.submissionsCount ?? f.count ?? 0) || 0;
      const alias = normalizeAlias(title || id);
      const rec = {
        id,
        title,
        alias,
        count: Math.max(0, Math.trunc(count)),
        lastSubmission: f.last_submission || null,
        url: f.url || null,
      };
      return JotformFormSummary.parse(rec);
    })
    .filter((f) => !!f.id)
    .filter((f) => (includeNoSubmissions ? true : Number(f.count || 0) > 0))
    .filter((f) => {
      if (!search) return true;
      return (
        String(f.title || "").toLowerCase().includes(search) ||
        String(f.id || "").toLowerCase().includes(search) ||
        String(f.alias || "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => String(b.lastSubmission || "").localeCompare(String(a.lastSubmission || "")))
    .slice(0, max);

  return { items };
}

async function findCustomerIdByExternalId(field: "cwId" | "hmisId", value: string, targetOrg: string) {
  const v = String(value || "").trim();
  if (!v) return null;
  const snap = await db.collection("customers").where(field, "==", v).limit(25).get();
  const hit = snap.docs.find((d) => normId((d.data() || {}).orgId) === normId(targetOrg));
  return hit?.id || null;
}

export async function linkJotformSubmission(body: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const rawId = normId(body?.id);
  const rawSubmissionId = normId(body?.submissionId);
  const formAlias = body?.formAlias ? normalizeAlias(body.formAlias) : null;
  const cwId = String(body?.cwId || "").trim() || null;
  const hmisId = String(body?.hmisId || "").trim() || null;

  let ref: FirebaseFirestore.DocumentReference;
  let snap: FirebaseFirestore.DocumentSnapshot | null = null;

  if (rawId) {
    ref = db.collection("jotformSubmissions").doc(rawId);
    snap = await ref.get();
  } else if (rawSubmissionId) {
    const q = await db
      .collection("jotformSubmissions")
      .where("orgId", "==", normId(targetOrg))
      .where("submissionId", "==", rawSubmissionId)
      .limit(1)
      .get();
    const doc = q.docs[0];
    if (!doc) {
      const e: any = new Error("not_found");
      e.code = 404;
      throw e;
    }
    snap = doc;
    ref = doc.ref;
  } else {
    const e: any = new Error("missing_id_or_submissionId");
    e.code = 400;
    throw e;
  }

  if (!snap?.exists) {
    const e: any = new Error("not_found");
    e.code = 404;
    throw e;
  }

  const prev = (snap.data() || {}) as any;
  assertDocOrgWritable(caller, targetOrg, prev);

  let grantId = normId(body?.grantId || prev.grantId || "") || null;
  let enrollmentId = normId(body?.enrollmentId || prev.enrollmentId || "") || null;
  let customerId = normId(body?.customerId || prev.customerId || "") || null;

  if (!customerId && cwId) customerId = await findCustomerIdByExternalId("cwId", cwId, targetOrg);
  if (!customerId && hmisId) customerId = await findCustomerIdByExternalId("hmisId", hmisId, targetOrg);

  if (customerId) {
    const cs = await db.collection("customers").doc(customerId).get();
    if (!cs.exists || normId((cs.data() || {}).orgId) !== normId(targetOrg)) {
      const e: any = new Error("customer_not_found_or_forbidden");
      e.code = 404;
      throw e;
    }
  }

  if (enrollmentId) {
    const es = await db.collection("customerEnrollments").doc(enrollmentId).get();
    if (!es.exists || normId((es.data() || {}).orgId) !== normId(targetOrg)) {
      const e: any = new Error("enrollment_not_found_or_forbidden");
      e.code = 404;
      throw e;
    }
    const ed = es.data() || {};
    if (!customerId) customerId = normId((ed as any).customerId || "");
    if (!grantId) grantId = normId((ed as any).grantId || "");
  }

  const cleanFieldMap =
    body?.fieldMap && typeof body.fieldMap === "object"
      ? Object.fromEntries(
          Object.entries(body.fieldMap as Record<string, unknown>)
            .map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])
            .filter(([k, v]) => !!k && !!v)
        )
      : null;

  const resolvedAlias =
    formAlias ||
    normalizeAlias(String(prev.formAlias || prev.formTitle || prev.formId || "form"));

  await ref.set(
    {
      grantId,
      customerId,
      enrollmentId,
      cwId,
      hmisId,
      formAlias: resolvedAlias,
      fieldMap: cleanFieldMap,
      linkedByUid: (caller as any)?.uid || null,
      linkedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: ref.id,
    linked: true as const,
    link: {
      grantId: grantId || null,
      customerId: customerId || null,
      enrollmentId: enrollmentId || null,
      cwId,
      hmisId,
      formAlias: resolvedAlias || null,
    },
  };
}

export async function syncJotformSelection(body: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const mode = String(body?.mode || "all");
  const includeNoSubmissions =
    body?.includeNoSubmissions === true || String(body?.includeNoSubmissions || "").toLowerCase() === "true";

  let forms: Array<{ id: string; alias?: string | null; title?: string | null; count?: number }>;
  try {
    forms = (await listJotformForms({ includeNoSubmissions, limit: 500 })).items;
  } catch (error) {
    throw syncError("jotform", error, { op: "listJotformForms" });
  }

  let selected = forms;
  if (mode === "formIds") {
    const ids = new Set(toArray(body?.formIds).map((x) => normId(x)).filter(Boolean));
    selected = forms.filter((f) => ids.has(normId(f.id)));
  } else if (mode === "aliases") {
    const aliases = new Set(toArray(body?.aliases).map((x) => normalizeAlias(x)).filter(Boolean));
    selected = forms.filter((f) => aliases.has(normalizeAlias(f.alias || f.title || f.id)));
  }

  if (!selected.length) return { forms: [], ids: [], count: 0 };

  const outForms: Array<{ formId: string; alias: string | null; count: number; jotformTotal: number; localTotal: number; countMismatch: boolean }> = [];
  const ids = new Set<string>();

  for (const f of selected) {
    let r: { ids: string[]; count: number };
    try {
      r = await syncJotformSubmissions(
        {
          formId: f.id,
          since: body?.since,
          limit: body?.limit,
          maxPages: body?.maxPages,
          includeRaw: body?.includeRaw,
        },
        caller,
        targetOrg
      );
    } catch (error) {
      throw syncError(readSyncStageFromError(error), error, { formId: String(f.id), alias: f.alias || null });
    }
    const jotformTotal = Number(f.count || 0);
    let localTotal = 0;
    try {
      const countSnap = await db.collection("jotformSubmissions")
        .where("orgId", "==", normId(targetOrg))
        .where("formId", "==", String(f.id))
        .count()
        .get();
      localTotal = countSnap.data().count;
    } catch { /* count() may not be available in emulator */ }
    outForms.push({
      formId: String(f.id),
      alias: f.alias || null,
      count: Number(r.count || 0),
      jotformTotal,
      localTotal,
      countMismatch: jotformTotal > 0 && localTotal !== jotformTotal,
    });
    (r.ids || []).forEach((id) => ids.add(String(id)));
  }

  return { forms: outForms, ids: Array.from(ids), count: ids.size };
}

function normalizeDigestMapInput(input: any, targetOrg: string): TJotformDigestMap {
  const formId = normId(input?.formId || input?.id || "");
  const parsed = JotformDigestMap.parse({
    ...input,
    formId,
    id: formId,
    formAlias: input?.formAlias ? normalizeAlias(input.formAlias) : null,
  });

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((s, idx) => ({
          id: String(s.id || "").trim(),
          label: String(s.label || "").trim() || `Section ${idx + 1}`,
          show: s.show !== false,
          order: Number.isFinite(Number(s.order)) ? Number(s.order) : idx,
          ...(s.color ? { color: String(s.color) } : {}),
        }))
        .filter((s) => !!s.id)
    : [];

  const sectionIds = new Set(sections.map((s) => s.id));

  const fields = Array.isArray(parsed.fields)
    ? parsed.fields
        .map((f, idx) => ({
          key: String(f.key || "").trim(),
          label: String(f.label || f.key || "").trim(),
          questionLabel: f.questionLabel ? String(f.questionLabel) : null,
          type: f.type || "question",
          sectionId: f.sectionId && sectionIds.has(String(f.sectionId)) ? String(f.sectionId) : null,
          show: f.show !== false,
          hideIfEmpty: f.hideIfEmpty !== false,
          order: Number.isFinite(Number(f.order)) ? Number(f.order) : idx,
        }))
        .filter((f) => !!f.key)
    : [];
  const spending = (parsed.options as any)?.spending || {};
  const asKeyArray = (value: unknown) =>
    Array.isArray(value) ? value.map((k) => String(k || "").trim()).filter(Boolean) : [];

  return {
    ...parsed,
    id: formId,
    orgId: normId(targetOrg),
    formId,
    formAlias: parsed.formAlias ? normalizeAlias(parsed.formAlias) : null,
    sections,
    fields,
    options: {
      hideEmptyFields: parsed.options?.hideEmptyFields !== false,
      showQuestions: parsed.options?.showQuestions !== false,
      showAnswers: parsed.options?.showAnswers !== false,
      task: {
        enabled: parsed.options?.task?.enabled === true,
        assignedToGroup: parsed.options?.task?.assignedToGroup || "admin",
        titlePrefix: parsed.options?.task?.titlePrefix ? String(parsed.options.task.titlePrefix).trim() : null,
        titleFieldKeys: Array.isArray(parsed.options?.task?.titleFieldKeys)
          ? parsed.options.task.titleFieldKeys.map((k: unknown) => String(k || "").trim()).filter(Boolean)
          : [],
        subtitleFieldKeys: Array.isArray(parsed.options?.task?.subtitleFieldKeys)
          ? parsed.options.task.subtitleFieldKeys.map((k: unknown) => String(k || "").trim()).filter(Boolean)
          : [],
      },
      spending: {
        ...(spending || {}),
        enabled: spending.enabled === true,
        schemaKind: ["credit-card", "invoice", "other"].includes(String(spending.schemaKind || ""))
          ? String(spending.schemaKind)
          : "other",
        grantFieldKeys: asKeyArray(spending.grantFieldKeys),
        lineItemFieldKeys: asKeyArray(spending.lineItemFieldKeys),
        customerFieldKeys: asKeyArray(spending.customerFieldKeys),
        amountFieldKeys: asKeyArray(spending.amountFieldKeys),
        merchantFieldKeys: asKeyArray(spending.merchantFieldKeys),
        keywordRules: Array.isArray(spending.keywordRules) ? spending.keywordRules : [],
        notes: spending.notes ? String(spending.notes).trim() : null,
      },
    },
    header: {
      show: parsed.header?.show !== false,
      title: parsed.header?.title || null,
      subtitle: parsed.header?.subtitle || null,
    },
  };
}

export async function upsertJotformDigestMap(body: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const doc = normalizeDigestMapInput(body, targetOrg);
  const ref = db.collection("jotformDigestMaps").doc(doc.formId);
  const existing = await ref.get();
  if (existing.exists) assertDocOrgWritable(caller, targetOrg, existing.data() || {});

  await ref.set(
    {
      ...doc,
      id: doc.formId,
      orgId: normId(targetOrg),
      createdAt: existing.exists ? (existing.data() as any)?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: (caller as any)?.uid || null,
    },
    { merge: true }
  );

  return { id: doc.formId };
}

export async function getJotformDigestMap(src: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const formId = normId(src?.formId || src?.id || "");
  const alias = src?.formAlias ? normalizeAlias(src.formAlias) : "";

  if (formId) {
    const snap = await db.collection("jotformDigestMaps").doc(formId).get();
    if (!snap.exists) return { map: null };
    const data = { id: snap.id, ...(snap.data() || {}) };
    assertDocOrgWritable(caller, targetOrg, data);
    return { map: data };
  }

  if (alias) {
    const q = await db
      .collection("jotformDigestMaps")
      .where("orgId", "==", normId(targetOrg))
      .where("formAlias", "==", alias)
      .limit(1)
      .get();
    const hit = q.docs[0];
    if (!hit) return { map: null };
    const data = { id: hit.id, ...(hit.data() || {}) };
    assertDocOrgWritable(caller, targetOrg, data);
    return { map: data };
  }

  return { map: null };
}

export async function listJotformDigestMaps(src: any, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);
  const limit = Math.max(1, Math.min(500, Number(src?.limit) || 200));
  const search = String(src?.search || "").trim().toLowerCase();

  const snap = await db
    .collection("jotformDigestMaps")
    .where("orgId", "==", normId(targetOrg))
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) } as any))
    .filter((x: any) => {
      if (!search) return true;
      const hay = `${String(x.formTitle || "")} ${String(x.formAlias || "")} ${String(x.formId || "")}`.toLowerCase();
      return hay.includes(search);
    });

  return { items };
}

/* ---------------- Spending form constants ---------------- */

// These forms always persist to Firestore (triggers inbox tasks + ledger flow)
export const JOTFORM_SPENDING_FORM_IDS = new Set(["251878265158166", "252674777246167"]);

/* ---------------- Live API proxy (no Firestore write) ---------------- */

export async function fetchJotformApiSubmissionsList(
  formId: string,
  params?: { limit?: number; offset?: number; status?: string; since?: string }
) {
  const limit = Math.max(1, Math.min(200, Number(params?.limit) || 50));
  const offset = Math.max(0, Number(params?.offset) || 0);
  const sinceIso = params?.since ? toUtcIso(params.since as any) : undefined;

  const content = await jotformFetch<JotformSubmissionApi[]>(`/form/${formId}/submissions`, {
    limit,
    offset,
    ...(sinceIso ? { date: sinceIso } : {}),
    ...(params?.status ? { filter: JSON.stringify({ status: params.status }) } : {}),
  });

  const raw = Array.isArray(content) ? content : [];
  const items = raw.map((s) => mapJotformApiSubmission(s, formId, false));
  return { items, hasMore: raw.length >= limit };
}

export async function fetchJotformApiSubmissionGet(id: string) {
  const content = await jotformFetch<JotformSubmissionApi>(`/submission/${id}`);
  if (!content || !content.id) return null;
  const formId = String(content.form_id || content.formId || "");
  return mapJotformApiSubmission(content, formId, false);
}

/* ---------------- Sync from Jotform API ---------------- */

type JotformSubmissionApi = Record<string, any>;

function mapJotformApiSubmission(sub: JotformSubmissionApi, formId: string, includeRaw: boolean): TJotformSubmission {
  const created = toUtcIso(sub.created_at ?? sub.createdAt ?? sub.created); // Jotform usually returns created_at
  const updated = toUtcIso(sub.updated_at ?? sub.updatedAt ?? sub.updated);
  const formTitle = sub.form_title || sub.formTitle || null;
  const formAlias = normalizeAlias(formTitle || formId || sub.form_id || sub.formId || "form");

  return {
    id: sub.id || sub.submission_id || sub.submissionId,
    submissionId: sub.id || sub.submission_id || sub.submissionId,
    formId: formId || sub.form_id || sub.formId,
    formTitle,
    formAlias,
    status: (sub.status || "active").toLowerCase(),
    statusRaw: sub.status || null,
    source: "sync",
    ip: sub.ip || null,
    answers: sub.answers || null,
    raw: includeRaw ? sub : null,
    createdAt: created || null,
    updatedAt: updated || null,
    submissionUrl: sub.url || sub.submission_url || null,
    editUrl: sub.edit_url || sub.editUrl || null,
    pdfUrl: sub.pdf || sub.pdf_url || null,
  } as TJotformSubmission;
}

export async function syncJotformSubmissions(body: unknown, caller: Claims, targetOrg: string) {
  assertTargetOrgAllowed(caller, targetOrg);

  const { formId, since, limit = 50, maxPages = 1, startOffset, includeRaw } = body as any;

  const pageLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
  const pageMax = Math.max(1, Math.min(25, Number(maxPages) || 1));

  const sinceIso = toUtcIso(since as any);

  let offset = Math.max(0, Number(startOffset) || 0);
  let page = 0;
  const ids: string[] = [];
  let hasMore = false;

  // Load credit cards once for CC form so we can resolve creditCardId at write time
  let orgCreditCards: Array<Record<string, unknown>> = [];
  if (String(formId) === CC_FORM_ID) {
    const snap = await db.collection("creditCards").where("orgId", "==", normId(targetOrg)).get();
    orgCreditCards = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  while (page < pageMax) {
    let content: JotformSubmissionApi[];
    try {
      content = await jotformFetch<JotformSubmissionApi[]>(`/form/${formId}/submissions`, {
        limit: pageLimit,
        offset,
        ...(sinceIso ? { date: sinceIso } : {}),
      });
    } catch (error) {
      throw syncError("jotform", error, { formId: String(formId), offset, page });
    }

    const submissions = Array.isArray(content) ? content : [];
    if (!submissions.length) break;

    const mapped = submissions.map((s) => mapJotformApiSubmission(s, String(formId), !!includeRaw));

    // Only persist to Firestore for spending forms — all others are served live from the API
    if (JOTFORM_SPENDING_FORM_IDS.has(String(formId))) {
      const normalized = mapped.map((s) => normalizeOne(s, caller, targetOrg));
      const writer = newBulkWriter(2);
      try {
        for (const sub of normalized) {
          const ref = db.collection("jotformSubmissions").doc(sub.id);
          writer.set(ref, sub, { merge: true });
          ids.push(sub.id);
        }
        await writer.close();
      } catch (error) {
        throw syncError("write", error, { formId: String(formId), persisted: normalized.length });
      }

      // Keep the spending tool deterministic: do not wait for the Firestore
      // trigger to backfill paymentQueue after this HTTP request returns.
      if (isSpendingFormId(formId)) {
        try {
          const queueItems = normalized.flatMap((sub) =>
            extractSpendItems(sub as any).map((extracted: ExtractedSpendItem) => {
              if (extracted.source === "credit-card" && extracted.card && orgCreditCards.length) {
                extracted.creditCardId = resolveCreditCardId(extracted.card, orgCreditCards) || null;
              }
              return { extracted, orgId: normId(targetOrg) };
            })
          );
          await upsertPaymentQueueItems(queueItems);

          // Write budget totals back to creditCards docs so the budget page
          // doesn't need to do expensive queue/ledger fan-outs per load.
          try {
            const touchedCardIds = [
              ...new Set(
                queueItems
                  .map(({ extracted }) => String(extracted.creditCardId || ""))
                  .filter(Boolean)
              ),
            ];
            await refreshCreditCardBudgets(normId(targetOrg), {
              cardIds: touchedCardIds.length ? touchedCardIds : undefined,
              updatedBy: "jotformSync",
            });
          } catch { /* budget refresh is best-effort; don't fail the sync */ }
        } catch (error) {
          throw syncError("write", error, { formId: String(formId), stage: "paymentQueue", persisted: normalized.length });
        }
      }
    } else {
      // For non-spending forms, just return the IDs without persisting
      mapped.forEach((s) => { if (s.id) ids.push(s.id); });
    }

    offset += submissions.length;
    page += 1;

    if (submissions.length < pageLimit) break;

    // If we've hit pageMax but got a full page, there may be more
    if (page >= pageMax) {
      hasMore = true;
    }
  }

  return { ids, count: ids.length, nextOffset: offset, hasMore };
}
