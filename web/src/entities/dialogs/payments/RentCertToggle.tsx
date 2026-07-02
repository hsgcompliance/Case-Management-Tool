"use client";

import React from "react";

/**
 * Rent cert state toggle. The due date is always derived (month prior to the
 * payment/effective date), so no date is ever entered here — the user only
 * picks the state. "notDue" clears the rent cert.
 */
export type RentCertToggleValue = "notDue" | "due" | "completed" | "effective";

const OPTIONS: Array<{ value: RentCertToggleValue; label: string }> = [
  { value: "notDue", label: "Not due" },
  { value: "due", label: "Due" },
  { value: "completed", label: "Completed" },
  { value: "effective", label: "Effective" },
];

const TONE: Record<RentCertToggleValue, string> = {
  notDue: "border-slate-200 bg-slate-50 text-slate-500",
  due: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  effective: "border-sky-200 bg-sky-50 text-sky-700",
};

/** Map a stored payment.rentCert to its toggle value. Missing/clear = "notDue". */
export function rentCertToggleValue(
  rentCert: { status?: string; dueDate?: string | null } | null | undefined,
): RentCertToggleValue {
  if (!rentCert || !rentCert.dueDate) return "notDue";
  const status = String(rentCert.status || "due");
  if (status === "completed") return "completed";
  if (status === "effective") return "effective";
  return "due";
}

export function RentCertToggle({
  value,
  onChange,
  disabled,
  title,
  className = "",
}: {
  value: RentCertToggleValue;
  onChange: (next: RentCertToggleValue) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <select
      className={["rounded border px-2 py-1 text-xs font-medium", TONE[value], className].join(" ")}
      value={value}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(event.currentTarget.value as RentCertToggleValue)}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
