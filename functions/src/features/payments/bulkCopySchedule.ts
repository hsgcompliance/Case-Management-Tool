// functions/src/features/payments/bulkCopySchedule.ts
import { db, FieldValue } from "../../core/admin";
import type { Request, Response } from "express";
import { toDate, toISO10, addMonths, monthsBetween, ensurePaymentIds, assertOrgAccess, requireUid, compositeKey, ensureMonthlySubtypeTag } from "./utils";
import { secureHandler } from "../../core/http";
import { PaymentsBulkCopyScheduleBody } from "./schemas";

/**
 * Copy a source enrollment's payment schedule template to many target enrollments.
 * POST /paymentsBulkCopySchedule
 * Body: {
 *   sourceEnrollmentId: string,
 *   targetEnrollmentIds: string[],
 *   mode?: 'replace'|'merge' = 'replace',
 *   includeTypes?: string[]|null,
 *   anchorByStartDate?: boolean = true
 * }
 */

/** Preserve paid history and compliance when merging. */
function carryPaymentStatus(prev: any, next: any) {
  if (prev?.paid) return prev; // never overwrite a paid row
  return {
    ...next,
    id: prev?.id || next?.id,
    paid: prev?.paid ?? next?.paid ?? false,
    paidAt: prev?.paidAt ?? next?.paidAt ?? null,
    paidFromGrant: prev?.paidFromGrant ?? next?.paidFromGrant ?? false,
    compliance: prev?.compliance ?? next?.compliance ?? null,
    note: prev?.note ?? next?.note ?? null,
    vendor: prev?.vendor ?? next?.vendor ?? null,
    comment: prev?.comment ?? next?.comment ?? null,
  };
}

/** POST /paymentsBulkCopySchedule */
export async function paymentsBulkCopyScheduleHandler(req: Request, res: Response) {
  const parsed = PaymentsBulkCopyScheduleBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  const user: any = (req as any)?.user || {};
  try { requireUid(user); } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message || "auth_required" });
  }

  const { sourceEnrollmentId, targetEnrollmentIds, mode, includeTypes, anchorByStartDate } = parsed.data;

  // load source
  const srcRef = db.collection("customerEnrollments").doc(sourceEnrollmentId);
  const srcSnap = await srcRef.get();
  if (!srcSnap.exists) return res.status(404).json({ ok: false, error: "Source enrollment not found" });

  const src = srcSnap.data() || {};
  assertOrgAccess(user, src);

  const sourceStart = src.startDate || null;
  const sourcePays: any[] = Array.isArray(src.payments) ? src.payments : [];

  const start = toDate(sourceStart);
  const rawTemplate = !start
    ? []
    : (sourcePays || [])
        .filter((p) => p && p.type)
        .map((p) => {
          const due = toDate(p.dueDate || p.date);
          const offset = due ? monthsBetween(start, due) : 0;
          return {
            type: p.type,
            amount: Number(p.amount) || 0,
            offsetMonths: offset,
            lineItemId: p.lineItemId || null,
            note: p.note || null,
            comment: p.comment || null,
          };
        });

  const template = Array.isArray(includeTypes)
    ? rawTemplate.filter((t) => includeTypes.includes(String(t.type)))
    : rawTemplate;

  const results: any[] = [];

  for (const eid of targetEnrollmentIds) {
    try {
      const ref = db.collection("customerEnrollments").doc(String(eid));
      const snap = await ref.get();
      if (!snap.exists) {
        results.push({ enrollmentId: eid, ok: false, error: "Enrollment not found" });
        continue;
      }

      const row = snap.data() || {};
      assertOrgAccess(user, row);

      const anchorDate = anchorByStartDate ? (row.startDate || null) : (sourceStart || null);
      const base = toDate(anchorDate) || new Date();

      let next = template.map((t) => {
        const due = addMonths(base, Number(t.offsetMonths) || 0);
        return {
          type: t.type,
          amount: Number(t.amount) || 0,
          dueDate: toISO10(due),
          paid: false,
          paidFromGrant: false,
          ...(t.lineItemId ? { lineItemId: t.lineItemId } : {}),
          ...(t.note != null ? { note: t.note } : {}),
          ...(t.comment != null ? { comment: t.comment } : {}),
        };
      });

      const existing: any[] = Array.isArray(row.payments) ? row.payments : [];

      // ensure subtype tag is explicit BEFORE ids (prevents rent/utility drift)
      next = next.map(ensureMonthlySubtypeTag);

      // deterministic IDs with reuse from existing
      next = ensurePaymentIds(next, existing);

      if (mode === "merge") {
        const merged = existing.slice();
        for (const p of next) {
          const key = compositeKey(p);
          const i = merged.findIndex((x) => compositeKey(x) === key);
          if (i >= 0) merged[i] = carryPaymentStatus(merged[i], p);
          else merged.push(p);
        }
        await ref.update({ payments: merged, updatedAt: FieldValue.serverTimestamp() });
        results.push({ enrollmentId: eid, ok: true, count: next.length, mode: "merge" });
      } else {
        // replace, but preserve any paid rows that aren't in template
        const paidKeep = existing.filter((p) => p?.paid);
        const keepByKey = new Set(paidKeep.map(compositeKey));
        const compiled = [
          ...paidKeep,
          ...next.filter((p) => !keepByKey.has(compositeKey(p))),
        ];
        await ref.update({ payments: compiled, updatedAt: FieldValue.serverTimestamp() });
        results.push({ enrollmentId: eid, ok: true, count: next.length, mode: "replace" });
      }
    } catch (e: any) {
      results.push({ enrollmentId: eid, ok: false, error: String(e?.message || e) });
    }
  }

  return res.status(200).json({ ok: true, results });
}

export const paymentsBulkCopySchedule = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsBulkCopyScheduleHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
