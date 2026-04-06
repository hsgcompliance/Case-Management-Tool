// functions/src/features/tasks/delete.ts
import { db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import type { Request, Response } from "express";
import { summarize, assertOrgAccess, requireUid } from "./utils";

/**
 * Delete a task or clear all tasks on an enrollment.
 * Body: { enrollmentId, taskId?: string, all?: boolean }
 */
export async function deleteTaskHandler(req: Request, res: Response): Promise<void> {
  const parsed = C.TasksDeleteBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }
  const { enrollmentId, taskId, all } = parsed.data;
  const user: any = (req as any)?.user || {};
  const uid = requireUid(user); // block anon writes

  const allFlag = all === true || all === "true" || all === 1 || (all as any) === "1";
  if (!allFlag && !taskId) {
    res.status(400).json({ ok: false, error: "Provide taskId or all=true" });
    return;
  }

  await db.runTransaction(async (trx) => {
    const ref = db.collection("customerEnrollments").doc(enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) throw new Error("Enrollment not found");

    const e: any = snap.data() || {};
    assertOrgAccess(user, e);

    const schedule: any[] = Array.isArray(e.taskSchedule) ? e.taskSchedule : [];
    const next = allFlag ? [] : schedule.filter((t) => String(t?.id) !== String(taskId));

    trx.set(
      ref,
      {
        taskSchedule: next,
        taskStats: summarize(next),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    trx.set(ref.collection("audit").doc(), {
      type: "task_delete",
      taskId: allFlag ? null : taskId,
      all: !!allFlag,
      at: new Date().toISOString(),
      byUid: uid,
      orgId: e.orgId || null,
    });
  });

  res.status(200).json({ ok: true, removed: allFlag ? "all" : taskId });
}
