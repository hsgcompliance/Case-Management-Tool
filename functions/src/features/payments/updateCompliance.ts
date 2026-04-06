// functions/src/features/payments/updateCompliance.ts
/**
 * Patch payment.compliance fields on a single payment within an enrollment.
 * POST /paymentsUpdateCompliance
 * Body: { enrollmentId, paymentId, patch: { items?, status?, note? } }
 * `items` replaces the full checklist array; `status` and `note` are merged.
 * Also patches matching ledger entries so the spend table reflects current compliance.
 */
import { db, FieldValue, isoNow } from "../../core";
import type { Response } from "express";
import { secureHandler } from "../../core/http";
import type { AuthedRequest } from "../../core/requestContext";
import { assertOrgAccess, requireUid } from "./utils";
import {
  PaymentsUpdateComplianceBody,
  type TPaymentsUpdateComplianceBody,
} from "./schemas";

/** POST /paymentsUpdateCompliance */
export async function paymentsUpdateComplianceHandler(req: AuthedRequest, res: Response) {
  const parsed = PaymentsUpdateComplianceBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.message });

  const user = (req.user ?? {}) as Record<string, unknown>;
  try {
    requireUid(user);
  } catch (e: unknown) {
    return res.status(401).json({ ok: false, error: (e as { message?: string })?.message || "auth_required" });
  }

  const { enrollmentId, paymentId, patch } = parsed.data as TPaymentsUpdateComplianceBody;
  const eRef = db.collection("customerEnrollments").doc(enrollmentId);

  try {
    const merged = await db.runTransaction(async (tx) => {
      const snap = await tx.get(eRef);
      if (!snap.exists) throw { status: 404, message: "Enrollment not found" };
      const data = (snap.data() || {}) as Record<string, unknown>;
      assertOrgAccess(user, data);

      const payments = Array.isArray(data.payments) ? data.payments : [];
      const idx = payments.findIndex((p) => {
        const row = p as { id?: unknown };
        return String(row?.id || "") === paymentId;
      });
      if (idx === -1) throw { status: 404, message: "Payment not found" };

      const prev = (payments[idx] || {}) as Record<string, unknown>;
      const prevCompliance =
        prev.compliance && typeof prev.compliance === "object"
          ? (prev.compliance as Record<string, unknown>)
          : {};
      const next = { ...prev, compliance: { ...prevCompliance, ...(patch || {}) } };

      const nextPayments = payments.slice();
      nextPayments[idx] = next;

      const write = { payments: nextPayments, updatedAt: FieldValue.serverTimestamp() };
      tx.set(eRef, write, { merge: true });
      return { ...data, ...write };
    });

    // Also patch matching ledger entries (best-effort, non-blocking)
    const mergedPayments = Array.isArray((merged as any).payments) ? (merged as any).payments : [];
    const updatedPayment = mergedPayments.find((p: any) => String(p?.id || '') === paymentId);
    const updatedCompliance = (updatedPayment as any)?.compliance ?? {};
    const hmisComplete = !!(updatedCompliance.hmisComplete);
    const caseworthyComplete = !!(updatedCompliance.caseworthyComplete);
    db.collection("ledger")
      .where("enrollmentId", "==", enrollmentId)
      .where("paymentId", "==", paymentId)
      .get()
      .then((snap) => {
        if (snap.empty) return;
        const now = isoNow();
        const batch = db.batch();
        for (const doc of snap.docs) {
          batch.update(doc.ref, {
            "compliance.hmisComplete": hmisComplete,
            "compliance.caseworthyComplete": caseworthyComplete,
            updatedAt: now,
          });
        }
        return batch.commit();
      })
      .catch(() => {/* non-fatal */});

    return res.json({ ok: true, id: enrollmentId, ...merged });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e?.status || 500).json({ ok: false, error: e?.message || "Failed to update payment compliance" });
  }
}

export const paymentsUpdateCompliance = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsUpdateComplianceHandler(req, res);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
