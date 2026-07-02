"use client";

import React from "react";

export type WorkbookTemplateVariant = "payer" | "nonpayer";

export function WorkbookVariantDialog({
  open,
  variant,
  busy = false,
  title = "Create TSS workbook",
  description = "Choose which configured template variant to copy into this customer's Drive folder.",
  confirmLabel = "Create workbook",
  onVariantChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  variant: WorkbookTemplateVariant;
  busy?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onVariantChange: (variant: WorkbookTemplateVariant) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>

        <div className="space-y-2 px-4 py-3">
          <button
            type="button"
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
              variant === "nonpayer"
                ? "border-sky-300 bg-sky-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
            onClick={() => onVariantChange("nonpayer")}
            disabled={busy}
          >
            <span
              className={`mt-0.5 h-3.5 w-3.5 rounded-full border ${
                variant === "nonpayer" ? "border-sky-600 bg-sky-600" : "border-slate-300"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">Non-payer / not sure</span>
              <span className="block text-xs text-slate-500">Use when Medicaid payer status is not confirmed.</span>
            </span>
          </button>

          <button
            type="button"
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
              variant === "payer"
                ? "border-sky-300 bg-sky-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
            onClick={() => onVariantChange("payer")}
            disabled={busy}
          >
            <span
              className={`mt-0.5 h-3.5 w-3.5 rounded-full border ${
                variant === "payer" ? "border-sky-600 bg-sky-600" : "border-slate-300"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">Payer</span>
              <span className="block text-xs text-slate-500">Use when Medicaid payer status is confirmed.</span>
            </span>
          </button>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Note: a future App Script library action should support converting an existing workbook between payer and non-payer variants.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? "Creating..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
