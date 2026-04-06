// functions/src/features/tasks/updateStatus.ts
import { db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import type { Request, Response } from "express";
import { summarize, assertOrgAccess, requireUid } from "./utils";

function taskHttpErr(message: string, code: number, meta?: Record<string, unknown>): never {
  const e: any = new Error(message);
  e.code = code;
  if (meta) e.meta = meta;
  throw e;
}

/**
 * Update task status with limited actions.
 * Body: { enrollmentId, taskId, action: 'complete'|'reopen'|'verify', reason?: string, notes?: string }
 */
export async function updateTaskStatusHandler( req: Request, res: Response ): Promise<void> {

  const parsed = C.TasksUpdateStatusBody.safeParse(req.body || {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ ok: false, error: parsed.error.message });
    return;
  }
  const { enrollmentId, taskId, action, reason, notes } =
    parsed.data;

  const user: any = (req as any)?.user || {};
  const uid = requireUid(user);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (trx) => {
    const ref = db
      .collection("customerEnrollments")
      .doc(enrollmentId);
    const snap = await trx.get(ref);
    if (!snap.exists) taskHttpErr("enrollment_not_found", 404, { enrollmentId });
    const e: any = snap.data() || {};

    assertOrgAccess(user, e);

    const sched: any[] = Array.isArray(e?.taskSchedule)
      ? [...e.taskSchedule]
      : [];
    const idx = sched.findIndex(
      (s) => String(s?.id) === String(taskId)
    );
    if (idx < 0) taskHttpErr("task_not_found", 404, { enrollmentId, taskId });

    const t = { ...sched[idx] };

    const isHardLocked =
      t.status === "verified" || t.verified;
    if (isHardLocked && action !== "verify") {
      taskHttpErr(
        "task_verified_locked",
        409,
        { enrollmentId, taskId }
      );
    }

    // Sequential multiparty guard: later steps cannot complete before earlier ones.
    if (
      t.multiParentId &&
      t.multiMode === "sequential" &&
      action === "complete"
    ) {
      const stepIndex = Number(
        (t as any).multiStepIndex || 0
      );
      if (stepIndex > 1) {
        const parentId = String(t.multiParentId);
        const blockingStep = sched.find(
          (s: any) =>
            s &&
            s.multiParentId === parentId &&
            Number((s as any).multiStepIndex || 0) <
              stepIndex &&
            !s.completed
        );
        if (blockingStep) {
          taskHttpErr("previous_step_not_complete", 409, {
            enrollmentId,
            taskId,
            blockingTaskId: String((blockingStep as any)?.id || ""),
            blockingStepIndex: Number((blockingStep as any)?.multiStepIndex || 0),
          });
        }
      }
    }

    if (action === "complete") {
      if (!t.completed) {
        t.completed = true;
        t.completedAt = nowIso;
        (t as any).completedBy = uid;
        if (notes)
          t.notes =
            (t.notes || "") +
            (t.notes ? "\n" : "") +
            notes;
      }
    } else if (action === "reopen") {
      if (t.completed) {
        t.completed = false;
        delete (t as any).completedAt;
        delete (t as any).completedBy;
        (t as any).reopenedAt = nowIso;
        (t as any).reopenedBy = uid;
        if (reason)
          (t as any).reopenReason = reason;
      }
    } else if (action === "verify") {
      (t as any).status = "verified";
      (t as any).verified = true;
      (t as any).verifiedAt = nowIso;
      (t as any).verifiedBy = uid;
    }

    sched[idx] = t;

    trx.update(ref, {
      taskSchedule: sched,
      taskStats: summarize(sched),
      updatedAt: FieldValue.serverTimestamp(),
    });

    trx.set(
      ref.collection("audit").doc(),
      {
        type: "task_status_change",
        taskId,
        action,
        reason: reason || null,
        notes: notes || null,
        byUid: uid,
        at: nowIso,
        orgId: e.orgId || null,
      }
    );
  });

  res.status(200).json({ ok: true });
}
