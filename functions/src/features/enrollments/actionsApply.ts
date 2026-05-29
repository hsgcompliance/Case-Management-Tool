import {
  canAccessDoc,
  db,
  FieldValue,
  requireOrg,
  secureHandler,
} from "../../core";
import { EnrollmentActionsApplyBody } from "./schemas";

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lifecycleIsOpen(enrollment: Record<string, any>): boolean {
  const status = String(enrollment?.status || (enrollment?.active ? "active" : "closed")).toLowerCase();
  if (status === "closed" || status === "deleted" || enrollment?.deleted === true) return false;
  if (enrollment?.active === false) return false;
  const endDate = String(enrollment?.endDate || "").slice(0, 10);
  return !endDate || endDate >= isoToday();
}

export const enrollmentActionsApply = secureHandler(
  async (req, res) => {
    const parsed = EnrollmentActionsApplyBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }

    const body = parsed.data;
    const user = (req as any).user || {};
    requireOrg(user);

    const enrollmentRef = db.collection("customerEnrollments").doc(body.enrollmentId);
    const historyRef = enrollmentRef.collection("actionHistory").doc();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(enrollmentRef);
      if (!snap.exists) {
        throw Object.assign(new Error("enrollment_not_found"), { code: 404 });
      }
      const before = snap.data() || {};
      if (!canAccessDoc(user, before)) {
        throw Object.assign(new Error("forbidden"), { code: 403 });
      }

      const patch: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      const history: Record<string, any> = {
        id: historyRef.id,
        actorType: "user",
        actorId: user.uid || null,
        note: body.note || null,
        createdAt: FieldValue.serverTimestamp(),
      };

      if (body.actionId && Object.prototype.hasOwnProperty.call(body, "value")) {
        patch.actions = {
          ...(before.actions && typeof before.actions === "object" && !Array.isArray(before.actions)
            ? before.actions
            : {}),
          [body.actionId]: body.value,
        };
        history.eventType = "actionChanged";
        history.actionId = body.actionId;
        history.before = before.actions?.[body.actionId];
        history.after = body.value;
      }

      if (body.serviceStatus) {
        patch.serviceStatus = body.serviceStatus;
        history.eventType = "serviceStatusChanged";
        history.before = before.serviceStatus || null;
        history.after = body.serviceStatus;
      }

      if (body.medicaid) {
        const previousMedicaid =
          before.medicaid && typeof before.medicaid === "object" && !Array.isArray(before.medicaid)
            ? before.medicaid
            : { status: "active" };
        const nextMedicaid = { ...previousMedicaid, ...body.medicaid };
        const nextStatus = String(nextMedicaid.status || "active") === "closed" ? "closed" : "active";
        nextMedicaid.status = nextStatus;
        if (nextStatus === "closed" && !nextMedicaid.closedDate) nextMedicaid.closedDate = isoToday();
        if (nextStatus === "active" && !nextMedicaid.reopenedDate) nextMedicaid.reopenedDate = isoToday();

        patch.medicaid = nextMedicaid;
        if (nextStatus === "closed") {
          patch.serviceStatus = "paused";
        } else if (lifecycleIsOpen(before)) {
          patch.serviceStatus = "active";
        }

        history.eventType = "medicaidStatusChanged";
        history.before = previousMedicaid;
        history.after = nextMedicaid;
      }

      tx.set(enrollmentRef, patch, { merge: true });
      tx.set(historyRef, history);
    });

    res.status(200).json({ ok: true, enrollmentId: body.enrollmentId, historyId: historyRef.id });
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] },
);
