// functions/src/features/ledger/http.ts
import { secureHandler, orgIdFromClaims, db, FieldValue, Timestamp } from "../../core";
import {
  LedgerListBody,
  LedgerCreateBody,
  LedgerClassifyBody,
  LedgerAutoAssignBody,
  LedgerGetByIdParams,
  LedgerBalanceQuery,
  type TLedgerEntry,
} from "./schemas";
import {
  listLedgerEntries,
  writeLedgerEntry,
  classifyLedgerEntries,
  autoAssignLedgerEntries,
  getLedgerEntryById,
  fetchEntriesForBalance,
  computeLedgerBalances,
} from "./service";

/* ============================================================================
   GET|POST /ledgerList
============================================================================ */

export const ledgerList = secureHandler(
  async (req, res): Promise<void> => {
    const src = req.method === "GET" ? req.query : req.body;
    const body = LedgerListBody.parse(src || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    const orgId = body.orgId || callerOrg;
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }
    const out = await listLedgerEntries(orgId, body);

    res.json({
      ok: true,
      entries: out.entries,
      count: out.count,
      hasMore: out.hasMore,
    });
  },
  { auth: "user", requireOrg: true, methods: ["GET", "POST", "OPTIONS"] }
);

/* ============================================================================
   POST /ledgerCreate
============================================================================ */

export const ledgerCreate = secureHandler(
  async (req, res): Promise<void> => {
    const body = LedgerCreateBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    if (!callerOrg){
       res.status(400).json({ ok: false, error: "org_required" });
      return;
    }

    // Only check existence if caller provided an id.
    if (body.id) {
      const existing = await db.collection("ledger").doc(body.id).get();
      if (existing.exists) {
         res.status(409).json({ ok: false, error: "entry_already_exists" });
         return;
      }
    }

    const entryData = {
      ...body,
      orgId: callerOrg,

      // optional audit (matches contracts)
      byUid: caller?.uid || null,
      byEmail: caller?.email ? String(caller.email).toLowerCase() : null,
      byName: caller?.name || caller?.displayName || null,

      origin: {
        app: "hdb",
        // sourcePath filled by service if missing and origin exists
      },

      // Use real timestamps (TsLike-friendly). Avoid FieldValue sentinels here.
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const entry = await db.runTransaction(async (trx) => {
      return writeLedgerEntry(trx, entryData);
    });

    res.status(201).json({ ok: true, entry });
    return;
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

/* ============================================================================
   POST /ledgerClassify
============================================================================ */

export const ledgerClassify = secureHandler(
  async (req, res): Promise<void> => {
    const body = LedgerClassifyBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    if (!callerOrg) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }

    const out = await classifyLedgerEntries(callerOrg, body, {
      uid: caller?.uid || null,
      email: caller?.email || null,
      name: caller?.name || caller?.displayName || null,
    });

    res.json(out);
    return;
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

/* ============================================================================
   POST /ledgerAutoAssign
============================================================================ */

export const ledgerAutoAssign = secureHandler(
  async (req, res): Promise<void> => {
    const body = LedgerAutoAssignBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    if (!callerOrg) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }

    const out = await autoAssignLedgerEntries(callerOrg, body);
    res.json(out);
    return;
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

/* ============================================================================
   GET /ledgerGetById/:entryId
============================================================================ */

export const ledgerGetById = secureHandler(
  async (req, res): Promise<void> => {
    const { entryId } = LedgerGetByIdParams.parse(req.params || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    const entry = await getLedgerEntryById(entryId);
    if (!entry) {
      res.status(404).json({ ok: false, error: "entry_not_found" });
      return;
    }

    // Org isolation (404 to avoid leaking existence)
    if ((entry as any).orgId !== callerOrg) {
      res.status(404).json({ ok: false, error: "entry_not_found" });
      return;
    }

    res.json({ ok: true, entry });
    return;
  },
  { auth: "user", requireOrg: true, methods: ["GET", "OPTIONS"] }
);

/* ============================================================================
   GET|POST /ledgerBalance
============================================================================ */

export const ledgerBalance = secureHandler(
  async (req, res): Promise<void> => {
    const src = req.method === "GET" ? req.query : req.body;
    const body = LedgerBalanceQuery.parse(src || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    const orgId = body.orgId || callerOrg;
    if (!orgId) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }

    const entries = await fetchEntriesForBalance(orgId, body);
    const balances = computeLedgerBalances(entries as TLedgerEntry[], body.groupBy);

    res.json({ ok: true, balances, groupBy: body.groupBy });
    return;
  },
  { auth: "user", requireOrg: true, methods: ["GET", "POST", "OPTIONS"] }
);

/* ============================================================================
   DELETE /ledgerDelete/:entryId  (admin only)
============================================================================ */

export const ledgerDelete = secureHandler(
  async (req, res): Promise<void> => {
    const { entryId } = LedgerGetByIdParams.parse(req.params || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);

    const doc = await db.collection("ledger").doc(entryId).get();
    if (!doc.exists) {
      res.status(404).json({ ok: false, error: "entry_not_found" });
      return;
    }

    const entry = doc.data() as TLedgerEntry;

    // Org isolation (404 to avoid leaking existence)
    if ((entry as any).orgId !== callerOrg) {
      res.status(404).json({ ok: false, error: "entry_not_found" });
      return;
    }

    // Only allow deletion of manual/adjustment entries
    const src = String((entry as any).source || "");
    if (!["manual", "adjustment"].includes(src)) {
      res.status(400).json({ ok: false, error: "cannot_delete_system_entry" });
      return;
    }

    await doc.ref.delete();
    res.json({ ok: true, deleted: entryId });
    return;
  },
  { auth: "admin", requireOrg: true, methods: ["DELETE", "OPTIONS"] }
);
