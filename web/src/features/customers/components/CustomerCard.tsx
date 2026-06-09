"use client";

import React from "react";
import type { Enrollment, TCustomerEntity } from "@types";
import { useCustomerEnrollments, useEnrollmentActionsApply, useEnrollmentsDelete, useEnrollmentsPatch } from "@hooks/useEnrollments";
import { useTasksForEnrollments, type TasksListItem } from "@hooks/useTasks";
import { currentMonthKey } from "@hooks/useMetrics";
import { useGrant, useGrants } from "@hooks/useGrants";
import { useAuth } from "@app/auth/AuthProvider";
import { Modal } from "@entities/ui/Modal";
import { EnrollmentMigrateDialog } from "@entities/dialogs/enrollment/EnrollmentMigrateDialog";
import { EnrollmentCleanupDialog, type EnrollmentCleanupOptions } from "@entities/dialogs/enrollment/EnrollmentCleanupDialog";
import { populationChipClass, populationTone } from "@lib/colorRegistry";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { fmtCurrencyUSD } from "@lib/formatters";
import { isAdminLike, isViewerLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import { normalizePayments, currency, todayISO, nextRentCertDue } from "./paymentScheduleUtils";
import { customerContactRoleForUid } from "../contactCaseManagers";
import { getCustomerDriveFolderLink, getCustomerWorkbookRef } from "../customerDriveFolder";
import { WorkbookSheetModal } from "@entities/workbook/WorkbookSheetModal";
import { getGrantFinancialCapabilities } from "@hdb/contracts";
import {
  enrollmentControlActionBody,
  enrollmentControlDone,
  enrollmentControlPatch,
  enrollmentControlStatusLabel,
  enrollmentControlsForGrant,
  type EnrollmentControlDescriptor,
} from "@features/enrollments/enrollmentControls";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const CARD_TASKS_LIMIT = 1000;

type CustomerCardProps = {
  customer: TCustomerEntity & { id: string };
  viewerUid?: string;
  selectedCmUid?: string;
  selected?: boolean;
  selectionMode?: boolean;
  onSelectGesture?: (
    customerId: string,
    gesture: {
      source: "card" | "checkbox";
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
    },
  ) => void;
  onOpen: (customerId: string, options?: { tab?: "tasks" }) => void;
  loading?: boolean;
};

type CardRoleMode = "viewer" | "user" | "admin";

function asTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  const maybeTs = value as { seconds?: number; toDate?: () => Date };
  if (typeof maybeTs.toDate === "function") return maybeTs.toDate().getTime();
  if (typeof maybeTs.seconds === "number") return maybeTs.seconds * 1000;
  return 0;
}

export function isNewCustomer(customer: TCustomerEntity): boolean {
  const createdAt = asTime(customer.createdAt);
  return createdAt > 0 && Date.now() - createdAt < FIVE_DAYS_MS;
}

function isActiveEnrollment(enrollment: Enrollment): boolean {
  const status = String(enrollment.status || "").toLowerCase();
  if (enrollment.deleted === true || status === "deleted") return false;
  if (enrollment.active === true || status === "active") return true;
  return false;
}

function calcAge(dob?: string | null): number | null {
  if (!dob) return null;
  const dobTime = new Date(dob).getTime();
  if (!Number.isFinite(dobTime) || dobTime <= 0) return null;
  return Math.floor((Date.now() - dobTime) / (365.25 * 86400000));
}

function displayName(customer: TCustomerEntity): string {
  return (
    (customer.name && String(customer.name).trim()) ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function isInactiveCustomer(customer: TCustomerEntity): boolean {
  if (typeof customer.active === "boolean") return !customer.active;
  const status = String(customer.status || "").trim().toLowerCase();
  return status === "inactive" || status === "closed" || status === "deleted";
}

function formatDate(value: unknown): string {
  const time = asTime(value);
  if (!time) return "";
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


function populationLabel(population: unknown): string {
  const text = String(population || "").trim();
  return text || "-";
}

function populationHeaderClass(population: unknown): string {
  switch (populationTone(population)) {
    case "sky":
      return "border-sky-200 bg-sky-100";
    case "emerald":
      return "border-emerald-200 bg-emerald-100";
    case "amber":
      return "border-amber-200 bg-amber-100";
    default:
      return "border-slate-200 bg-slate-100";
  }
}

function sortActiveEnrollments(enrollments: Enrollment[]): Enrollment[] {
  return [...enrollments].sort((a, b) => {
    const bTime = Math.max(asTime(b.updatedAt), asTime(b.startDate), asTime(b.createdAt));
    const aTime = Math.max(asTime(a.updatedAt), asTime(a.startDate), asTime(a.createdAt));
    return bTime - aTime;
  });
}

function sortTasks(tasks: TasksListItem[]): TasksListItem[] {
  return [...tasks].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
}



function enrollmentSummaryLabel(enrollment: Enrollment): string {
  return (
    String(enrollment.grantName || "").trim() ||
    String(enrollment.name || "").trim() ||
    "Enrollment"
  );
}

function CustomerTasksList({
  enrollmentIds,
  hasEnrollmentData,
  isLoadingEnrollmentData,
  isRefreshingEnrollmentData,
  muted = false,
  onOpenTasks,
  onLoadEnrollmentData,
}: {
  enrollmentIds: string[];
  hasEnrollmentData: boolean;
  isLoadingEnrollmentData: boolean;
  isRefreshingEnrollmentData: boolean;
  muted?: boolean;
  onOpenTasks: () => void;
  onLoadEnrollmentData: () => void;
}) {
  const month = currentMonthKey();
  const { data: tasks = [], isLoading } = useTasksForEnrollments(enrollmentIds, month, {
    enabled: hasEnrollmentData && enrollmentIds.length > 0,
    limit: CARD_TASKS_LIMIT,
  });

  const openTasks = sortTasks(tasks.filter((task) => task.status === "open"));

  if (!hasEnrollmentData && isLoadingEnrollmentData) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading enrollments...</div>;
  }

  if (!hasEnrollmentData) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={muted ? "text-slate-400" : "text-slate-500"}>Enrollment Data not cached</span>
        <button
          type="button"
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
            muted
              ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
          ].join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            onLoadEnrollmentData();
          }}
          disabled={isRefreshingEnrollmentData || isLoadingEnrollmentData}
          title="Load enrollment data for this customer"
          aria-label="Load enrollment data for this customer"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={["h-3.5 w-3.5", isRefreshingEnrollmentData ? "animate-spin" : ""].join(" ")}
          >
            <path
              d="M16 10a6 6 0 1 1-2.1-4.57"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M16 4.5v4h-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  if (isLoadingEnrollmentData || isRefreshingEnrollmentData) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading enrollments...</div>;
  }

  if (isLoading) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading tasks...</div>;
  }

  if (openTasks.length === 0) {
    return <div className={["text-xs italic", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>No tasks due this month</div>;
  }

  return (
    <div className="space-y-2">
      <div className={["text-[11px] font-semibold uppercase tracking-[0.16em]", muted ? "text-slate-400" : "text-slate-500"].join(" ")}>
        Open This Month: {openTasks.length}
      </div>
      <ul className="space-y-1.5">
        {openTasks.slice(0, 5).map((task: TasksListItem) => (
          <li key={task.id}>
            <button
              type="button"
              className={[
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs transition",
                muted
                  ? "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200/70"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
              onClick={(event) => {
                event.stopPropagation();
                onOpenTasks();
              }}
            >
              <div className="min-w-0">
                <div className={["truncate font-medium", muted ? "text-slate-600" : "text-slate-800"].join(" ")}>{task.title}</div>
                <div className={muted ? "text-slate-400" : "text-slate-400"}>Due {formatDate(task.dueDate)}</div>
              </div>
              <span className={[
                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                muted
                  ? "border-slate-200 bg-white text-slate-500"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              ].join(" ")}>
                Open
              </span>
            </button>
          </li>
        ))}
        {openTasks.length > 5 ? <li className="text-xs text-slate-400">+{openTasks.length - 5} more</li> : null}
      </ul>
    </div>
  );
}

type EnrollmentFinancial = {
  id: string;
  label: string;
  firstDate: string | null;
  lastDate: string | null;
  totalProjected: number;
  totalPaid: number;
  nextDue: { date: string; amount: number } | null;
  hasAnyMoney: boolean;
};

type DraftPaymentRow = {
  id: string;
  dueDate: string;
  type: string;
  amount: number;
  paid: boolean;
  lineItemId: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function describePaymentType(value: unknown): string {
  const text = String(value || "").trim();
  return text || "payment";
}

function paymentRowId(payment: Record<string, unknown>, index: number): string {
  return String(payment.id || payment.paymentId || payment.key || `row-${index}`);
}

function paymentDueDate(payment: Record<string, unknown>): string {
  return String(payment.dueDate || payment.date || "").slice(0, 10);
}

function defaultCloseDateForGrant(grant: Record<string, unknown> | null | undefined): string {
  const today = todayISO();
  const grantEndDate = String(grant?.endDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(grantEndDate) && grantEndDate < today ? grantEndDate : today;
}

function toDraftPaymentRows(enrollment: Enrollment | null): DraftPaymentRow[] {
  const payments = Array.isArray(enrollment?.payments) ? enrollment.payments : [];
  return payments.map((raw, index) => {
    const payment = (raw || {}) as Record<string, unknown>;
    const amount = Number(payment.amount || 0);
    return {
      id: paymentRowId(payment, index),
      dueDate: paymentDueDate(payment),
      type: describePaymentType(payment.type),
      amount: Number.isFinite(amount) ? amount : 0,
      paid: payment.paid === true,
      lineItemId: String(payment.lineItemId || ""),
    };
  });
}

function budgetSummaryForGrant(grant: Record<string, unknown> | null | undefined) {
  const budget = grant?.budget && typeof grant.budget === "object" ? (grant.budget as Record<string, unknown>) : {};
  const totals = budget.totals && typeof budget.totals === "object" ? (budget.totals as Record<string, unknown>) : {};
  const total = Number(budget.total ?? totals.total ?? 0) || 0;
  const spent = Number(totals.spent ?? budget.spent ?? 0) || 0;
  const projected = Number(totals.projected ?? budget.projected ?? 0) || 0;
  const capabilities = getGrantFinancialCapabilities((grant || {}) as Record<string, unknown>);
  const drawsDownBudget = capabilities.drawsDownBudget;
  return {
    total,
    spent,
    projected,
    available: total - spent - projected,
    activityTotal: spent + projected,
    drawsDownBudget,
    isBillingMode: !drawsDownBudget && (capabilities.billingEnabled || capabilities.usesBillingLedger),
  };
}

function PaymentScheduleQuickModal({
  open,
  customerId,
  enrollment,
  onClose,
}: {
  open: boolean;
  customerId: string;
  enrollment: Enrollment | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const roleMode: CardRoleMode = isAdminLike(profile as any) ? "admin" : isViewerLike(profile as any) ? "viewer" : "user";
  const editable = roleMode !== "viewer";
  const admin = roleMode === "admin";
  const grantId = String(enrollment?.grantId || "");
  const { data: grant = null } = useGrant(grantId, { enabled: open && !!grantId });
  const [draftRows, setDraftRows] = React.useState<DraftPaymentRow[]>([]);
  const [rawOpen, setRawOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraftRows(toDraftPaymentRows(enrollment));
    setRawOpen(false);
  }, [enrollment, open]);

  const budget = budgetSummaryForGrant(grant);
  const draftTotal = draftRows.reduce((sum, row) => sum + row.amount, 0);

  const updateDraft = (id: string, patch: Partial<DraftPaymentRow>) => {
    setDraftRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Payment Schedule"
      widthClass="max-w-5xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {editable ? (
            <a className="btn btn-secondary btn-sm" href={`/customers/${customerId}?tab=payments`}>
              Edit Payments
            </a>
          ) : null}
          {editable && grantId ? (
            <a className="btn btn-secondary btn-sm" href={`/grants/${grantId}?tab=budget`}>
              Grant Spending
            </a>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Local model only. Changes in this popup do not save.
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {(budget.drawsDownBudget
            ? [
                ["Budget", budget.total],
                ["Spent", budget.spent],
                ["Projected", budget.projected],
                ["Available", budget.available],
              ]
            : [
                ["Reference", budget.total],
                [budget.isBillingMode ? "Recorded Spend" : "Spent", budget.spent],
                ["Projected", budget.projected],
                ["Activity Total", budget.activityTotal],
              ]
          ).map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{fmtCurrencyUSD(Number(value))}</div>
            </div>
          ))}
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Paid</th>
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-sky-50/60">
                  <td className="px-3 py-2 select-text">
                    {fmtShortDate(row.dueDate)}
                  </td>
                  <td className="px-3 py-2 select-text">{row.type}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editable ? (
                      <input className="input h-8 w-28 text-right" type="number" step="0.01" value={String(row.amount)} onChange={(e) => updateDraft(row.id, { amount: Number(e.currentTarget.value) || 0 })} />
                    ) : (
                      <span>{currency(row.amount)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <input type="checkbox" checked={row.paid} onChange={(e) => updateDraft(row.id, { paid: e.currentTarget.checked })} />
                    ) : (
                      row.paid ? "Yes" : "No"
                    )}
                  </td>
                </tr>
              ))}
              {!draftRows.length ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={4}>No payment rows.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="text-right text-sm font-semibold text-slate-700">
          Modeled total: {fmtCurrencyUSD(draftTotal)}
        </div>

        {admin ? (
          <details open={rawOpen} onToggle={(event) => setRawOpen(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Advanced JSON</summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{safeJson({ enrollment, grant })}</pre>
          </details>
        ) : null}
      </div>
    </Modal>
  );
}

function EnrollmentQuickModal({
  open,
  enrollment,
  onClose,
  onChanged,
}: {
  open: boolean;
  enrollment: Enrollment | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const roleMode: CardRoleMode = isAdminLike(profile as any) ? "admin" : isViewerLike(profile as any) ? "viewer" : "user";
  const editable = roleMode !== "viewer";
  const admin = roleMode === "admin";
  const patch = useEnrollmentsPatch();
  const applyAction = useEnrollmentActionsApply();
  const deleteEnrollment = useEnrollmentsDelete();
  const grantId = String(enrollment?.grantId || "");
  const { data: grant = null } = useGrant(grantId, { enabled: open && !!grantId });
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [closeDate, setCloseDate] = React.useState(todayISO());
  const [manageOpen, setManageOpen] = React.useState(false);
  const [dateEditorOpen, setDateEditorOpen] = React.useState(false);
  const [closeEditorOpen, setCloseEditorOpen] = React.useState(false);
  const [rawOpen, setRawOpen] = React.useState(false);
  const [migrateOpen, setMigrateOpen] = React.useState(false);
  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const { data: grants = [] } = useGrants(
    { limit: 500 },
    { enabled: editable && migrateOpen, staleTime: 60_000 },
  );

  React.useEffect(() => {
    if (!open) return;
    setStartDate(String(enrollment?.startDate || "").slice(0, 10));
    setEndDate(String(enrollment?.endDate || "").slice(0, 10));
    setCloseDate(todayISO());
    setManageOpen(false);
    setDateEditorOpen(false);
    setCloseEditorOpen(false);
    setRawOpen(false);
    setMigrateOpen(false);
    setCleanupOpen(false);
  }, [enrollment, open]);

  React.useEffect(() => {
    if (!open) return;
    const today = todayISO();
    const defaultCloseDate = defaultCloseDateForGrant(grant as Record<string, unknown> | null);
    setCloseDate((current) => (current === today ? defaultCloseDate : current));
  }, [grant, open]);

  const enrollmentId = String(enrollment?.id || "");
  const status = String(enrollment?.status || (enrollment?.active === false ? "closed" : "active")).toLowerCase();
  const enrollmentLabel = formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>, { fallback: enrollmentId || "Enrollment" });
  const grantName = String(grant?.name || enrollment?.grantName || "").trim();
  const grantDescription = String(grant?.description || grant?.summary || "").trim();
  const statusTone =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "closed" || status === "inactive"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const busy = patch.isPending || applyAction.isPending || deleteEnrollment.isPending;

  const patchEnrollment = async (patchData: Record<string, unknown>) => {
    if (!enrollmentId) return;
    try {
      await patch.mutateAsync({ id: enrollmentId, patch: patchData });
      toast("Enrollment updated.", { type: "success" });
      setDateEditorOpen(false);
      setCloseEditorOpen(false);
      onChanged();
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to update enrollment.", { type: "error" });
    }
  };

  const saveDates = () => {
    void patchEnrollment({
      startDate: startDate || null,
      endDate: endDate || null,
    });
  };

  const closeEnrollment = () => {
    void patchEnrollment({
      status: "closed",
      active: false,
      endDate: closeDate || todayISO(),
    });
  };

  const controlDescriptors = React.useMemo(
    () => enrollmentControlsForGrant(grant as Record<string, unknown> | null, status === "closed" || status === "inactive"),
    [grant, status],
  );

  const toggleEnrollmentControl = async (descriptor: EnrollmentControlDescriptor) => {
    if (!enrollmentId || !enrollment) return;
    try {
      const next = !enrollmentControlDone(enrollment as Record<string, unknown>, descriptor);
      const patchData = enrollmentControlPatch(enrollment as Record<string, unknown>, descriptor, next);
      if (patchData) {
        await patch.mutateAsync({ id: enrollmentId, patch: patchData });
      } else {
        const actionBody = enrollmentControlActionBody(enrollmentId, descriptor, next);
        if (!actionBody) return;
        await applyAction.mutateAsync(actionBody as any);
      }
      toast("Enrollment updated.", { type: "success" });
      onChanged();
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to update enrollment control.", { type: "error" });
    }
  };

  const markDisplayedControlsComplete = () => {
    void (async () => {
      for (const descriptor of controlDescriptors) {
        if (enrollmentControlDone(enrollment as Record<string, unknown>, descriptor)) continue;
        await toggleEnrollmentControl(descriptor);
      }
    })();
  };

  const cleanupEnrollment = async (opts: EnrollmentCleanupOptions) => {
    if (!enrollmentId) return;
    try {
      await deleteEnrollment.mutateAsync({ id: enrollmentId, voidPaid: opts.voidPaid, unlinkSpends: opts.unlinkSpends });
      toast("Enrollment cleaned up.", { type: "success" });
      setCleanupOpen(false);
      onChanged();
      onClose();
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to clean up enrollment.", { type: "error" });
    }
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title="Enrollment"
        widthClass="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-bold text-slate-900">{enrollmentLabel}</div>
                {grantName ? <div className="mt-1 text-sm font-medium text-slate-600">{grantName}</div> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone}`}>
                  {status || "unknown"}
                </span>
                {editable ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setManageOpen((value) => !value)}
                    disabled={busy}
                    aria-expanded={manageOpen}
                  >
                    Manage
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grant Description</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {grantDescription || "No description."}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{fmtShortDate(startDate)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{fmtShortDate(endDate)}</div>
            </div>
          </section>

          <div className="grid gap-2 text-sm md:grid-cols-2">
            {controlDescriptors.length ? controlDescriptors.map((descriptor) => {
              const done = enrollmentControlDone(enrollment as Record<string, unknown>, descriptor);
              return (
                <button
                  key={`${descriptor.kind}_${descriptor.key}`}
                  type="button"
                  className={[
                    "rounded-lg border px-4 py-3 text-left transition disabled:opacity-60",
                    done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50",
                  ].join(" ")}
                  onClick={() => void toggleEnrollmentControl(descriptor)}
                  disabled={!editable || busy}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{descriptor.control.label}</div>
                  <div className="mt-1 font-semibold text-slate-800">{enrollmentControlStatusLabel(done, descriptor)}</div>
                </button>
              );
            }) : (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 md:col-span-2">
                No enrollment controls configured for this grant/program.
              </div>
            )}
          </div>

          {editable && manageOpen ? (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Enrollment management</div>
                  <div className="text-xs text-slate-500">Use these for quick patches or to open the full tools.</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManageOpen(false)}>
                  Hide
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
                  onClick={() => {
                    setDateEditorOpen((value) => !value);
                    setCloseEditorOpen(false);
                  }}
                  disabled={busy}
                >
                  <span className="block font-semibold text-slate-900">Edit dates</span>
                  <span className="block text-xs text-slate-500">Change start or end date.</span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                  onClick={() => {
                    setCloseEditorOpen((value) => !value);
                    setDateEditorOpen(false);
                  }}
                  disabled={busy}
                >
                  <span className="block font-semibold text-slate-900">Close enrollment</span>
                  <span className="block text-xs text-slate-500">Set the end date and mark inactive.</span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
                  onClick={() => setMigrateOpen(true)}
                  disabled={busy}
                >
                  <span className="block font-semibold text-slate-900">Migrate enrollment</span>
                  <span className="block text-xs text-slate-500">Open the migration tool.</span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                  onClick={markDisplayedControlsComplete}
                  disabled={busy || !controlDescriptors.length || controlDescriptors.every((descriptor) => enrollmentControlDone(enrollment as Record<string, unknown>, descriptor))}
                >
                  <span className="block font-semibold text-slate-900">Mark controls complete</span>
                  <span className="block text-xs text-slate-500">Complete all displayed controls for this enrollment.</span>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 md:col-span-2"
                  onClick={() => setCleanupOpen(true)}
                  disabled={busy}
                >
                  <span className="block font-semibold text-slate-900">Clean up enrollment</span>
                  <span className="block text-xs text-slate-500">Open the cleanup/delete dialog for associated spend handling.</span>
                </button>
              </div>

              {dateEditorOpen ? (
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</span>
                    <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</span>
                    <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
                  </label>
                  <div className="flex items-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveDates} disabled={busy}>
                      Save
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDateEditorOpen(false)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {closeEditorOpen ? (
                <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 md:grid-cols-[1fr_auto]">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Enrollment End Date</span>
                    <input className="input" type="date" value={closeDate} onChange={(e) => setCloseDate(e.currentTarget.value)} />
                  </label>
                  <div className="flex items-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={closeEnrollment} disabled={busy}>
                      Confirm Close
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCloseEditorOpen(false)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {admin ? (
            <details open={rawOpen} onToggle={(event) => setRawOpen(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Advanced JSON</summary>
              <pre className="mt-3 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{safeJson({ enrollment, grant })}</pre>
            </details>
          ) : null}
        </div>
      </Modal>
      <EnrollmentMigrateDialog
        open={migrateOpen}
        enrollment={enrollment}
        grants={grants as any}
        onClose={() => setMigrateOpen(false)}
        onDone={onChanged}
      />
      <EnrollmentCleanupDialog
        open={cleanupOpen}
        enrollmentLabel={enrollmentLabel}
        onCancel={() => setCleanupOpen(false)}
        onConfirm={(opts) => void cleanupEnrollment(opts)}
      />
    </>
  );
}

function computeEnrollmentFinancial(enrollment: Enrollment): EnrollmentFinancial {
  const all = normalizePayments(Array.isArray(enrollment.payments) ? enrollment.payments : []);
  // Exclude service payments for financial summary (rent, deposit, prorated only)
  const financial = all.filter((p) => p.type !== "service" && !p.void);
  const label =
    String(enrollment.grantName || "").trim() ||
    String(enrollment.name || "").trim() ||
    "Enrollment";

  if (!financial.length) {
    return { id: String(enrollment.id || ""), label, firstDate: null, lastDate: null, totalProjected: 0, totalPaid: 0, nextDue: null, hasAnyMoney: false };
  }

  const today = todayISO();
  const dates = financial.map((p) => p.dueDate).filter(Boolean).sort();
  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;
  const totalProjected = financial.reduce((s, p) => s + p.amount, 0);
  const totalPaid = financial.filter((p) => p.paid === true).reduce((s, p) => s + p.amount, 0);
  const unpaid = financial
    .filter((p) => !p.paid && p.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextDue = unpaid.length ? { date: unpaid[0].dueDate, amount: unpaid[0].amount } : null;

  return { id: String(enrollment.id || ""), label, firstDate, lastDate, totalProjected, totalPaid, nextDue, hasAnyMoney: totalProjected > 0 };
}

function fmtShortDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [, m, d] = iso.split("-");
  return `${m}/${d}/${iso.slice(2, 4)}`;
}

const COL_SPAN_CLASSES = ["", "lg:col-span-1", "lg:col-span-2"] as const;
const DRAG_PX_PER_STEP = 140;

type CustomerCardContextMenu =
  | { kind: "enrollment"; x: number; y: number; enrollmentId: string }
  | { kind: "payment"; x: number; y: number; enrollmentId: string };

function hasSelectedTextWithin(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;

  for (let i = 0; i < selection.rangeCount; i += 1) {
    const range = selection.getRangeAt(i);
    const container = range.commonAncestorContainer;
    const node = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    if (node && element.contains(node)) return true;
  }

  return false;
}

function CustomerCardInner({
  customer,
  viewerUid,
  selectedCmUid,
  selected = false,
  selectionMode = false,
  onSelectGesture,
  onOpen,
  loading = false,
}: CustomerCardProps) {
  const { profile } = useAuth();
  const canManageEnrollments = !isViewerLike(profile as any);
  const patchEnrollment = useEnrollmentsPatch();
  const [colSpan, setColSpan] = React.useState(1);
  const dragRef = React.useRef<{ startX: number; startSpan: number } | null>(null);
  const showEnrollmentSections = colSpan > 1;
  const [paymentPopupEnrollmentId, setPaymentPopupEnrollmentId] = React.useState<string | null>(null);
  const [enrollmentPopupId, setEnrollmentPopupId] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<CustomerCardContextMenu | null>(null);

  const handleResizeMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = { startX: event.clientX, startSpan: colSpan };

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = Math.round((moveEvent.clientX - dragRef.current.startX) / DRAG_PX_PER_STEP);
        setColSpan(Math.max(1, Math.min(2, dragRef.current.startSpan + delta)));
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [colSpan],
  );

  const age = calcAge((customer as { dob?: string | null }).dob || null);
  const inactiveCustomer = isInactiveCustomer(customer);
  const viewerId = String(viewerUid || "").trim();
  const selectedCmId = String(selectedCmUid || "").trim();
  const caseManagerName = String(customer.caseManagerName || customer.caseManagerId || "Unassigned").trim();
  const viewerRelationship = customerContactRoleForUid(customer as Record<string, unknown>, viewerId);
  const driveFolderLink = getCustomerDriveFolderLink(customer);
  const workbookRef = getCustomerWorkbookRef(customer);
  const [workbookModalOpen, setWorkbookModalOpen] = React.useState(false);
  const [hoveredEnrollmentSection, setHoveredEnrollmentSection] = React.useState(false);
  const [shouldLoadEnrollments, setShouldLoadEnrollments] = React.useState(false);
  const enrollmentsQuery = useCustomerEnrollments(customer.id, {
    enabled: !!customer.id && shouldLoadEnrollments,
    limit: 25,
  });
  const enrollments = enrollmentsQuery.data || [];
  const hasEnrollmentData = enrollmentsQuery.data !== undefined;
  const isLoadingEnrollmentData = enrollmentsQuery.isLoading || enrollmentsQuery.isFetching;
  const paymentPopupEnrollment = React.useMemo(
    () => enrollments.find((enrollment) => String(enrollment.id || "") === String(paymentPopupEnrollmentId || "")) || null,
    [enrollments, paymentPopupEnrollmentId],
  );
  const enrollmentPopup = React.useMemo(
    () => enrollments.find((enrollment) => String(enrollment.id || "") === String(enrollmentPopupId || "")) || null,
    [enrollments, enrollmentPopupId],
  );
  const enrollmentById = React.useMemo(() => {
    const map = new Map<string, Enrollment>();
    for (const enrollment of enrollments) {
      const id = String(enrollment.id || "");
      if (id) map.set(id, enrollment);
    }
    return map;
  }, [enrollments]);

  const activeEnrollments = sortActiveEnrollments(enrollments.filter(isActiveEnrollment));
  const inactiveEnrollments = enrollments.filter((enrollment) => !isActiveEnrollment(enrollment));
  const activeEnrollmentIds = activeEnrollments.map((enrollment) => enrollment.id);
  const enrollmentFinancials = activeEnrollments.map(computeEnrollmentFinancial);
  const hasAnyFinancialAssistance = enrollmentFinancials.some((f) => f.hasAnyMoney);
  const rentCertDue = nextRentCertDue(activeEnrollments);
  const lastAssistanceDate = enrollmentFinancials
    .filter((f) => f.hasAnyMoney && f.lastDate)
    .map((f) => f.lastDate as string)
    .sort()
    .at(-1) ?? null;

  React.useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const closeEnrollmentToday = React.useCallback(
    async (enrollmentId: string) => {
      if (!canManageEnrollments || patchEnrollment.isPending) return;
      const enrollment = enrollmentById.get(String(enrollmentId || ""));
      if (!enrollment || !isActiveEnrollment(enrollment)) {
        setContextMenu(null);
        return;
      }
      try {
        await patchEnrollment.mutateAsync({
          id: String(enrollment.id),
          patch: {
            status: "closed",
            active: false,
            endDate: todayISO(),
          },
        });
        toast("Enrollment closed today.", { type: "success" });
        setContextMenu(null);
        void enrollmentsQuery.refetch();
      } catch (error: unknown) {
        toast(toApiError(error).error || "Failed to close enrollment.", { type: "error" });
      }
    },
    [canManageEnrollments, enrollmentById, enrollmentsQuery, patchEnrollment],
  );

  const openGrantForEnrollment = React.useCallback(
    (enrollmentId: string) => {
      const enrollment = enrollmentById.get(String(enrollmentId || ""));
      const grantId = String(enrollment?.grantId || "").trim();
      setContextMenu(null);
      if (!grantId) {
        toast("No grant is linked to this enrollment.", { type: "warning" });
        return;
      }
      window.open(`/grants/${encodeURIComponent(grantId)}`, "_blank", "noopener,noreferrer");
    },
    [enrollmentById],
  );

  // Selected CM's relationship (only when a different CM is selected)
  const selectedCmRole = (selectedCmId && selectedCmId !== viewerId)
    ? customerContactRoleForUid(customer as Record<string, unknown>, selectedCmId)
    : null;

  const ROLE_CLASSES = {
    primary: "border-orange-200 bg-orange-50 text-orange-800",
    secondary: "border-emerald-200 bg-emerald-50 text-emerald-800",
    other: "border-violet-200 bg-violet-50 text-violet-800",
  } as const;

  const cmChip = selectedCmRole
    ? {
        label: selectedCmRole === "primary" ? "Primary" : selectedCmRole === "secondary" ? "Secondary" : "Other",
        className: ROLE_CLASSES[selectedCmRole],
      }
    : null;

  const myChip = viewerRelationship
    ? {
        label: viewerRelationship === "primary" ? "My Client" : viewerRelationship === "secondary" ? "Secondary Contact" : "Other Contact",
        className: ROLE_CLASSES[viewerRelationship],
      }
    : null;

  return (
    <article
      data-card-physics-id={`customer:${customer.id}`}
      data-block-id={`customer:${customer.id}`}
      data-block-name={
        (customer.name && String(customer.name).trim()) ||
        [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
        customer.id
      }
      data-customer-active={inactiveCustomer ? "false" : "true"}
      className={[
        COL_SPAN_CLASSES[colSpan],
        "group relative h-full cursor-pointer overflow-hidden rounded-[24px] border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        inactiveCustomer
          ? "border-slate-200 bg-slate-50/90 text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400"
          : "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
        selected
          ? "border-sky-500 ring-2 ring-sky-200 bg-sky-50/40 shadow-md dark:ring-sky-500/40 dark:bg-sky-950/40"
          : "border-slate-200 dark:border-slate-700",
      ].join(" ")}
      onClick={(event) => {
        if ((event.target as HTMLElement | null)?.closest(".modal-overlay")) return;
        if (hasSelectedTextWithin(event.currentTarget)) return;
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onSelectGesture?.(customer.id, {
            source: "card",
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });
          return;
        }
        onOpen(customer.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            onSelectGesture?.(customer.id, {
              source: "card",
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
            });
            return;
          }
          onOpen(customer.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[24px] bg-white/70 backdrop-blur-[2px] dark:bg-slate-900/70">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-300" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Loading…</span>
          </div>
        </div>
      )}
      <div
        className={[
          "absolute right-4 top-4 z-20 transition-opacity",
          selected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <label
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full border shadow-sm",
            selected
              ? "border-sky-500 bg-sky-600 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-sky-400",
          ].join(" ")}
          title={selected ? "Selected" : "Select customer"}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected}
            readOnly
            onClick={(event) => {
              event.stopPropagation();
              onSelectGesture?.(customer.id, {
                source: "checkbox",
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
              });
            }}
          />
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.125 7.187a1 1 0 0 1-1.42 0L3.29 9.015a1 1 0 1 1 1.414-1.414l4.17 4.17 6.418-6.474a1 1 0 0 1 1.412-.007Z"
              clipRule="evenodd"
            />
          </svg>
        </label>
      </div>

      {(cmChip || myChip) ? (
        <div className="mx-4 mt-4 flex flex-wrap gap-1.5">
          {cmChip ? (
            <div
              className={[
                "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                inactiveCustomer ? "border-slate-200 bg-slate-100 text-slate-500" : cmChip.className,
              ].join(" ")}
            >
              {cmChip.label}
            </div>
          ) : null}
          {myChip ? (
            <div
              className={[
                "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                inactiveCustomer ? "border-slate-200 bg-slate-100 text-slate-500" : myChip.className,
              ].join(" ")}
            >
              {myChip.label}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={[
          "mt-3 border-y px-4 py-4",
          inactiveCustomer
            ? "border-slate-200 bg-slate-100/80 text-slate-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-400"
            : ["text-slate-950", populationHeaderClass(customer.population)].join(" "),
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={["text-2xl font-extrabold leading-tight tracking-tight", inactiveCustomer ? "text-slate-600 dark:text-slate-400" : "text-slate-950"].join(" ")}>
                {displayName(customer)}
              </span>
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  inactiveCustomer ? "border-slate-200 bg-white text-slate-500" : populationChipClass(customer.population),
                ].join(" ")}
              >
                {populationLabel(customer.population)}
              </span>
              {age != null ? <span className={inactiveCustomer ? "text-sm text-slate-500" : "text-sm text-slate-600"}>{age}y</span> : null}
              {isNewCustomer(customer) ? (
                <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  NEW
                </span>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className={["text-[10px] font-semibold uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-500 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"].join(" ")}>
              Case Manager
            </div>
            <div className={["truncate text-sm font-semibold", inactiveCustomer ? "text-slate-600 dark:text-slate-500" : "text-slate-900 dark:text-slate-200"].join(" ")}>
              {caseManagerName}
            </div>
          </div>
        </div>
        <div className={["mt-1 text-xs font-medium uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-500 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"].join(" ")}>
          <span>CW ID: {customer.cwId ? String(customer.cwId) : "--"}</span>
          {driveFolderLink ? (
            <a
              href={driveFolderLink.url}
              target="_blank"
              rel="noreferrer"
              className={[
                "ml-3 inline-flex min-h-7 items-center rounded-md px-1.5 text-xs font-semibold tracking-normal underline underline-offset-2 transition",
                inactiveCustomer ? "text-slate-500 hover:text-slate-700" : "text-sky-700 hover:text-sky-900",
              ].join(" ")}
              title={driveFolderLink.label}
              aria-label={driveFolderLink.label}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              Folder
            </a>
          ) : null}
          {workbookRef ? (
            <button
              type="button"
              className={[
                "ml-2 inline-flex min-h-7 items-center rounded-md px-1.5 text-xs font-semibold tracking-normal underline underline-offset-2 transition",
                inactiveCustomer ? "text-slate-500 hover:text-slate-700" : "text-sky-700 hover:text-sky-900",
              ].join(" ")}
              title={`Open ${workbookRef.name}`}
              aria-label={`Open ${workbookRef.name}`}
              onClick={(event) => { event.stopPropagation(); setWorkbookModalOpen(true); }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              Workbook
            </button>
          ) : null}
        </div>
        {workbookRef && workbookModalOpen ? (
          <WorkbookSheetModal
            spreadsheetId={workbookRef.spreadsheetId}
            gid={workbookRef.gid}
            spreadsheetName={workbookRef.name}
            openUrl={workbookRef.url}
            onClose={() => setWorkbookModalOpen(false)}
          />
        ) : null}
      </div>

      {/* ── Below-banner: Payments (left) + Enrollments (right) ── */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        {/* LEFT: financial summary per enrollment */}
        <div 
          className="min-w-0 space-y-1.5" 
          onMouseEnter={() => setHoveredEnrollmentSection(true)}
          onMouseLeave={() => setHoveredEnrollmentSection(false)}
        >
          <div className={["font-semibold uppercase tracking-[0.18em]", colSpan > 1 ? "text-xs" : "text-[10px]", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
            Financial Assistance
          </div>
          {isLoadingEnrollmentData && !hasEnrollmentData ? (
            <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "text-slate-400 dark:text-slate-500"].join(" ")}>Loading…</div>
          ) : !hasEnrollmentData ? (
            hoveredEnrollmentSection ? (
              <button
                type="button"
                className={[
                  "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium transition",
                  "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  setShouldLoadEnrollments(true);
                }}
                disabled={enrollmentsQuery.isFetching}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={["h-3.5 w-3.5 mr-1.5", enrollmentsQuery.isFetching ? "animate-spin" : ""].join(" ")}
                >
                  <path
                    d="M16 10a6 6 0 1 1-2.1-4.57"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 4.5v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Load Enrollment
              </button>
            ) : (
              <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "italic", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"].join(" ")}>
                Hover to load enrollment info
              </div>
            )
          ) : !hasAnyFinancialAssistance ? (
            <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "italic", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"].join(" ")}>
              No financial assistance provided
            </div>
          ) : (
            <div
              className={[
                "space-y-2",
                enrollmentFinancials.filter((f) => f.hasAnyMoney).length > 2 ? "max-h-40 overflow-y-auto pr-1" : "",
              ].join(" ")}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              data-payment-schedule-list
            >
              {rentCertDue ? (
                <div
                  data-payment-schedule-summary="rent-cert-due"
                  className={[
                    "rounded-lg border px-2 transition-all select-text",
                    colSpan > 1 ? "py-2.5 text-sm" : "py-1.5 text-[11px]",
                    rentCertDue.asap
                      ? "border-amber-300 bg-amber-100 font-bold text-amber-950 hover:border-amber-400 hover:bg-amber-200/70 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
                      : inactiveCustomer
                      ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70"
                      : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60",
                  ].join(" ")}
                >
                  <span className="opacity-75">Next Rent Cert Due: </span>
                  <span>{fmtShortDate(rentCertDue.dueDate)}</span>
                  {rentCertDue.asap ? <span> ASAP</span> : null}
                </div>
              ) : lastAssistanceDate ? (
                <div
                  data-payment-schedule-summary="last-assistance-date"
                  className={[
                    "rounded-lg border px-2 transition-all select-text",
                    colSpan > 1 ? "py-2.5 text-sm" : "py-1.5 text-[11px]",
                    inactiveCustomer
                      ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-700/70",
                  ].join(" ")}
                >
                  <span className="opacity-75">Last date of assistance: </span>
                  <span>{fmtShortDate(lastAssistanceDate)}</span>
                </div>
              ) : null}
              {enrollmentFinancials.filter((f) => f.hasAnyMoney).map((f) => (
                <div
                  key={f.id}
                  data-payment-schedule-enrollment-id={f.id}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPaymentPopupEnrollmentId(f.id);
                  }}
                  onContextMenu={(event) => {
                    if (hasSelectedTextWithin(event.currentTarget)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({ kind: "payment", x: event.clientX, y: event.clientY, enrollmentId: f.id });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setPaymentPopupEnrollmentId(f.id);
                  }}
                  className={[
                    "cursor-pointer rounded-lg border px-2 transition-all select-text",
                    colSpan > 1 ? "py-2.5 text-sm" : "py-1.5 text-[11px]",
                    inactiveCustomer
                      ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70"
                      : "border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/70",
                  ].join(" ")}
                >
                  <div className="truncate font-semibold">{f.label}</div>
                  <div className={[colSpan > 1 ? "mt-1 text-xs" : "mt-0.5 text-[10px]", "opacity-75"].join(" ")}>
                    {fmtShortDate(f.firstDate)} – {fmtShortDate(f.lastDate)}
                  </div>
                  <div className={["flex flex-wrap gap-x-2 gap-y-0.5", colSpan > 1 ? "mt-1.5 text-xs" : "mt-1 text-[10px]"].join(" ")}>
                    <span>
                      <span className="opacity-60">Projected </span>
                      <span className="font-semibold">{currency(f.totalProjected)}</span>
                    </span>
                    <span>
                      <span className="opacity-60">Paid </span>
                      <span className="font-semibold">{currency(f.totalPaid)}</span>
                    </span>
                  </div>
                  {f.nextDue ? (
                    <div className={colSpan > 1 ? "mt-1 text-xs" : "mt-0.5 text-[10px]"}>
                      <span className="opacity-60">Next </span>
                      <span className="font-semibold">{fmtShortDate(f.nextDue.date)} · {currency(f.nextDue.amount)}</span>
                    </div>
                  ) : (
                    <div className={[colSpan > 1 ? "mt-1 text-xs" : "mt-0.5 text-[10px]", "opacity-60"].join(" ")}>All paid</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: enrollment chip + list */}
        <div 
          className="min-w-0 space-y-1.5" 
          onMouseEnter={() => setHoveredEnrollmentSection(true)}
          onMouseLeave={() => setHoveredEnrollmentSection(false)}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <div className={["font-semibold uppercase tracking-[0.18em]", colSpan > 1 ? "text-xs" : "text-[10px]", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              Enrollments
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className={[colSpan > 1 ? "text-xs" : "text-[10px]", "rounded-full border px-2 py-0.5 font-semibold", inactiveCustomer ? "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"].join(" ")}>
                {hasEnrollmentData ? `${activeEnrollments.length} / ${enrollments.length}` : "—"}
              </span>
              {hasEnrollmentData ? (
                <button
                  type="button"
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
                    inactiveCustomer
                      ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
                  ].join(" ")}
                  onClick={(event) => {
                    event.stopPropagation();
                    void enrollmentsQuery.refetch();
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  disabled={enrollmentsQuery.isFetching}
                  title="Refresh enrollments"
                  aria-label="Refresh enrollments"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className={["h-3.5 w-3.5", enrollmentsQuery.isFetching ? "animate-spin" : ""].join(" ")}
                  >
                    <path
                      d="M16 10a6 6 0 1 1-2.1-4.57"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 4.5v4h-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
          {isLoadingEnrollmentData && !hasEnrollmentData ? (
            <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "text-slate-400 dark:text-slate-500"].join(" ")}>Loading…</div>
          ) : !hasEnrollmentData ? (
            hoveredEnrollmentSection ? (
              <button
                type="button"
                className={[
                  "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium transition",
                  "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  setShouldLoadEnrollments(true);
                }}
                disabled={enrollmentsQuery.isFetching}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={["h-3.5 w-3.5 mr-1.5", enrollmentsQuery.isFetching ? "animate-spin" : ""].join(" ")}
                >
                  <path
                    d="M16 10a6 6 0 1 1-2.1-4.57"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 4.5v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Load Enrollment
              </button>
            ) : (
              <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "italic", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"].join(" ")}>
                Hover to load enrollment info
              </div>
            )
          ) : hasEnrollmentData ? (
            activeEnrollments.length > 0 ? (
              <div
                className={[
                  colSpan > 1 ? "space-y-1.5" : "space-y-1",
                  activeEnrollments.length > 3 ? "max-h-28 overflow-y-auto pr-1" : "",
                ].join(" ")}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                data-enrollment-list
              >
                {activeEnrollments.map((enr) => (
                  <div
                    key={enr.id}
                    data-enrollment-id={enr.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      setEnrollmentPopupId(String(enr.id || ""));
                    }}
                    onContextMenu={(event) => {
                      if (hasSelectedTextWithin(event.currentTarget)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu({
                        kind: "enrollment",
                        x: event.clientX,
                        y: event.clientY,
                        enrollmentId: String(enr.id || ""),
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      setEnrollmentPopupId(String(enr.id || ""));
                    }}
                    className={[
                      "cursor-pointer truncate rounded-lg border px-2 font-medium transition-all select-text",
                      colSpan > 1 ? "py-1.5 text-sm" : "py-1 text-[11px]",
                      inactiveCustomer
                        ? "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200",
                    ].join(" ")}
                  >
                    {enrollmentSummaryLabel(enr)}
                  </div>
                ))}
              </div>
            ) : (
              <div className={[colSpan > 1 ? "text-sm" : "text-[11px]", "italic", inactiveCustomer ? "text-slate-400 dark:text-slate-500" : "text-slate-400 dark:text-slate-500"].join(" ")}>
                No active
              </div>
            )
          ) : (
            <div className="text-[11px] text-slate-400 dark:text-slate-500">—</div>
          )}
        </div>
      </div>

      {showEnrollmentSections ? (
        <div className="flex h-full flex-col gap-3 px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className={["text-xs font-semibold uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-400" : "text-slate-500"].join(" ")}>
                Enrollment Tasks
              </div>
              <button
                type="button"
                className={["text-xs font-semibold underline-offset-2 hover:underline", inactiveCustomer ? "text-slate-400 hover:text-slate-500" : "text-slate-500 hover:text-slate-700"].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(customer.id, { tab: "tasks" });
                }}
              >
                Open Tasks
              </button>
            </div>
            <CustomerTasksList
              enrollmentIds={activeEnrollmentIds}
              hasEnrollmentData={hasEnrollmentData}
              isLoadingEnrollmentData={isLoadingEnrollmentData}
              isRefreshingEnrollmentData={enrollmentsQuery.isFetching}
              muted={inactiveCustomer}
              onOpenTasks={() => onOpen(customer.id, { tab: "tasks" })}
              onLoadEnrollmentData={() => {
                if (!customer.id) return;
                setShouldLoadEnrollments(true);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="group absolute bottom-0 right-0" onClick={(event) => event.stopPropagation()}>
        <div
          onMouseDown={handleResizeMouseDown}
          className="hidden h-8 w-8 cursor-col-resize items-end justify-end pb-1.5 pr-1.5 opacity-0 transition-opacity group-hover:opacity-100 lg:flex"
          title={`Width: ${colSpan} col${colSpan > 1 ? "s" : ""} - drag to resize`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-slate-300">
            <path d="M7 0v2H0V0h7zM10 0v10H8V0h2zM7 4v2H0V4h7zM7 8v2H0V8h7z" />
          </svg>
        </div>
        {colSpan > 1 ? (
          <div className="pointer-events-none absolute bottom-2 right-8 hidden text-[9px] font-bold text-slate-400 lg:block">
            {colSpan}x
          </div>
        ) : null}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[12000] min-w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          role="menu"
        >
          {contextMenu.kind === "payment" ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
              onClick={() => openGrantForEnrollment(contextMenu.enrollmentId)}
              role="menuitem"
            >
              Open Grant
            </button>
          ) : null}
          {contextMenu.kind === "enrollment" && canManageEnrollments ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50"
              onClick={() => void closeEnrollmentToday(contextMenu.enrollmentId)}
              disabled={patchEnrollment.isPending}
              role="menuitem"
            >
              Close enrollment today
            </button>
          ) : null}
          {contextMenu.kind === "enrollment" ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setEnrollmentPopupId(contextMenu.enrollmentId);
                setContextMenu(null);
              }}
              role="menuitem"
            >
              Open enrollment details
            </button>
          ) : null}
        </div>
      ) : null}

      {paymentPopupEnrollment ? (
        <PaymentScheduleQuickModal
          open
          customerId={customer.id}
          enrollment={paymentPopupEnrollment}
          onClose={() => setPaymentPopupEnrollmentId(null)}
        />
      ) : null}

      {enrollmentPopup ? (
        <EnrollmentQuickModal
          open
          enrollment={enrollmentPopup}
          onClose={() => setEnrollmentPopupId(null)}
          onChanged={() => {
            void enrollmentsQuery.refetch();
          }}
        />
      ) : null}
    </article>
  );
}

export const CustomerCard = React.memo(CustomerCardInner);
export default CustomerCard;
