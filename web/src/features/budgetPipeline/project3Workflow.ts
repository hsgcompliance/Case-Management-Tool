import type { GrantBudgetEligibilityResult } from "@hdb/contracts";

export type AdvancedGrantOption = {
  value: string;
  label: string;
};

export type AdvancedGrantOptionGroup = {
  label: "Active" | "Historical";
  options: AdvancedGrantOption[];
};

type GrantOptionSource = {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  kind?: unknown;
  status?: unknown;
  active?: unknown;
  deleted?: unknown;
  budget?: unknown;
  financialConfig?: { model?: unknown } | null;
};

function grantStatus(grant: GrantOptionSource): string {
  const explicit = String(grant.status || "").trim().toLowerCase();
  if (grant.deleted === true || explicit === "deleted") return "Deleted";
  if (explicit === "closed") return "Closed";
  if (explicit === "draft") return "Draft";
  if (explicit === "inactive" || grant.active === false) return "Inactive";
  return "Active";
}

function grantType(grant: GrantOptionSource): string {
  const financialModel = String(grant.financialConfig?.model || "").trim().toLowerCase();
  if (financialModel === "billable") return "Billable";
  if (String(grant.kind || "").trim().toLowerCase() === "program") return "Program";
  return "Grant";
}

function isRelevantAdvancedAssignmentGrant(grant: GrantOptionSource, currentGrantId: string): boolean {
  const id = String(grant.id || "").trim();
  if (!id) return false;
  if (id === currentGrantId) return true;
  const kind = String(grant.kind || "").trim().toLowerCase();
  const financialModel = String(grant.financialConfig?.model || "").trim().toLowerCase();
  return kind !== "program" || financialModel === "billable" || !!grant.budget;
}

/** Advanced designation is the only workflow that exposes historical grants. */
export function buildAdvancedGrantOptionGroups(
  grants: GrantOptionSource[],
  currentGrantId = "",
): AdvancedGrantOptionGroup[] {
  const active: AdvancedGrantOption[] = [];
  const historical: AdvancedGrantOption[] = [];
  const seen = new Set<string>();

  for (const grant of grants) {
    const id = String(grant.id || "").trim();
    if (!isRelevantAdvancedAssignmentGrant(grant, currentGrantId) || seen.has(id)) continue;
    seen.add(id);
    const status = grantStatus(grant);
    const name = String(grant.name || grant.code || id).trim() || id;
    const option = { value: id, label: `${name} — ${status} · ${grantType(grant)}` };
    if (status === "Active") active.push(option);
    else historical.push(option);
  }

  const sort = (a: AdvancedGrantOption, b: AdvancedGrantOption) => a.label.localeCompare(b.label);
  active.sort(sort);
  historical.sort(sort);

  return [
    ...(active.length ? [{ label: "Active" as const, options: active }] : []),
    ...(historical.length ? [{ label: "Historical" as const, options: historical }] : []),
  ];
}

/** Date inputs are always reduced to a serializable YYYY-MM-DD string or empty. */
export function normalizePipelineDateInput(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

export function isOutOfGrantPeriod(eligibility: GrantBudgetEligibilityResult | null | undefined): boolean {
  return !!eligibility?.assignedToGrant && !eligibility.eligibleForGrantTotals &&
    (eligibility.reason === "before-grant-start" || eligibility.reason === "after-grant-end");
}

export function stableLineItemDisclosureId(lineItem: Record<string, unknown>): string {
  const id = String(lineItem.id || "").trim();
  if (id) return id;
  const label = String(lineItem.label || "unnamed").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const type = String(lineItem.type || "untyped").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `legacy:${label || "unnamed"}:${type || "untyped"}`;
}

export function stableCycleDisclosureId(
  lineItemId: string,
  cycle: Record<string, unknown>,
): string {
  const id = String(cycle.id || "").trim();
  if (id) return `${lineItemId}:${id}`;
  return `${lineItemId}:legacy:${String(cycle.startDate || "")}:${String(cycle.endDate || "")}:${String(cycle.label || "")}`;
}

export function activityBelongsToCycle(
  eligibility: GrantBudgetEligibilityResult,
  cycleId: string,
): boolean {
  return !!cycleId && eligibility.spendingCycleId === cycleId;
}

export function activityIsOutsideConfiguredCycles(
  eligibility: GrantBudgetEligibilityResult,
  configuredCycleIds: ReadonlySet<string>,
): boolean {
  const cycleId = String(eligibility.spendingCycleId || "").trim();
  return !cycleId || !configuredCycleIds.has(cycleId);
}
