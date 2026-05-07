// web/src/features/customers/components/paymentScheduleUtils.ts
// Shared helpers for customer features (dates, currency, payments utils, etc)
// NOTE: This module holds Payment/Builder-specific logic.
// Generic date normalization/validation now lives in @lib/date.

import type { Payment, ScheduleMeta } from "@types";
import { isISODate10, safeISODate10, todayISO as localTodayISO, toISODate } from "@lib/date";

/* ----------------------- date & money utils ----------------------- */

export function isISO(s: string): boolean {
  return isISODate10(s);
}

export function safeISO(x: unknown): string {
  return safeISODate10(x);
}

/** Formats a date as YYYY-MM-DD (no TZ surprises) */
export function fmt(d: Date): string {
  return toISODate(d);
}

/** Today in YYYY-MM-DD (local) */
export function todayISO(): string {
  return localTodayISO();
}

/**
 * Adds `m` months to an ISO date WITHOUT crossing time zones or DST.
 * Clamps the day to the last valid day in the target month.
 */
export function addMonthsISO(iso: string, m: number): string {
  if (!isISO(iso)) return "";
  const [y0, mo0, d0] = iso.split("-").map(Number);
  const total = (y0 * 12 + (mo0 - 1)) + m;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;

  const lastDay = lastDayOfMonth(y, mo);
  const d = Math.min(d0, lastDay);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function firstOfNextMonth(iso: string): string {
  if (!isISO(iso)) return "";
  const [y0, mo0] = iso.split("-").map(Number);
  const total = y0 * 12 + (mo0 - 1) + 1;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

export function lastDayOfMonth(year: number, month1Based: number): number {
  const nextMonth = month1Based === 12 ? 1 : month1Based + 1;
  const nextYear = month1Based === 12 ? year + 1 : year;
  const firstNext = new Date(nextYear, nextMonth - 1, 1);
  const lastThis = new Date(firstNext.getTime() - 24 * 60 * 60 * 1000);
  return lastThis.getDate();
}

export function currency(x: number, currencyCode = "USD"): string {
  const n = Number(x || 0);
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ----------------------- payments utils ----------------------- */

export function withVendorAndCommentTags(
  base: string[],
  vendor?: string,
  comment?: string
): string[] {
  // remove existing vendor:* to avoid dup, then add normalized single tag
  let tags = base.filter((t) => !/^vendor:/i.test(String(t)));
  if (vendor?.trim()) tags = [...tags, `vendor:${vendor.trim()}`];
  if (comment?.trim()) tags = [...tags, comment.trim()];
  return Array.from(new Set(tags)).slice(0, 10);
}

/** Extract vendor from payment.note[] (vendor:*). Returns undefined if not present. */
export function extractVendorFromNote(p: Payment): string | undefined {
  const tags = Array.isArray(p.note) ? p.note : p.note ? [p.note] : [];
  const hit = tags.find((t) => /^vendor:/i.test(String(t)));
  if (!hit) return undefined;
  const val = String(hit).split(":").slice(1).join(":").trim();
  return val || undefined;
}

/** Build basic badges for schedule rows (Monthly, Due this month, Overdue) */
export function buildNoteTags(p: Payment): string[] {
  const base = Array.isArray(p.note)
    ? p.note.filter(Boolean).map(String)
    : p.note
    ? [String(p.note)]
    : [];

  if (p.type === "monthly") base.push("Monthly");

  const due = safeISO(p.dueDate);
  if (due) {
    const today = new Date();
    const d = new Date(`${due}T00:00:00`);
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    if (!p.paid) {
      if (d < firstOfThisMonth) base.push("Overdue");
      else if (d >= firstOfThisMonth && d < firstOfNextMonth) base.push("Due this month");
    }
  }
  return Array.from(new Set(base.map(String))).slice(0, 5);
}

export function displayTypeLabel(p: Payment): string {
  if (p.type === "deposit") return "Deposit Assistance";
  if (p.type === "prorated") return "Prorated Rent Assistance";
  if (p.type === "service") return "Support Service";
  const subtype = Array.isArray(p.note) ? p.note[0] : p.note;
  const isUtility = String(subtype || "").toLowerCase().includes("utility");
  return isUtility ? "Utility Assistance" : "Rent Assistance";
}

export function makePaymentId(
  coreType: Payment["type"],
  sub: "rent" | "utility" | "deposit" | "prorated" | "service",
  due: string,
  li: string,
  amt: number,
  i: number
): string {
  const cents = Math.round((amt || 0) * 100);
  return `pay_${coreType}_${sub}_${due}_${li || "unassigned"}_${cents}_${i}`;
}

export function normalizePayments(
  list: unknown[],
  opts?: { requireLineItemId?: boolean }
): Payment[] {
  const requireLI = !!opts?.requireLineItemId;
  const allowed = new Set<Payment["type"]>(["monthly", "deposit", "prorated", "service"]);
  return (Array.isArray(list) ? list : [])
    .map((raw, i) => {
      const p: any = raw || {};
      const due = safeISO(p.dueDate) || safeISO(p.date) || "";
      const amt = Number(p.amount) || 0;
      const li = String(p.lineItemId || p.li || "").trim();
      const type = String(p.type || "").toLowerCase() as Payment["type"];
      if (!allowed.has(type)) return null;

      const id =
        p.id ||
        makePaymentId(
          type,
          (Array.isArray(p.note) ? p.note[0] || "rent" : p.note || "rent") as any,
          due,
          li,
          amt,
          i
        );

      return {
        ...p,
        id,
        amount: amt,
        dueDate: due,
        lineItemId: li || undefined,
        type,
      } as Payment;
    })
    .filter(
      (p): p is Payment =>
        !!p && !!p.id && p.amount > 0 && isISO(p.dueDate) && (!requireLI || !!p.lineItemId)
    );
}

export type RentCertDue = {
  enrollmentId?: string;
  enrollmentLabel?: string;
  dueDate: string;
  targetPaymentDate: string;
  asap: boolean;
  label: string;
};

function paymentNotes(p: Payment): string[] {
  if (Array.isArray(p.note)) return p.note.filter(Boolean).map(String);
  return p.note ? [String(p.note)] : [];
}

export function isRentPayment(p: Payment): boolean {
  if (p.type !== "monthly") return false;
  const notes = paymentNotes(p).join(" ").toLowerCase();
  return !notes || notes.includes("rent");
}

export function computeRentCertDues(
  payments: unknown[],
  opts?: { enrollmentId?: string; enrollmentLabel?: string; today?: string }
): RentCertDue[] {
  const today = opts?.today && isISO(opts.today) ? opts.today : todayISO();
  const rentPayments = normalizePayments(Array.isArray(payments) ? payments : [])
    .filter((p) => !p.void && isRentPayment(p))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (rentPayments.length < 4) return [];

  const out: RentCertDue[] = [];
  for (let i = 3; i < rentPayments.length; i += 3) {
    const targetPaymentDate = rentPayments[i].dueDate;
    const dueDate = addMonthsISO(targetPaymentDate, -1);
    if (!dueDate) continue;
    out.push({
      enrollmentId: opts?.enrollmentId,
      enrollmentLabel: opts?.enrollmentLabel,
      dueDate,
      targetPaymentDate,
      asap: dueDate <= today,
      label: `${fmtShortMonth(targetPaymentDate)} rent cert due ${fmtShortMonth(dueDate)}`,
    });
  }
  return out;
}

export function nextRentCertDue(
  enrollments: Array<{ id?: string; grantName?: unknown; name?: unknown; payments?: unknown }>
): RentCertDue | null {
  const dues = enrollments.flatMap((enrollment) =>
    computeRentCertDues(Array.isArray(enrollment.payments) ? enrollment.payments : [], {
      enrollmentId: String(enrollment.id || ""),
      enrollmentLabel:
        String(enrollment.grantName || "").trim() ||
        String(enrollment.name || "").trim() ||
        "Enrollment",
    })
  );
  const sorted = dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return sorted.find((due) => due.targetPaymentDate >= todayISO()) || sorted[sorted.length - 1] || null;
}

function fmtShortMonth(iso: string): string {
  if (!isISO(iso)) return iso;
  const [, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Math.max(0, Math.min(11, Number(m) - 1))]} ${Number(d)}`;
}

export function tmpId(): string {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Row keys that stay stable even with identical-looking rows */
export function makeRowKeys(list: Payment[]): string[] {
  const seen = new Map<string, number>();
  return list.map((p) => {
    const cents = Math.round(Number(p.amount || 0) * 100);
    const base =
      `${p.id ?? "noid"}|${p.type}|${safeISO(p.dueDate)}` +
      `|${p.lineItemId ?? ""}|${cents}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

export function monthDiff(aISO: string, bISO: string): number {
  const [ay, am] = aISO.split("-").map(Number);
  const [by, bm] = bISO.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}
export function isConsecutiveMonth(prevISO: string, currISO: string): boolean {
  return monthDiff(prevISO, currISO) === 1;
}

/**
 * Reconstructs builder state from a flat list of payments (when scheduleMeta is missing).
 * Keeps services (note/vendor/comment), and detects runs of monthly rent/utility.
 */
export function reconstructBuilderFromPayments(
  payments: Payment[],
  start: string
): {
  rentPlans: NonNullable<ScheduleMeta["rentPlans"]>;
  utilPlans: NonNullable<ScheduleMeta["utilPlans"]>;
  services: NonNullable<ScheduleMeta["services"]>;
  deposit: NonNullable<ScheduleMeta["deposit"]>;
  prorated: NonNullable<ScheduleMeta["prorated"]>;
} {
  const rentPlans: ScheduleMeta["rentPlans"] = [];
  const utilPlans: ScheduleMeta["utilPlans"] = [];
  const services: ScheduleMeta["services"] = [];
  let deposit: NonNullable<ScheduleMeta["deposit"]> = {
    enabled: false,
    date: start,
    amount: "",
    lineItemId: "",
  };
  let prorated: NonNullable<ScheduleMeta["prorated"]> = {
    enabled: false,
    date: start,
    amount: "",
    lineItemId: "",
  };

  const sorted = normalizePayments(payments, { requireLineItemId: true }).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate)
  );

  const dep = sorted.find((p) => p.type === "deposit");
  if (dep)
    deposit = {
      enabled: true,
      date: dep.dueDate,
      amount: String(dep.amount || ""),
      lineItemId: dep.lineItemId || "",
      vendor: dep.vendor ?? undefined,
      comment: dep.comment ?? undefined,
    };
  const pro = sorted.find((p) => p.type === "prorated");
  if (pro)
    prorated = {
      enabled: true,
      date: pro.dueDate,
      amount: String(pro.amount || ""),
      lineItemId: pro.lineItemId || "",
      vendor: pro.vendor ?? undefined,
      comment: pro.comment ?? undefined,
    };

  for (const p of sorted) {
    if (p.type === "service") {
      services.push({
        id: p.id || tmpId(),
        note: Array.isArray(p.note) ? String(p.note[0] ?? "") : String(p.note ?? ""),
        date: p.dueDate,
        amount: String(p.amount || ""),
        lineItemId: p.lineItemId || "",
        vendor: p.vendor ?? undefined,
        comment: p.comment ?? undefined,
      });
    }
  }

  const monthly = sorted.filter((p) => p.type === "monthly");
  const groups = new Map<string, Payment[]>();
  for (const m of monthly) {
    const primary = Array.isArray(m.note) ? m.note[0] || "" : m.note || "";
    const subtype = (primary || "rent").toLowerCase();
    const key = `${subtype}|${m.lineItemId || ""}|${Math.round((m.amount || 0) * 100)}`;
    (groups.get(key) || groups.set(key, []).get(key)!).push(m);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    let run: Payment[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (i === 0 || isConsecutiveMonth(arr[i - 1].dueDate, arr[i].dueDate)) run.push(arr[i]);
      else {
        placeRun(run);
        run = [arr[i]];
      }
    }
    if (run.length) placeRun(run);
  }

  function placeRun(run: Payment[]) {
    const first = run[0];
    const li = first.lineItemId || "";
    const plan = {
      id: tmpId(), // stable key for UI rows
      firstDue: first.dueDate,
      months: String(run.length),
      monthly: (first.amount || 0).toFixed(2),
      lineItemId: li,
    };
    const primary = Array.isArray(first.note) ? first.note[0] || "rent" : first.note || "rent";
    const subtype = primary.toLowerCase();
    if (subtype === "utility") utilPlans.push(plan);
    else rentPlans.push(plan);
  }

  return { rentPlans, utilPlans, deposit, prorated, services };
}

/** For “override latest monthly on same date” behavior in draft builder */
export function makeOverrideInserter(target: Payment[]) {
  const byKey = new Map<string, number>();

  const keyOf = (p: Payment) => {
    const primary = Array.isArray(p.note) ? (p.note[0] ?? "") : (p.note ?? "");
    return `${p.type}:${primary.toLowerCase()}:${p.dueDate}:${p.lineItemId ?? ""}:${p.amount}`;
  };

  return (p: Payment) => {
    if (p.type === "monthly") {
      const key = keyOf(p);
      const idx = byKey.get(key);

      if (idx != null) {
        const prev = target[idx];

        // preserve pay-state + compliance when rebuilding projection
        target[idx] = {
          ...prev,
          ...p,
          paid: prev.paid ?? p.paid,
          paidAt: prev.paidAt ?? p.paidAt,
          paidFromGrant: prev.paidFromGrant ?? p.paidFromGrant,
          compliance: prev.compliance ?? p.compliance,
        };
        return;
      }

      byKey.set(key, target.length);
    }
    target.push(p);
  };
}
