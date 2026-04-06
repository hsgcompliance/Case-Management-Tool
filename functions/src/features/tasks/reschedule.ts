// functions/src/features/tasks/reschedule.ts
import { db, FieldValue, secureHandler } from "../../core";
import {z, tasks as C } from "@hdb/contracts";
import { summarize, assertOrgAccess, requireUid } from "./utils";

/**
 * Either set a specific date for one task OR shift many by N days.
 * Body:
 *  - { enrollmentId, taskId, newDueDate }
 *  - { enrollmentId, taskIds:[...], shiftDays:number }
 */
const Body = C.TasksRescheduleBody;

function addDaysISO(iso: string, n: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}

/** POST /tasksReschedule */
export const tasksReschedule = secureHandler(async (req, res) => {
  const body = Body.parse(req.body || {});
  const user: any = (req as any)?.user || {};
  const uid = requireUid(user);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (trx) => {
    const ref = db.collection("customerEnrollments").doc(body.enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) throw new Error("Enrollment not found");
    const e: any = snap.data() || {};

    assertOrgAccess(user, e);

    const sched: any[] = Array.isArray(e.taskSchedule) ? [...e.taskSchedule] : [];

    if ("taskId" in body) {
      const idx = sched.findIndex((t)=> String(t?.id)===body.taskId);
      if (idx < 0) throw new Error("Task not found");
      const t = { ...sched[idx] };
      t.dueDate = body.newDueDate;
      t.dueMonth = body.newDueDate.slice(0,7);
      (t as any).updatedAt = nowIso; (t as any).updatedBy = uid;
      sched[idx] = t;
    } else {
      for (const id of body.taskIds) {
        const idx = sched.findIndex((t)=> String(t?.id)===id);
        if (idx < 0) continue;
        const t = { ...sched[idx] };
        const next = addDaysISO(String(t?.dueDate||nowIso).slice(0,10), body.shiftDays);
        t.dueDate = next; t.dueMonth = next.slice(0,7);
        (t as any).updatedAt = nowIso; (t as any).updatedBy = uid;
        sched[idx] = t;
      }
    }

    sched.sort((a:any,b:any)=> String(a.dueDate).localeCompare(String(b.dueDate)));

    trx.update(ref, {
      taskSchedule: sched,
      taskStats: summarize(sched),
      updatedAt: FieldValue.serverTimestamp(),
    });

    trx.set(ref.collection("audit").doc(), {
      type: "task_reschedule",
      mode: "taskId" in body ? "single" : "bulk",
      byUid: uid, at: nowIso,
      orgId: e.orgId || null,
    });
  });

  res.status(200).json({ ok:true });
}, { auth:"user", methods:["POST","OPTIONS"] });
