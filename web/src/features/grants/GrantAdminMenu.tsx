"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import {
  useGrantAdminClearPayments,
  useGrantAdminClearEnrollments,
  useGrantAdminReconcileBudget,
} from "@hooks/useGrants";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";

interface Props {
  grantId: string;
}

export function GrantAdminMenu({ grantId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const clearPayments = useGrantAdminClearPayments();
  const clearEnrollments = useGrantAdminClearEnrollments();
  const reconcile = useGrantAdminReconcileBudget();

  const invalidateGrant = () => {
    qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) });
    qc.invalidateQueries({ queryKey: qk.grants.root });
  };

  const handleClearPayments = async () => {
    if (window.prompt('This deletes enrollment-sourced ledger entries and projection queue items for this grant only.\n\nCC and invoice payments are preserved. Budget totals are recomputed from what remains.\n\nType DELETE to confirm') !== "DELETE") return;
    setOpen(false);
    setBusy(true);
    try {
      const resp = await clearPayments.mutateAsync(grantId) as any;
      const del = resp?.deleted ?? {};
      const skip = resp?.skipped ?? {};
      const skipNote = (skip.ledger || skip.paymentQueue)
        ? ` (${(skip.ledger ?? 0) + (skip.paymentQueue ?? 0)} CC/invoice entries preserved)`
        : "";
      toast(`Cleared ${del.ledger ?? 0} ledger + ${del.paymentQueue ?? 0} queue items. Budget reconciled.${skipNote}`, { type: "success" });
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleClearEnrollments = async () => {
    if (window.prompt('This soft-deletes ALL enrollments under this grant and removes their pending payment projections.\n\nType DELETE to confirm') !== "DELETE") return;
    setOpen(false);
    setBusy(true);
    try {
      const resp = await clearEnrollments.mutateAsync(grantId) as any;
      const cleared = resp?.cleared ?? {};
      const skip = resp?.skipped ?? {};
      const skipNote = skip.enrollments ? ` (${skip.enrollments} skipped — org mismatch)` : "";
      toast(`${cleared.enrollments ?? 0} enrollment(s) cleared, ${cleared.paymentQueue ?? 0} projection(s) removed.${skipNote}`, { type: "success" });
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleReconcile = async () => {
    setOpen(false);
    setBusy(true);
    try {
      const resp = await reconcile.mutateAsync(grantId) as any;
      const t = resp?.totals ?? {};
      const c = resp?.counts ?? {};
      const fmt = (n: number) => Number(n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      toast(
        `Budget reconciled from ${c.ledger ?? 0} ledger + ${c.paymentQueue ?? 0} queue items. Spent: ${fmt(t.spent)} · Projected: ${fmt(t.projected)} · Balance: ${fmt(t.balance)}`,
        { type: "success" },
      );
      invalidateGrant();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        disabled={busy}
        className="btn btn-ghost btn-sm gap-1 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
        onClick={() => setOpen((v) => !v)}
        title="Admin tools"
      >
        {busy ? "Working..." : "Admin ▾"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-[14px] border border-orange-200 bg-white py-1.5 shadow-lg dark:border-orange-900/50 dark:bg-slate-900">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-orange-500">
            Admin Tools
          </div>

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20"
            onClick={handleClearPayments}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Clear All Payments</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Delete ledger + queue, zero budget totals
            </span>
          </button>

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20"
            onClick={handleClearEnrollments}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Clear All Enrollments</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Soft-delete enrollments + void projections
            </span>
          </button>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={handleReconcile}
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Reconcile Budget</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Recount ledger + projections → write budget totals
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default GrantAdminMenu;
