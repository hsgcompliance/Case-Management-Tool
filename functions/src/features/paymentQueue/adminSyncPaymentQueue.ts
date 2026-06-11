// functions/src/features/paymentQueue/adminSyncPaymentQueue.ts
//
// Admin-only: backfill the paymentQueue collection from existing data.
// Useful when the emulator is loaded from a data import (triggers don't fire
// on import, so paymentQueue is empty even when enrollments and jotformSubmissions exist).
//
// POST body:
//   { orgId?: string, dryRun?: boolean, pageSize?: number, reallocate?: boolean }
//
// Processes three phases:
//   1. customerEnrollments  → projection queue items (unpaid payments)
//   2. jotformSubmissions   → CC / invoice queue items (known spending forms);
//      re-extraction repopulates transactionFields on stale rows.
//   3. reallocate (default true) → re-run active pipelines over existing
//      pending+unassigned items, classifying them onto grant + line item.
//      The auto-allocator trigger is create-only, so a re-extraction (update)
//      does not re-fire it for the existing backlog.

import type { Request, Response } from "express";
import { db, hasLevel, orgIdFromClaims, isoNow } from "../../core";
import { syncEnrollmentProjectionQueueItems, upsertPaymentQueueItems } from "./service";
import { inferTransactionWindowModel, type TransactionWindowModel } from "@hdb/contracts";
import { getJotformFormQuestions } from "../jotform/service";
import { isSpendingFormId, extractSpendItems } from "./extractor";
import { matchesPipeline } from "../budgetPipeline/service";
import type { TBudgetPipeline } from "../budgetPipeline/schemas";

const PAGE = 200;
const FN = "adminSyncPaymentQueue";

type SyncResults = {
  enrollmentsScanned: number;
  enrollmentsWithPayments: number;
  projectionsWritten: number;
  jotformScanned: number;
  jotformProcessed: number;
  jotformItemsWritten: number;
  reallocScanned: number;
  reallocMatched: number;
  reallocPipelinesActive: number;
  errors: string[];
};

/**
 * Re-run active pipelines over existing pending + unassigned queue items.
 *
 * The live auto-allocator (`onPaymentQueueItemCreate`) fires only on document
 * CREATE. A re-extraction backfill writes existing docs via set/merge=false,
 * which is an UPDATE, so allocation never re-fires for the existing backlog.
 * This mirrors the trigger's logic (oldest active pipeline wins) so that rows
 * whose `transactionFields` were just repopulated actually get classified onto
 * their grant + line item.
 *
 * Honors dryRun: counts matches without writing.
 */
async function reallocatePendingItems(
  orgId: string,
  dryRun: boolean,
  pageSize: number,
  results: SyncResults,
): Promise<void> {
  const pSnap = await db
    .collection("budgetPipelines")
    .where("orgId", "==", orgId)
    .where("status", "==", "active")
    .orderBy("createdAt", "asc")
    .get();

  results.reallocPipelinesActive = pSnap.size;
  if (pSnap.empty) return;

  const pipelines: TBudgetPipeline[] = pSnap.docs.map(
    (d) => ({ ...(d.data() as TBudgetPipeline), id: d.id }),
  );

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let done = false;

  while (!done) {
    // Equality-only filters (no orderBy) need no composite index; paginate by
    // implicit __name__ order via startAfter(snapshot).
    let q: FirebaseFirestore.Query = db
      .collection("paymentQueue")
      .where("orgId", "==", orgId)
      .where("queueStatus", "==", "pending")
      .where("grantId", "==", null)
      .limit(pageSize);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;
    cursor = snap.docs[snap.docs.length - 1];
    done = snap.docs.length < pageSize;

    for (const doc of snap.docs) {
      results.reallocScanned++;
      const item = { ...(doc.data() as Record<string, unknown>), id: doc.id };

      for (const pipeline of pipelines) {
        if (!matchesPipeline(item, pipeline)) continue;

        const patch: Record<string, unknown> = {};
        if (pipeline.grantId) patch.grantId = pipeline.grantId;
        if (pipeline.lineItemId) patch.lineItemId = pipeline.lineItemId;
        if (!patch.grantId && !patch.lineItemId) break; // matched but nothing to set
        patch.pipelineId = pipeline.id;

        results.reallocMatched++;
        if (!dryRun) {
          const now = isoNow();
          patch.updatedAtISO = now;
          patch["system.lastWriter"] = `${FN}:reallocate:pipeline:${pipeline.id}`;
          patch["system.lastWriteAt"] = now;
          try {
            await doc.ref.update(patch);
          } catch (e: unknown) {
            results.errors.push(`realloc:${doc.id}: ${String((e as any)?.message || e)}`);
          }
        }
        break; // first match wins
      }
    }
  }
}

export async function adminSyncPaymentQueueHandler(
  req: Request,
  res: Response
): Promise<void> {
  const caller = (req as any).user || {};
  // Level-based: admin OR higher (dev/org_dev/super_dev). rolesFromClaims must
  // not be used for authz — it returns [topRole, ...tags], so a dev lacks "admin".
  if (!hasLevel(caller, "admin")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const callerOrg = orgIdFromClaims(caller);
  const orgId = String(body.orgId || callerOrg || "").trim();
  const dryRun = body.dryRun === true;
  // Re-run active pipelines over the existing pending backlog after re-extraction.
  // Defaults on; pass reallocate:false to skip (extraction-only backfill).
  const reallocate = body.reallocate !== false;
  const pageSize = Math.max(1, Math.min(500, Number(body.pageSize ?? PAGE)));

  if (!orgId) {
    res.status(400).json({ ok: false, error: "org_required" });
    return;
  }

  const results: SyncResults = {
    enrollmentsScanned: 0,
    enrollmentsWithPayments: 0,
    projectionsWritten: 0,
    jotformScanned: 0,
    jotformProcessed: 0,
    jotformItemsWritten: 0,
    reallocScanned: 0,
    reallocMatched: 0,
    reallocPipelinesActive: 0,
    errors: [],
  };

  // ── 1. Enrollments → projection queue items ──────────────────────────────

  let enrollCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let enrollDone = false;

  while (!enrollDone) {
    let q = db
      .collection("customerEnrollments")
      .where("orgId", "==", orgId)
      .orderBy("__name__")
      .limit(pageSize);

    if (enrollCursor) q = q.startAfter(enrollCursor);

    const snap = await q.get();
    if (snap.empty) break;
    enrollCursor = snap.docs[snap.docs.length - 1];
    enrollDone = snap.docs.length < pageSize;

    for (const doc of snap.docs) {
      results.enrollmentsScanned++;
      const data = doc.data() as Record<string, unknown>;

      const payments = Array.isArray(data.payments)
        ? (data.payments as Array<Record<string, unknown>>)
        : [];

      const unpaid = payments.filter(
        (p) => p.paid !== true && p.void !== true && Number(p.amount || 0) > 0
      );
      if (unpaid.length === 0) continue;

      results.enrollmentsWithPayments++;
      if (dryRun) {
        results.projectionsWritten += unpaid.length;
        continue;
      }

      try {
        await syncEnrollmentProjectionQueueItems({
          orgId,
          enrollmentId: doc.id,
          grantId: String(data.grantId || "") || null,
          customerId: String(data.customerId || "") || null,
          customerName: String(data.customerName || "") || null,
          payments: payments as Array<Record<string, unknown>>,
        });
        results.projectionsWritten += unpaid.length;
      } catch (e: unknown) {
        results.errors.push(`enrollment:${doc.id}: ${String((e as any)?.message || e)}`);
      }
    }
  }

  // ── 2. JotForm submissions → CC / invoice queue items ──────────────────

  let jotCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let jotDone = false;
  const transactionModels = new Map<string, TransactionWindowModel>();

  while (!jotDone) {
    let q = db
      .collection("jotformSubmissions")
      .where("orgId", "==", orgId)
      .orderBy("__name__")
      .limit(pageSize);

    if (jotCursor) q = q.startAfter(jotCursor);

    const snap = await q.get();
    if (snap.empty) break;
    jotCursor = snap.docs[snap.docs.length - 1];
    jotDone = snap.docs.length < pageSize;

    for (const doc of snap.docs) {
      results.jotformScanned++;
      const sub = doc.data() as Record<string, unknown>;
      const formId = String(sub?.form_id || sub?.formId || "").trim();

      if (!isSpendingFormId(formId)) continue;

      const active =
        sub?.active !== false &&
        String(sub?.status || "active") !== "deleted";

      if (!active) continue;

      results.jotformProcessed++;
      let transactionModel = transactionModels.get(formId);
      if (!transactionModel) {
        const liveQuestions = await getJotformFormQuestions(formId);
        transactionModel = inferTransactionWindowModel(formId, liveQuestions.fields);
        transactionModels.set(formId, transactionModel);
      }
      const extracted = extractSpendItems(sub as any, transactionModel);
      if (extracted.length === 0) continue;

      if (dryRun) {
        results.jotformItemsWritten += extracted.length;
        continue;
      }

      try {
        await upsertPaymentQueueItems(
          extracted.map((e) => ({ extracted: e, orgId }))
        );
        results.jotformItemsWritten += extracted.length;
      } catch (e: unknown) {
        results.errors.push(`jotform:${doc.id}: ${String((e as any)?.message || e)}`);
      }
    }
  }

  // ── 3. Re-allocate existing pending + unassigned items via active pipelines ──
  // The auto-allocator trigger is create-only, so re-extraction (an update) does
  // not re-fire it. Run pipelines over the existing backlog here.
  if (reallocate) {
    try {
      await reallocatePendingItems(orgId, dryRun, pageSize, results);
    } catch (e: unknown) {
      results.errors.push(`reallocate: ${String((e as any)?.message || e)}`);
    }
  }

  res.json({
    ok: true,
    dryRun,
    reallocate,
    orgId,
    at: isoNow(),
    ...results,
  });
}
