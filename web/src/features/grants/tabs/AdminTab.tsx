"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import {
  useGrantAdminPreview,
  useGrantAdminClearPayments,
  useGrantAdminClearEnrollments,
  useGrantAdminReconcileBudget,
} from "@hooks/useGrants";
import { Modal } from "@entities/ui/Modal";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import type { TGrant } from "@types";

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  Number(n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtCount = (n: number, singular: string, plural?: string) =>
  `${n.toLocaleString()} ${n === 1 ? singular : (plural ?? singular + "s")}`;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <span className={["inline-block animate-pulse rounded bg-slate-200 dark:bg-slate-700", className].join(" ")} />;
}

// ─── Impact row ──────────────────────────────────────────────────────────────

function ImpactRow({
  label,
  amount,
  variant,
  loading,
}: {
  label: string;
  count?: number;
  amount?: number;
  variant: "delete" | "preserve" | "neutral";
  loading?: boolean;
}) {
  const dotColor =
    variant === "delete" ? "bg-rose-400" : variant === "preserve" ? "bg-emerald-400" : "bg-slate-300";
  const amtColor =
    variant === "delete"
      ? "text-rose-600 dark:text-rose-400"
      : variant === "preserve"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className={["mt-1.5 h-1.5 w-1.5 flex-none rounded-full", dotColor].join(" ")} />
      <span className="text-slate-700 dark:text-slate-300">
        {loading ? <Skeleton className="h-3 w-28" /> : label}
      </span>
      {amount !== undefined && !loading && (
        <span className={["ml-auto tabular-nums font-medium", amtColor].join(" ")}>{fmtUsd(amount)}</span>
      )}
    </div>
  );
}

// ─── Action card ─────────────────────────────────────────────────────────────

function ActionCard({
  title,
  description,
  children,
  onAction,
  actionLabel,
  actionVariant = "danger",
  disabled,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onAction: () => void;
  actionLabel: string;
  actionVariant?: "danger" | "primary";
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      <div className="px-4 py-3">{children}</div>
      <div className="flex justify-end border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <button
          type="button"
          disabled={disabled}
          onClick={onAction}
          className={[
            "btn btn-sm",
            actionVariant === "danger"
              ? "bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
              : "",
          ].join(" ")}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

type DialogKind = "payments" | "enrollments" | "reconcile";

function ConfirmDialog({
  kind,
  preview,
  grant,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: DialogKind | null;
  preview: any;
  grant: TGrant | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (kind: DialogKind, confirmText: string) => void;
}) {
  const [confirmText, setConfirmText] = React.useState("");
  React.useEffect(() => { if (!kind) setConfirmText(""); }, [kind]);

  if (!kind) return null;

  const needsConfirm = kind !== "reconcile";
  const canSubmit = !needsConfirm || confirmText === "DELETE";

  const budget = grant
    ? {
        total: Number((grant as any)?.budget?.total ?? 0),
        spent: Number((grant as any)?.budget?.totals?.spent ?? 0),
        projected: Number((grant as any)?.budget?.totals?.projected ?? 0),
        balance: Number((grant as any)?.budget?.totals?.balance ?? 0),
      }
    : null;

  return (
    <Modal
      isOpen={!!kind}
      onClose={onCancel}
      widthClass="max-w-lg"
      title={
        kind === "payments"
          ? "Clear Enrollment Payments"
          : kind === "enrollments"
          ? "Clear Enrollments"
          : "Reconcile Budget"
      }
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={[
              "btn btn-sm",
              kind !== "reconcile" ? "bg-rose-600 text-white hover:bg-rose-700" : "",
            ].join(" ")}
            disabled={!canSubmit || busy}
            onClick={() => onConfirm(kind, confirmText)}
          >
            {busy
              ? "Working..."
              : kind === "payments"
              ? "Clear Payments"
              : kind === "enrollments"
              ? "Clear Enrollments"
              : "Reconcile Now"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* ── Payments dialog body ────────────────────────────────────────── */}
        {kind === "payments" && (
          <>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="font-semibold text-rose-800 dark:text-rose-300">This cannot be undone.</div>
              <div className="mt-0.5 text-xs text-rose-700 dark:text-rose-400">
                Enrollment ledger entries and projection queue items will be permanently deleted.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Will Delete</div>
                <ImpactRow
                  label={`${fmtCount(preview?.ledger?.enrollmentSpends?.count ?? 0, "ledger entry", "ledger entries")}`}
                  amount={preview?.ledger?.enrollmentSpends?.amount}
                  variant="delete"
                />
                <ImpactRow
                  label={`${fmtCount(preview?.paymentQueue?.projections?.count ?? 0, "projection")}`}
                  amount={preview?.paymentQueue?.projections?.amount}
                  variant="delete"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Will Preserve</div>
                <ImpactRow
                  label={`${fmtCount(preview?.ledger?.ccInvoice?.count ?? 0, "CC/invoice entry", "CC/invoice entries")}`}
                  amount={preview?.ledger?.ccInvoice?.amount}
                  variant="preserve"
                />
                <ImpactRow
                  label={`${fmtCount(preview?.paymentQueue?.ccInvoice?.count ?? 0, "CC/invoice queue item")}`}
                  amount={preview?.paymentQueue?.ccInvoice?.amount}
                  variant="preserve"
                />
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Budget recomputed from preserved data
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Enrollments dialog body ─────────────────────────────────────── */}
        {kind === "enrollments" && (
          <>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="font-semibold text-rose-800 dark:text-rose-300">This cannot be undone.</div>
              <div className="mt-0.5 text-xs text-rose-700 dark:text-rose-400">
                Enrollments are soft-deleted — they remain in the database marked inactive.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Will Deactivate</div>
                <ImpactRow label={`${fmtCount(preview?.enrollments?.active ?? 0, "active enrollment")}`} variant="delete" />
                <ImpactRow label={`${fmtCount(preview?.enrollments?.inactive ?? 0, "inactive enrollment")}`} variant="neutral" />
                <ImpactRow label={`${fmtCount(preview?.paymentQueue?.projections?.count ?? 0, "pending projection")}`} variant="delete" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Not Affected</div>
                <ImpactRow label="Ledger history" variant="preserve" />
                <ImpactRow label="CC/invoice entries" variant="preserve" />
                <ImpactRow label="Grant budget record" variant="preserve" />
              </div>
            </div>
          </>
        )}

        {/* ── Reconcile dialog body ───────────────────────────────────────── */}
        {kind === "reconcile" && (
          <>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-900/50 dark:bg-sky-950/30">
              <div className="font-semibold text-sky-800 dark:text-sky-300">Safe to run at any time.</div>
              <div className="mt-0.5 text-xs text-sky-700 dark:text-sky-400">
                Counts all ledger entries and pending queue items, then writes the correct totals back to the grant budget. No data is deleted.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Currently Recorded</div>
                {budget ? (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Spent</span><span className="font-medium">{fmtUsd(budget.spent)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Projected</span><span className="font-medium">{fmtUsd(budget.projected)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Balance</span><span className="font-medium">{fmtUsd(budget.balance)}</span></div>
                  </>
                ) : <div className="text-slate-400 text-xs">No budget data</div>}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Will Count</div>
                <ImpactRow label={fmtCount((preview?.ledger?.enrollmentSpends?.count ?? 0) + (preview?.ledger?.ccInvoice?.count ?? 0), "ledger entry", "ledger entries")} variant="neutral" />
                <ImpactRow label={fmtCount((preview?.paymentQueue?.projections?.count ?? 0) + (preview?.paymentQueue?.ccInvoice?.count ?? 0), "queue item")} variant="neutral" />
              </div>
            </div>
          </>
        )}

        {/* ── Confirm input (destructive only) ───────────────────────────── */}
        {needsConfirm && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Type <span className="font-mono font-bold text-slate-900 dark:text-slate-100">DELETE</span> to confirm
            </label>
            <input
              type="text"
              className="input w-full font-mono"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.currentTarget.value)}
              autoFocus
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({ result, onDismiss }: { result: { kind: DialogKind; data: any }; onDismiss: () => void }) {
  const { kind, data } = result;

  const lines: string[] = [];
  if (kind === "payments") {
    lines.push(`Deleted ${data?.deleted?.ledger ?? 0} ledger entries + ${data?.deleted?.paymentQueue ?? 0} projection queue items`);
    const skip = (data?.skipped?.ledger ?? 0) + (data?.skipped?.paymentQueue ?? 0);
    if (skip) lines.push(`${skip} CC/invoice entries preserved`);
    if (data?.totals) {
      lines.push(`New balance: ${fmtUsd(data.totals.balance ?? 0)} · Spent: ${fmtUsd(data.totals.spent ?? 0)}`);
    }
  } else if (kind === "enrollments") {
    lines.push(`${data?.cleared?.enrollments ?? 0} enrollments deactivated`);
    lines.push(`${data?.cleared?.paymentQueue ?? 0} pending projections removed`);
  } else if (kind === "reconcile") {
    if (data?.totals) {
      lines.push(`Spent: ${fmtUsd(data.totals.spent ?? 0)}`);
      lines.push(`Projected: ${fmtUsd(data.totals.projected ?? 0)}`);
      lines.push(`Balance: ${fmtUsd(data.totals.balance ?? 0)}`);
    }
    lines.push(`Counted ${data?.counts?.ledger ?? 0} ledger + ${data?.counts?.paymentQueue ?? 0} queue items`);
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {kind === "payments" ? "Payments Cleared" : kind === "enrollments" ? "Enrollments Cleared" : "Budget Reconciled"}
          </div>
          <ul className="mt-1 space-y-0.5">
            {lines.map((l, i) => (
              <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400">{l}</li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="text-emerald-400 hover:text-emerald-600">×</button>
      </div>
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export function AdminTab({ grantId, grant }: { grantId: string; grant: TGrant | null }) {
  const qc = useQueryClient();
  const {
    data: previewRaw,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = useGrantAdminPreview(grantId);
  const preview = previewRaw as any;

  const [activeDialog, setActiveDialog] = React.useState<DialogKind | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ kind: DialogKind; data: any } | null>(null);

  const clearPayments = useGrantAdminClearPayments();
  const clearEnrollments = useGrantAdminClearEnrollments();
  const reconcile = useGrantAdminReconcileBudget();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.grants.detail(grantId) });
    qc.invalidateQueries({ queryKey: qk.grants.root });
    void refetchPreview();
  };

  const handleConfirm = async (kind: DialogKind, _confirmText: string) => {
    setBusy(true);
    try {
      let resp: any;
      if (kind === "payments") {
        resp = await clearPayments.mutateAsync(grantId);
      } else if (kind === "enrollments") {
        resp = await clearEnrollments.mutateAsync(grantId);
      } else {
        resp = await reconcile.mutateAsync(grantId);
      }
      setActiveDialog(null);
      setLastResult({ kind, data: resp });
      invalidate();
    } catch (e) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const loading = previewLoading;
  const blocked = previewLoading || previewError;

  return (
    <div className="mt-4 space-y-4">
      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/40 dark:bg-orange-950/20">
        <span className="text-lg">⚠️</span>
        <div>
          <div className="text-sm font-semibold text-orange-900 dark:text-orange-200">Admin Operations</div>
          <div className="text-xs text-orange-700 dark:text-orange-400">
            These tools operate directly on Firestore data. Destructive actions show live impact counts before you confirm.
          </div>
        </div>
      </div>

      {/* Preview error */}
      {previewError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="text-sm text-rose-800 dark:text-rose-300">
            Could not load impact preview. Actions are disabled until preview loads successfully.
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm ml-4 text-rose-700"
            onClick={() => void refetchPreview()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Result panel */}
      {lastResult && <ResultPanel result={lastResult} onDismiss={() => setLastResult(null)} />}

      {/* ── Clear Enrollment Payments ──────────────────────────────────── */}
      <ActionCard
        title="Clear Enrollment Payments"
        description="Permanently deletes enrollment-sourced ledger entries and projection queue items. CC and invoice entries are always preserved."
        actionLabel="Clear Enrollment Payments →"
        actionVariant="danger"
        disabled={blocked}
        onAction={() => setActiveDialog("payments")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500">Will Delete</div>
            <div className="space-y-1.5">
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.ledger?.enrollmentSpends?.count ?? 0, "ledger entry", "ledger entries")}
                amount={preview?.ledger?.enrollmentSpends?.amount}
                variant="delete"
                loading={loading}
              />
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.paymentQueue?.projections?.count ?? 0, "projection queue item")}
                amount={preview?.paymentQueue?.projections?.amount}
                variant="delete"
                loading={loading}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Will Preserve</div>
            <div className="space-y-1.5">
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.ledger?.ccInvoice?.count ?? 0, "CC/invoice ledger entry", "CC/invoice ledger entries")}
                amount={preview?.ledger?.ccInvoice?.amount}
                variant="preserve"
                loading={loading}
              />
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.paymentQueue?.ccInvoice?.count ?? 0, "CC/invoice queue item")}
                amount={preview?.paymentQueue?.ccInvoice?.amount}
                variant="preserve"
                loading={loading}
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Budget recomputed from remaining data
              </div>
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ── Clear Enrollments ──────────────────────────────────────────── */}
      <ActionCard
        title="Clear Enrollments"
        description="Soft-deletes all enrollments under this grant and removes their pending projection queue items. Ledger history is not touched."
        actionLabel="Clear Enrollments →"
        actionVariant="danger"
        disabled={blocked}
        onAction={() => setActiveDialog("enrollments")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500">Will Deactivate</div>
            <div className="space-y-1.5">
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.enrollments?.active ?? 0, "active enrollment")}
                variant="delete"
                loading={loading}
              />
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.enrollments?.inactive ?? 0, "inactive enrollment")}
                variant="neutral"
                loading={loading}
              />
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.paymentQueue?.projections?.count ?? 0, "pending projection")}
                variant="delete"
                loading={loading}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Not Affected</div>
            <div className="space-y-1.5">
              <ImpactRow label="Ledger history" variant="preserve" />
              <ImpactRow label="CC/invoice queue items" variant="preserve" />
              <ImpactRow label="Grant budget record" variant="preserve" />
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ── Reconcile Budget ───────────────────────────────────────────── */}
      <ActionCard
        title="Reconcile Budget"
        description="Recounts all ledger entries and pending queue items, then writes the correct totals back. Safe to run at any time — nothing is deleted."
        actionLabel="Reconcile Budget →"
        actionVariant="primary"
        disabled={blocked}
        onAction={() => setActiveDialog("reconcile")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Currently Recorded</div>
            <div className="space-y-1">
              {(["spent", "projected", "balance"] as const).map((key) => {
                const val = Number((grant as any)?.budget?.totals?.[key] ?? 0);
                return (
                  <div key={key} className="flex items-baseline justify-between text-sm">
                    <span className="capitalize text-slate-600 dark:text-slate-400">{key}</span>
                    <span className={["font-medium tabular-nums", key === "balance" && val < 0 ? "text-rose-600" : ""].join(" ")}>
                      {fmtUsd(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Will Count</div>
            <div className="space-y-1.5">
              <ImpactRow
                label={loading ? "" : fmtCount((preview?.ledger?.enrollmentSpends?.count ?? 0) + (preview?.ledger?.ccInvoice?.count ?? 0), "ledger entry", "ledger entries")}
                variant="neutral"
                loading={loading}
              />
              <ImpactRow
                label={loading ? "" : fmtCount((preview?.paymentQueue?.projections?.count ?? 0) + (preview?.paymentQueue?.ccInvoice?.count ?? 0), "pending queue item")}
                variant="neutral"
                loading={loading}
              />
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ── Confirmation dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        kind={activeDialog}
        preview={preview}
        grant={grant}
        busy={busy}
        onCancel={() => { if (!busy) setActiveDialog(null); }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
