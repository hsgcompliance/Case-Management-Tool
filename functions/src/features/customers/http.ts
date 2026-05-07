// functions/src/features/customers/http.ts
import {
  secureHandler,
  db,
  FieldPath,
  Timestamp,
  requireOrgId,
  canAccessDoc,
  type AuthedRequest,
  toDate,
} from "../../core";

import {
  CustomerUpsertBody,
  CustomerPatchBody,
  CustomersDeleteBody,
  CustomersAdminDeleteBody,
  CustomersGetQuery,
  CustomersListQuery,
  toArray,
} from "./schemas";
import type { CustomerInput } from "./schemas";

import {
  upsertCustomers,
  patchCustomers,
  softDeleteCustomers,
  hardDeleteCustomers,
  backfillCustomerNames,
  backfillCaseManagerNames,
} from "./service";
import { backfillCustomerAssistanceLength } from "./assistanceLength";

type FsTimestamp = FirebaseFirestore.Timestamp;

const parseCursorTs = (v: unknown): FsTimestamp => {
  if (typeof v === "string" || typeof v === "number") {
    // Handle numeric strings as epoch millis
    const num = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
    const d = toDate(num as string | number | Date);
    if (d) return Timestamp.fromDate(d) as unknown as FsTimestamp;
    const err = new Error("invalid_cursor_timestamp") as Error & { code?: number };
    err.code = 400;
    throw err;
  }
  if (!v || typeof v !== "object") {
    const err = new Error("invalid_cursor_timestamp") as Error & { code?: number };
    err.code = 400;
    throw err;
  }
  const ts =
    (v as
      | {
          seconds?: unknown;
          _seconds?: unknown;
          nanoseconds?: unknown;
          _nanoseconds?: unknown;
        }
      | null
      | undefined) ?? {};
  const hasSeconds = ts.seconds !== undefined || ts._seconds !== undefined;
  const sec = Number(ts.seconds ?? ts._seconds);
  const ns = Number(ts.nanoseconds ?? ts._nanoseconds ?? 0);

  if (hasSeconds && Number.isFinite(sec) && Number.isFinite(ns)) {
    return new Timestamp(Math.trunc(sec), Math.trunc(ns)) as unknown as FsTimestamp;
  }

  const err = new Error("invalid_cursor_timestamp") as Error & { code?: number };
  err.code = 400;
  throw err;
};

const normalizeIdsFromDeleteBody = (parsed: unknown): string[] => {
  if (typeof parsed === "string") return [parsed];
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as { id?: unknown; ids?: unknown };
    if (typeof obj.id === "string") return [obj.id];
    if (Array.isArray(obj.ids)) return obj.ids.map(String);
  }
  return [];
};

/** POST /customersUpsert — merge semantics; single or array */
export const customersUpsert = secureHandler(
  async (req: AuthedRequest, res) => {
    const body = CustomerUpsertBody.parse(req.body);
    const out = await upsertCustomers(body, req.user!);
    res.status(201).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] },
);

/** PATCH /customersPatch — partial update; single or array */
export const customersPatch = secureHandler(
  async (req: AuthedRequest, res) => {
    const body = CustomerPatchBody.parse(req.body);
    const out = await patchCustomers(
      body as unknown as
        | {
            id: string;
            patch: Partial<CustomerInput>;
            unset?: string[];
            coerceNulls?: boolean;
          }
        | Array<{
            id: string;
            patch: Partial<CustomerInput>;
            unset?: string[];
            coerceNulls?: boolean;
          }>,
      req.user!,
    );
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["PATCH", "OPTIONS"] },
);

/** POST /customersDelete — soft delete */
export const customersDelete = secureHandler(
  async (req: AuthedRequest, res) => {
    // contracts should accept: string | string[] | { id?, ids?, cascade? } (your call)
    const parsed = CustomersDeleteBody.parse(req.body);

    const ids = normalizeIdsFromDeleteBody(parsed);
    if (!ids.length) {
      res.status(400).json({ ok: false, error: "missing_id_or_ids" });
      return;
    }

    // If cascade is part of the contract, use it. Otherwise keep legacy query support.
    const parsedCascade =
      typeof parsed === "object" &&
      parsed &&
      "cascade" in parsed &&
      typeof (parsed as { cascade?: unknown }).cascade === "boolean"
        ? (parsed as { cascade?: boolean }).cascade
        : undefined;
    const cascade =
      parsedCascade ??
      String((req.query?.cascade ?? "true") as string)
        .toLowerCase()
        .trim() !== "false";

    const out = await softDeleteCustomers(ids, req.user!, {
      cascadeEnrollments: cascade,
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] },
);

/** POST /customersAdminDelete — hard delete (admin only) */
export const customersAdminDelete = secureHandler(
  async (req: AuthedRequest, res) => {
    const parsed = CustomersAdminDeleteBody.parse(req.body);
    const ids = normalizeIdsFromDeleteBody(parsed);

    if (!ids.length) {
      res.status(400).json({ ok: false, error: "missing_id_or_ids" });
      return;
    }

    const out = await hardDeleteCustomers(ids, req.user!);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** GET /customersGet */
export const customerGet = secureHandler(
  async (req: AuthedRequest, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const { id } = CustomersGetQuery.parse(src);

    const snap = await db.collection("customers").doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    const data = snap.data() || {};
    if (!canAccessDoc(req.user!, data)) {
      res.status(403).json({ ok: false, error: "forbidden" });
      return;
    }

    res.status(200).json({ ok: true, customer: { id: snap.id, ...data } });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] },
);

// Canonical endpoint name; keep legacy alias above for backward compatibility.
export const customersGet = customerGet;

/** GET /customersList */
export const customersList = secureHandler(
  async (req: AuthedRequest, res) => {
    const src = (req.method === "GET" ? req.query : req.body) || {};
    const qIn = CustomersListQuery.parse(src);

    const lim = Math.max(1, Math.min(500, Number(qIn.limit ?? 200)));

    // Keep this normalization here for now; next pass should move it into contracts preprocess.
    const normActive = String(qIn.active ?? "all")
      .trim()
      .toLowerCase();
    const activeFilter: true | false | "all" =
      normActive === "all" ||
      normActive === "" ||
      normActive === "undefined" ||
      normActive === "null"
        ? "all"
        : ["true", "1", "yes", "y", "active"].includes(normActive)
          ? true
          : ["false", "0", "no", "n", "inactive"].includes(normActive)
            ? false
            : "all";

    const normDel = String(qIn.deleted ?? "exclude")
      .trim()
      .toLowerCase();
    const deletedFilter: "exclude" | "only" | "include" = [
      "exclude",
      "only",
      "include",
    ].includes(normDel)
      ? (normDel as "exclude" | "only" | "include")
      : "exclude";

    const orgId = requireOrgId(req);

    let q: FirebaseFirestore.Query = db
      .collection("customers")
      .where("orgId", "==", orgId);

    if (deletedFilter === "only") q = q.where("deleted", "==", true);
    else if (deletedFilter === "exclude") q = q.where("deleted", "==", false);

    if (activeFilter !== "all") q = q.where("active", "==", activeFilter);

    const caseManagerId = String(qIn.caseManagerId || "").trim();
    if (caseManagerId) q = q.where("caseManagerId", "==", caseManagerId);

    const contactCaseManagerId = String((qIn as any).contactCaseManagerId || "").trim();
    if (contactCaseManagerId) {
      q = q.where("contactCaseManagerIds", "array-contains", contactCaseManagerId);
    }

    q = q
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(lim);

    if (qIn.cursorUpdatedAt && qIn.cursorId) {
      const ts = parseCursorTs(qIn.cursorUpdatedAt);
      q = q.startAfter(ts, String(qIn.cursorId));
    }

    const snap = await q.get();
    const docs = snap.docs;
    const items = docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    const last = docs.length ? docs[docs.length - 1] : null;
    const lastUpdated =
      (last?.get("updatedAt") as
        | FirebaseFirestore.Timestamp
        | undefined
        | null) ?? null;

    const next = last
      ? {
          cursorUpdatedAt: lastUpdated ?? Timestamp.fromMillis(0),
          cursorId: last.id,
        }
      : null;

    res.status(200).json({
      ok: true,
      items,
      next,
      filter: { active: activeFilter, deleted: deletedFilter },
      note: "list is org-scoped for now; cross-org teams will be merged in later",
    });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] },
);

/** POST /customersBackfillNames — temporary admin/dev utility to split names */
export const customersBackfillNames = secureHandler(
  async (req: AuthedRequest, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
      limit?: unknown;
      allOrgs?: unknown;
      dryRun?: unknown;
    };
    const out = await backfillCustomerNames(req.user!, {
      limit: Number(body.limit ?? 1000),
      allOrgs: body.allOrgs === true || String(body.allOrgs || "").toLowerCase() === "true",
      dryRun: body.dryRun === undefined ? false : (body.dryRun === true || String(body.dryRun || "").toLowerCase() === "true"),
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** POST /customersBackfillCaseManagerNames — temporary admin/dev utility */
export const customersBackfillCaseManagerNames = secureHandler(
  async (req: AuthedRequest, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
      limit?: unknown;
      allOrgs?: unknown;
      dryRun?: unknown;
    };
    const out = await backfillCaseManagerNames(req.user!, {
      limit: Number(body.limit ?? 1000),
      allOrgs: body.allOrgs === true || String(body.allOrgs || "").toLowerCase() === "true",
      dryRun: body.dryRun === undefined ? false : (body.dryRun === true || String(body.dryRun || "").toLowerCase() === "true"),
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);

/** POST /customersBackfillAssistanceLength — temporary admin/dev utility */
export const customersBackfillAssistanceLength = secureHandler(
  async (req: AuthedRequest, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
      limit?: unknown;
      allOrgs?: unknown;
      dryRun?: unknown;
    };
    const out = await backfillCustomerAssistanceLength(req.user!, {
      limit: Number(body.limit ?? 1000),
      allOrgs: body.allOrgs === true || String(body.allOrgs || "").toLowerCase() === "true",
      dryRun: body.dryRun === undefined ? false : (body.dryRun === true || String(body.dryRun || "").toLowerCase() === "true"),
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] },
);
