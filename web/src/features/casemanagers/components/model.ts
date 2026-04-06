"use client";

import type { CompositeUser } from "@hooks/useUsers";
import type { TCustomer, TEnrollment } from "@types";
import { toISODate, toMillisAny, ymKey } from "@lib/date";

export type CaseManagerUser = CompositeUser;
export type CustomerRow = TCustomer;
export type EnrollmentRow = TEnrollment & { id: string };

export type CmPopulationStats = {
  totalCM: number;
  youthCM: number;
  individualCM: number;
  familyCM: number;
  youthNames: string[];
  individualNames: string[];
  familyNames: string[];
};

export type TopBannerStats = {
  total: number;
  YOUTH: number;
  INDIVIDUAL: number;
  FAMILY: number;
};

export const ACTIVE_CUSTOMER_STATUSES = new Set(["active"]);

export function isActiveCustomer(c: CustomerRow | null | undefined): boolean {
  if (!c) return false;
  if (typeof c.active === "boolean") return c.active;
  const s = String(c.status || "").toLowerCase();
  return s === "" || s === "active";
}

export function isInactiveCustomer(c: CustomerRow | null | undefined): boolean {
  return !isActiveCustomer(c);
}

export function cmLabel(u: CaseManagerUser | null | undefined): string {
  if (!u) return "";
  return String(u.displayName || u.email || u.uid || "").trim();
}

export function customerLabel(c: CustomerRow): string {
  return String(
    c.name ||
      [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
      c.id ||
      "(Unnamed)"
  );
}

export function populationLabel(pop: unknown): "YOUTH" | "INDIVIDUAL" | "FAMILY" | "" {
  const raw = String(pop || "").toLowerCase();
  if (raw === "youth") return "YOUTH";
  if (raw === "individual") return "INDIVIDUAL";
  if (raw === "family") return "FAMILY";
  return "";
}

export function toISO10(v?: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return toISODate(v);
  const ms = toMillisAny(v);
  return ms ? toISODate(ms) : "";
}

export function currentYearMonthKey(d = new Date()): string {
  return ymKey(d);
}

export function fmtDOB(v?: unknown): string {
  return toISO10(v) || "-";
}
