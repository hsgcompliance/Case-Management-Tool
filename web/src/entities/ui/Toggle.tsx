// BEGIN FILE: web/src/lib/Toggle.tsx
"use client";
import React from "react";

type Props = {
  value?: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  tourId?: string;
  onLabel?: string; // default "Yes"
  offLabel?: string; // default "No"
  size?: "sm" | "md"; // default "md"
  variant?: "default" | "soft"; // default "default"
};

export function ToggleYesNo({
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  tourId,
  onLabel = "Yes",
  offLabel = "No",
  size = "md",
  variant = "default",
}: Props) {
  const v = !!value;

  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const activeClass =
    variant === "soft" ? "bg-slate-600 text-white" : "bg-slate-900 text-white";

  const baseBtn = [
    pad,
    "rounded-lg transition select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  ].join(" ");

  const inactive = "text-slate-700 hover:bg-slate-100";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm"
      data-tour={tourId}
    >
      <button
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${onLabel}` : undefined}
        aria-pressed={v}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={[baseBtn, v ? activeClass : inactive].join(" ")}
        data-tour={tourId ? `${tourId}-yes` : undefined}
      >
        {onLabel}
      </button>

      <button
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${offLabel}` : undefined}
        aria-pressed={!v}
        disabled={disabled}
        onClick={() => onChange(false)}
        className={[baseBtn, !v ? activeClass : inactive].join(" ")}
        data-tour={tourId ? `${tourId}-no` : undefined}
      >
        {offLabel}
      </button>
    </div>
  );
}

/** ──────────────────────────────────────────────
 *  Optional tri-state: Yes / No / Unknown
 *  - Does NOT affect existing ToggleYesNo usage
 *  - Default visual state is "Unknown" (value === undefined)
 *  - onChange can return true / false / undefined
 *  - Use this only where you explicitly want 3-state
 *  ────────────────────────────────────────────── */

type TriValue = boolean | undefined;

type TriProps = Omit<Props, "value" | "onChange"> & {
  value?: TriValue;
  onChange: (v: TriValue) => void;
  unknownLabel?: string; // default "Unknown"
};

export function ToggleYesNoTri({
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  tourId,
  onLabel = "Yes",
  offLabel = "No",
  unknownLabel = "Unknown",
  size = "md",
  variant = "default",
}: TriProps) {
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  const current: "yes" | "no" | "unknown" =
    value === true ? "yes" : value === false ? "no" : "unknown";

  const activeClass =
    variant === "soft" ? "bg-slate-600 text-white" : "bg-slate-900 text-white";

  const baseBtn = [
    pad,
    "rounded-lg transition select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  ].join(" ");

  const inactive = "text-slate-700 hover:bg-slate-100";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm"
      data-tour={tourId}
    >
      <button
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${onLabel}` : undefined}
        aria-pressed={current === "yes"}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={[baseBtn, current === "yes" ? activeClass : inactive].join(" ")}
        data-tour={tourId ? `${tourId}-yes` : undefined}
      >
        {onLabel}
      </button>

      <button
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${offLabel}` : undefined}
        aria-pressed={current === "no"}
        disabled={disabled}
        onClick={() => onChange(false)}
        className={[baseBtn, current === "no" ? activeClass : inactive].join(" ")}
        data-tour={tourId ? `${tourId}-no` : undefined}
      >
        {offLabel}
      </button>

      <button
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${unknownLabel}` : undefined}
        aria-pressed={current === "unknown"}
        disabled={disabled}
        onClick={() => onChange(undefined)}
        className={[baseBtn, current === "unknown" ? activeClass : inactive].join(" ")}
        data-tour={tourId ? `${tourId}-unknown` : undefined}
      >
        {unknownLabel}
      </button>
    </div>
  );
}
