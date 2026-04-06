//functions/src/features/tasks/updateFields.ts
import { db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import type { Request, Response } from "express";
import { summarize, assertOrgAccess, requireUid } from "./utils";

/**
 * PATCH task fields that aren't status (safe UI edits):
 * Body: { enrollmentId, taskId, patch: { notify?: boolean, notes?: string, type?: string, bucket?: 'task'|'assessment'|'compliance'|'other' } }
 */
export async function updateTaskFieldsHandler(req: Request, res: Response): Promise<void> {
  const parsed = C.TasksUpdateFieldsBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }
  const { enrollmentId, taskId, patch } = parsed.data;

  const user: any = (req as any)?.user || {};
  const uid = requireUid(user);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (trx) => {
    const ref = db.collection("customerEnrollments").doc(enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) throw new Error("Enrollment not found");
    const e: any = snap.data() || {};

    assertOrgAccess(user, e);

    const sched: any[] = Array.isArray(e.taskSchedule) ? [...e.taskSchedule] : [];
    const idx = sched.findIndex((t) => String(t?.id) === String(taskId));
    if (idx < 0) throw new Error("Task not found");

    const t = { ...sched[idx] };
    if (Object.prototype.hasOwnProperty.call(patch, "notify")) t.notify = !!patch.notify;
    if (Object.prototype.hasOwnProperty.call(patch, "notes")) t.notes = String(patch.notes || "");
    if (Object.prototype.hasOwnProperty.call(patch, "type")) t.type = String(patch.type || t.type || "Task");
    if (Object.prototype.hasOwnProperty.call(patch, "bucket")) t.bucket = patch.bucket;
    (t as any).updatedAt = nowIso;
    (t as any).updatedBy = uid;

    sched[idx] = t;

    trx.update(ref, {
      taskSchedule: sched,
      taskStats: summarize(sched),
      updatedAt: FieldValue.serverTimestamp(),
    });

    trx.set(ref.collection("audit").doc(), {
      type: "task_patch_fields",
      taskId,
      patch,
      byUid: uid,
      at: nowIso,
      orgId: e.orgId || null,
    });
  });

  res.status(200).json({ ok: true });
}
