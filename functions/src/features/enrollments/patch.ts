// functions/src/features/enrollments/patch.ts
import {
  db,
  FieldValue,
  secureHandler,
  requireOrg,
  canAccessDoc,
  sanitizeFlatObject,
  toDateOnly,
} from "../../core";

import { EnrollmentsPatchBody, toArray } from "./schemas";
import { deriveEnrollmentNames } from "./derive";
import { summarize } from "../tasks/utils";

const ALWAYS_IMMUTABLE = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "by",
  "orgId",
  "teamIds",
  "grantId",
  "customerId",
  "migratedFrom",
  "migratedTo",
  "scheduleMeta",
  "taskSchedule",
  "taskStats",
  "payments",
  "spends",
  "deletedAt",
  "voidedAt",
  "reversedAt",
]);

// Unsets are more dangerous than sets — block lifecycle fields too.
const UNSET_BLOCKED = new Set([
  ...ALWAYS_IMMUTABLE,
  "status",
  "active",
  "deleted",
]);

function err(message: string, code: number, meta?: Record<string, unknown>) {
  const e: any = new Error(message);
  e.code = code;
  if (meta) e.meta = meta;
  return e;
}

function latestPaymentDueDate(payments: any[]): string | null {
  let maxDue = "";
  for (const p of Array.isArray(payments) ? payments : []) {
    if ((p as any)?.void === true) continue;
    const due = String((p as any)?.dueDate || (p as any)?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;
    if (!maxDue || due > maxDue) maxDue = due;
  }
  return maxDue || null;
}

function closeFutureTasksAfterEndDate(schedule: any[], endDateISO: string, actor = "system") {
  const nowIso = new Date().toISOString();
  let changed = false;
  const next = (Array.isArray(schedule) ? schedule : []).map((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    if (!due || due <= endDateISO) return t;
    if (t?.status === "verified") return t;
    if (t?.completed === true || t?.status === "done") return t;
    changed = true;
    return {
      ...t,
      completed: true,
      completedAt: t?.completedAt || nowIso,
      status: "done",
      notes: [String(t?.notes || "").trim(), `Auto-closed after enrollment end ${endDateISO}`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 2000),
      updatedAt: nowIso,
      updatedBy: actor,
    };
  });
  return { changed, next };
}

function deleteFutureTasksAfterEndDate(schedule: any[], endDateISO: string) {
  if (!Array.isArray(schedule)) return { changed: false, next: schedule };
  const next = schedule.filter((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    return !due || due <= endDateISO;
  });
  return { changed: next.length !== schedule.length, next };
}

export const enrollmentsPatch = secureHandler(
  async (req, res) => {
  const parsed = EnrollmentsPatchBody.parse(req.body);
  const rows = toArray(parsed);

    if (!rows.length) {
      res.status(400).json({ ok: false, error: "empty" });
      return;
    }

    const user = (req as any).user || {};
    requireOrg(user);

    // Access check preflight (with proper codes)
    const snaps = await Promise.all(
      rows.map((r) => db.collection("customerEnrollments").doc(r.id).get())
    );

    snaps.forEach((s, i) => {
      const id = rows[i]?.id;
      if (!s.exists) throw err("enrollment_not_found", 404, { id });
      if (!canAccessDoc(user, s.data() || {})) throw err("forbidden", 403, { id });
    });
    const existingById = new Map<string, any>(
      snaps.map((s, i) => [String(rows[i]?.id || ""), s.data() || {}]),
    );

    const batch = db.batch();

    for (const row of rows) {
      const id = row.id;
      const patchRaw = row.patch || {};
      const unset = Array.isArray(row.unset) ? row.unset : [];

      // Core sanitization (drops __proto__/constructor/prototype + truncates long strings)
      const patch = sanitizeFlatObject(patchRaw as any);

      const data: any = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      const existing = existingById.get(String(id)) || {};

      // allow updates, but protect identity/finance/schedule
      for (const [k, v] of Object.entries(patch)) {
        if (ALWAYS_IMMUTABLE.has(k)) continue;
        data[k] = v;
      }

      // apply unsets last so delete wins
      for (const k of unset) {
        const key = String(k || "").trim();
        if (!key) continue;
        if (UNSET_BLOCKED.has(key)) continue;
        data[key] = FieldValue.delete();
      }

      // status/active coupling (both directions)
      if ("status" in patch && !("active" in patch)) {
        const st = String((patch as any).status || "");
        data.active = st === "active";
        if (st === "deleted") data.deleted = true;
        if (st === "active" || st === "closed") data.deleted = false;
      }
      if ("active" in patch && !("status" in patch)) {
        const act = !!(patch as any).active;
        data.status = act ? "active" : "closed";
        if (act) data.deleted = false;
      }

      const nextStatus = String(
        Object.prototype.hasOwnProperty.call(data, "status") ? data.status : existing.status || ""
      ).toLowerCase();
      const nextDeleted = Boolean(
        Object.prototype.hasOwnProperty.call(data, "deleted") ? data.deleted : existing.deleted
      );
      const nextActive =
        Object.prototype.hasOwnProperty.call(data, "active")
          ? Boolean(data.active)
          : (typeof existing.active === "boolean" ? Boolean(existing.active) : true);
      const closeLike = nextStatus === "closed" || nextStatus === "deleted" || nextDeleted || !nextActive;
      const explicitClose = nextStatus === "closed" || (!nextDeleted && !nextActive);
      const effectiveEndDate =
        String(
          ("endDate" in patch ? (patch as any).endDate : undefined) ??
            existing.endDate ??
            ""
        ).slice(0, 10) || (closeLike ? toDateOnly(new Date()) : "");

      if (closeLike && effectiveEndDate) {
        if (explicitClose) {
          const lastPaymentDate = latestPaymentDueDate(Array.isArray(existing.payments) ? existing.payments : []);
          if (lastPaymentDate && effectiveEndDate < lastPaymentDate) {
            throw err(`close_date_before_last_payment (${effectiveEndDate} < ${lastPaymentDate})`, 400, {
              id,
              closeDate: effectiveEndDate,
              lastPaymentDate,
            });
          }
        }
        if (!("endDate" in patch) && !existing.endDate) data.endDate = effectiveEndDate;
        const schedule = Array.isArray(existing.taskSchedule) ? existing.taskSchedule : [];
        const taskChange =
          nextStatus === "deleted" || nextDeleted
            ? deleteFutureTasksAfterEndDate(schedule, effectiveEndDate)
            : closeFutureTasksAfterEndDate(schedule, effectiveEndDate, String(user?.uid || "system"));
        if (taskChange.changed) {
          data.taskSchedule = taskChange.next;
          data.taskStats = summarize(taskChange.next);
        }
      }

      Object.assign(
        data,
        await deriveEnrollmentNames({
          grantId: existing.grantId,
          customerId: existing.customerId,
          startDate: "startDate" in patch ? (patch as any).startDate : existing.startDate,
          grantDoc: { name: existing.grantName },
          customerDoc: { name: existing.customerName || existing.clientName },
        }),
      );

      batch.set(db.collection("customerEnrollments").doc(id), data, { merge: true });
    }

    await batch.commit();
    res.status(200).json({ ok: true, ids: rows.map((r) => r.id) });
  },
  { auth: "user", requireOrg: true, methods: ["PATCH", "POST", "OPTIONS"] }
);
