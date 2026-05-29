import { normalizeGrantComplianceConfig } from "@hdb/contracts/grants";

function iso10(value: unknown): string {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(obj: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function applyComplianceDefaults(next: Record<string, any>, grant: Record<string, any>) {
  const config = normalizeGrantComplianceConfig(grant);
  const controls = [...(config.active || []), ...(config.inactive || [])];
  const complianceKeys = controls
    .map((control) => String(control.field || `compliance.${control.key}`).trim())
    .filter((field) => field.startsWith("compliance."))
    .map((field) => field.slice("compliance.".length).trim())
    .filter(Boolean);

  if (!complianceKeys.length) return;

  const compliance = isPlainObject(next.compliance) ? { ...next.compliance } : {};
  let changed = false;
  for (const key of Array.from(new Set(complianceKeys))) {
    if (hasOwn(compliance, key)) continue;
    compliance[key] = false;
    changed = true;
  }
  if (changed || !isPlainObject(next.compliance)) {
    next.compliance = compliance;
  }
}

function addMonthsMinusOneDay(startISO: string, months: number): string {
  const [year, month, day] = startISO.split("-").map(Number);
  if (!year || !month || !day || !Number.isFinite(months) || months < 1) return "";
  const target = new Date(year, month - 1 + months, day);
  target.setDate(target.getDate() - 1);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function capToGrantEnd(endDate: string, grant: Record<string, any>): string {
  const grantEndDate = iso10(grant?.endDate);
  if (!grantEndDate || !endDate) return endDate;
  return endDate > grantEndDate ? grantEndDate : endDate;
}

function enrollmentAuthorizationEndDate(extra: Record<string, any>, grant: Record<string, any>): string {
  const months = Number(grant?.enrollmentDefaults?.authorizationMonths);
  if (!Number.isFinite(months) || months < 1) return "";
  const start = iso10(extra?.startDate) || iso10(new Date().toISOString());
  if (!start) return "";
  return capToGrantEnd(addMonthsMinusOneDay(start, Math.floor(months)), grant);
}

export function applyGrantEnrollmentDefaults(
  extra: Record<string, any>,
  grant: Record<string, any>,
  options: { applyAuthorizationWindow?: boolean } = {},
) {
  const next = { ...(extra || {}) };
  const hasExplicitEndDate = Object.prototype.hasOwnProperty.call(next, "endDate");

  if (options.applyAuthorizationWindow !== false) {
    const requestedEndDate = iso10(next.endDate);
    if (requestedEndDate) {
      next.endDate = capToGrantEnd(requestedEndDate, grant);
    } else if (!hasExplicitEndDate) {
      const defaultEndDate = enrollmentAuthorizationEndDate(next, grant);
      if (defaultEndDate) next.endDate = defaultEndDate;
    }
  } else if (next.endDate) {
    next.endDate = capToGrantEnd(iso10(next.endDate), grant);
  }

  if (!next.serviceStatus && hasOwn(grant?.enrollmentDefaults || {}, "serviceStatus")) {
    next.serviceStatus = String(grant?.enrollmentDefaults?.serviceStatus || "active") === "paused"
      ? "paused"
      : "active";
  }

  if (
    (!next.medicaid || typeof next.medicaid !== "object" || Array.isArray(next.medicaid)) &&
    hasOwn(grant?.enrollmentDefaults || {}, "medicaidStatus")
  ) {
    next.medicaid = {
      status: String(grant?.enrollmentDefaults?.medicaidStatus || "active") === "closed"
        ? "closed"
        : "active",
    };
  }

  applyComplianceDefaults(next, grant || {});

  return next;
}
