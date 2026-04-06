'use client';

// web/src/client/enrollments.ts
import api from "./api";
import { idemKey } from "@lib/idem";
import type {
  ReqOf,
  RespOf,
  EnrollmentsUpsertReq,
  EnrollmentsPatchReq,
  EnrollmentsDeleteReq,
  EnrollmentsDeleteResp,
  EnrollmentsAdminDeleteReq,
  EnrollmentsAdminDeleteResp,
  EnrollmentsEnrollCustomerReq,
  EnrollmentsEnrollCustomerResp,
  EnrollmentsBulkEnrollReq,
  EnrollmentsBulkEnrollResp,
  EnrollmentsCheckOverlapsReq,
  EnrollmentsCheckOverlapsResp,
  EnrollmentsCheckDualReq,
  EnrollmentsCheckDualResp,
  EnrollmentsMigrateReq,
  EnrollmentsMigrateResp,
  EnrollmentsUndoMigrationReq,
  EnrollmentsUndoMigrationResp,
  EnrollmentsAdminReverseLedgerEntryReq,
  EnrollmentsAdminReverseLedgerEntryResp,
  EnrollmentsListQuery,
  TEnrollment,
  EnrollmentGetByIdQuery,
  EnrollmentGetByIdResp,
} from "@types";
// Intentional exception: runtime zod parser from contracts for request validation.
import { EnrollmentsMigrateBody } from "@hdb/contracts/enrollments";

export type Enrollment = TEnrollment & { id: string };

const STRIP_WRITE_KEYS = new Set(["createdAt", "updatedAt", "deleted", "orgId"]);

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((x) => stripUndefinedDeep(x)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

function sanitizeEnrollmentForWrite(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const k of STRIP_WRITE_KEYS) delete out[k];
  return stripUndefinedDeep(out);
}

function sanitizeEnrollmentsUpsertBody(rows: EnrollmentsUpsertReq): EnrollmentsUpsertReq {
  if (Array.isArray(rows)) return rows.map((r) => sanitizeEnrollmentForWrite(r)) as EnrollmentsUpsertReq;
  return sanitizeEnrollmentForWrite(rows) as EnrollmentsUpsertReq;
}

function sanitizeEnrollmentsPatchBody(rows: EnrollmentsPatchReq): EnrollmentsPatchReq {
  const sanitizeRow = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const src = row as Record<string, unknown>;
    return stripUndefinedDeep({
      ...src,
      patch: sanitizeEnrollmentForWrite(src.patch),
    });
  };
  if (Array.isArray(rows)) return rows.map((r) => sanitizeRow(r)) as EnrollmentsPatchReq;
  return sanitizeRow(rows) as EnrollmentsPatchReq;
}

function normalizeList(res: unknown): Enrollment[] {
  if (Array.isArray(res)) return res as Enrollment[];

  if (res && typeof res === "object") {
    const asObj = res as Record<string, unknown>;
    // Ok<{ items: ... }> style (Ok type usually flattens fields at top-level)
    if (Array.isArray(asObj.items)) return asObj.items as Enrollment[];
    if (Array.isArray(asObj.enrollments)) return asObj.enrollments as Enrollment[];
    if (Array.isArray(asObj.rows)) return asObj.rows as Enrollment[];
    if (Array.isArray(asObj.data)) return asObj.data as Enrollment[];
  }

  return [];
}

export const Enrollments = {
  upsert: (rows: EnrollmentsUpsertReq) => {
    const body = sanitizeEnrollmentsUpsertBody(rows);
    return api.callIdem(
      "enrollmentsUpsert",
      body,
      idemKey({ scope: "enrollments", op: "upsert", rows: body })
    );
  },

  patch: (rows: EnrollmentsPatchReq) => {
    const body = sanitizeEnrollmentsPatchBody(rows);
    return api.callIdem(
      "enrollmentsPatch",
      body,
      idemKey({ scope: "enrollments", op: "patch", rows: body })
    );
  },

  list: async (query?: EnrollmentsListQuery): Promise<Enrollment[]> => {
    const maxPerPage = 500;
    const requestedLimitRaw =
      query && "limit" in query ? Number((query as any).limit) : NaN;
    const needsPagination = Number.isFinite(requestedLimitRaw) && requestedLimitRaw > maxPerPage;

    const firstReq = needsPagination
      ? ({ ...(query || {}), limit: maxPerPage } as EnrollmentsListQuery)
      : query;

    const first = await api.get("enrollmentsList", firstReq);
    if (!needsPagination) return normalizeList(first);

    const target = Math.max(1, requestedLimitRaw);
    const out: Enrollment[] = normalizeList(first);
    let next =
      first && typeof first === "object"
        ? ((first as { next?: string | null }).next ?? null)
        : null;

    while (out.length < target && next) {
      const remaining = target - out.length;
      const page = await api.get("enrollmentsList", {
        ...(query || {}),
        limit: Math.min(maxPerPage, remaining),
        startAfter: next,
        cursorUpdatedAt: undefined,
        cursorId: undefined,
      } as any);
      const items = normalizeList(page);
      if (!items.length) break;
      out.push(...items);
      next =
        page && typeof page === "object"
          ? ((page as { next?: string | null }).next ?? null)
          : null;
    }

    return out.slice(0, target);
  },

  listAll: async (
    query?: Omit<EnrollmentsListQuery, "limit" | "startAfter" | "cursorUpdatedAt" | "cursorId">,
    opts?: { maxPages?: number; maxItems?: number }
  ): Promise<Enrollment[]> => {
    const maxPerPage = 500;
    const maxPages = Math.max(1, Number(opts?.maxPages ?? 200));
    const maxItems = Math.max(maxPerPage, Number(opts?.maxItems ?? 50_000));

    const out: Enrollment[] = [];
    let cursorUpdatedAt: unknown = undefined;
    let cursorId: string | undefined = undefined;
    let startAfter: string | undefined = undefined;

    for (let i = 0; i < maxPages; i++) {
      const page: unknown = await api.get("enrollmentsList", {
        ...(query || {}),
        limit: maxPerPage,
        startAfter,
        cursorUpdatedAt: cursorUpdatedAt as any,
        cursorId,
      } as any);

      const items = normalizeList(page);
      if (!items.length) break;
      out.push(...items);
      if (out.length >= maxItems) break;

      const next =
        page && typeof page === "object"
          ? ((page as { next?: { cursorUpdatedAt?: unknown; cursorId?: string } | string | null }).next ?? null)
          : null;

      if (next && typeof next === "object" && (next as any).cursorId) {
        cursorUpdatedAt = (next as any).cursorUpdatedAt;
        cursorId = String((next as any).cursorId);
        startAfter = undefined;
        continue;
      }

      if (typeof next === "string" && next.trim()) {
        // Legacy fallback shape: next is doc id only.
        cursorUpdatedAt = undefined;
        cursorId = undefined;
        startAfter = next.trim();
        continue;
      }

      break;
    }

    return out.slice(0, maxItems);
  },

  getById: async (id: string): Promise<Enrollment | null> => {
    const query: EnrollmentGetByIdQuery = { id };
    const res = (await api.get("enrollmentGetById", query)) as EnrollmentGetByIdResp;
    const asObj = res as Record<string, unknown>;

    // Canonical backend shape: { ok:true, enrollment:{...} }
    if (asObj.ok === true && asObj.enrollment && typeof asObj.enrollment === "object") {
      return asObj.enrollment as Enrollment;
    }

    // Legacy fallbacks (if any)
    if (asObj.enrollment && typeof asObj.enrollment === "object") {
      return asObj.enrollment as Enrollment;
    }
    if (typeof asObj.id === "string") return res as unknown as Enrollment;

    return null;
  },

  delete: (idOrIds: string | string[]): Promise<EnrollmentsDeleteResp> => {
    const body: EnrollmentsDeleteReq = Array.isArray(idOrIds) ? { ids: idOrIds } : { id: idOrIds };
    return api.callIdem(
      "enrollmentsDelete",
      body,
      idemKey({ scope: "enrollments", op: "delete", body })
    );
  },

  adminDelete: (idOrIds: string | string[]): Promise<EnrollmentsAdminDeleteResp> => {
    const base = Array.isArray(idOrIds) ? { ids: idOrIds } : { id: idOrIds };
    const body: EnrollmentsAdminDeleteReq = { ...base, mode: "hard", purgeSpends: true } as any;
    return api.callIdem(
      "enrollmentsAdminDelete",
      body,
      idemKey({ scope: "enrollments", op: "adminDelete", body })
    );
  },

  enrollCustomer: (body: EnrollmentsEnrollCustomerReq): Promise<EnrollmentsEnrollCustomerResp> =>
    api.callIdem(
      "enrollmentsEnrollCustomer",
      body,
      idemKey({ scope: "enrollments", op: "enrollCustomer", body })
    ),

  bulkEnroll: (body: EnrollmentsBulkEnrollReq): Promise<EnrollmentsBulkEnrollResp> =>
    api.callIdem(
      "enrollmentsBulkEnroll",
      body,
      idemKey({ scope: "enrollments", op: "bulkEnroll", body })
    ),

  checkOverlaps: (body: EnrollmentsCheckOverlapsReq): Promise<EnrollmentsCheckOverlapsResp> =>
    api.post("enrollmentsCheckOverlaps", body),
  checkDual: (body: EnrollmentsCheckDualReq): Promise<EnrollmentsCheckDualResp> =>
    api.post("enrollmentsCheckDual", body),

  backfillNames: (body: ReqOf<"enrollmentsBackfillNames">) =>
    api.callIdem(
      "enrollmentsBackfillNames",
      body,
      idemKey({ scope: "enrollments", op: "backfillNames", body })
    ) as Promise<RespOf<"enrollmentsBackfillNames">>,

  backfillPopulation: (body?: Record<string, unknown>) =>
    api.call("enrollmentsBackfillPopulation", {
      body: body || {},
      idempotencyKey: idemKey({ scope: "enrollments", op: "backfillPopulation", body: body || {} }),
    }) as Promise<{ ok: true } | { ok: false; error: string }>,

  migrate: (body: EnrollmentsMigrateReq): Promise<EnrollmentsMigrateResp> =>
    api.callIdem(
      "enrollmentsMigrate",
      EnrollmentsMigrateBody.parse(body),
      idemKey({ scope: "enrollments", op: "migrate", body })
    ),

  undoMigration: (body: EnrollmentsUndoMigrationReq): Promise<EnrollmentsUndoMigrationResp> =>
    api.callIdem(
      "enrollmentsUndoMigration",
      body,
      idemKey({ scope: "enrollments", op: "undoMigration", body })
    ),

  adminReverseLedgerEntry: (
    body: EnrollmentsAdminReverseLedgerEntryReq
  ): Promise<EnrollmentsAdminReverseLedgerEntryResp> =>
    api.callIdem(
      "enrollmentsAdminReverseLedgerEntry",
      body,
      idemKey({ scope: "enrollments", op: "adminReverseLedgerEntry", body })
    ),
};

export default Enrollments;
