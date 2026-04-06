//functions/src/features/tasks/triggers.ts
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME, isoNow } from "../../core";
import {
  generateOccurrences,
  summarize,
  slug,
  iso10,
  addMonths,
  addYears,
  lastDayOfMonthISO,
  resolveCaseManagerUid,
} from "./utils";

/* -------------------------------------------------------------------------- */
/*                                FIRESTORE TRIGGERS                          */
/* -------------------------------------------------------------------------- */

/**
 * New: when an enrollment is created → build task.
 *
 * Server-side integrity:
 *  - if both enrollment & grant have orgId and they differ → bail (no tasks written)
 *
 * startDate = enrollment.startDate (or today)
 * endDate:
 *   - if months/assistanceMonths provided → last day of that month window
 *   - else default +1 year
 */
// ─── Conditional task rule helpers ───────────────────────────────────────────

/** Compute full years between two dates */
function ageInYears(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

function applyAgeOperator(age: number, op: string, threshold: number): boolean {
  if (op === ">=") return age >= threshold;
  if (op === "<=") return age <= threshold;
  if (op === ">") return age > threshold;
  if (op === "<") return age < threshold;
  return false;
}

/**
 * Evaluate grant.conditionalTaskRules and produce additional task items.
 * Fetches customer doc (DOB) and sibling enrollments (concurrent_enrollment).
 * Errors are swallowed so they never block the main task build.
 */
async function evaluateConditionalRules(
  enrollmentId: string,
  enrollment: any,
  grant: any,
  startDate: Date,
  cmUid: string | null,
): Promise<any[]> {
  const rules: any[] = Array.isArray(grant.conditionalTaskRules)
    ? grant.conditionalTaskRules
    : [];
  if (rules.length === 0) return [];

  const customerId = String(enrollment.customerId || "");

  // Fetch customer doc once (needed for age rules)
  let customer: any = null;
  try {
    const snap = await db.collection("customers").doc(customerId).get();
    if (snap.exists) customer = snap.data() || {};
  } catch (_) { /* non-fatal */ }

  // Fetch sibling enrollments once (needed for concurrent_enrollment rules)
  let siblingEnrollments: any[] = [];
  try {
    const sibSnap = await db
      .collection("customerEnrollments")
      .where("customerId", "==", customerId)
      .where("active", "==", true)
      .get();
    siblingEnrollments = sibSnap.docs
      .filter((d) => d.id !== enrollmentId)
      .map((d) => ({ id: d.id, ...(d.data() || {}) }));
  } catch (_) { /* non-fatal */ }

  const extra: any[] = [];

  for (const rule of rules) {
    let conditionMet = false;

    if (rule.type === "age") {
      const dob = customer?.dateOfBirth || customer?.dob || null;
      if (dob) {
        const dobDate = new Date(dob);
        if (!Number.isNaN(dobDate.getTime())) {
          const age = ageInYears(dobDate, startDate);
          conditionMet = applyAgeOperator(age, String(rule.ageOperator || ">="), Number(rule.ageThreshold ?? 0));
        }
      }
    } else if (rule.type === "concurrent_enrollment") {
      const pattern = String(rule.programName || "").toLowerCase().trim();
      if (pattern) {
        conditionMet = siblingEnrollments.some((e) => {
          const name = String(e.grantName || e.name || "").toLowerCase();
          return name.includes(pattern);
        });
      }
    }

    if (!conditionMet) continue;

    // Build due date
    const offsetDays = Number(rule.dueOffsetDays ?? 0) || 0;
    const dueDate = new Date(startDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + offsetDays);
    const dueDateStr = iso10(dueDate);
    const dueMonth = dueDateStr.slice(0, 7);

    const taskId = `cond_${slug(rule.id)}_${dueDateStr}`;
    const group = String(rule.assignToGroup || "casemanager");
    const assignUid = group === "casemanager" ? cmUid : null;

    extra.push({
      id: taskId,
      type: String(rule.taskName || "Conditional Task"),
      defId: rule.id,
      dueDate: dueDateStr,
      dueMonth,
      completed: false,
      completedAt: null,
      byUid: null,
      notify: true,
      notes: String(rule.taskNotes || rule.taskDescription || ""),
      bucket: String(rule.taskBucket || "task"),
      managed: true,
      conditionalRuleId: rule.id,
      conditionalRuleType: rule.type,
      assignedToGroup: group,
      assignedToUid: assignUid,
      assignedAt: assignUid ? new Date().toISOString() : null,
      assignedBy: assignUid ? "system" : null,
    });
  }

  return extra;
}

export const onEnrollmentBuildTasks = onDocumentCreated(
  { region: RUNTIME.region, document: "customerEnrollments/{id}" },
  async (event) => {
    const eid = String(event.params.id);
    const after = (event.data?.data() as any) || {};

    // Respect the generateTaskSchedule flag — default true when absent
    const generateTaskSchedule = after.generateTaskSchedule !== false;

    const start = new Date(after.startDate || Date.now());

    // compute endDate if missing
    let endISO = String(after.endDate || "");
    if (!endISO) {
      const months = Number(
        after.assistanceMonths ?? after.months ?? 0
      );
      if (Number.isFinite(months) && months > 0) {
        const endM = addMonths(start, months - 1);
        endISO = lastDayOfMonthISO(
          endM.getUTCFullYear(),
          endM.getUTCMonth()
        );
      } else {
        endISO = iso10(addYears(start, 1));
      }
      await db
        .collection("customerEnrollments")
        .doc(eid)
        .set({ endDate: endISO }, { merge: true });
    }

    // find grant defs
    if (!after.grantId) return;
    const gsnap = await db
      .collection("grants")
      .doc(String(after.grantId))
      .get();
    if (!gsnap.exists) return;
    const grant: any = gsnap.data() || {};

    // org consistency gate (internal)
    const enrOrg =
      after.orgId ||
      after.orgID ||
      after.organizationId ||
      after.org ||
      null;
    const grantOrg =
      grant.orgId ||
      grant.orgID ||
      grant.organizationId ||
      grant.org ||
      null;
    if (
      enrOrg &&
      grantOrg &&
      String(enrOrg) !== String(grantOrg)
    ) {
      return;
    }

    const cmUid = resolveCaseManagerUid(after);

    // ── Early exit when nothing to build ─────────────────────────────────────
    const hasDefs = generateTaskSchedule && Array.isArray(grant.tasks) && grant.tasks.length > 0;
    const hasRules = Array.isArray(grant.conditionalTaskRules) && grant.conditionalTaskRules.length > 0;
    if (!hasDefs && !hasRules) return;

    // ── Regular task schedule (only when flag is on) ──────────────────────────
    const defs: any[] = generateTaskSchedule && Array.isArray(grant.tasks)
      ? grant.tasks
      : [];

    const managed: any[] = [];

    for (const def of defs) {
      const defStart = String((def as any)?.startDate || "").slice(0, 10) || iso10(start);
      const raw =
        generateOccurrences(def, defStart) || [];
      const enrEnd = endISO ? new Date(endISO) : null;
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
          managed.push({
            id: baseId,
            type,
            defId: def.id || def.type || "custom",
            dueDate,
            dueMonth,
            completed: false,
            completedAt: null,
            byUid: null,
            notify: def.notify ?? true,
            notes: "",
            bucket: def.bucket || "task",
            managed: true,

            assignedToGroup: "casemanager",
            assignedToUid: cmUid,
            assignedAt: cmUid
              ? new Date().toISOString()
              : null,
            assignedBy: cmUid ? "system" : null,
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

            managed.push({
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
              bucket: def.bucket || "task",
              managed: true,

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

    // ── Conditional task rules ─────────────────────────────────────────────────
    const conditionalTasks = await evaluateConditionalRules(eid, after, grant, start, cmUid);
    for (const ct of conditionalTasks) {
      // Avoid duplicates if the same rule id already built a regular task
      if (!managed.some((m: any) => m.id === ct.id)) {
        managed.push(ct);
      }
    }

    managed.sort((a: any, b: any) =>
      String(a.dueDate).localeCompare(String(b.dueDate))
    );

    if (managed.length === 0) return;

    await db
      .collection("customerEnrollments")
      .doc(eid)
      .set(
        {
          taskSchedule: managed,
          taskStats: summarize(managed),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
);

/**
 * Existing: When CM changes or schedule changes, normalize 'casemanager' tasks
 * so their assignedToUid follows enrollment.caseManagerId.
 */
export const onEnrollmentAutoAssignCM = onDocumentUpdated(
  { region: RUNTIME.region, document: "customerEnrollments/{id}" },
  async (event) => {
    // Temporarily disabled — CM auto-assign not needed right now
    return;
    const before = (event.data?.before?.data() as any) || {};
    const after = (event.data?.after?.data() as any) || {};
    const id = String(event.params.id);

    const cmBefore = before.caseManagerId || null;
    const cmAfter = after.caseManagerId || null;

    const curr = Array.isArray(after.taskSchedule)
      ? after.taskSchedule
      : [];
    const cmChanged = cmBefore !== cmAfter;

    // Only touch tasks owned by 'casemanager' when assignment truly changes.
    // Safety: if cmAfter is null and task already has null UID, do not rewrite
    // assignedAt/assignedBy (prevents self-trigger loops).
    let touched = false;
    const next = curr.map((t: any) => {
      const group = t?.assignedToGroup || null;
      const currentUid = t?.assignedToUid || null;
      const legacyCmOwned = !group && cmBefore && currentUid === cmBefore;
      if (group !== "casemanager" && !legacyCmOwned) return t;
      const needs = cmChanged
        ? currentUid !== cmAfter
        : !!cmAfter && currentUid !== cmAfter;
      if (!needs) return t;
      touched = true;
      return {
        ...t,
        assignedToGroup: "casemanager",
        assignedToUid: cmAfter || null,
        assignedAt: new Date().toISOString(),
        assignedBy: "system",
      };
    });

    if (!touched) return;

    await db
      .collection("customerEnrollments")
      .doc(id)
      .set(
        {
          taskSchedule: next,
          taskStats: summarize(next),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
);

const FN_OTHER_TASK_INDEXER = "onOtherTaskWrite";

/**
 * Index otherTasks into userTasks so they appear in useMyInbox / inboxWorkloadList.
 *
 * utid format: `other|{docId}`
 *
 * assignedToUid = first element of assignedToUids (array on otherTasks).
 * Second+ assignees are stored in assignedToUids passthrough so the frontend
 * can surface them, but the scalar assignedToUid drives inbox bucketing.
 */
export const onOtherTaskWrite = onDocumentWritten(
  { region: RUNTIME.region, document: "otherTasks/{id}" },
  async (event) => {
    const id = String(event.params.id);
    const utid = `other|${id}`;
    const ref = db.collection("userTasks").doc(utid);

    // Hard delete → close inbox item
    if (!event.data?.after?.exists) {
      const existing = await ref.get();
      if (existing.exists) {
        await ref.set(
          { status: "done", completedAtISO: isoNow(), updatedAtISO: isoNow() },
          { merge: true }
        );
      }
      return;
    }

    const doc = (event.data?.after?.data() as any) || {};
    const orgId = String(doc.orgId || "") || null;

    const assignedToUids: string[] = Array.isArray(doc.assignedToUids)
      ? (doc.assignedToUids as string[]).filter((x) => !!String(x || "").trim())
      : [];
    const assignedToUid = assignedToUids.length ? assignedToUids[0] : null;
    const assignedToGroup = doc.assignedToGroup || (assignedToUid ? "casemanager" : null);

    const due = String(doc.dueDate || "") || null;
    const dueMonth = String(doc.dueMonth || (due ? due.slice(0, 7) : "")) || null;

    const status =
      doc.completed === true || String(doc.status || "").toLowerCase() === "done"
        ? "done"
        : "open";

    await ref.set(
      {
        utid,
        source: "other",
        status,
        orgId,
        teamIds: orgId ? [orgId] : [],
        sourcePath: `otherTasks/${id}`,
        sourceId: id,
        dueDate: due,
        dueMonth,
        assignedToUid,
        assignedToGroup,
        // Passthrough so CaseManagerLoadTool / other| resolution works
        assignedToUids,
        cmUid: null,
        notify: typeof doc.notify === "boolean" ? doc.notify : true,
        title: String(doc.title || "Task"),
        note: doc.notes || null,
        notes: doc.notes || null,
        labels: [],
        completedAtISO: doc.completedAt || null,
        createdAtISO: doc.createdAtISO || null,
        updatedAtISO: isoNow(),
        system: {
          lastWriter: FN_OTHER_TASK_INDEXER,
          lastWriteAt: isoNow(),
        },
      },
      { merge: true }
    );
  }
);
