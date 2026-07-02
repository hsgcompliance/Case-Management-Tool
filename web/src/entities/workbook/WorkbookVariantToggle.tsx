"use client";

// Compact view + toggle control for an already-linked TSS workbook's
// payer/non-payer variant. This flag is what gates the AI case note assistant
// (only "payer" workbooks are eligible) — see functions/src/features/caseNoteAssistant.

import React from "react";
import api from "@client/api";
import { toast } from "@lib/toast";
import type { WorkbookTemplateVariant } from "./WorkbookVariantDialog";

export function WorkbookVariantToggle({
  customerId,
  variant,
  isViewer = false,
  onChanged,
}: {
  customerId: string;
  variant?: string | null;
  isViewer?: boolean;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const current: WorkbookTemplateVariant = variant === "payer" ? "payer" : "nonpayer";

  const setVariant = async (next: WorkbookTemplateVariant) => {
    if (next === current || busy) return;
    setBusy(true);
    try {
      const resp = (await (api as any).postWith("setCustomerWorkbookVariant", {
        customerId,
        variant: next,
      })) as Record<string, unknown>;
      if (resp?.ok) {
        toast(
          next === "payer"
            ? "Marked payer — AI case note assistant is now available."
            : "Marked non-payer — AI case note assistant is now disabled.",
          { type: "success" },
        );
        onChanged?.();
      } else {
        toast(String(resp?.error || "Failed to update workbook variant."), { type: "error" });
      }
    } catch {
      toast("Failed to update workbook variant.", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (isViewer) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          current === "payer"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
        title={current === "payer" ? "AI case note assistant enabled" : "AI case note assistant disabled"}
      >
        {current === "payer" ? "Payer" : "Non-payer"}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]"
      title="Payer status controls AI case note assistant availability"
    >
      <button
        type="button"
        className={`rounded-md px-2 py-1 font-medium transition ${
          current === "nonpayer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
        disabled={busy}
        onClick={() => void setVariant("nonpayer")}
      >
        Non-payer
      </button>
      <button
        type="button"
        className={`rounded-md px-2 py-1 font-medium transition ${
          current === "payer" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
        disabled={busy}
        onClick={() => void setVariant("payer")}
      >
        Payer
      </button>
    </div>
  );
}
