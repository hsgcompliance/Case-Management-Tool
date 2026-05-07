// functions/src/features/tasks/generateScheduleWrite.ts
import { db, FieldValue } from "../../core";
import { tasks as C } from "@hdb/contracts";
import type { Request, Response } from "express";
import {
  generateOccurrences,
  carryStatus,
  summarize,
  slug,
  assertOrgAccess,
  requireUid,
  resolveCaseManagerUid,
} from "./utils";
import { evaluateConditionalTaskRules } from "./conditionalRules";

/**
 * Generate + write managed tasks for one or many enrollments.
 * If no taskDefs are provided, uses `grants/{id}.tasks` (legacy field name).
 *
 * RBAC/ORG:
 *  - blocks anon writes
 *  - requires requester org match when enrollment / grant has orgId
 *  - legacy docs (no orgId) still work
 */

// [Hardening note] TasksGenerateScheduleWriteBody uses unknown task defs for parity. That’s fine for this loop, but it means contracts can’t protect you from garbage task definitions until you standardize a real TaskDef schema. startDate is accepted as a string and only later treated like a date. If this ever becomes user-input, invalid strings will slip through.

export async function generateTaskScheduleWriteHandler(req: Request, res: Response): Promise<void> {
  const parsed = C.TasksGenerateScheduleWriteBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const {
    enrollmentId,
    enrollmentIds,
    startDate,
    keepManual,
    mode,
    preserveCompletedManaged,
    pinCompletedManaged,
    taskDef,
    taskDefs,
    replaceTaskDefPrefixes,
  } = parsed.data;

  const user: any = (req as any)?.user || {};
  try {
    requireUid(user); // blocks anon writes even if wrapper missed it
  } catch (e: any) {
    res
      .status(401)
      .json({ ok: false, error: e?.message || "auth_required" });
    return;
  }

  const targetIds =
    Array.isArray(enrollmentIds) && enrollmentIds.length
      ? enrollmentIds
      : enrollmentId
      ? [enrollmentId]
      : [];

  if (!targetIds.length) {
    res
      .status(400)
      .json({ ok: false, error: "Missing enrollmentId(s)" });
    return;
  }

  // Normalize incoming defs (optional)
  let incomingDefs: any[] = [];
  if (Array.isArray(taskDefs)) incomingDefs = taskDefs;
  else if (Array.isArray(taskDef)) incomingDefs = taskDef;
  else if (taskDef) incomingDefs = [taskDef];

  const results: any[] = [];

  for (const eid of targetIds) {
    try {
      const enrRef = db
        .collection("customerEnrollments")
        .doc(eid);
      const enrSnap = await enrRef.get();

      if (!enrSnap.exists) {
        results.push({
          enrollmentId: eid,
          ok: false,
          error: "Enrollment not found",
        });
        continue;
      }

      const enr: any = enrSnap.data() || {};
      assertOrgAccess(user, enr);

      const effStart = startDate || enr.startDate;
      if (!effStart) {
        results.push({
          enrollmentId: eid,
          ok: false,
          error: "Missing startDate for enrollment",
        });
        continue;
      }

      // Use incoming defs or grant.tasks (legacy)
      let defs: any[] = incomingDefs;
      let grantForRules: any = null;
      if (!defs.length) {
        const gref = db
          .collection("grants")
          .doc(String(enr.grantId));
        const gsnap = await gref.get();

        if (!gsnap.exists) {
          results.push({
            enrollmentId: eid,
            ok: false,
            error: "Grant not found",
          });
          continue;
        }

        const grant: any = gsnap.data() || {};
        grantForRules = grant;
        assertOrgAccess(user, grant);

        defs = Array.isArray(grant.tasks)
          ? grant.tasks
          : [];
        const rules = Array.isArray(grant.conditionalTaskRules)
          ? grant.conditionalTaskRules
          : [];
        if (!defs.length && !rules.length) {
          const existing = Array.isArray(enr.taskSchedule)
            ? enr.taskSchedule
            : [];
          await enrRef.set(
            { updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          results.push({
            enrollmentId: eid,
            ok: true,
            total: existing.length,
            note: "No task defs on grant",
          });
          continue;
        }
      }

      // Closed enrollments: keep manual and remove grant-managed
      if (
        enr.status === "closed" ||
        enr.active === false ||
        enr.enrolled === false
      ) {
        const existing = Array.isArray(enr.taskSchedule)
          ? enr.taskSchedule
          : [];
        const defIds = new Set([
          ...defs.map((d: any) => String(d.id || d.type || "custom")),
          ...(!incomingDefs.length && grantForRules
            ? (Array.isArray(grantForRules.conditionalTaskRules)
                ? grantForRules.conditionalTaskRules.map((r: any) => String(r.id || r.taskName || "conditional"))
                : [])
            : []),
        ]);
        const manual = keepManual
          ? existing.filter((t: any) => {
              const did = String(t?.defId ?? "");
              return !did || !defIds.has(did);
            })
          : [];

        await enrRef.set(
          {
            taskSchedule: manual,
            taskStats: summarize(manual),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        results.push({
          enrollmentId: eid,
          ok: true,
          total: manual.length,
          closed: true,
        });
        continue;
      }

      // Build new managed set
      const defIds = new Set([
        ...defs.map((d: any) => String(d.id || d.type || "custom")),
        ...(!incomingDefs.length && grantForRules
          ? (Array.isArray(grantForRules.conditionalTaskRules)
              ? grantForRules.conditionalTaskRules.map((r: any) => String(r.id || r.taskName || "conditional"))
              : [])
          : []),
      ]);
      const managedNew: any[] = [];
      const replacedDefPrefixes = (replaceTaskDefPrefixes || [])
        .map((p: any) => String(p || "").trim())
        .filter(Boolean);
      const isReplacedDefId = (defId: unknown) => {
        const did = String(defId || "");
        return replacedDefPrefixes.some((prefix: string) => did.startsWith(prefix));
      };
      const customerRefId = String(enr.customerId || enr.clientId || "").trim();
      const customerSnap =
        customerRefId
          ? await db.collection("customers").doc(customerRefId).get().catch(() => null)
          : null;
      const customerDoc = customerSnap?.exists ? (customerSnap.data() || {}) : {};

      const customerDocName =
        String((customerDoc as any)?.name || "").trim() ||
        `${String((customerDoc as any)?.firstName || "").trim()} ${String((customerDoc as any)?.lastName || "").trim()}`.trim() ||
        null;
      const cmUid = resolveCaseManagerUid(enr) || resolveCaseManagerUid(customerDoc);
      const customerName =
        String(enr.customerName || enr.clientName || "").trim() ||
        customerDocName ||
        null;
      const grantName = String(enr.grantName || "").trim() || null;
      const caseManagerName =
        String(enr.caseManagerName || "").trim() ||
        String((customerDoc as any)?.caseManagerName || "").trim() ||
        null;
      const enrollmentName = String(enr.name || "").trim() || null;

      for (const def of defs) {
        const defStart = String((def as any)?.startDate || "").slice(0, 10) || effStart;
        const raw = generateOccurrences(def, defStart) || [];

        const enrEnd = enr.endDate ? new Date(enr.endDate) : null;
        const defEnd = def.endDate ? new Date(def.endDate) : null;
        const cutoff =
          [enrEnd, defEnd]
            .filter(Boolean)
            .sort((a: any, b: any) => +a - +b)[0] || null;

        const key = slug(
          def.id || def.type || def.name || "task"
        );
        const multiRaw = (def as any)?.multiparty;
        const hasMultiSteps =
          multiRaw && Array.isArray(multiRaw.steps) && multiRaw.steps.length > 0;

        const occurrences = raw.filter(
          (t: any) => !cutoff || new Date(t.dueDate) <= cutoff
        );

        for (const occ of occurrences) {
          const dueDate = occ.dueDate;
          const dueMonth = String(dueDate).slice(0, 7);
          const baseId =
            occ.id || `task_${key}_${dueDate}`;
          const type =
            occ.type || def.name || "Task";

          if (!hasMultiSteps) {
            // Single-owner task (backwards compatible path)
            const ownerGroup = String(
              def.assignedToGroup || def.assignToGroup || def.group || "casemanager"
            ).trim() || "casemanager";
            const ownerUid =
              String(def.assignedToUid || def.assignToUid || def.uid || "").trim() ||
              (ownerGroup === "casemanager" ? cmUid : null);
            const taskNotes = String(def.notes || def.note || "").trim();
            managedNew.push({
              id: baseId,
              type,
              defId: def.id || def.type || "custom",
              dueDate,
              dueMonth,
              completed: false,
              completedAt: null,
              byUid: null,
              notify: def.notify ?? true,
              notes: taskNotes,
              description: String(def?.description || "").trim() || null,
              bucket: def.bucket || "task",
              managed: true,
              customerName,
              grantName,
              caseManagerName,
              enrollmentName,

              assignedToGroup: ownerGroup,
              assignedToUid: ownerUid,
              assignedAt: ownerUid
                ? new Date().toISOString()
                : null,
              assignedBy: ownerUid ? "system" : null,
            });
          } else {
            const steps: any[] = Array.isArray(multiRaw.steps)
              ? multiRaw.steps
              : [];
            const stepCount = steps.length;
            const multiMode: "parallel" | "sequential" =
              multiRaw.mode === "sequential"
                ? "sequential"
                : "parallel";

            steps.forEach((stepDef: any, idx: number) => {
              const stepIndex = idx + 1;
              const stepId = `${baseId}_s${stepIndex}`;
              const stepGroup =
                (stepDef && stepDef.group) || "casemanager";
              let stepUid: string | null =
                (stepDef && stepDef.uid) || null;

              if (!stepUid && stepGroup === "casemanager") {
                stepUid = cmUid;
              }

              managedNew.push({
                id: stepId,
                type,
                defId: def.id || def.type || "custom",
                dueDate,
                dueMonth,
                completed: false,
                completedAt: null,
                byUid: null,
                notify: def.notify ?? true,
                notes: "",
                description: String(def?.description || "").trim() || null,
                bucket: def.bucket || "task",
                managed: true,
                customerName,
                grantName,
                caseManagerName,
                enrollmentName,

                assignedToGroup: stepGroup,
                assignedToUid: stepUid,
                assignedAt: stepUid
                  ? new Date().toISOString()
                  : null,
                assignedBy: stepUid ? "system" : null,

                // linked-step metadata
                multiParentId: baseId,
                multiStepIndex: stepIndex,
                multiStepCount: stepCount,
                multiMode,
              });
            });
          }
        }
      }

      if (!incomingDefs.length && grantForRules) {
        const conditionalTasks = await evaluateConditionalTaskRules(
          eid,
          enr,
          grantForRules,
          new Date(effStart),
          cmUid,
        );
        for (const ct of conditionalTasks) {
          if (!managedNew.some((m: any) => m.id === ct.id)) {
            managedNew.push({
              ...ct,
              customerName,
              grantName,
              caseManagerName,
              enrollmentName,
            });
          }
        }
      }

      const existing = Array.isArray(enr.taskSchedule)
        ? enr.taskSchedule
        : [];

      // Base set per mode
      let base: any[];
      if (mode === "mergeManaged") {
        base = existing.slice(); // overlay new managed by id
      } else {
        base = keepManual
          ? existing.filter((t: any) => {
              const did = String(t?.defId ?? "");
              return !did || (!defIds.has(did) && !isReplacedDefId(did));
            })
          : [];
      }

      // Indices for carry-over
      const idxById = new Map<string, any>();
      const idxByComposite = new Map<string, any>(); // defId|dueDate
      for (const t of existing) {
        const id = String(t?.id || "");
        if (id) idxById.set(id, t);
        const did = String(t?.defId ?? "");
        const dd = String(t?.dueDate ?? "");
        if (did && dd) idxByComposite.set(`${did}|${dd}`, t);
      }

      if (preserveCompletedManaged) {
        for (let i = 0; i < managedNew.length; i++) {
          const next = managedNew[i];
          const prev =
            idxById.get(String(next.id)) ||
            idxByComposite.get(
              `${String(next.defId || "")}|${String(
                next.dueDate || ""
              )}`
            );
          if (prev) managedNew[i] = carryStatus(prev, next);
        }
      }

      const map = new Map<string, any>();
      for (const t of base) map.set(String(t.id), t);
      for (const t of managedNew) map.set(String(t.id), t);
      const merged = Array.from(map.values());

      // Pin completed managed tasks that disappeared
      if (pinCompletedManaged) {
        const mergedById = new Set(
          merged.map((t: any) => String(t.id))
        );
        const mergedByComposite = new Set(
          merged
            .map((t: any) => {
              const did = String(t?.defId ?? "");
              const dd = String(t?.dueDate ?? "");
              return did && dd ? `${did}|${dd}` : "";
            })
            .filter(Boolean)
        );

        for (const prev of existing) {
          const did = String(prev?.defId ?? "");
          const dd = String(prev?.dueDate ?? "");
          const wasManaged = !!did && defIds.has(did);
          if (isReplacedDefId(did) && !defIds.has(did)) continue;
          if (!wasManaged) continue;

          const present =
            mergedById.has(String(prev.id)) ||
            (did &&
              dd &&
              mergedByComposite.has(`${did}|${dd}`));

          if (prev.completed && !present) merged.push({ ...prev });
        }
      }

      merged.sort((a: any, b: any) =>
        String(a.dueDate).localeCompare(String(b.dueDate))
      );

      const generatedManagedCount = managedNew.length;
      const zeroGeneratedNote =
        defs.length > 0 && generatedManagedCount === 0
          ? `No task occurrences generated. Check recurring start/end dates against enrollment dates (enrollment start: ${String(enr.startDate || "n/a")}, enrollment end: ${String(enr.endDate || "n/a")}).`
          : undefined;

      await enrRef.set(
        {
          taskSchedule: merged,
          taskStats: summarize(merged),
          ...(incomingDefs.length
            ? {
                taskScheduleMeta: {
                  version: 1,
                  defs,
                  savedAt: new Date().toISOString(),
                },
              }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        enrollmentId: eid,
        ok: true,
        total: merged.length,
        ...(zeroGeneratedNote ? { note: zeroGeneratedNote } : {}),
      });
    } catch (e: any) {
      results.push({
        enrollmentId: eid,
        ok: false,
        error: e?.message || String(e),
      });
    }
  }

  res.status(200).json({ ok: true, results });
}

export async function generateTaskScheduleForEnrollments(
  input: unknown,
  user: Record<string, unknown>,
): Promise<any[]> {
  let statusCode = 200;
  let payload: any = null;
  const req = { body: input, user } as unknown as Request;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as Response;

  await generateTaskScheduleWriteHandler(req, res);
  if (statusCode >= 400 || payload?.ok === false) {
    throw new Error(String(payload?.error || "task_schedule_generation_failed"));
  }
  return Array.isArray(payload?.results) ? payload.results : [];
}
