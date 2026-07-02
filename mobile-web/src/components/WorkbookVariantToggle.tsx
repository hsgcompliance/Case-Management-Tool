import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GoogleIntegrations } from "@/lib/googleIntegrations";
import { qk } from "@/hooks/queryKeys";

/**
 * Compact view + toggle for an already-linked TSS workbook's payer/non-payer
 * variant. This flag gates the AI case note assistant (payer-only) — see
 * functions/src/features/caseNoteAssistant.
 */
export function WorkbookVariantToggle({
  customerId,
  variant,
}: {
  customerId: string;
  variant?: string | null;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Legacy links may have no persisted variant — the backend denies AI for
  // those, so clicking "Non-payer" on an unset workbook must persist it
  // rather than no-oping.
  const hasExplicitVariant = variant === "payer" || variant === "nonpayer";
  const current: "payer" | "nonpayer" = variant === "payer" ? "payer" : "nonpayer";

  async function setVariant(next: "payer" | "nonpayer") {
    if (busy || (hasExplicitVariant && next === current)) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await GoogleIntegrations.setWorkbookVariant({ customerId, variant: next });
      if (!resp.ok) { setError(resp.error || "Could not update workbook type."); return; }
      await qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) });
      void qc.invalidateQueries({ queryKey: qk.customers.root });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update workbook type.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Workbook type:</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(["nonpayer", "payer"] as const).map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => void setVariant(v)}
              className={`px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
                current === v ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              {v === "nonpayer" ? "Non-payer" : "Payer"}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
