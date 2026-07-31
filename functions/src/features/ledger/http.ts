// functions/src/features/ledger/http.ts
import { secureHandler, orgIdFromClaims, db, FieldValue, Timestamp } from "../../core";
import {
  LedgerListBody,
  LedgerCreateBody,
  LedgerClassifyBody,
  LedgerAutoAssignBody,
  LedgerBulkAdjustBody,
  LedgerGetByIdParams,
  LedgerBalanceQuery,
  type TLedgerEntry,
} from "./schemas";
import {
  listLedgerEntries,
  writeLedgerEntry,
  classifyLedgerEntries,
  autoAssignLedgerEntries,
  bulkAdjustLedgerEntries,
  getLedgerEntryById,
  fetchEntriesForBalance,
  computeLedgerBalances,
} from "./service";
import { recomputeGrantBudgetFromLedger } from "../grants/budgetRecompute";
import { recomputeCustomerSpendForGrant } from "../grants/lineItemCaps";

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
  { auth: "viewer", requireOrg: true, methods: ["GET", "POST", "OPTIONS"] }
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

    const paymentQueueId = String(body.paymentQueueId || "").trim();
    const grantId = String(body.grantId || "").trim();
    const lineItemId = String(body.lineItemId || "").trim();
    if (grantId) {
      const grantSnap = await db.collection("grants").doc(grantId).get();
      const grant = grantSnap.exists ? grantSnap.data() || {} : null;
      if (!grant || String((grant as any).orgId || "").trim() !== callerOrg) {
        res.status(404).json({ ok: false, error: "grant_not_found" });
        return;
      }
      const lineItems = Array.isArray((grant as any)?.budget?.lineItems)
        ? (grant as any).budget.lineItems
        : [];
      const lineItem = lineItems.find((item: any) => String(item?.id || "") === lineItemId);
      if (!lineItem) {
        res.status(400).json({ ok: false, error: "line_item_not_found" });
        return;
      }
      if (lineItem.locked) {
        res.status(400).json({ ok: false, error: "line_item_locked" });
        return;
      }
    }

    const reservedQueueLedgerId = String(body.id || "").startsWith("pqledger_");
    if (
      (paymentQueueId && body.id !== `pqledger_${paymentQueueId}`) ||
      (reservedQueueLedgerId && !paymentQueueId)
    ) {
      res.status(400).json({ ok: false, error: "invalid_queue_ledger_identity" });
      return;
    }

    if (paymentQueueId) {
      const queueSnap = await db.collection("paymentQueue").doc(paymentQueueId).get();
      if (!queueSnap.exists) {
        res.status(404).json({ ok: false, error: "payment_queue_item_not_found" });
        return;
      }
      const queueOrgId = String((queueSnap.data() as any)?.orgId || "").trim();
      if (queueOrgId && queueOrgId !== callerOrg) {
        res.status(404).json({ ok: false, error: "payment_queue_item_not_found" });
        return;
      }
    }

    // A queue-linked manual create is retry-safe: if the deterministic ledger
    // document already exists for this queue item, return it for the caller to
    // finish/repair the queue post instead of creating a duplicate.
    if (body.id) {
      const existing = await db.collection("ledger").doc(body.id).get();
      if (existing.exists) {
        const existingEntry = { id: existing.id, ...(existing.data() || {}) } as any;
        if (
          paymentQueueId &&
          String(existingEntry?.origin?.paymentQueueId || "") === paymentQueueId &&
          String(existingEntry?.orgId || "") === callerOrg
        ) {
          res.status(200).json({ ok: true, entry: existingEntry });
          return;
        }
        res.status(409).json({ ok: false, error: "entry_already_exists" });
        return;
      }
    }

    const { paymentQueueId: _paymentQueueId, ...ledgerBody } = body;
    const entryData = {
      ...ledgerBody,
      orgId: callerOrg,

      // optional audit (matches contracts)
      byUid: caller?.uid || null,
      byEmail: caller?.email ? String(caller.email).toLowerCase() : null,
      byName: caller?.name || caller?.displayName || null,

      origin: {
        app: "hdb",
        ...(paymentQueueId
          ? {
              baseId: paymentQueueId,
              paymentQueueId,
              sourcePath: `paymentQueue/${paymentQueueId}`,
            }
          : {}),
      },

      // Use real timestamps (TsLike-friendly). Avoid FieldValue sentinels here.
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const entry = await db.runTransaction(async (trx) => {
      return writeLedgerEntry(trx, entryData);
    });

    let budgetRecomputed = false;
    const warnings: string[] = [];
    const affectedGrantId = String((entry as any)?.grantId || "").trim();
    if (affectedGrantId) {
      try {
        const recompute = await recomputeGrantBudgetFromLedger(affectedGrantId);
        await recomputeCustomerSpendForGrant({ grantId: affectedGrantId }).catch(() => null);
        budgetRecomputed = recompute.recomputed;
      } catch (err: any) {
        warnings.push(`budget_recompute_failed:${err?.message || String(err)}`);
      }
    }

    res.status(201).json({ ok: true, entry, budgetRecomputed, warnings });
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
   POST /ledgerBulkAdjust  (admin only)
   Directly edit existing ledger entries in place (no reversal + respend), then
   recompute each affected grant's budget once.
============================================================================ */

export const ledgerBulkAdjust = secureHandler(
  async (req, res): Promise<void> => {
    const body = LedgerBulkAdjustBody.parse(req.body || {});
    const caller = (req as any).user || {};
    const callerOrg = orgIdFromClaims(caller);
    if (!callerOrg) {
      res.status(400).json({ ok: false, error: "org_required" });
      return;
    }

    const result = await bulkAdjustLedgerEntries(callerOrg, body.items, {
      reason: body.reason ?? null,
      dryRun: body.dryRun,
      user: {
        uid: caller?.uid || null,
        email: caller?.email || null,
        name: caller?.name || caller?.displayName || null,
      },
    });

    // One budget + cap recompute per affected grant, after all ledger writes land.
    const grantsRecomputed: string[] = [];
    if (!result.dryRun) {
      for (const grantId of result.affectedGrantIds) {
        try {
          const r = await recomputeGrantBudgetFromLedger(grantId);
          await recomputeCustomerSpendForGrant({ grantId }).catch(() => null);
          if (r.recomputed) grantsRecomputed.push(grantId);
        } catch {
          /* non-fatal per grant */
        }
      }
    }

    res.json({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      grantsRecomputed,
      dryRun: result.dryRun,
    });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"], memory: "512MiB", timeoutSeconds: 300, concurrency: 4 }
);

/* ============================================================================
   GET /ledgerGetById/:entryId
============================================================================ */

export const ledgerGetById = secureHandler(
  async (req, res): Promise<void> => {
    const { entryId } = LedgerGetByIdParams.parse({
      ...((req.query || {}) as Record<string, unknown>),
      ...((req.params || {}) as Record<string, unknown>),
    });
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
  { auth: "viewer", requireOrg: true, methods: ["GET", "OPTIONS"] }
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
  { auth: "viewer", requireOrg: true, methods: ["GET", "POST", "OPTIONS"] }
);

/* ============================================================================
   DELETE /ledgerDelete/:entryId  (admin only)
============================================================================ */

export const ledgerDelete = secureHandler(
  async (req, res): Promise<void> => {
    const { entryId } = LedgerGetByIdParams.parse({
      ...((req.body || {}) as Record<string, unknown>),
      ...((req.query || {}) as Record<string, unknown>),
      ...((req.params || {}) as Record<string, unknown>),
    });
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
