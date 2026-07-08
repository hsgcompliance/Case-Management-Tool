import type { Response } from "express";
import { db, FieldValue } from "../../core";
import { secureHandler } from "../../core/http";
import type { AuthedRequest } from "../../core/requestContext";
import { summarize } from "../tasks/utils";
import { PaymentsRentCertSetBody } from "./schemas";
import { assertOrgAccess, requireUid } from "./utils";

const paymentDate = (payment: Record<string, unknown>) => String(payment.dueDate || payment.date || "").slice(0, 10);
/** Rent cert due date is always the month prior to the effective (payment) date. */
const monthPriorISO = (iso: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
};
const taskIds = (paymentId: string, targetDate: string) => {
  const base = `payment_rent_cert_${paymentId}_${targetDate}`;
  return [`${base}_casemanager`, `${base}_compliance`];
};
const taskTargetDate = (task: Record<string, unknown>) => {
  const direct = String(task.targetPaymentDate || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const idMatch = String(task.defId || task.id || "").match(/(\d{4}-\d{2}-\d{2})(?:_[a-z]+)?$/i);
  if (idMatch) return idMatch[1];
  const due = String(task.dueDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return "";
  const date = new Date(`${due}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
};
const isRentCertTask = (task: Record<string, unknown>) => {
  const id = String(task.defId || task.id || "").toLowerCase();
  const text = `${String(task.title || task.type || "")} ${String(task.notes || task.note || "")}`.toLowerCase();
  return id.startsWith("payment_rent_cert_") || id.startsWith("pay_cert_") || text.includes("rent cert");
};
const taskRole = (task: Record<string, unknown>) => String(task.assignedToGroup || "").toLowerCase();

export const paymentsRentCertSet = secureHandler(async (req: AuthedRequest, res: Response): Promise<void> => {
  const parsed = PaymentsRentCertSetBody.safeParse(req.body || {});
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
  const user = (req.user || {}) as Record<string, unknown>;
  try { requireUid(user); } catch (error: any) {
    return void res.status(401).json({ ok: false, error: error?.message || "auth_required" });
  }
  const { enrollmentId, paymentId, status: toggle, dueDate: bodyDueDate, bucket: bodyBucket, title: bodyTitle, supersedeOlderOpenCerts } = parsed.data;
  const ref = db.collection("customerEnrollments").doc(enrollmentId);
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw { status: 404, message: "enrollment_not_found" };
      const enrollment = (snap.data() || {}) as Record<string, any>;
      assertOrgAccess(user, enrollment);
      const payments = Array.isArray(enrollment.payments) ? enrollment.payments.slice() : [];
      const index = payments.findIndex((payment: any) => String(payment?.id || "") === paymentId);
      if (index < 0) throw { status: 404, message: "payment_not_found" };
      const payment = { ...(payments[index] || {}) };
      const targetPaymentDate = paymentDate(payment);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetPaymentDate)) throw { status: 400, message: "payment_due_date_required" };
      const existingTasks = Array.isArray(enrollment.taskSchedule) ? enrollment.taskSchedule : [];
      const previousTaskIds = new Set(Array.isArray(payment?.rentCert?.taskIds) ? payment.rentCert.taskIds.map(String) : []);
      const matchingLegacyTasks = existingTasks.filter((task: any) =>
        isRentCertTask(task) && taskTargetDate(task) === targetPaymentDate,
      );
      const keepTasks = existingTasks.filter((task: any) =>
        !previousTaskIds.has(String(task?.id || "")) &&
        String(task?.rentCertPaymentId || "") !== paymentId &&
        !matchingLegacyTasks.includes(task),
      );
      // Resolve the requested state. The toggle drives the status; the due date
      // is always derived as the month prior to the payment (effective) date.
      // Legacy callers (no toggle) keep the explicit dueDate path.
      const wantsClear = toggle === "notDue" || (!toggle && !bodyDueDate);
      const forcedStatus = toggle && toggle !== "notDue" ? toggle : null; // "due" | "completed" | "effective"
      const markComplete = forcedStatus === "completed" || forcedStatus === "effective";
      const dueDate = wantsClear
        ? null
        : forcedStatus
          ? monthPriorISO(targetPaymentDate)
          : (bodyDueDate || null);

      let rentCert: Record<string, unknown> | null = null;
      let taskSchedule = keepTasks;
      if (dueDate) {
        const ids = taskIds(paymentId, targetPaymentDate);
        const priorById = new Map(existingTasks.map((task: any) => [String(task?.id || ""), task]));
        const title = (bodyTitle || "").trim() || `${targetPaymentDate.slice(0, 7)} rent cert due ${dueDate}`;
        const nowISO = new Date().toISOString();
        const generated = ids.map((id, index) => {
          const role = index === 0 ? "casemanager" : "compliance";
          const prior: any = priorById.get(id) || matchingLegacyTasks.find((task: any) => taskRole(task) === role);
          const completed = markComplete ? true : prior?.completed === true;
          return {
            id, type: title, title, defId: id, dueDate, dueMonth: dueDate.slice(0, 7),
            completed, completedAt: completed ? (prior?.completedAt || nowISO) : null,
            status: completed ? "done" : (prior?.status || "open"), notify: true, bucket: bodyBucket || "compliance", managed: true,
            notes: role === "casemanager" ? "Collect updated customer and landlord documents for rent certification." : "Prepare and send the updated rent certification or notice.",
            assignedToGroup: role, assignedToUid: role === "casemanager" ? enrollment.caseManagerId || null : null,
            assignedBy: "system", rentCertPaymentId: paymentId, targetPaymentDate,
          };
        });
        taskSchedule = [...keepTasks, ...generated].sort((a: any, b: any) => String(a?.dueDate || "").localeCompare(String(b?.dueDate || "")));
        const derivedStatus = generated.every((task) => task.completed === true) ? "completed" : "due";
        rentCert = { dueDate, targetPaymentDate, source: "manual", taskIds: ids, status: forcedStatus || derivedStatus };
      }
      // Clearing is sticky: rentCertOptOut prevents the continuum sync from
      // regenerating a calculated cert for this payment. Setting any state
      // removes the opt-out.
      payments[index] = { ...payment, rentCert, rentCertOptOut: dueDate ? null : true };

      // A newer certification supersedes earlier open ("due") certs on this
      // enrollment: mark them completed and close their reminder tasks.
      // "completed"/"effective" certs are never touched.
      if (dueDate && supersedeOlderOpenCerts) {
        const supersededPaymentIds = new Set<string>();
        const supersededTaskIds = new Set<string>();
        for (let i = 0; i < payments.length; i += 1) {
          if (i === index) continue;
          const other = (payments[i] || {}) as Record<string, any>;
          const rc = other.rentCert as Record<string, any> | null | undefined;
          if (!rc?.dueDate) continue;
          if (String(rc.status || "due") !== "due") continue;
          const otherTarget = String(rc.targetPaymentDate || paymentDate(other) || "").slice(0, 10);
          if (!otherTarget || otherTarget >= targetPaymentDate) continue;
          supersededPaymentIds.add(String(other.id || ""));
          for (const id of Array.isArray(rc.taskIds) ? rc.taskIds : []) supersededTaskIds.add(String(id));
          payments[i] = { ...other, rentCert: { ...rc, status: "completed" } };
        }
        if (supersededPaymentIds.size || supersededTaskIds.size) {
          const completedAtISO = new Date().toISOString();
          taskSchedule = taskSchedule.map((task: any) => {
            const linked =
              supersededTaskIds.has(String(task?.id || "")) ||
              supersededPaymentIds.has(String(task?.rentCertPaymentId || ""));
            if (!linked || task?.completed === true) return task;
            return { ...task, completed: true, completedAt: task?.completedAt || completedAtISO, status: "done" };
          });
        }
      }
      tx.set(ref, { payments, taskSchedule, taskStats: summarize(taskSchedule), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return rentCert;
    });
    res.status(200).json({ ok: true, enrollmentId, paymentId, rentCert: result });
  } catch (error: any) {
    res.status(Number(error?.status || 500)).json({ ok: false, error: error?.message || "rent_cert_update_failed" });
  }
}, { auth: "user", methods: ["POST", "OPTIONS"] });
