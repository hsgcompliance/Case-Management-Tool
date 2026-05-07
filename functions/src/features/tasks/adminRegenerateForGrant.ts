//functions/src/features/tasks/adminRegenerateForGrant.ts
import { z, db, FieldValue, FieldPath, rolesFromClaims } from "../../core";
import type { Request, Response } from "express";
import { generateOccurrences, carryStatus, summarize, slug, resolveCaseManagerUid } from "./utils";
import { evaluateConditionalTaskRules } from "./conditionalRules";

/**
 * Admin-only: regenerate managed tasks for all enrollments in a grant.
 * Body:
 * {
 *   grantId: string,
 *   activeOnly?: boolean = true,
 *   keepManual?: boolean = true,
 *   mode?: 'replaceManaged'|'mergeManaged' = 'replaceManaged',
 *   preserveCompletedManaged?: boolean = true,
 *   pinCompletedManaged?: boolean = true,
 *   pageSize?: number = 200,
 *   dryRun?: boolean = false
 * }
 */
export async function adminRegenerateTasksForGrantHandler(
  req: Request,
  res: Response
): Promise<void> {
  const roles = rolesFromClaims((req as any).user || {});
  if (!roles.includes("admin")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const schema = z.object({
    grantId: z.string(),
    activeOnly: z.boolean().optional().default(true),
    keepManual: z.boolean().optional().default(true),
    mode: z
      .enum(["replaceManaged", "mergeManaged"])
      .optional()
      .default("replaceManaged"),
    preserveCompletedManaged: z.boolean().optional().default(true),
    pinCompletedManaged: z.boolean().optional().default(true),
    pageSize: z.number().int().min(1).max(1000).optional().default(200),
    dryRun: z.boolean().optional().default(false),
  });

  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ ok: false, error: parsed.error.message });
    return;
  }

  const {
    grantId,
    activeOnly,
    keepManual,
    mode,
    preserveCompletedManaged,
    pinCompletedManaged,
    pageSize,
    dryRun,
  } = parsed.data;

  // Load grant task defs (legacy field 'tasks')
  const gref = db.collection("grants").doc(grantId);
  const gsnap = await gref.get();
  if (!gsnap.exists) {
    res.status(404).json({ ok: false, error: "Grant not found" });
    return;
  }
  const grant: any = gsnap.data() || {};
  const defs = Array.isArray(grant?.tasks) ? grant.tasks : [];
  
  const conditionalRuleIds = Array.isArray(grant?.conditionalTaskRules)
    ? grant.conditionalTaskRules.map((r: any) => String(r.id || r.taskName || "conditional"))
    : [];
  const defIds = new Set([
    ...defs.map((d: any) => String(d.id || d.type || "custom")),
    ...conditionalRuleIds,
  ]);

  let q: FirebaseFirestore.Query = db
    .collection("customerEnrollments")
    .where("grantId", "==", grantId);
  // [inconsistent] migrate from legacy 'active' to 'enrolled'
  // Query uses 'enrolled == true' if activeOnly; if your data hasn’t been backfilled yet, keep legacy reads below.
  if (activeOnly) q = q.where("enrolled", "==", true);

  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const results: any[] = [];

  for (;;) {
    let qry = q.orderBy(FieldPath.documentId()).limit(pageSize);
    if (last) qry = qry.startAfter(last);

    const snap = await qry.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const eid = doc.id;
      const enr = doc.data() || {};
      const effStart = enr.startDate;
      if (!effStart) {
        results.push({
          enrollmentId: eid,
          ok: false,
          error: "Missing startDate",
        });
        continue;
      }

      // Closed? keep manual, nuke managed
      const isClosed =
        enr?.status === "closed" ||
        enr?.enrolled === false ||
        enr?.active === false;
      if (isClosed) {
        const existing = Array.isArray(enr.taskSchedule)
          ? enr.taskSchedule
          : [];
        const manual = keepManual
          ? existing.filter((t: any) => {
              const did = String(t?.defId ?? "");
              return !did || !defIds.has(did);
            })
          : [];
        const next = manual;
        const summary = summarize(next);
        if (!dryRun) {
          await doc.ref.set(
            {
              taskSchedule: next,
              taskStats: summary,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        results.push({
          enrollmentId: eid,
          ok: true,
          total: next.length,
          closed: true,
        });
        continue;
      }

      // Build new managed for all defs
      const managedNew: any[] = [];
      const customerRefId = String((enr as any).customerId || (enr as any).clientId || "").trim();
      const customerSnap =
        customerRefId
          ? await db.collection("customers").doc(customerRefId).get().catch(() => null)
          : null;
      const customerDoc = customerSnap?.exists ? (customerSnap.data() || {}) : {};

      const customerName =
        String((enr as any).customerName || (enr as any).clientName || "").trim() ||
        String((customerDoc as any).name || "").trim() ||
        `${String((customerDoc as any).firstName || "").trim()} ${String((customerDoc as any).lastName || "").trim()}`.trim() ||
        null;
      const grantName = String((enr as any).grantName || grant?.name || "").trim() || null;
      const caseManagerName =
        String((enr as any).caseManagerName || "").trim() ||
        String((customerDoc as any).caseManagerName || "").trim() ||
        null;
      const enrollmentName = String((enr as any).name || "").trim() || null;
      const cmUid = resolveCaseManagerUid(enr) || resolveCaseManagerUid(customerDoc); // default routing to CM; only visible if set

      for (const def of defs) {
        const defStart = String((def as any)?.startDate || "").slice(0, 10) || effStart;
        const raw = generateOccurrences(def, defStart) || [];

        const enrEnd = enr.endDate ? new Date(enr.endDate) : null;
        const defEnd = def.endDate ? new Date(def.endDate) : null;
        const cutoff =
          [enrEnd, defEnd]
            .filter(Boolean)
            .sort((a: any, b: any) => +a - +b)[0] || null;

        const key = slug(def.id || def.type || def.name);
        const multiRaw = (def as any)?.multiparty;
        const hasMultiSteps =
          multiRaw && Array.isArray(multiRaw.steps) && multiRaw.steps.length > 0;

        const occurrences = raw.filter(
          (t: any) => !cutoff || new Date(t.dueDate) <= cutoff
        );

        for (const occ of occurrences) {
          const dueDate = occ.dueDate;
          const dueMonth = String(dueDate).slice(0, 7);
          const baseId = occ.id || `task_${key}_${dueDate}`;
          const type = occ.type || def.name || "Task";

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
              description: String((def as any)?.description || "").trim() || null,
              bucket: def.bucket || "task",
              managed: true,
              customerName,
              grantName,
              caseManagerName,
              enrollmentName,

              assignedToGroup: ownerGroup,
              assignedToUid: ownerUid,
              assignedAt: ownerUid ? new Date().toISOString() : null,
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
                description: String((def as any)?.description || "").trim() || null,
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

      const conditionalTasks = await evaluateConditionalTaskRules(
        eid,
        enr,
        grant,
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

      const existing = Array.isArray(enr.taskSchedule)
        ? enr.taskSchedule
        : [];

      // Base set per mode
      let base: any[];
      if (mode === "mergeManaged") {
        base = existing.slice();
      } else {
        base = keepManual
          ? existing.filter((t: any) => {
              const did = String(t?.defId ?? "");
              return !did || !defIds.has(did);
            })
          : [];
      }

      // Carry status
      const idxById = new Map<string, any>();
      const idxByComposite = new Map<string, any>();
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
          if (!wasManaged) continue;

          const present =
            mergedById.has(String(prev.id)) ||
            (did &&
              dd &&
              mergedByComposite.has(`${did}|${dd}`));

          if (prev.completed && !present) {
            merged.push({ ...prev });
          }
        }
      }

      merged.sort((a: any, b: any) =>
        String(a.dueDate).localeCompare(String(b.dueDate))
      );

      if (!dryRun) {
        await doc.ref.set(
          {
            taskSchedule: merged,
            taskStats: summarize(merged),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      results.push({
        enrollmentId: eid,
        ok: true,
        total: merged.length,
      });
    }

    last = snap.docs[snap.docs.length - 1] || null;
    if (snap.size < pageSize) break;
  }

  res
    .status(200)
    .json({ ok: true, count: results.length, results });
}
