// functions/src/features/grants/service.ts
import { randomUUID as uuid } from "node:crypto";
import {
  db,
  FieldValue,
  withTxn,
  sanitizeNestedObject,
  stripReservedFields,
  normId,
  orgIdFromClaims,
  requireOrg,
  isDev,
  newBulkWriter,
  fromBudgetCents,
  toBudgetCents,
  type Claims,
} from "../../core";
import { syncEnrollmentProjectionQueueItems } from "../paymentQueue/service";
import { buildEnrollmentClosePreview } from "@hdb/contracts/enrollments";
import { computeGrantLineItemOverCap } from "@hdb/contracts";
import { deleteEnrollmentsCore } from "../enrollments/delete";
import {
  deriveMaxAssistanceSnapshot,
} from "../enrollments/defaults";
import {
  Grant,
  GrantPatchBody,
  GrantUpsertBody,
  TGrant,
  TGrantBudget,
  normalizeGrantFinancialConfig,
  normalizeGrantComplianceConfig,
  normalizeGrantDriveTemplates,
  shouldRetainGrantBudget,
  parseGrantMaxAssistanceMonths,
  toArray,
} from "./schemas";
import { copyCyclePipelineConfiguration } from "./cyclePipelineCopy";

/* ---------------- Budget helpers (server-derived totals) ---------------- */

function sum(nums: number[]) {
  return fromBudgetCents(nums.reduce((a, b) => a + toBudgetCents(b), 0));
}

function slugifyLineItemType(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLineItemType(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") {
    const label = value.trim();
    if (!label || ["na", "n/a", "none", "null"].includes(label.toLowerCase())) return null;
    return { id: slugifyLineItemType(label), label };
  }
  if (typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const label = String(raw.label ?? raw.name ?? raw.id ?? "").trim();
  if (!label || ["na", "n/a", "none", "null"].includes(label.toLowerCase())) return null;
  const id = String(raw.id ?? "").trim() || slugifyLineItemType(label);
  return {
    ...raw,
    id,
    label,
  };
}

type BudgetWindow = { startDate?: unknown; endDate?: unknown };

function iso10(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const d = new Date(value as never);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function monthEnd(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

function splitMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(mode: "monthly" | "quarterly", start: string, index: number) {
  if (mode === "monthly") return splitMonthKey(new Date(`${start}T00:00:00.000Z`));
  return `Q${index + 1}`;
}

function generateEvenSplitGoals(args: {
  mode: "monthly" | "quarterly";
  amount: number;
  startDate: string;
  endDate: string;
}) {
  const start = new Date(`${args.startDate}T00:00:00.000Z`);
  const end = new Date(`${args.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const periods: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const step = args.mode === "monthly" ? 1 : 3;

  while (cursor <= endCursor && periods.length < 240) {
    const periodStart = cursor.toISOString().slice(0, 10) < args.startDate
      ? args.startDate
      : cursor.toISOString().slice(0, 10);
    const rawEnd = monthEnd(cursor.getUTCFullYear(), cursor.getUTCMonth() + step - 1);
    const periodEnd = rawEnd > args.endDate ? args.endDate : rawEnd;
    periods.push({ startDate: periodStart, endDate: periodEnd });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1));
  }

  if (!periods.length) return [];
  const totalCents = toBudgetCents(args.amount);
  const base = Math.trunc(totalCents / periods.length);
  let remainder = totalCents - base * periods.length;
  return periods.map((period, index) => {
    const extra = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    remainder -= extra;
    return {
      id: `${args.mode}_${period.startDate}_${period.endDate}`,
      label: periodLabel(args.mode, period.startDate, index),
      ...period,
      amount: fromBudgetCents(base + extra),
      spent: 0,
      projected: 0,
      balance: fromBudgetCents(base + extra),
      projectedBalance: fromBudgetCents(base + extra),
    };
  });
}

function normalizeSplitGoals(
  li: Record<string, any>,
  window?: BudgetWindow,
) {
  const modeRaw = String(li.splitMode || "none").trim();
  const splitMode = (["fixed", "monthly", "quarterly", "custom"].includes(modeRaw) ? modeRaw : "none") as "none" | "fixed" | "monthly" | "quarterly" | "custom";
  const rollRaw = String(li.rollForward || "none").trim();
  const rollForward = (["rollToNext", "rollToEnd", "rebalanceFuture", "manual"].includes(rollRaw)
    ? rollRaw
    : "none") as "none" | "rollToNext" | "rollToEnd" | "rebalanceFuture" | "manual";
  const amount = Number(li.amount || 0);
  const splitStartDate = iso10(li.splitStartDate || window?.startDate);
  const splitEndDate = iso10(li.splitEndDate || window?.endDate);
  const rawGoals = Array.isArray(li.splitGoals) ? li.splitGoals : [];

  let goals = rawGoals.map((goal: Record<string, any>, index: number) => {
    const goalAmount = Number(goal?.amount || 0);
    const spent = Number(goal?.spent || 0);
    const projected = Number(goal?.projected || 0);
    return {
      ...goal,
      id: String(goal?.id || `split_${index + 1}`).trim(),
      label: String(goal?.label || goal?.name || `Cycle ${index + 1}`).trim(),
      startDate: iso10(goal?.startDate),
      endDate: iso10(goal?.endDate),
      amount: Number.isFinite(goalAmount) ? goalAmount : 0,
      spent: Number.isFinite(spent) ? spent : 0,
      projected: Number.isFinite(projected) ? projected : 0,
      balance: fromBudgetCents(toBudgetCents(goalAmount) - toBudgetCents(spent)),
      projectedBalance: fromBudgetCents(toBudgetCents(goalAmount) - toBudgetCents(spent) - toBudgetCents(projected)),
    };
  });

  if ((splitMode === "monthly" || splitMode === "quarterly") && splitStartDate && splitEndDate) {
    const currentKey = goals.map((goal) => `${goal.startDate}:${goal.endDate}:${goal.amount}`).join("|");
    const generated = generateEvenSplitGoals({ mode: splitMode, amount, startDate: splitStartDate, endDate: splitEndDate });
    const generatedKey = generated.map((goal) => `${goal.startDate}:${goal.endDate}:${goal.amount}`).join("|");
    if (!goals.length || currentKey !== generatedKey) goals = generated;
  }

  const splitTotal = sum(goals.map((goal) => goal.amount));
  const variance = fromBudgetCents(toBudgetCents(amount) - toBudgetCents(splitTotal));
  const needsTotalWarning = splitMode !== "none" && goals.length > 0 && Math.abs(toBudgetCents(variance)) > 0;
  const needsDateWarning = splitMode !== "none" && goals.some((goal) => !goal.startDate || !goal.endDate);

  return {
    splitMode,
    rollForward,
    splitStartDate: splitStartDate || null,
    splitEndDate: splitEndDate || null,
    splitGoals: goals,
    breakdownValidation: splitMode === "none"
      ? { status: "ok" as const, splitTotal: 0, variance: amount }
      : {
          status: needsTotalWarning || needsDateWarning ? "warning" as const : "ok" as const,
          splitTotal,
          variance,
          ...(needsDateWarning
            ? { message: "One or more split goals is missing a date range." }
            : needsTotalWarning
            ? { message: "Split goal total does not match the line item budget." }
            : {}),
        },
  };
}

function preserveStoredSplitActuals(
  patchLineItem: Record<string, unknown>,
  storedLineItem: Record<string, unknown>,
) {
  const patchGoals = Array.isArray(patchLineItem.splitGoals) ? patchLineItem.splitGoals : [];
  const storedGoals = Array.isArray(storedLineItem.splitGoals) ? storedLineItem.splitGoals : [];
  if (!patchGoals.length || !storedGoals.length) return patchLineItem;
  const storedById = new Map(storedGoals.map((goal: any) => [String(goal?.id || ""), goal]));
  return {
    ...patchLineItem,
    splitGoals: patchGoals.map((goal: any) => {
      const stored = storedById.get(String(goal?.id || ""));
      if (!stored) return goal;
      return {
        ...goal,
        spent: stored.spent ?? 0,
        projected: stored.projected ?? 0,
        balance: stored.balance,
        projectedBalance: stored.projectedBalance,
      };
    }),
  };
}

export function normalizeBudget(
  input?: TGrantBudget | null,
  window?: BudgetWindow,
): TGrantBudget | null {
  if (!input) return null;

  const items: any[] = (Array.isArray(input.lineItems) ? input.lineItems : []).map(
    (li) => {
      const base = {
        ...li,
        id: li.id || uuid(),
        label: li.label ?? null,
        amount: Number(li.amount || 0),

        // totals across all time (these are inputs here; rollups may overwrite elsewhere)
        projected: Number(li.projected || 0),
        spent: Number(li.spent || 0),

        // windowed tallies default to 0 if missing
        projectedInWindow: Number(li.projectedInWindow || 0),
        spentInWindow: Number(li.spentInWindow || 0),

        locked: li.locked ?? null,

        type: normalizeLineItemType(li.type),

        // per-customer cap (optional, pass through as-is)
        ...(li.capEnabled !== undefined ? { capEnabled: li.capEnabled } : { capEnabled: false }),
        ...(li.perCustomerCap != null ? { perCustomerCap: Number(li.perCustomerCap) } : {}),
      };
      return {
        ...base,
        ...normalizeSplitGoals(base, window),
      };
    },
  );

  const capFromItems = sum(items.map((i) => i.amount));
  const total = Number(input.total ?? NaN);
  const totalCap = Number.isFinite(total) && total >= 0 ? total : capFromItems;

  const projected = sum(items.map((i) => i.projected));
  const spent = sum(items.map((i) => i.spent));
  const totalCapCents = toBudgetCents(totalCap);
  const spentCents = toBudgetCents(spent);
  const projectedCents = toBudgetCents(projected);
  const balance = fromBudgetCents(totalCapCents - spentCents);
  const projectedBalance = fromBudgetCents(totalCapCents - spentCents - projectedCents);

  const projectedInWindow = sum(items.map((i) => i.projectedInWindow || 0));
  const spentInWindow = sum(items.map((i) => i.spentInWindow || 0));
  const spentInWindowCents = toBudgetCents(spentInWindow);
  const projectedInWindowCents = toBudgetCents(projectedInWindow);
  const windowBalance = fromBudgetCents(totalCapCents - spentInWindowCents);
  const windowProjectedBalance = fromBudgetCents(totalCapCents - spentInWindowCents - projectedInWindowCents);

  const totals = {
    total: totalCap,
    projected,
    spent,
    balance,
    projectedBalance,
    projectedSpend: fromBudgetCents(spentCents + projectedCents),
    remaining: balance, // compat alias
    projectedInWindow,
    spentInWindow,
    windowBalance,
    windowProjectedBalance,
  };

  const out: TGrantBudget = {
    total: totalCap,
    totals,
    lineItems: items,
  };

  if (input.allocationEnabled !== undefined) {
    out.allocationEnabled = input.allocationEnabled === true;
  }
  if (input.perCustomerCap !== undefined) {
    out.perCustomerCap =
      input.perCustomerCap == null ? null : Number(input.perCustomerCap);
  }
  if (input.createdAt != null) out.createdAt = input.createdAt;
  if (input.updatedAt != null) out.updatedAt = input.updatedAt;
  if ((input as Record<string, unknown>).digestDisplay !== undefined) {
    (out as Record<string, unknown>).digestDisplay = sanitizeNestedObject((input as Record<string, unknown>).digestDisplay);
  }

  return out;
}

const cleanExtras = (v: Record<string, unknown> | null | undefined) =>
  v
    ? sanitizeNestedObject(stripReservedFields(v as Record<string, unknown>))
    : null;

const cleanGrantTasks = (v: TGrant["tasks"] | null | undefined): TGrant["tasks"] | null => {
  if (Array.isArray(v)) return sanitizeNestedObject(v) as TGrant["tasks"];
  return cleanExtras(v as Record<string, unknown> | null | undefined) as TGrant["tasks"] | null;
};

/* ---------------- Reserved keys (server-owned / protected) ---------------- */

const RESERVED = new Set<string>([
  "id",
  "orgId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "_tags",
  "active",
  "deleted",
  "system",
]);

function isReserved(k: string) {
  return RESERVED.has(k) || k.startsWith("_");
}

function hasOwn(obj: unknown, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeFinancialConfigForDecision(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
  unset: string[] | undefined,
) {
  if (patch.financialConfig === null) return null;
  const clearsFinancialConfig = Array.isArray(unset) && unset.includes("financialConfig");
  const prevConfig = !clearsFinancialConfig && isPlainObject(prev.financialConfig) ? prev.financialConfig : {};
  const patchConfig = isPlainObject(patch.financialConfig) ? patch.financialConfig : {};
  if (!Object.keys(prevConfig).length && !Object.keys(patchConfig).length) return undefined;
  return { ...prevConfig, ...patchConfig };
}

function grantDecisionInput(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
  kind: TGrant["kind"],
  unset?: string[],
) {
  const financialConfig = mergeFinancialConfigForDecision(prev, patch, unset);
  return {
    ...prev,
    ...patch,
    kind,
    ...(financialConfig === undefined ? {} : { financialConfig }),
  };
}

function isReservedRouteId(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
}

const KNOWN_GRANT_FIELDS = new Set<string>([
  "id",
  "orgId",
  "name",
  "status",
  "active",
  "deleted",
  "kind",
  "financialConfig",
  "duration",
  "lengthOfAssistance",
  "maxAssistanceMonths",
  "startDate",
  "endDate",
  "budget",
  "taskTypes",
  "tasks",
  "complianceConfig",
  "driveTemplates",
  "conditionalTaskRules",
  "pins",
  "invoicing",
  "invoiceDocuments",
  "linking",
  "levelOfAssistance",
  "programIds",
  "fundingGrantIds",
  "relatedProgramIds",
  "relatedGrantIds",
  "meta",
  "createdAt",
  "updatedAt",
]);

function cleanTopLevelExtras(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (KNOWN_GRANT_FIELDS.has(key) || isReserved(key) || value === undefined) continue;
    out[key] = sanitizeNestedObject(value);
  }
  return out;
}

function patchTouchesMaxAssistance(
  patch: Record<string, unknown>,
  unset?: string[],
): boolean {
  return (
    hasOwn(patch, "maxAssistanceMonths") ||
    hasOwn(patch, "lengthOfAssistance") ||
    hasOwn(patch, "maxLengthOfAssistance") ||
    hasOwn(patch, "maximumLengthOfAssistance") ||
    (Array.isArray(unset) &&
      unset.some((key) =>
        ["maxAssistanceMonths", "lengthOfAssistance", "maxLengthOfAssistance", "maximumLengthOfAssistance"].includes(String(key || "")),
      ))
  );
}

async function syncGrantMaxAssistanceToActiveEnrollments(grantId: string) {
  const grantSnap = await db.collection("grants").doc(grantId).get();
  if (!grantSnap.exists) return { scanned: 0, updated: 0 };
  const grant = (grantSnap.data() || {}) as Record<string, any>;
  const snap = await db
    .collection("customerEnrollments")
    .where("grantId", "==", grantId)
    .where("active", "==", true)
    .get();
  if (snap.empty) return { scanned: 0, updated: 0 };

  const writer = newBulkWriter(2);
  let updated = 0;
  for (const doc of snap.docs) {
    const enrollment = (doc.data() || {}) as Record<string, any>;
    const status = String(enrollment.status || "").toLowerCase();
    if (enrollment.deleted === true || status === "deleted" || status === "closed") continue;
    const next = deriveMaxAssistanceSnapshot(enrollment, grant);
    writer.set(
      doc.ref,
      {
        ...next,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    updated += 1;
  }
  await writer.close();
  return { scanned: snap.size, updated };
}

/* ---------------- Program/Grant coherence ---------------- */

type Kind = "grant" | "program";

/** Canonicalize kind (default to grant if not specified). */
function canonicalKind(prev: Partial<TGrant>, patch: Partial<TGrant>): Kind {
  const rawKind = String(patch?.kind ?? prev?.kind ?? "")
    .trim()
    .toLowerCase();
  return rawKind === "program" ? "program" : "grant";
}

/* ---------------- Org access helpers ---------------- */

function assertTargetOrgAllowed(caller: Claims, targetOrg: string) {
  const callerOrg = orgIdFromClaims(caller);
  const t = normId(targetOrg);

  if (callerOrg && normId(callerOrg) !== t && !isDev(caller)) {
    const e = new Error("forbidden_cross_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { callerOrg: normId(callerOrg), targetOrg: t };
    throw e;
  }

  // Non-devs must have an org. (Dev may pass explicit targetOrg.)
  if (!callerOrg && !isDev(caller)) {
    requireOrg(caller);
  }
}

function assertDocOrgWritable(
  caller: Claims,
  targetOrg: string,
  doc: { orgId?: unknown } | null | undefined,
) {
  const docOrg = normId(doc?.orgId);
  const t = normId(targetOrg);

  if (docOrg && docOrg !== t && !isDev(caller)) {
    const e = new Error("forbidden_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { docOrg, targetOrg: t };
    throw e;
  }
}

/* ---------------- Patch sanitizer ---------------- */

function sanitizeGrantPatch(patch: Partial<TGrant>): Partial<TGrant> {
  const out: Partial<TGrant> = { ...(patch || {}) };

  // Strip server-owned / protected keys
  for (const k of Object.keys(out)) {
    if (isReserved(k)) delete out[k];
  }

  // Never accept client-set createdAt/updatedAt (even if not caught above)
  if ("createdAt" in out) delete out.createdAt;
  if ("updatedAt" in out) delete out.updatedAt;

  if (out.tasks !== undefined) out.tasks = cleanGrantTasks(out.tasks);
  if (out.driveTemplates !== undefined) {
    out.driveTemplates = normalizeGrantDriveTemplates(out.driveTemplates) as Partial<TGrant>["driveTemplates"];
  }
  if (out.meta !== undefined) out.meta = cleanExtras(out.meta);
  if (
    out.budget !== undefined &&
    out.budget !== null &&
    typeof out.budget === "object" &&
    !Array.isArray(out.budget)
  ) {
    const budget = { ...(out.budget as Record<string, unknown>) };
    delete budget.createdAt;
    delete budget.updatedAt;
    out.budget = budget as TGrantBudget;
  }

  return out;
}

function assertNoSelfLinks(id: string, linking: unknown) {
  if (!isPlainObject(linking)) return;
  const cycle = isPlainObject(linking.cycle) ? linking.cycle : {};
  const targets: unknown[] = [cycle.previousGrantId, cycle.nextGrantId];
  const requirement = isPlainObject(linking.enrollmentRequirement) ? linking.enrollmentRequirement : {};
  if (Array.isArray(requirement.targetGrantIds)) targets.push(...requirement.targetGrantIds);
  for (const rule of Array.isArray(linking.enrollmentRules) ? linking.enrollmentRules : []) {
    if (isPlainObject(rule)) targets.push(rule.targetGrantId);
  }
  if (targets.some((target) => normId(target) === id)) {
    const error = new Error("grant_link_cannot_reference_self") as Error & { code: number };
    error.code = 400;
    throw error;
  }
}

async function syncCycleReciprocal(ids: string[], targetOrg: string) {
  for (const id of ids) {
    const snap = await db.collection("grants").doc(id).get();
    if (!snap.exists) continue;
    const grant = snap.data() || {};
    const cycle = isPlainObject(grant?.linking?.cycle) ? grant.linking.cycle : {};
    const previousGrantId = normId(cycle.previousGrantId);
    if (previousGrantId) await copyCyclePipelineConfiguration(previousGrantId, id, targetOrg);
    for (const [rawTarget, reciprocalField] of [
      [cycle.nextGrantId, "previousGrantId"],
      [cycle.previousGrantId, "nextGrantId"],
    ] as Array<[unknown, string]>) {
      const targetId = normId(rawTarget);
      if (!targetId) continue;
      const direction = reciprocalField === "previousGrantId" ? "nextGrantId" : "previousGrantId";
      const targetRef = db.collection("grants").doc(targetId);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        await db.collection("grants").doc(id).update(`linking.cycle.${direction}`, null);
        throw Object.assign(new Error("linked_grant_not_found"), { code: 400 });
      }
      const target = targetSnap.data() || {};
      if (normId(target.orgId) && normId(target.orgId) !== normId(targetOrg)) {
        await db.collection("grants").doc(id).update(`linking.cycle.${direction}`, null);
        throw Object.assign(new Error("linked_grant_cross_org"), { code: 403 });
      }
      let cursor = targetId;
      const visited = new Set<string>();
      while (cursor && !visited.has(cursor)) {
        if (cursor === id) {
          await db.collection("grants").doc(id).update(`linking.cycle.${direction}`, null);
          throw Object.assign(new Error("grant_cycle_loop_detected"), { code: 400 });
        }
        visited.add(cursor);
        const cursorSnap = cursor === targetId ? targetSnap : await db.collection("grants").doc(cursor).get();
        cursor = normId((cursorSnap.data() as any)?.linking?.cycle?.[direction]);
      }
      await targetRef.set({
        linking: {
          ...(isPlainObject(target.linking) ? target.linking : {}),
          cycle: {
            ...(isPlainObject(target?.linking?.cycle) ? target.linking.cycle : {}),
            [reciprocalField]: id,
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}

async function clearRemovedCycleReciprocals(
  changes: Array<{ id: string; before: Record<string, any>; after: Record<string, any> }>,
) {
  for (const { id, before, after } of changes) {
    for (const [oldTargetRaw, newTargetRaw, reciprocalField] of [
      [before?.linking?.cycle?.nextGrantId, after?.linking?.cycle?.nextGrantId, "previousGrantId"],
      [before?.linking?.cycle?.previousGrantId, after?.linking?.cycle?.previousGrantId, "nextGrantId"],
    ] as Array<[unknown, unknown, string]>) {
      const oldTarget = normId(oldTargetRaw);
      if (!oldTarget || oldTarget === normId(newTargetRaw)) continue;
      const ref = db.collection("grants").doc(oldTarget);
      const snap = await ref.get();
      if (normId((snap.data() as any)?.linking?.cycle?.[reciprocalField]) === id) {
        await ref.update(`linking.cycle.${reciprocalField}`, null, "updatedAt", FieldValue.serverTimestamp());
      }
    }
  }
}

/* ---------------- Normalize single grant for storage ---------------- */

export function normalizeOne(input: TGrant, caller: Claims, targetOrg: string) {
  const parsed = Grant.parse(input);

  if (parsed.id && isReservedRouteId(parsed.id)) {
    const e = new Error("invalid_reserved_id") as Error & { code: number };
    e.code = 400;
    throw e;
  }

  const id = parsed.id || uuid();
  assertNoSelfLinks(id, parsed.linking);
  const status = (parsed.status || "active") as TGrant["status"];

  const active = status === "active";
  const deleted = status === "deleted";

  const kind = canonicalKind({}, parsed);
  const financialConfig = normalizeGrantFinancialConfig({ ...parsed, kind });
  const complianceConfig = normalizeGrantComplianceConfig(parsed as Record<string, unknown>);
  const driveTemplates = normalizeGrantDriveTemplates((parsed as Record<string, unknown>).driveTemplates);

  const budget = shouldRetainGrantBudget({ ...parsed, kind, financialConfig })
    ? normalizeBudget(parsed.budget ?? { total: 0, lineItems: [] }, parsed)
    : null;

  const tasks = cleanGrantTasks(parsed.tasks);
  const meta = cleanExtras(parsed.meta);
  const extras = cleanTopLevelExtras(parsed as Record<string, unknown>);

  return {
    ...extras,
    id,
    orgId: normId(targetOrg),

    name: parsed.name,
    status,
    active,
    deleted,

    kind,
    financialConfig,

    duration: parsed.duration ?? null,
    lengthOfAssistance: parsed.lengthOfAssistance ?? null,
    maxAssistanceMonths:
      parsed.maxAssistanceMonths ??
      parseGrantMaxAssistanceMonths(parsed.lengthOfAssistance) ??
      null,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,

    budget,
    taskTypes: parsed.taskTypes ?? null,
    complianceConfig,
    driveTemplates,
    conditionalTaskRules: parsed.conditionalTaskRules ?? null,
    pins: parsed.pins ?? null,
    invoicing: parsed.invoicing ?? null,
    invoiceDocuments: parsed.invoiceDocuments ?? null,
    linking: parsed.linking ?? null,
    levelOfAssistance: parsed.levelOfAssistance ?? null,
    programIds: parsed.programIds ?? null,
    fundingGrantIds: parsed.fundingGrantIds ?? null,
    relatedProgramIds: parsed.relatedProgramIds ?? null,
    relatedGrantIds: parsed.relatedGrantIds ?? null,
    tasks,
    meta,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* ---------------- Upsert (bulk) ---------------- */

export async function upsertGrants(
  body: unknown,
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const items = toArray(GrantUpsertBody.parse(body)).map((g) =>
    normalizeOne(g, caller, targetOrg),
  );

  // Prevent cross-org "ID takeover" and migrate legacy orgId if missing.
  const refs = items.map((g) => db.collection("grants").doc(g.id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < items.length; i++) {
    writer.set(refs[i], items[i], { merge: true });
  }
  await writer.close();
  await clearRemovedCycleReciprocals(items.map((item, index) => ({
    id: item.id,
    before: (snaps[index].data() || {}) as Record<string, any>,
    after: item as Record<string, any>,
  })));
  await syncCycleReciprocal(items.map((item) => item.id), targetOrg);

  return { ids: items.map((i) => i.id) };
}

/* ---------------- Patch (bulk; supports unset[]; budget-aware merges) ---------------- */

export async function patchGrants(
  body: unknown,
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const rows = toArray(GrantPatchBody.parse(body));
  const ids = rows.map((r) => r.id);

  const refs = ids.map((id) => db.collection("grants").doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  const budgetRows: Array<{
    id: string;
    patch: Partial<TGrant>;
    unset?: string[];
  }> = [];
  // Track grants whose terminal status should be reflected on enrollments after write.
  const cascadeNeeded: Array<{ id: string; targetStatus: "closed" | "deleted" }> = [];
  const maxAssistanceSyncIds = new Set<string>();
  const cycleLinkChanges: Array<{ id: string; before: Record<string, any>; after: Record<string, any> }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { id, patch, unset } = rows[i];
    const prev = (snaps[i].data() || {}) as Partial<TGrant>;

    const safePatch = sanitizeGrantPatch(patch as Partial<TGrant>);
    assertNoSelfLinks(id, (safePatch as Record<string, unknown>).linking);
    cycleLinkChanges.push({
      id,
      before: prev as Record<string, any>,
      after: { ...(prev as Record<string, any>), ...(safePatch as Record<string, any>) },
    });

    const touchesBudget = hasOwn(safePatch, "budget");

    if (touchesBudget) {
      budgetRows.push({ id, patch: safePatch, unset });
      continue;
    }

    if (patchTouchesMaxAssistance(safePatch as Record<string, unknown>, unset)) {
      maxAssistanceSyncIds.add(id);
    }

    // status coherence
    const nextStatus = (safePatch.status ??
      prev.status ??
      "draft") as TGrant["status"];
    const active = nextStatus === "active";
    const deleted = nextStatus === "deleted";

    // Detect terminal status writes for cascade. Re-running the cascade is cheap for
    // already-terminal enrollments and lets a later save repair stale active rows.
    const prevStatus = (prev.status ?? "draft") as TGrant["status"];
    if (prevStatus !== nextStatus || hasOwn(safePatch, "status")) {
      if (nextStatus === "closed") cascadeNeeded.push({ id, targetStatus: "closed" });
      else if (nextStatus === "deleted") cascadeNeeded.push({ id, targetStatus: "deleted" });
    }

    // program/grant coherence
    const kind = canonicalKind(prev, safePatch);
    const nextFinancialConfig = normalizeGrantFinancialConfig({ ...prev, ...safePatch, kind });
    const nextComplianceConfig = normalizeGrantComplianceConfig({ ...prev, ...safePatch });
    const mustClearBudget = !shouldRetainGrantBudget(
      {
        ...grantDecisionInput(prev as Record<string, unknown>, safePatch as Record<string, unknown>, kind, unset),
        financialConfig: nextFinancialConfig,
      },
    );
    const shouldSeedBudget =
      !mustClearBudget &&
      !hasOwn(safePatch, "budget") &&
      !(prev.budget && typeof prev.budget === "object" && !Array.isArray(prev.budget));

    const data: Record<string, unknown> = {
      ...safePatch,
      status: nextStatus,
      active,
      deleted,
      kind,
      financialConfig: nextFinancialConfig,
      complianceConfig: nextComplianceConfig,
      ...(mustClearBudget ? { budget: null } : {}),
      ...(shouldSeedBudget ? { budget: normalizeBudget({ total: 0, lineItems: [] }, { ...prev, ...safePatch }) } : {}),
      ...(normId(prev.orgId) ? {} : { orgId: normId(targetOrg) }), // migrate legacy
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = db.collection("grants").doc(id);
    writer.set(ref, data, { merge: true });

    if (Array.isArray(unset) && unset.length) {
      const delMap: Record<string, FirebaseFirestore.FieldValue> = {};
      for (const path of unset) delMap[path] = FieldValue.delete();
      writer.set(ref, delMap, { merge: true });
    }
  }

  await writer.close();

  // Cascade to enrollments for any grants that just became closed or deleted.
  // Non-fatal — grant write already committed above.
  if (cascadeNeeded.length) {
    await Promise.allSettled(
      cascadeNeeded.map(({ id, targetStatus }) =>
        cascadeGrantToEnrollments(id, targetStatus).catch((e: any) =>
          console.error(`[patchGrants] cascade failed for grant ${id} → ${targetStatus}:`, e?.message || e)
        )
      )
    );
  }

  // Budget patches: transact per-doc for deterministic merge + re-derive totals.
  for (const row of budgetRows) {
    const { id, patch, unset } = row;

    let cascadeTargetStatus: "closed" | "deleted" | null = null;

    await withTxn(async (tx) => {
      const ref = db.collection("grants").doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) {
        const e = new Error("not_found") as Error & { code: number };
        e.code = 404;
        throw e;
      }

      const prev = snap.data() || {};
      assertDocOrgWritable(caller, targetOrg, prev);

      // status coherence
      const prevObj = prev as Partial<TGrant>;
      const nextStatus = (patch.status ??
        prevObj.status ??
        "draft") as TGrant["status"];
      const active = nextStatus === "active";
      const deleted = nextStatus === "deleted";

      const prevStatus = (prevObj.status ?? "draft") as TGrant["status"];
      if (prevStatus !== nextStatus || hasOwn(patch, "status")) {
        if (nextStatus === "closed") cascadeTargetStatus = "closed";
        else if (nextStatus === "deleted") cascadeTargetStatus = "deleted";
      }

      // kind coherence
      const kind = canonicalKind(prev, patch);
      const nextFinancialConfig = normalizeGrantFinancialConfig({ ...prev, ...patch, kind });
      const nextComplianceConfig = normalizeGrantComplianceConfig({ ...prev, ...patch });
      const mustClearBudget = !shouldRetainGrantBudget(
        {
          ...grantDecisionInput(prev as Record<string, unknown>, patch as Record<string, unknown>, kind, unset),
          financialConfig: nextFinancialConfig,
        },
      );

      // budget merge
      let nextBudget: TGrantBudget | null = null;

      if (mustClearBudget) {
        nextBudget = null;
      } else if (hasOwn(patch, "budget") && patch.budget === null) {
        nextBudget = normalizeBudget({ total: 0, lineItems: [] }, { ...prev, ...patch });
      } else {
        const prevBudget = (prevObj.budget || {}) as Partial<TGrantBudget>;
        const patchBudget = (patch.budget || {}) as Partial<TGrantBudget>;

        // When line items are patched, preserve spent/projected/windowed tallies from
        // the stored Firestore doc so a budget edit cannot zero out real spend history.
        let mergedLineItems: any[] | undefined = prevBudget.lineItems as any[] | undefined;
        if (Array.isArray(patchBudget.lineItems)) {
          const prevById: Record<string, any> = Object.fromEntries(
            (prevBudget.lineItems ?? []).map((li: any) => [String(li.id || ""), li])
          );
          mergedLineItems = patchBudget.lineItems.map((pli: any) => {
            const stored = prevById[String(pli.id || "")] ?? {};
            const nextLineItem = preserveStoredSplitActuals(pli, stored);
            return {
              ...nextLineItem,
              // Never let patch input overwrite these — they are owned by the spend system
              spent: stored.spent ?? 0,
              projected: stored.projected ?? 0,
              spentInWindow: stored.spentInWindow ?? 0,
              projectedInWindow: stored.projectedInWindow ?? 0,
            };
          });
        }

        const mergedInput: Partial<TGrantBudget> = {
          ...prevBudget,
          ...patchBudget,
          lineItems: mergedLineItems,
        };

        // If line items were patched without an explicit total override, drop the
        // stored total so normalizeBudget re-derives it from the new item amounts.
        if (Array.isArray(patchBudget.lineItems) && !hasOwn(patchBudget, "total")) {
          delete (mergedInput as Record<string, unknown>).total;
        }

        nextBudget = normalizeBudget(
          Object.keys(mergedInput).length
            ? (mergedInput as TGrantBudget)
            : { total: 0, lineItems: [] },
          { ...prev, ...patch },
        );
      }

      // Recompute each line item's overCap against the NEW amount now, not
      // just whenever a later payment write happens to touch that line item.
      // Editing a budget amount up or down changes whether spent+projected
      // exceeds it immediately — the flag should never be allowed to go
      // stale relative to the amount that's actually on screen right after
      // a save. spent/projected are preserved as-is above; only the flag
      // itself is being refreshed here.
      if (nextBudget && Array.isArray(nextBudget.lineItems)) {
        const prospectiveGrant = { ...prev, ...patch, budget: nextBudget };
        nextBudget = {
          ...nextBudget,
          lineItems: nextBudget.lineItems.map((li: any) => {
            const overCap = computeGrantLineItemOverCap(prospectiveGrant, li);
            const { overCap: _drop, ...rest } = li;
            return overCap != null ? { ...rest, overCap } : rest;
          }),
        };
      }

      const data: Record<string, unknown> = {
        ...patch,
        status: nextStatus,
        active,
        deleted,
        kind,
        financialConfig: nextFinancialConfig,
        complianceConfig: nextComplianceConfig,
        budget: nextBudget,
        ...(normId(prevObj.orgId) ? {} : { orgId: normId(targetOrg) }), // migrate legacy
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(ref, data, { merge: true });

      if (Array.isArray(unset) && unset.length) {
        const delMap: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const path of unset) delMap[path] = FieldValue.delete();
        tx.set(ref, delMap, { merge: true });
      }
    }, "grants_patch_with_budget");

    if (cascadeTargetStatus) {
      await cascadeGrantToEnrollments(id, cascadeTargetStatus).catch((e: any) =>
        console.error(`[patchGrants] cascade failed for grant ${id} -> ${cascadeTargetStatus}:`, e?.message || e)
      );
    }
    if (patchTouchesMaxAssistance(patch as Record<string, unknown>, unset)) {
      maxAssistanceSyncIds.add(id);
    }
  }

  if (maxAssistanceSyncIds.size) {
    await Promise.allSettled(
      Array.from(maxAssistanceSyncIds).map((id) =>
        syncGrantMaxAssistanceToActiveEnrollments(id).catch((e: any) =>
          console.error(`[patchGrants] max assistance sync failed for grant ${id}:`, e?.message || e)
        )
      )
    );
  }

  await clearRemovedCycleReciprocals(cycleLinkChanges);
  await syncCycleReciprocal(ids, targetOrg);
  return { ids };
}

/* ---------------- Grant → enrollment cascade ---------------- */

/**
 * Cascade a grant status transition to all non-terminal enrollments.
 * Reads all affected enrollments first, then writes — never the reverse.
 * Errors are logged per-enrollment but do not block the others.
 */
export async function cascadeGrantToEnrollments(
  grantId: string,
  targetStatus: "closed" | "deleted",
) {
  if (!grantId) return;

  const grantSnap = await db.collection("grants").doc(grantId).get();
  const grant = grantSnap.exists ? (grantSnap.data() || {}) : {};
  const grantEndDate = String((grant as Record<string, unknown>).endDate || "").slice(0, 10);
  const closeEndDate = grantEndDate || new Date().toISOString().slice(0, 10);

  // --- READ FIRST: all enrollments for this grant that are not already terminal ---
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await db
      .collection("customerEnrollments")
      .where("grantId", "==", grantId)
      .get();
  } catch (e: any) {
    console.error(`[cascadeGrant] read failed for grant ${grantId}:`, e?.message || e);
    return;
  }

  if (snap.empty) return;

  const toProcess = snap.docs.filter((d) => {
    const s = String((d.data() as any)?.status || "").toLowerCase();
    return s !== "closed" && s !== "deleted";
  });

  if (!toProcess.length) return;

  const closedEnrollments: Array<{ id: string; orgId: string | null; grantId: string | null; customerId: string | null }> = [];

  if (targetStatus === "closed") {
    // Re-read each enrollment fresh inside its own transaction right before
    // computing closePreview/writing. `toProcess` comes from the bulk query
    // above; between that read and this write, a normal paymentsSpend call
    // could mark one of these enrollments' payments paid. Writing a
    // `retainedPayments` array computed from the stale snapshot (as this used
    // to, via a shared BulkWriter) would silently overwrite that paid flag —
    // the same bug class fixed in syncContinuumRentCertReminders 2026-07-22.
    const results = await Promise.allSettled(toProcess.map((doc) => db.runTransaction(async (trx) => {
      const ref = doc.ref;
      const freshSnap = await trx.get(ref);
      if (!freshSnap.exists) return;
      const data = freshSnap.data() as any;
      const closePreview = buildEnrollmentClosePreview({
        payments: Array.isArray(data?.payments) ? data.payments : [],
        requestedCloseDate: null,
        fallbackDate: closeEndDate,
      });
      trx.set(ref, {
        status: "closed",
        active: false,
        endDate: closePreview.closeDate,
        payments: closePreview.retainedPayments,
        closedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      closedEnrollments.push({
        id: doc.id,
        orgId: data?.orgId ?? null,
        grantId: data?.grantId ?? grantId,
        customerId: data?.customerId ?? null,
      });
    })));
    for (const r of results) {
      if (r.status === "rejected") console.error(`[cascadeGrant] close failed for grant ${grantId}:`, r.reason?.message || r.reason);
    }
  } else {
    // Deletion never touches `payments` — no race risk, bulk writer is fine.
    const writer = newBulkWriter(2);
    for (const doc of toProcess) {
      const data = doc.data() as any;
      writer.set(doc.ref, { status: "deleted", active: false, deleted: true, deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      closedEnrollments.push({
        id: doc.id,
        orgId: data?.orgId ?? null,
        grantId: data?.grantId ?? grantId,
        customerId: data?.customerId ?? null,
      });
    }
    try {
      await writer.close();
    } catch (e: any) {
      console.error(`[cascadeGrant] batch write failed for grant ${grantId}:`, e?.message || e);
      return;
    }
  }

  // --- VOID projections for all affected enrollments (non-fatal per-enrollment) ---
  await Promise.allSettled(
    closedEnrollments.map(({ id, orgId, grantId: gid, customerId }) =>
      syncEnrollmentProjectionQueueItems({
        orgId,
        enrollmentId: id,
        grantId: gid,
        customerId,
        payments: [],
      }).catch((e: any) =>
        console.error(`[cascadeGrant] voidProjections failed for enrollment ${id}:`, e?.message || e)
      )
    )
  );
}

/* ---------------- Delete (soft) ---------------- */

export async function softDeleteGrants(
  ids: string | string[],
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const arr = toArray(ids);
  const snaps = await Promise.all(
    arr.map((id) => db.collection("grants").doc(id).get()),
  );

  snaps.forEach((s) => {
    if (!s.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  const writer = newBulkWriter(2);
  for (const id of arr) {
    writer.set(
      db.collection("grants").doc(id),
      {
        status: "deleted",
        active: false,
        deleted: true,
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
        ...(normId(
          (
            snaps.find((s) => s.id === id)?.data() as
              | { orgId?: unknown }
              | undefined
          )?.orgId,
        )
          ? {}
          : { orgId: normId(targetOrg) }),
      },
      { merge: true },
    );
  }
  await writer.close();

  // Cascade to enrollments. Non-fatal per-grant — grant is already deleted above.
  await Promise.allSettled(
    arr.map((id) =>
      cascadeGrantToEnrollments(id, "deleted").catch((e: any) =>
        console.error(`[softDeleteGrants] cascade failed for grant ${id}:`, e?.message || e)
      )
    )
  );

  return { ids: arr, deleted: true as const };
}

/* ---------------- Delete (hard) ---------------- */

export async function hardDeleteGrants(
  ids: string | string[],
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  // --- ALL READS FIRST ---
  const arr = toArray(ids);
  const snaps = await Promise.all(
    arr.map((id) => db.collection("grants").doc(id).get()),
  );

  snaps.forEach((s) => {
    if (!s.exists) return;
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  // Read all enrollments for every grant before any writes.
  const enrollmentSnaps = await Promise.all(
    arr.map((id) =>
      db.collection("customerEnrollments").where("grantId", "==", id).get()
        .then((s) => ({ grantId: id, docs: s.docs }))
        .catch(() => ({ grantId: id, docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    )
  );

  // --- CASCADE: hard-delete enrollments first ---
  const cascadeErrors: Array<{ grantId: string; enrollmentId: string; error: string }> = [];

  for (const { grantId, docs } of enrollmentSnaps) {
    for (const d of docs) {
      const enrData = d.data() as any;
      if (enrData?.hardDeletePending === true) continue;
      try {
        await deleteEnrollmentsCore(
          [{ id: d.id, hard: true }],
          caller
        );
      } catch (e: any) {
        // Non-fatal: log and continue so remaining enrollments + grant still get deleted.
        cascadeErrors.push({ grantId, enrollmentId: d.id, error: String(e?.message || e) });
      }
    }
  }

  const batch = db.batch();
  for (const id of arr) {
    batch.delete(db.collection("grants").doc(id));
  }
  await batch.commit();

  return {
    ids: arr,
    deleted: true,
    ...(cascadeErrors.length ? { cascadeErrors } : {}),
  };
}
