import { normalizeGrantComplianceConfig, type TGrantComplianceControl } from "@hdb/contracts";
import type { Enrollment } from "@client/enrollments";

export type EnrollmentControlKind = "compliance" | "serviceStatus" | "medicaid" | "action";

export type EnrollmentControlDescriptor = {
  control: TGrantComplianceControl;
  kind: EnrollmentControlKind;
  key: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function enrollmentControlDescriptor(control: TGrantComplianceControl): EnrollmentControlDescriptor | null {
  const field = text(control.field || `compliance.${control.key}`);
  if (field.startsWith("compliance.")) {
    const key = field.slice("compliance.".length).trim();
    return key ? { control, kind: "compliance", key } : null;
  }
  if (field === "serviceStatus") {
    return { control, kind: "serviceStatus", key: "serviceStatus" };
  }
  if (field === "medicaid.status") {
    return { control, kind: "medicaid", key: "medicaidStatus" };
  }
  if (field.startsWith("actions.")) {
    const key = field.slice("actions.".length).trim();
    return key ? { control, kind: "action", key } : null;
  }
  return null;
}

export function enrollmentControlsForGrant(
  grant: Record<string, unknown> | null | undefined,
  inactive = false,
): EnrollmentControlDescriptor[] {
  const config = normalizeGrantComplianceConfig(grant || {});
  const controls = inactive ? config.inactive || [] : config.active || [];
  return controls
    .map((control) => enrollmentControlDescriptor(control))
    .filter((control): control is EnrollmentControlDescriptor => !!control);
}

export function enrollmentControlDone(
  enrollment: Enrollment | Record<string, unknown> | null | undefined,
  descriptor: EnrollmentControlDescriptor,
): boolean {
  const row = (enrollment || {}) as Record<string, unknown>;
  if (descriptor.kind === "compliance") {
    const compliance = isPlainObject(row.compliance) ? row.compliance : {};
    return Boolean(compliance[descriptor.key]);
  }
  if (descriptor.kind === "serviceStatus") {
    return text(row.serviceStatus || "active") === "active";
  }
  if (descriptor.kind === "medicaid") {
    const medicaid = isPlainObject(row.medicaid) ? row.medicaid : {};
    return text(medicaid.status || "active") === "active";
  }
  const actions = isPlainObject(row.actions) ? row.actions : {};
  return Boolean(actions[descriptor.key]);
}

export function enrollmentControlStatusLabel(done: boolean, descriptor: EnrollmentControlDescriptor): string {
  if (descriptor.kind === "serviceStatus") return done ? "Active" : "Paused";
  if (descriptor.kind === "medicaid") return done ? "Active" : "Closed";
  return done ? "Done" : "Pending";
}

export function enrollmentControlPatch(
  enrollment: Enrollment | Record<string, unknown>,
  descriptor: EnrollmentControlDescriptor,
  nextDone: boolean,
): Record<string, unknown> | null {
  if (descriptor.kind !== "compliance") return null;
  const row = enrollment as Record<string, unknown>;
  const compliance = isPlainObject(row.compliance) ? row.compliance : {};
  return {
    compliance: {
      ...compliance,
      [descriptor.key]: nextDone,
    },
  };
}

export function enrollmentControlActionBody(
  enrollmentId: string,
  descriptor: EnrollmentControlDescriptor,
  nextDone: boolean,
): Record<string, unknown> | null {
  if (descriptor.kind === "serviceStatus") {
    return {
      enrollmentId,
      serviceStatus: nextDone ? "active" : "paused",
      note: `${descriptor.control.label} set to ${nextDone ? "active" : "paused"}`,
    };
  }
  if (descriptor.kind === "medicaid") {
    return {
      enrollmentId,
      medicaid: { status: nextDone ? "active" : "closed" },
      note: `${descriptor.control.label} set to ${nextDone ? "active" : "closed"}`,
    };
  }
  if (descriptor.kind === "action") {
    return {
      enrollmentId,
      actionId: descriptor.key,
      value: nextDone,
      note: `${descriptor.control.label} set to ${nextDone ? "complete" : "pending"}`,
    };
  }
  return null;
}
