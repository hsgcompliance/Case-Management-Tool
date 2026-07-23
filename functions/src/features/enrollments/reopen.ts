// functions/src/features/enrollments/reopen.ts
// reopenEnrollmentCore: restores an enrollment to active, checks for an
// overlap conflict against other currently-active enrollments for the same
// customer+grant first (the actual "smart" part — the old one-click reopen
// had no such check), and tells the caller plainly when there's no future
// schedule left to reactivate (expected under the current close behavior —
// see TOOL_ARCHITECTURE_AND_ROADMAP.md / root-cause-2026-07-21-duplicate-
// enrollment.md — rather than silently looking broken).
import { db, FieldValue, secureHandler, requireOrg, canAccessDoc, toDate } from "../../core";
import { overlapsAny } from "./overlap";
import { EnrollmentsReopenBody, type TEnrollmentsReopenBody } from "./schemas";

export async function reopenEnrollmentCore(user: Record<string, any>, body: TEnrollmentsReopenBody) {
  requireOrg(user);
  const ref = db.collection("customerEnrollments").doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("enrollment_not_found");
  const existing = snap.data() || {};
  if (!canAccessDoc(user, existing)) throw new Error("forbidden");

  const isDeleted = existing.deleted === true || String(existing.status || "").toLowerCase() === "deleted";
  if (isDeleted) throw new Error("cannot_reopen_deleted_enrollment");

  const isAlreadyOpen = existing.deleted !== true && existing.active !== false && String(existing.status || "active") !== "closed";
  if (isAlreadyOpen) throw new Error("enrollment_already_active");

  const siblingsSnap = await db.collection("customerEnrollments")
    .where("customerId", "==", existing.customerId)
    .where("grantId", "==", existing.grantId)
    .get();
  const activeOthers = siblingsSnap.docs
    .filter((d) => d.id !== body.id)
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((o: any) => o.deleted !== true && o.active !== false && String(o.status || "active") !== "closed");

  // Reopening clears endDate (open-ended going forward) — check the resulting open window.
  const conflicts = overlapsAny({ startDate: existing.startDate, endDate: null }, activeOthers, (v: unknown) => toDate(v as any));
  if (conflicts.length) {
    const e: any = new Error("active_enrollment_conflict");
    e.meta = { conflicts: conflicts.map((c: any) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate })) };
    throw e;
  }

  const payments = Array.isArray(existing.payments) ? existing.payments : [];
  const hasFutureUnpaid = payments.some((p: any) => p?.paid !== true && p?.void !== true);

  await ref.set(
    {
      status: "active",
      active: true,
      endDate: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    id: body.id,
    scheduleRebuildRecommended: !hasFutureUnpaid,
  };
}

export const enrollmentsReopen = secureHandler(
  async (req, res) => {
    const parsed = EnrollmentsReopenBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const user = (req as any).user || {};
    try {
      const result = await reopenEnrollmentCore(user, parsed.data);
      res.status(200).json({ ok: true, ...result });
    } catch (error: any) {
      const message = String(error?.message || error || "reopen_failed");
      const status = message === "enrollment_not_found" ? 404 : message === "forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: message, ...(error?.meta || {}) });
    }
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] },
);
