// functions/src/features/paymentQueue/adminSyncPaymentQueue.ts
//
// Admin-only: backfill the paymentQueue collection from existing data.
// Useful when the emulator is loaded from a data import (triggers don't fire
// on import, so paymentQueue is empty even when enrollments and jotformSubmissions exist).
//
// POST body:
//   { orgId?: string, dryRun?: boolean, pageSize?: number }
//
// Processes two sources:
//   1. customerEnrollments  → projection queue items (unpaid payments)
//   2. jotformSubmissions   → CC / invoice queue items (known spending forms)

import type { Request, Response } from "express";
import { db, rolesFromClaims, orgIdFromClaims, isoNow } from "../../core";
import { syncEnrollmentProjectionQueueItems, upsertPaymentQueueItems } from "./service";
import { isSpendingFormId, extractSpendItems } from "./extractor";

const PAGE = 200;

export async function adminSyncPaymentQueueHandler(
  req: Request,
  res: Response
): Promise<void> {
  const caller = (req as any).user || {};
  const roles = rolesFromClaims(caller);
  if (!roles.includes("admin")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const callerOrg = orgIdFromClaims(caller);
  const orgId = String(body.orgId || callerOrg || "").trim();
  const dryRun = body.dryRun === true;
  const pageSize = Math.max(1, Math.min(500, Number(body.pageSize ?? PAGE)));

  if (!orgId) {
    res.status(400).json({ ok: false, error: "org_required" });
    return;
  }

  const results = {
    enrollmentsScanned: 0,
    enrollmentsWithPayments: 0,
    projectionsWritten: 0,
    jotformScanned: 0,
    jotformProcessed: 0,
    jotformItemsWritten: 0,
    errors: [] as string[],
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
      const extracted = extractSpendItems(sub as any);
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

  res.json({
    ok: true,
    dryRun,
    orgId,
    at: isoNow(),
    ...results,
  });
}
