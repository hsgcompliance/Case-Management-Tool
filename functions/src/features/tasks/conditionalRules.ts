import { db } from "../../core";
import { generateOccurrences, iso10, slug } from "./utils";

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

function normPopulation(v: unknown): string {
  const s = String(v || "").trim().toLowerCase();
  if (s === "youth") return "Youth";
  if (s === "family" || s === "families") return "Family";
  if (s === "individual" || s === "individuals") return "Individual";
  return "";
}

function rulePopulations(rule: any): Set<string> {
  const raw = [
    rule?.population,
    ...(Array.isArray(rule?.populations) ? rule.populations : []),
  ];
  return new Set(raw.map(normPopulation).filter(Boolean));
}

/**
 * Evaluate grant.conditionalTaskRules and return managed reminder rows.
 *
 * This is the explicit-generator replacement for the old enrollment-created
 * trigger behavior. It supports existing one-off age/concurrent rules and
 * newer population/recurring notification rules.
 */
export async function evaluateConditionalTaskRules(
  enrollmentId: string,
  enrollment: any,
  grant: any,
  startDate: Date,
  cmUid: string | null,
): Promise<any[]> {
  const rules: any[] = Array.isArray(grant?.conditionalTaskRules)
    ? grant.conditionalTaskRules
    : [];
  if (!rules.length) return [];

  const customerId = String(enrollment?.customerId || enrollment?.clientId || "");

  let customer: any = null;
  try {
    const snap = customerId ? await db.collection("customers").doc(customerId).get() : null;
    if (snap?.exists) customer = snap.data() || {};
  } catch (_) {
    // Non-fatal. A missing customer should not block normal task generation.
  }

  let siblingEnrollments: any[] = [];
  try {
    const sibSnap = customerId
      ? await db
          .collection("customerEnrollments")
          .where("customerId", "==", customerId)
          .where("active", "==", true)
          .get()
      : null;
    siblingEnrollments = sibSnap
      ? sibSnap.docs
          .filter((d) => d.id !== enrollmentId)
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      : [];
  } catch (_) {
    // Non-fatal.
  }

  const extra: any[] = [];

  for (const rule of rules) {
    let conditionMet = false;

    if (rule?.type === "age") {
      const dob = customer?.dateOfBirth || customer?.dob || enrollment?.dateOfBirth || enrollment?.dob || null;
      if (dob) {
        const dobDate = new Date(dob);
        if (!Number.isNaN(dobDate.getTime())) {
          const age = ageInYears(dobDate, startDate);
          conditionMet = applyAgeOperator(age, String(rule.ageOperator || ">="), Number(rule.ageThreshold ?? 0));
        }
      }
    } else if (rule?.type === "population") {
      const wanted = rulePopulations(rule);
      const actual =
        normPopulation(enrollment?.population) ||
        normPopulation(customer?.population);
      conditionMet = !!actual && wanted.has(actual);
    } else if (rule?.type === "concurrent_enrollment") {
      const pattern = String(rule.programName || "").toLowerCase().trim();
      if (pattern) {
        conditionMet = siblingEnrollments.some((e) => {
          const name = String(e.grantName || e.name || "").toLowerCase();
          return name.includes(pattern);
        });
      }
    }

    if (!conditionMet) continue;

    const offsetDays = Number(rule.dueOffsetDays ?? 0) || 0;
    const anchor = new Date(startDate);
    anchor.setUTCDate(anchor.getUTCDate() + offsetDays);
    const anchorISO = iso10(anchor);
    const baseRuleId = String(rule.id || rule.taskName || "conditional");
    const taskDef = {
      id: `cond_${slug(baseRuleId)}`,
      name: String(rule.taskName || rule.name || "Conditional Reminder"),
      type: String(rule.taskName || rule.name || "Conditional Reminder"),
      kind: rule.kind || (rule.frequency ? "recurring" : "one-off"),
      frequency: rule.frequency || "monthly",
      every: rule.every || undefined,
      dueDate: rule.dueDate || anchorISO,
      startDate: rule.startDate || anchorISO,
      endDate: rule.endDate || enrollment?.endDate || undefined,
    };

    const occurrences = generateOccurrences(taskDef, anchorISO) || [];
    for (const occ of occurrences) {
      const dueDate = String(occ.dueDate || anchorISO).slice(0, 10);
      const dueMonth = dueDate.slice(0, 7);
      const group = String(rule.assignToGroup || "casemanager");
      const assignUid = group === "casemanager" ? cmUid : null;

      extra.push({
        id: occ.id || `cond_${slug(baseRuleId)}_${dueDate}`,
        type: occ.type || taskDef.name,
        defId: baseRuleId,
        dueDate,
        dueMonth,
        completed: false,
        completedAt: null,
        byUid: null,
        notify: rule.notify ?? true,
        notes: String(rule.taskNotes || rule.taskDescription || ""),
        description: String(rule.taskDescription || "").trim() || null,
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
  }

  return extra;
}
