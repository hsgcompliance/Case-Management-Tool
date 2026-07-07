"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { qk } from "@hooks/queryKeys";
import {
  useGrants,
  useGrantAdminPreview,
  useGrantAdminClearPayments,
  useGrantAdminClearEnrollments,
  useGrantAdminReconcileBudget,
  useAdminDeleteGrants,
} from "@hooks/useGrants";
import { useEnrollments, useEnrollmentsMigrate } from "@hooks/useEnrollments";
import { Modal } from "@entities/ui/Modal";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import { fmtCurrencyUSD } from "@lib/formatters";
import type { EnrollmentsMigrateReq, TGrant } from "@types";
import type { Enrollment } from "@client/enrollments";
import { GrantLinkingAdminPanel } from "../GrantLinkingAdminPanel";

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => fmtCurrencyUSD(n);

const fmtCount = (n: number, singular: string, plural?: string) =>
  `${n.toLocaleString()} ${n === 1 ? singular : (plural ?? singular + "s")}`;

function isProgramTarget(row: TGrant | null | undefined): boolean {
  return String((row as any)?.kind || "").trim().toLowerCase() === "program";
}

function targetLabel(row: TGrant | null | undefined): "Grant" | "Program" {
  return isProgramTarget(row) ? "Program" : "Grant";
}

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

type DialogKind = "payments" | "enrollments" | "reconcile" | "hardDelete";

type EnrollStatus = "active" | "inactive" | "deleted";
type MigrationCloseTaskMode = "complete" | "delete";
type MigrationClosePaymentMode = "spendUnpaid" | "deleteUnpaid" | "keep";

const todayISO = () => new Date().toISOString().slice(0, 10);

function enrollmentStatus(row: Record<string, unknown>): EnrollStatus {
  if (row.deleted === true || String(row.status || "").toLowerCase() === "deleted") return "deleted";
  return row.active === true ? "active" : "inactive";
}

function date10(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return ((value as { toDate: () => Date }).toDate()).toISOString().slice(0, 10);
  }
  return "";
}

function ConfirmDialog({
  kind,
  preview,
  grant,
  busy,
  enrollStatuses,
  onEnrollStatusesChange,
  onCancel,
  onConfirm,
}: {
  kind: DialogKind | null;
  preview: any;
  grant: TGrant | null;
  busy: boolean;
  enrollStatuses: EnrollStatus[];
  onEnrollStatusesChange: (s: EnrollStatus[]) => void;
  onCancel: () => void;
  onConfirm: (kind: DialogKind, confirmText: string) => void;
}) {
  const [confirmText, setConfirmText] = React.useState("");
  React.useEffect(() => { if (!kind) setConfirmText(""); }, [kind]);

  const toggleStatus = (s: EnrollStatus) => {
    onEnrollStatusesChange(
      enrollStatuses.includes(s) ? enrollStatuses.filter((x) => x !== s) : [...enrollStatuses, s],
    );
  };

  if (!kind) return null;

  const isProgram = isProgramTarget(grant);
  const label = targetLabel(grant);
  const needsConfirm = kind !== "reconcile";
  const enrollStatusesOk = kind !== "enrollments" || enrollStatuses.length > 0;
  const canSubmit = (!needsConfirm || confirmText === "DELETE") && enrollStatusesOk;

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
          : kind === "hardDelete"
          ? `Hard Delete ${label}`
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
              : kind === "hardDelete"
              ? `Delete ${label} Permanently`
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
                Enrollment ledger entries, deprecated spend mirrors, and projection queue items will be permanently deleted.
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
                <ImpactRow
                  label={`${fmtCount(preview?.spendMirrors?.count ?? 0, "deprecated spend mirror")}`}
                  amount={preview?.spendMirrors?.amount}
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
                Selected enrollments are permanently deleted from Firestore. Ledger history is not touched.
              </div>
            </div>

            {/* Status multi-select */}
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Target statuses</div>
              <div className="flex gap-3">
                {(["active", "inactive", "deleted"] as EnrollStatus[]).map((s) => {
                  const counts: Record<EnrollStatus, number> = {
                    active:   preview?.enrollments?.active   ?? 0,
                    inactive: preview?.enrollments?.inactive ?? 0,
                    deleted:  preview?.enrollments?.deleted  ?? 0,
                  };
                  const checked = enrollStatuses.includes(s);
                  return (
                    <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStatus(s)}
                        className="rounded"
                      />
                      <span className="capitalize text-slate-700 dark:text-slate-300">{s}</span>
                      <span className="ml-1 tabular-nums text-xs text-slate-400">({counts[s]})</span>
                    </label>
                  );
                })}
              </div>
              {enrollStatuses.length === 0 && (
                <div className="mt-1.5 text-xs text-rose-500">Select at least one status.</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Will Hard Delete</div>
                {(["active", "inactive", "deleted"] as EnrollStatus[]).map((s) => {
                  const counts: Record<EnrollStatus, number> = {
                    active:   preview?.enrollments?.active   ?? 0,
                    inactive: preview?.enrollments?.inactive ?? 0,
                    deleted:  preview?.enrollments?.deleted  ?? 0,
                  };
                  const included = enrollStatuses.includes(s);
                  return (
                    <ImpactRow
                      key={s}
                      label={fmtCount(counts[s], `${s} enrollment`)}
                      variant={included ? "delete" : "neutral"}
                    />
                  );
                })}
                <ImpactRow
                  label={fmtCount(preview?.paymentQueue?.projections?.count ?? 0, "pending projection")}
                  variant="delete"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Not Affected</div>
                <ImpactRow label="Ledger history" variant="preserve" />
                <ImpactRow label="CC/invoice queue items" variant="preserve" />
                <ImpactRow label={isProgram ? "Program record" : "Grant budget record"} variant="preserve" />
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

        {/* ── Hard Delete dialog body ─────────────────────────────────── */}
        {kind === "hardDelete" && (
          <>
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 dark:border-rose-800/60 dark:bg-rose-950/40">
              <div className="font-semibold text-rose-800 dark:text-rose-300">This permanently removes the {label.toLowerCase()} from Firestore.</div>
              <div className="mt-0.5 text-xs text-rose-700 dark:text-rose-400">
                The document and all nested data are unrecoverable after deletion.
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Recommended: clear data first</div>
              <div className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                <div>• Use <span className="font-semibold">Clear Enrollment Payments</span> to remove ledger entries and projection queue items.</div>
                <div>• Use <span className="font-semibold">Clear Enrollments</span> to soft-delete active enrollments.</div>
                <div className="mt-1">Skipping these steps will leave orphaned enrollments and payment records pointing to a deleted grant.</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500">May Be Orphaned</div>
                <ImpactRow
                  label={fmtCount((preview?.enrollments?.active ?? 0) + (preview?.enrollments?.inactive ?? 0), "enrollment")}
                  variant="delete"
                />
                <ImpactRow
                  label={fmtCount((preview?.ledger?.enrollmentSpends?.count ?? 0) + (preview?.ledger?.ccInvoice?.count ?? 0), "ledger entry", "ledger entries")}
                  amount={(preview?.ledger?.enrollmentSpends?.amount ?? 0) + (preview?.ledger?.ccInvoice?.amount ?? 0)}
                  variant="delete"
                />
                <ImpactRow
                  label={fmtCount((preview?.paymentQueue?.projections?.count ?? 0) + (preview?.paymentQueue?.ccInvoice?.count ?? 0), "queue item")}
                  variant="delete"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-500">Deleted from Firestore</div>
                <ImpactRow label={`${label} document`} variant="delete" />
                <ImpactRow label={isProgram ? "Program settings & pins" : "Budget record & pins"} variant="delete" />
                <ImpactRow label="Nested subcollections" variant="delete" />
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
    if (Number(data?.deleted?.spendMirrors ?? 0) > 0) {
      lines.push(`Deleted ${data.deleted.spendMirrors} deprecated enrollment spend mirrors`);
    }
    const skip = (data?.skipped?.ledger ?? 0) + (data?.skipped?.paymentQueue ?? 0);
    if (skip) lines.push(`${skip} CC/invoice entries preserved`);
    if (data?.totals) {
      lines.push(`New balance: ${fmtUsd(data.totals.balance ?? 0)} · Spent: ${fmtUsd(data.totals.spent ?? 0)}`);
    }
  } else if (kind === "enrollments") {
    lines.push(`${data?.cleared?.enrollments ?? 0} enrollments deactivated`);
    lines.push(`${data?.cleared?.paymentQueue ?? 0} pending projections removed`);
    if (Number(data?.cleared?.spendMirrors ?? 0) > 0) {
      lines.push(`${data.cleared.spendMirrors} deprecated spend mirrors removed`);
    }
  } else if (kind === "reconcile") {
    if (data?.migrationSummary) {
      lines.push(`Migrated ${(data.migrationSummary.total ?? 0) - (data.migrationSummary.failed ?? 0)} of ${data.migrationSummary.total ?? 0} enrollments`);
      if (data.migrationSummary.failed) lines.push(`${data.migrationSummary.failed} migrations failed`);
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Bulk Migration Finished</div>
              <ul className="mt-1 space-y-0.5">
                {lines.map((l, i) => <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400">{l}</li>)}
              </ul>
            </div>
            <button type="button" onClick={onDismiss} className="text-emerald-400 hover:text-emerald-600">×</button>
          </div>
        </div>
      );
    }
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

// ─── Bulk migration dialog ───────────────────────────────────────────────────

type MigrationOptions = {
  toGrantId: string;
  cutoverDate: string;
  statuses: EnrollStatus[];
  lineItemMap: Record<string, string>;
  moveSpends: boolean;
  moveTasks: boolean;
  movePaidPayments: boolean;
  rebuildScheduleMeta: boolean;
  closeSourceTaskMode: MigrationCloseTaskMode;
  closeSourcePaymentMode: MigrationClosePaymentMode;
};

function lineItemOptions(grantLike: TGrant | null | undefined) {
  const items = Array.isArray((grantLike as any)?.budget?.lineItems) ? (grantLike as any).budget.lineItems : [];
  return items
    .map((li: any) => ({ id: String(li?.id || "").trim(), label: String(li?.label || li?.name || li?.id || "").trim() }))
    .filter((li: { id: string }) => li.id);
}

function buildSmartLineItemMap(source: Array<{ id: string; label: string }>, dest: Array<{ id: string; label: string }>) {
  const destIds = new Set(dest.map((li) => li.id));
  const destByLabel = new Map(dest.map((li) => [li.label.toLowerCase(), li.id]));
  const singleDest = dest.length === 1 ? dest[0].id : "";
  const out: Record<string, string> = {};
  for (const src of source) {
    out[src.id] = destIds.has(src.id) ? src.id : destByLabel.get(src.label.toLowerCase()) || singleDest || "";
  }
  return out;
}

function BulkMigrationDialog({
  open,
  sourceGrant,
  enrollments,
  grants,
  running,
  progress,
  onCancel,
  onRun,
}: {
  open: boolean;
  sourceGrant: TGrant | null;
  enrollments: Enrollment[];
  grants: TGrant[];
  running: boolean;
  progress: { done: number; total: number; failed: number } | null;
  onCancel: () => void;
  onRun: (opts: MigrationOptions, targets: Enrollment[]) => void;
}) {
  const [toGrantId, setToGrantId] = React.useState("");
  const [cutoverDate, setCutoverDate] = React.useState(todayISO());
  const [statuses, setStatuses] = React.useState<EnrollStatus[]>(["active"]);
  const [moveSpends, setMoveSpends] = React.useState(true);
  const [moveTasks, setMoveTasks] = React.useState(true);
  const [movePaidPayments, setMovePaidPayments] = React.useState(false);
  const [rebuildScheduleMeta, setRebuildScheduleMeta] = React.useState(true);
  const [closeSourceTaskMode, setCloseSourceTaskMode] = React.useState<MigrationCloseTaskMode>("complete");
  const [closeSourcePaymentMode, setCloseSourcePaymentMode] = React.useState<MigrationClosePaymentMode>("deleteUnpaid");
  const [lineItemMap, setLineItemMap] = React.useState<Record<string, string>>({});
  const [confirmText, setConfirmText] = React.useState("");

  const sourceLineItems = React.useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    for (const li of lineItemOptions(sourceGrant)) byId.set(li.id, li);
    for (const enrollment of enrollments) {
      for (const payment of Array.isArray((enrollment as any).payments) ? (enrollment as any).payments : []) {
        const id = String(payment?.lineItemId || "").trim();
        if (id && !byId.has(id)) byId.set(id, { id, label: id });
      }
    }
    return Array.from(byId.values());
  }, [sourceGrant, enrollments]);

  const destGrant = React.useMemo(() => grants.find((g) => String((g as any)?.id || "") === toGrantId) || null, [grants, toGrantId]);
  const destLineItems = React.useMemo(() => lineItemOptions(destGrant), [destGrant]);

  React.useEffect(() => {
    if (!open) return;
    setConfirmText("");
  }, [open]);

  React.useEffect(() => {
    setLineItemMap(toGrantId ? buildSmartLineItemMap(sourceLineItems, destLineItems) : {});
  }, [toGrantId, sourceLineItems, destLineItems]);

  const toggleStatus = (status: EnrollStatus) => {
    setStatuses((prev) => prev.includes(status) ? prev.filter((x) => x !== status) : [...prev, status]);
  };

  const targetEnrollments = React.useMemo(() => {
    return enrollments.filter((e) => {
      if (String((e as any).grantId || "") !== String((sourceGrant as any)?.id || "")) return false;
      if (!statuses.includes(enrollmentStatus(e as any))) return false;
      if (String((e as any).grantId || "") === toGrantId) return false;
      if ((e as any).migratedTo) return false;
      return true;
    });
  }, [enrollments, sourceGrant, statuses, toGrantId]);

  const impact = React.useMemo(() => {
    let futurePayments = 0;
    let futurePaid = 0;
    let futureUnpaid = 0;
    let futureAmount = 0;
    let futurePaidAmount = 0;
    let futureUnpaidAmount = 0;
    let tasks = 0;
    for (const enrollment of targetEnrollments) {
      for (const payment of Array.isArray((enrollment as any).payments) ? (enrollment as any).payments : []) {
        const due = date10(payment?.dueDate || payment?.date);
        if (due && due >= cutoverDate) {
          const amount = Number(payment?.amount || 0);
          futurePayments++;
          futureAmount += Number.isFinite(amount) ? amount : 0;
          if (payment?.paid) {
            futurePaid++;
            futurePaidAmount += Number.isFinite(amount) ? amount : 0;
          } else {
            futureUnpaid++;
            futureUnpaidAmount += Number.isFinite(amount) ? amount : 0;
          }
        }
      }
      for (const task of Array.isArray((enrollment as any).taskSchedule) ? (enrollment as any).taskSchedule : []) {
        const due = date10(task?.dueDate || task?.date);
        if (due && due >= cutoverDate) tasks++;
      }
    }
    return { futurePayments, futurePaid, futureUnpaid, futureAmount, futurePaidAmount, futureUnpaidAmount, tasks };
  }, [targetEnrollments, cutoverDate]);

  const sourceIsProgram = isProgramTarget(sourceGrant);
  const destIsProgram = isProgramTarget(destGrant);
  const programInvolved = sourceIsProgram || destIsProgram;
  const budgetImpact =
    impact.futureUnpaid > 0 ||
    (movePaidPayments && impact.futurePaid > 0) ||
    moveSpends ||
    closeSourcePaymentMode === "spendUnpaid";
  const mappingRequired =
    impact.futureUnpaid > 0 ||
    (movePaidPayments && impact.futurePaid > 0) ||
    moveSpends;
  const mapped = !mappingRequired || sourceLineItems.every((li) => !!lineItemMap[li.id]);
  const canRun = !!toGrantId && !!cutoverDate && statuses.length > 0 && targetEnrollments.length > 0 && mapped && confirmText === "MIGRATE" && !running;

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      widthClass="max-w-4xl"
      title="Smart Bulk Migration"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {progress ? `${progress.done}/${progress.total} complete, ${progress.failed} failed` : `${targetEnrollments.length} enrollment targets`}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={running}>Cancel</button>
            <button type="button" className="btn btn-sm" disabled={!canRun} onClick={() => onRun({ toGrantId, cutoverDate, statuses, lineItemMap, moveSpends, moveTasks, movePaidPayments, rebuildScheduleMeta, closeSourceTaskMode, closeSourcePaymentMode }, targetEnrollments)}>
              {running ? "Migrating..." : "Run Migration"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label>
            <div className="mb-1 text-xs font-medium text-slate-600">Destination</div>
            <select className="input w-full" value={toGrantId} onChange={(e) => setToGrantId(e.currentTarget.value)} disabled={running}>
              <option value="">Select destination...</option>
              {grants.filter((g) => String((g as any)?.id || "") !== String((sourceGrant as any)?.id || "")).map((g) => (
                <option key={String((g as any).id)} value={String((g as any).id)}>
                  {String((g as any).name || (g as any).code || (g as any).id)} ({targetLabel(g)})
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="mb-1 text-xs font-medium text-slate-600">Cutover date</div>
            <input className="input w-full" type="date" value={cutoverDate} onChange={(e) => setCutoverDate(e.currentTarget.value || todayISO())} disabled={running} />
          </label>
        </div>

        {programInvolved && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="text-sm font-semibold">Budget information may be lost or skipped.</div>
            <div className="mt-1 text-xs">
              Programs do not carry grant budgets. Non-dev users cannot run migrations that move payments, spends, or recalculate budget projections to or from a Program.
            </div>
            {budgetImpact && (
              <div className="mt-2 space-y-1 text-xs">
                <div className="font-semibold">Preview breaking changes:</div>
                {impact.futureUnpaid > 0 && <div>- {fmtCount(impact.futureUnpaid, "future unpaid payment")} may need manual handling.</div>}
                {movePaidPayments && impact.futurePaid > 0 && <div>- {fmtCount(impact.futurePaid, "future paid payment")} would move from the source target.</div>}
                {moveSpends && <div>- Ledger spends after cutover would move to the destination target.</div>}
                {closeSourcePaymentMode === "spendUnpaid" && <div>- Source unpaid projections would be converted into spend before closeout.</div>}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Target Enrollments</div>
          <div className="flex flex-wrap gap-3">
            {(["active", "inactive", "deleted"] as EnrollStatus[]).map((status) => {
              const count = enrollments.filter((e) => enrollmentStatus(e as any) === status).length;
              return (
                <label key={status} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} disabled={running} />
                  <span className="capitalize">{status}</span>
                  <span className="text-xs text-slate-400">({count})</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Will Migrate</div>
            <div className="mt-2 space-y-1">
              <ImpactRow label={fmtCount(targetEnrollments.length, "enrollment")} variant="neutral" />
              <ImpactRow label={fmtCount(impact.futurePayments, "future payment")} amount={impact.futureAmount} variant="neutral" />
              <ImpactRow label={fmtCount(impact.tasks, "future task")} variant="neutral" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid Policy</div>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2"><input type="radio" checked={!movePaidPayments} onChange={() => setMovePaidPayments(false)} disabled={running} /> Keep paid on source</label>
              <label className="flex items-center gap-2"><input type="radio" checked={movePaidPayments} onChange={() => setMovePaidPayments(true)} disabled={running} /> Move paid after cutover</label>
              <div className="text-xs text-slate-500">{fmtCount(impact.futurePaid, "paid row")} / {fmtUsd(impact.futurePaidAmount)}</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unpaid Projections</div>
            <div className="mt-2 text-sm">{fmtCount(impact.futureUnpaid, "unpaid row")} / {fmtUsd(impact.futureUnpaidAmount)}</div>
            <select className="input mt-2 w-full" value={closeSourcePaymentMode} onChange={(e) => setCloseSourcePaymentMode(e.currentTarget.value as MigrationClosePaymentMode)} disabled={running}>
              <option value="deleteUnpaid">Delete from source</option>
              <option value="keep">Keep on source</option>
              <option value="spendUnpaid">Run spend on source</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Options</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={moveSpends} onChange={(e) => setMoveSpends(e.currentTarget.checked)} disabled={running} /> Move ledger spends after cutover</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={moveTasks} onChange={(e) => setMoveTasks(e.currentTarget.checked)} disabled={running} /> Move tasks after cutover</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={rebuildScheduleMeta} onChange={(e) => setRebuildScheduleMeta(e.currentTarget.checked)} disabled={running} /> Rebuild destination schedule meta</label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Future task close policy</span>
              <select className="input w-full" value={closeSourceTaskMode} onChange={(e) => setCloseSourceTaskMode(e.currentTarget.value as MigrationCloseTaskMode)} disabled={running}>
                <option value="complete">Mark source tasks complete</option>
                <option value="delete">Delete source tasks</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Line Item Mapping</div>
          <div className="space-y-2">
            {sourceLineItems.length === 0 ? <div className="text-slate-500">No source line items found.</div> : sourceLineItems.map((src) => (
              <div key={src.id} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_1fr]">
                <div>
                  <div className="font-medium">{src.label || src.id}</div>
                  <div className="text-xs text-slate-400">{src.id}</div>
                </div>
                <select className="input w-full" value={lineItemMap[src.id] || ""} onChange={(e) => {
                  const value = e.currentTarget.value;
                  setLineItemMap((prev) => ({ ...prev, [src.id]: value }));
                }} disabled={!toGrantId || running}>
                  <option value="">Select destination line item...</option>
                  {destLineItems.map((li) => <option key={li.id} value={li.id}>{li.label || li.id}</option>)}
                </select>
              </div>
            ))}
          </div>
          {mappingRequired && !mapped && <div className="mt-2 text-xs text-rose-600">Map every source line item before running migration.</div>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Type <span className="font-mono font-bold text-slate-900">MIGRATE</span> to confirm</label>
          <input className="input w-full font-mono" value={confirmText} onChange={(e) => setConfirmText(e.currentTarget.value)} disabled={running} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export function AdminTab({ grantId, grant }: { grantId: string; grant: TGrant | null }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: allGrants = [] } = useGrants({ limit: 500 }, { staleTime: 60_000 });
  const { data: grantEnrollments = [], isLoading: enrollmentsLoading } = useEnrollments({ grantId, limit: 500 }, { enabled: !!grantId });
  const {
    data: previewRaw,
    isLoading: previewLoading,
    isError: previewError,
    refetch: refetchPreview,
  } = useGrantAdminPreview(grantId);
  const preview = previewRaw as any;

  const [activeDialog, setActiveDialog] = React.useState<DialogKind | null>(null);
  const [bulkMigrationOpen, setBulkMigrationOpen] = React.useState(false);
  const [migrationProgress, setMigrationProgress] = React.useState<{ done: number; total: number; failed: number } | null>(null);
  const [enrollStatuses, setEnrollStatuses] = React.useState<("active" | "inactive" | "deleted")[]>(["active", "inactive"]);
  const [busy, setBusy] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ kind: DialogKind; data: any } | null>(null);

  const clearPayments = useGrantAdminClearPayments();
  const clearEnrollments = useGrantAdminClearEnrollments();
  const reconcile = useGrantAdminReconcileBudget();
  const hardDelete = useAdminDeleteGrants();
  const migrateEnrollment = useEnrollmentsMigrate();

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
        resp = await clearEnrollments.mutateAsync({ grantId, statuses: enrollStatuses });
      } else if (kind === "hardDelete") {
        await hardDelete.mutateAsync(grantId);
        qc.invalidateQueries({ queryKey: qk.grants.root });
        router.push("/grants");
        return;
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

  const handleBulkMigration = async (opts: MigrationOptions, targets: Enrollment[]) => {
    setBusy(true);
    setMigrationProgress({ done: 0, total: targets.length, failed: 0 });
    const failures: Array<{ id: string; error: string }> = [];
    try {
      for (const enrollment of targets) {
        const body: EnrollmentsMigrateReq = {
          enrollmentId: String(enrollment.id || ""),
          toGrantId: opts.toGrantId,
          cutoverDate: opts.cutoverDate,
          lineItemMap: opts.lineItemMap,
          closeSource: true,
          moveSpends: opts.moveSpends,
          moveTasks: opts.moveTasks,
          movePaidPayments: opts.movePaidPayments,
          rebuildScheduleMeta: opts.rebuildScheduleMeta,
          closeSourceTaskMode: opts.closeSourceTaskMode,
          closeSourcePaymentMode: opts.closeSourcePaymentMode,
          customerId: String((enrollment as any).customerId || ""),
        } as EnrollmentsMigrateReq;
        try {
          await migrateEnrollment.mutateAsync(body);
          setMigrationProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: targets.length, failed: prev?.failed ?? 0 }));
        } catch (e) {
          failures.push({ id: String(enrollment.id || ""), error: toApiError(e).error });
          setMigrationProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: targets.length, failed: (prev?.failed ?? 0) + 1 }));
        }
      }
      setBulkMigrationOpen(false);
      setLastResult({
        kind: "reconcile",
        data: {
          totals: null,
          counts: { ledger: 0, paymentQueue: 0 },
          migrationSummary: { total: targets.length, failed: failures.length },
        },
      });
      if (failures.length) {
        const firstError = failures[0]?.error || "Migration failed.";
        toast(
          failures.length === targets.length
            ? firstError
            : `Migrated ${targets.length - failures.length} of ${targets.length} enrollment${targets.length === 1 ? "" : "s"}. First failure: ${firstError}`,
          { type: failures.length === targets.length ? "error" : "warning" },
        );
        console.warn("Bulk enrollment migration failures", failures);
      } else {
        toast(`Migrated ${targets.length} enrollment${targets.length === 1 ? "" : "s"}.`, { type: "success" });
      }
      invalidate();
      qc.invalidateQueries({ queryKey: qk.enrollments.root });
    } finally {
      setBusy(false);
      setMigrationProgress(null);
    }
  };

  const loading = previewLoading;
  const blocked = previewLoading || previewError;
  const migrationTargets = (grantEnrollments as Enrollment[]).filter((e) => enrollmentStatus(e as any) === "active").length;
  const isProgram = isProgramTarget(grant);
  const label = targetLabel(grant);

  return (
    <div className="mt-4 space-y-4">
      {grant ? (
        <GrantLinkingAdminPanel
          grant={grant as TGrant & { id?: string }}
          grants={allGrants as Array<TGrant & { id?: string }>}
        />
      ) : null}
      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/40 dark:bg-orange-950/20">
        <span className="text-lg">⚠️</span>
        <div>
          <div className="text-sm font-semibold text-orange-900 dark:text-orange-200">Admin Operations</div>
          <div className="text-xs text-orange-700 dark:text-orange-400">
            These tools operate directly on Firestore data. Destructive actions show live impact counts before you confirm.
            {isProgram ? " Programs reuse enrollment tools but do not use grant budget workflows." : ""}
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

      {isProgram && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
          Programs do not expose budget reconciliation or payment-clear tools. Use enrollment cleanup and migration tools for participation changes.
        </div>
      )}

      {/* ── Clear Enrollment Payments ──────────────────────────────────── */}
      {!isProgram && (
      <ActionCard
        title="Clear Enrollment Payments"
        description="Permanently deletes enrollment-sourced ledger entries, deprecated enrollment spend mirrors, and projection queue items. CC and invoice entries are always preserved."
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
              <ImpactRow
                label={loading ? "" : fmtCount(preview?.spendMirrors?.count ?? 0, "deprecated spend mirror")}
                amount={preview?.spendMirrors?.amount}
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
      )}

      {/* ── Clear Enrollments ──────────────────────────────────────────── */}
      <ActionCard
        title="Clear Enrollments"
        description={`Soft-deletes all enrollments under this ${label.toLowerCase()} and removes their pending projection queue items. Ledger history is not touched.`}
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
              <ImpactRow label={isProgram ? "Program record" : "Grant budget record"} variant="preserve" />
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ── Reconcile Budget ───────────────────────────────────────────── */}
      {!isProgram && (
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
      )}

      {/* ── Smart Bulk Migration ──────────────────────────────────────── */}
      <ActionCard
        title="Smart Bulk Migration"
        description={`Mass-migrates enrollments from this ${label.toLowerCase()} to another grant or program using the existing migration engine, with cutover, paid-spend, task, and line-item impact preview.`}
        actionLabel="Open Migration Preview →"
        actionVariant="primary"
        disabled={enrollmentsLoading || busy}
        onAction={() => setBulkMigrationOpen(true)}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Currently Loaded</div>
            <div className="space-y-1.5">
              <ImpactRow
                label={enrollmentsLoading ? "" : fmtCount((grantEnrollments as Enrollment[]).length, "enrollment")}
                variant="neutral"
                loading={enrollmentsLoading}
              />
              <ImpactRow
                label={enrollmentsLoading ? "" : fmtCount(migrationTargets, "active migration target")}
                variant="neutral"
                loading={enrollmentsLoading}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Will Preserve</div>
            <div className="space-y-1.5">
              <ImpactRow label="Single-enrollment migration audit records" variant="preserve" />
              <ImpactRow label="Migration undo snapshots" variant="preserve" />
            </div>
          </div>
        </div>
      </ActionCard>

      {/* ── Hard Delete Grant ──────────────────────────────────────────── */}
      <ActionCard
        title={`Hard Delete ${label}`}
        description={`Permanently removes the ${label.toLowerCase()} document from Firestore. Enrollments and payment records are not automatically deleted — clear them first to avoid orphaned data.`}
        actionLabel={`Hard Delete ${label} →`}
        actionVariant="danger"
        disabled={blocked}
        onAction={() => setActiveDialog("hardDelete")}
      >
        <div className="space-y-1.5">
          <ImpactRow
            label={loading ? "" : `${fmtCount((preview?.enrollments?.active ?? 0) + (preview?.enrollments?.inactive ?? 0) + (preview?.enrollments?.deleted ?? 0), "enrollment")} may be orphaned`}
            variant="delete"
            loading={loading}
          />
          <ImpactRow
            label={loading ? "" : `${fmtCount((preview?.ledger?.enrollmentSpends?.count ?? 0) + (preview?.ledger?.ccInvoice?.count ?? 0), "ledger entry", "ledger entries")} may be orphaned`}
            amount={loading ? undefined : (preview?.ledger?.enrollmentSpends?.amount ?? 0) + (preview?.ledger?.ccInvoice?.amount ?? 0)}
            variant="delete"
            loading={loading}
          />
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {isProgram ? "Run Clear Enrollments first." : "Run Clear Enrollment Payments and Clear Enrollments first."}
          </div>
        </div>
      </ActionCard>

      <BulkMigrationDialog
        open={bulkMigrationOpen}
        sourceGrant={grant}
        enrollments={grantEnrollments as Enrollment[]}
        grants={allGrants as TGrant[]}
        running={busy && bulkMigrationOpen}
        progress={migrationProgress}
        onCancel={() => { if (!busy) setBulkMigrationOpen(false); }}
        onRun={(opts, targets) => void handleBulkMigration(opts, targets)}
      />

      {/* ── Confirmation dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        kind={activeDialog}
        preview={preview}
        grant={grant}
        busy={busy}
        enrollStatuses={enrollStatuses}
        onEnrollStatusesChange={setEnrollStatuses}
        onCancel={() => { if (!busy) setActiveDialog(null); }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
