"use client";

import React from "react";

// Minimal interface — works with TPayment, PaymentRecord, plain objects, etc.
type PaymentLike = {
  type?: string | null;
  note?: string | string[] | null;
};

function resolveSubtype(note: unknown): "rent" | "utility" {
  const tags = Array.isArray(note)
    ? note.map((t) => String(t ?? "").toLowerCase())
    : note != null
    ? [String(note).toLowerCase()]
    : [];
  return tags.some(
    (t) => t === "utility" || t === "sub:utility" || t.startsWith("utility:") || t.startsWith("sub:utility"),
  )
    ? "utility"
    : "rent";
}

export type UserPaymentType = "rent" | "utility" | "deposit" | "prorated" | "service";

export function resolvePaymentType(payment: PaymentLike): UserPaymentType {
  const type = String(payment?.type ?? "monthly").toLowerCase();
  if (type === "deposit") return "deposit";
  if (type === "prorated") return "prorated";
  if (type === "service") return "service";
  return resolveSubtype(payment?.note);
}

export function paymentTypeLabel(payment: PaymentLike): string {
  switch (resolvePaymentType(payment)) {
    case "rent":     return "Rent";
    case "utility":  return "Utility";
    case "deposit":  return "Deposit";
    case "prorated": return "Pro-Rated";
    case "service":  return "Support Service";
  }
}

export const RENTAL_ASSISTANCE_TYPES = new Set<UserPaymentType>(["rent", "deposit", "prorated"]);

export function isRentalAssistance(payment: PaymentLike): boolean {
  return RENTAL_ASSISTANCE_TYPES.has(resolvePaymentType(payment));
}

const TYPE_COLORS: Record<UserPaymentType, { chip: string; dot: string }> = {
  rent:     { chip: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500" },
  utility:  { chip: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500" },
  deposit:  { chip: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
  prorated: { chip: "bg-sky-50 text-sky-700 border-sky-200",            dot: "bg-sky-500" },
  service:  { chip: "bg-emerald-50 text-emerald-700 border-emerald-200",dot: "bg-emerald-500" },
};

/** Pill badge — for detail cards and prominent display */
export function PaymentTypeChip({ payment }: { payment: PaymentLike }) {
  const resolved = resolvePaymentType(payment);
  const { chip } = TYPE_COLORS[resolved];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chip}`}>
      {paymentTypeLabel(payment)}
    </span>
  );
}

/** Color dot + text — for table rows */
export function PaymentTypeBadge({ payment }: { payment: PaymentLike }) {
  const resolved = resolvePaymentType(payment);
  const { dot } = TYPE_COLORS[resolved];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {paymentTypeLabel(payment)}
    </span>
  );
}

/** Returns non-subtype, non-vendor tags from a payment's note array — shown as metadata. */
export function paymentNoteMeta(note: unknown): string {
  const tags = Array.isArray(note)
    ? note.map((t) => String(t ?? "").trim()).filter(Boolean)
    : note != null
    ? [String(note).trim()].filter(Boolean)
    : [];
  const SKIP = /^(sub:|vendor:|rent$|utility$)/i;
  return tags.filter((t) => !SKIP.test(t)).join(", ");
}
