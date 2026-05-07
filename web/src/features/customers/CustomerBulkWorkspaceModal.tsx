"use client";

import React from "react";
import FullPageModal from "@entities/ui/FullPageModal";
import GrantSelect from "@entities/selectors/GrantSelect";
import CaseManagerSelect, { type CaseManagerOption } from "@entities/selectors/CaseManagerSelect";
import PaymentScheduleBuilderDialog from "@entities/dialogs/payments/PaymentScheduleBuilderDialog";
import { GrantBudgetStrip } from "@entities/grants/GrantBudgetStrip";
import { useEnrollCustomer, useEnrollmentsBulkEnroll } from "@hooks/useEnrollments";
import { usePatchCustomers, useSoftDeleteCustomers, useHardDeleteCustomers } from "@hooks/useCustomers";
import { usePaymentsBuildSchedule } from "@hooks/usePayments";
import type { PaymentScheduleBuildInput } from "@hooks/usePayments";
import type { TCustomerEntity, ReqOf, TPayment } from "@types";
import type { Enrollment } from "@client/enrollments";
import EnrollmentsAPI from "@client/enrollments";
import PaymentsAPI from "@client/payments";
import TasksAPI from "@client/tasks";
import { toast } from "@lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";

type CustomerRow = TCustomerEntity & { id: string };

export type CustomerBulkTool =
  | "enroll"
  | "payments"
  | "case-managers"
  | "archive"
  | "delete"
  | "hard-delete"
  | "complete-past-tasks"
  | "mark-projections-paid"
  | "reverse-payments"
  | "refresh-enrollments";

type Props = {
  isOpen: boolean;
  tool: CustomerBulkTool | null;
  customers: CustomerRow[];
  isAdminUser: boolean;
  caseManagerOptions: CaseManagerOption[];
  onClose: () => void;
  onClearSelection: () => void;
};

type EnrollmentOption = {
  id: string;
  label: string;
  grantId?: string;
  statusLabel?: "open" | "closed";
  lineItemIds?: string[];
  scheduleMeta?: unknown;
};

type LoadedEnrollmentMap = Record<string, Enrollment[]>;

const PAGE_SIZE = 50;
const BULK_SENTINEL = "__bulk__";

function displayName(customer: Pick<CustomerRow, "name" | "firstName" | "lastName">): string {
  return (
    (customer.name && String(customer.name).trim()) ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function formatDob(value: unknown): string {
  const text = String(value || "").trim();
  return text || "-";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function enrollmentLabel(enrollment: Enrollment): string {
  return (
    String(enrollment.grantName || "").trim() ||
    String(enrollment.name || "").trim() ||
    String(enrollment.grantId || "").trim() ||
    "Enrollment"
  );
}

function isActiveEnrollment(enrollment: Enrollment): boolean {
  const status = String(enrollment.status || "").toLowerCase();
  if (enrollment.deleted === true || status === "deleted") return false;
  if (enrollment.active === true || status === "active") return true;
  return false;
}

function toEnrollmentOption(enrollment: Enrollment): EnrollmentOption {
  const payments = Array.isArray((enrollment as Record<string, unknown>).payments)
    ? (((enrollment as Record<string, unknown>).payments as Array<Record<string, unknown>>) || [])
    : [];
  const lineItemIds = Array.from(
    new Set(
      payments.map((payment) => String(payment?.lineItemId || "").trim()).filter(Boolean),
    ),
  );
  const statusLabel: "open" | "closed" =
    enrollment.active === true || String(enrollment.status || "").toLowerCase() === "active"
      ? "open"
      : "closed";
  return {
    id: String(enrollment.id || ""),
    label: enrollmentLabel(enrollment),
    grantId: String(enrollment.grantId || "").trim() || undefined,
    statusLabel,
    lineItemIds,
    scheduleMeta: (enrollment as Record<string, unknown>).scheduleMeta,
  };
}

function chunkArray<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function isOpenTask(row: Record<string, unknown>): boolean {
  return String(row?.status || "open").trim().toLowerCase() === "open";
}

function isCompletablePayment(payment: TPayment | null | undefined): payment is TPayment & { id: string } {
  const id = String(payment?.id || "").trim();
  return !!id && payment?.paid !== true && payment?.void !== true && Number(payment?.amount || 0) > 0;
}

function isReversiblePayment(payment: TPayment | null | undefined): payment is TPayment & { id: string } {
  const id = String(payment?.id || "").trim();
  return !!id && payment?.paid === true && payment?.void !== true && Number(payment?.amount || 0) > 0;
}

function WorkspaceScaffold({
  title,
  subtitle,
  customers,
  onClose,
  leftPane,
  children,
}: {
  title: string;
  subtitle: string;
  customers: CustomerRow[];
  onClose: () => void;
  leftPane?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      disableOverlayClose={false}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Bulk Workspace</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{title}</div>
            <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      }
      leftPane={
        leftPane ?? (
          <div className="space-y-4 p-5">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{customers.length}</div>
              <div className="mt-1 text-sm text-slate-500">Customers in this workspace</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Preview</div>
              <div className="mt-3 space-y-2">
                {customers.slice(0, 8).map((customer) => (
                  <div key={customer.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-medium text-slate-900">{displayName(customer)}</div>
                    <div className="text-xs text-slate-500">DOB {formatDob(customer.dob)}</div>
                  </div>
                ))}
                {customers.length > 8 ? (
                  <div className="text-xs text-slate-400">+{customers.length - 8} more</div>
                ) : null}
              </div>
            </div>
          </div>
        )
      }
      rightPane={<div className="h-full overflow-y-auto bg-slate-50 p-6">{children}</div>}
    />
  );
}

function useSelectedCustomerEnrollments(customers: CustomerRow[], enabled: boolean) {
  const [data, setData] = React.useState<LoadedEnrollmentMap>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || customers.length === 0) {
      setData({});
      return;
    }
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const next: LoadedEnrollmentMap = {};
        const groups = chunkArray(customers, 12);
        for (const group of groups) {
          const results = await Promise.all(
            group.map(async (customer) => {
              const enrollments = await EnrollmentsAPI.list({
                customerId: String(customer.id || ""),
                limit: 200,
              });
              return [customer.id, Array.isArray(enrollments) ? enrollments : []] as const;
            }),
          );
          if (cancelled) return;
          for (const [customerId, enrollments] of results) next[customerId] = enrollments;
          setData((prev) => ({ ...prev, ...next }));
        }
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Failed to load enrollments.", { type: "error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [customers, enabled]);

  return { data, loading, setData };
}

function BulkEnrollWorkspace({
  customers,
  onClose,
  onClearSelection,
}: {
  customers: CustomerRow[];
  onClose: () => void;
  onClearSelection: () => void;
}) {
  const bulkEnroll = useEnrollmentsBulkEnroll();
  const { data: enrollmentsByCustomer, loading } = useSelectedCustomerEnrollments(customers, true);
  const [page, setPage] = React.useState(0);
  const [globalGrantId, setGlobalGrantId] = React.useState<string | null>(null);
  const [globalStartDate, setGlobalStartDate] = React.useState(todayISO());
  const [grantOverrides, setGrantOverrides] = React.useState<Record<string, string>>({});
  const [startDateOverrides, setStartDateOverrides] = React.useState<Record<string, string>>({});

  const firstSelectedEnrollmentGrantId = React.useMemo(() => {
    for (const customer of customers) {
      const active = (enrollmentsByCustomer[customer.id] || []).find(isActiveEnrollment);
      const grantId = String(active?.grantId || "").trim();
      if (grantId) return grantId;
    }
    return null;
  }, [customers, enrollmentsByCustomer]);

  React.useEffect(() => {
    if (!globalGrantId && firstSelectedEnrollmentGrantId) setGlobalGrantId(firstSelectedEnrollmentGrantId);
  }, [firstSelectedEnrollmentGrantId, globalGrantId]);

  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const pageRows = React.useMemo(
    () => customers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [customers, page],
  );

  const resolveGrantId = React.useCallback(
    (customerId: string) => {
      const override = String(grantOverrides[customerId] || "").trim();
      return override || String(globalGrantId || "").trim();
    },
    [globalGrantId, grantOverrides],
  );

  const resolveStartDate = React.useCallback(
    (customerId: string) => {
      const override = String(startDateOverrides[customerId] || "").trim();
      return override || globalStartDate;
    },
    [globalStartDate, startDateOverrides],
  );

  const handleSave = React.useCallback(
    async (closeWhenDone: boolean) => {
      const grouped = new Map<string, string[]>();
      for (const customer of customers) {
        const customerId = String(customer.id || "").trim();
        const grantId = resolveGrantId(customerId);
        const startDate = resolveStartDate(customerId);
        if (!customerId || !grantId || !startDate) continue;
        const key = `${grantId}__${startDate}`;
        const group = grouped.get(key) || [];
        group.push(customerId);
        grouped.set(key, group);
      }

      if (!grouped.size) {
        toast("Choose a program and start date for at least one customer.", { type: "error" });
        return;
      }

      const failedCustomerIds: string[] = [];
      let enrolledCount = 0;

      for (const [key, customerIds] of grouped.entries()) {
        const [grantId, startDate] = key.split("__");
        const resp = await bulkEnroll.mutateAsync({
          grantId,
          customerIds,
          extra: { startDate },
        });
        const results = (resp as { results?: Array<{ customerId: string; error?: string }> })?.results ?? [];
        for (const r of results) {
          if (r.error) failedCustomerIds.push(r.customerId);
          else enrolledCount += 1;
        }
      }

      if (failedCustomerIds.length) {
        const names = failedCustomerIds
          .map((id) => customers.find((c) => c.id === id))
          .map((c) => (c ? displayName(c) : "Unknown"))
          .join(", ");
        toast(`${enrolledCount} enrolled. ${failedCustomerIds.length} failed: ${names}`, { type: "error" });
      } else {
        toast(`${enrolledCount} customer${enrolledCount === 1 ? "" : "s"} enrolled.`, { type: "success" });
      }

      if (!failedCustomerIds.length) onClearSelection();
      if (closeWhenDone && !failedCustomerIds.length) onClose();
    },
    [bulkEnroll, customers, onClearSelection, onClose, resolveGrantId, resolveStartDate],
  );

  return (
    <WorkspaceScaffold
      title="Bulk Enroll"
      subtitle="Set global defaults once, then override by row where needed."
      customers={customers}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Global Defaults</div>
              <div className="mt-1 text-sm text-slate-500">These apply to every row unless the row overrides them.</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Program</div>
              <GrantSelect
                value={globalGrantId}
                onChange={setGlobalGrantId}
                placeholderLabel="Select program"
                disabled={bulkEnroll.isPending}
              />
            </div>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-slate-600">Start Date</div>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                value={globalStartDate}
                onChange={(event) => setGlobalStartDate(event.currentTarget.value)}
                disabled={bulkEnroll.isPending}
              />
            </label>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-slate-950">Selected Customers</div>
              <div className="text-xs text-slate-500">{customers.length} customers, 50 per page</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0}
              >
                Prev
              </button>
              <span className="text-slate-500">Page {page + 1} / {pageCount}</span>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
                disabled={page >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">DOB</th>
                  <th className="px-5 py-3">Current Enrollment</th>
                  <th className="px-5 py-3">Program Override</th>
                  <th className="px-5 py-3">Start Date Override</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((customer) => {
                  const activeEnrollment = (enrollmentsByCustomer[customer.id] || []).find(isActiveEnrollment);
                  return (
                    <tr key={customer.id} className="border-t border-slate-100 align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{displayName(customer)}</div>
                        <div className="text-xs text-slate-400">{customer.id}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDob(customer.dob)}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {loading ? "Loading..." : activeEnrollment ? enrollmentLabel(activeEnrollment) : "No active enrollment"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="min-w-[230px]">
                          <GrantSelect
                            value={grantOverrides[customer.id] || null}
                            onChange={(value) =>
                              setGrantOverrides((prev) => {
                                const next = { ...prev };
                                if (!value) delete next[customer.id];
                                else next[customer.id] = value;
                                return next;
                              })
                            }
                            placeholderLabel="Use bulk default"
                            disabled={bulkEnroll.isPending}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Effective: {resolveGrantId(customer.id) || "Unset"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="date"
                          className="w-full min-w-[170px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                          value={startDateOverrides[customer.id] || ""}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setStartDateOverrides((prev) => {
                              const next = { ...prev };
                              if (!value) delete next[customer.id];
                              else next[customer.id] = value;
                              return next;
                            });
                          }}
                          disabled={bulkEnroll.isPending}
                        />
                        <div className="mt-2 text-xs text-slate-400">
                          Effective: {resolveStartDate(customer.id)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => void handleSave(false)}
            disabled={bulkEnroll.isPending}
          >
            {bulkEnroll.isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
            onClick={() => void handleSave(true)}
            disabled={bulkEnroll.isPending}
          >
            {bulkEnroll.isPending ? "Saving..." : "Save And Exit"}
          </button>
        </div>
      </div>
    </WorkspaceScaffold>
  );
}

function BulkCaseManagersWorkspace({
  customers,
  caseManagerOptions,
  onClose,
  onClearSelection,
}: {
  customers: CustomerRow[];
  caseManagerOptions: CaseManagerOption[];
  onClose: () => void;
  onClearSelection: () => void;
}) {
  const patchCustomers = usePatchCustomers();
  const [page, setPage] = React.useState(0);
  const [globalPrimaryId, setGlobalPrimaryId] = React.useState<string | null>(null);
  const [globalSecondaryId, setGlobalSecondaryId] = React.useState<string | null>(null);
  const [globalContactId, setGlobalContactId] = React.useState<string | null>(null);
  const [primaryOverrides, setPrimaryOverrides] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      customers
        .map((c) => [c.id, String((c as Record<string, unknown>).caseManagerId || "").trim()])
        .filter(([, v]) => v),
    ),
  );
  const [secondaryOverrides, setSecondaryOverrides] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      customers
        .map((c) => [c.id, String((c as Record<string, unknown>).secondaryCaseManagerId || "").trim()])
        .filter(([, v]) => v),
    ),
  );
  const [contactOverrides, setContactOverrides] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      customers
        .map((c) => {
          const ids = (c as Record<string, unknown>).contactCaseManagerIds;
          const first = Array.isArray(ids) ? String(ids[0] || "").trim() : "";
          return [c.id, first];
        })
        .filter(([, v]) => v),
    ),
  );

  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const pageRows = React.useMemo(
    () => customers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [customers, page],
  );

  const resolveValue = React.useCallback((customerId: string, overrides: Record<string, string>, globalValue: string | null) => {
    const override = String(overrides[customerId] || "").trim();
    return override || String(globalValue || "").trim();
  }, []);

  const handleSave = React.useCallback(
    async (closeWhenDone: boolean) => {
      const rows = customers.map((customer) => {
        const primaryId = resolveValue(customer.id, primaryOverrides, globalPrimaryId) || null;
        const secondaryId = resolveValue(customer.id, secondaryOverrides, globalSecondaryId) || null;
        const contactId = resolveValue(customer.id, contactOverrides, globalContactId) || null;
        const contactIds = Array.from(
          new Set(
            [primaryId, secondaryId, contactId]
              .map((value) => String(value || "").trim())
              .filter(Boolean),
          ),
        );
        return {
          id: customer.id,
          patch: {
            caseManagerId: primaryId,
            secondaryCaseManagerId: secondaryId,
            contactCaseManagerIds: contactIds,
          },
        };
      });

      await patchCustomers.mutateAsync(rows);
      toast(`Updated case management assignments for ${customers.length} customer${customers.length === 1 ? "" : "s"}.`, { type: "success" });
      onClearSelection();
      if (closeWhenDone) onClose();
    },
    [
      contactOverrides,
      customers,
      globalContactId,
      globalPrimaryId,
      globalSecondaryId,
      onClearSelection,
      onClose,
      patchCustomers,
      primaryOverrides,
      resolveValue,
      secondaryOverrides,
    ],
  );

  return (
    <WorkspaceScaffold
      title="Bulk Assign Case Team"
      subtitle="Apply a shared case team, then override row by row where needed."
      customers={customers}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Primary Case Manager</div>
              <CaseManagerSelect value={globalPrimaryId} onChange={setGlobalPrimaryId} options={caseManagerOptions} allLabel="No default" className="w-full" />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Secondary Case Manager</div>
              <CaseManagerSelect value={globalSecondaryId} onChange={setGlobalSecondaryId} options={caseManagerOptions} allLabel="No default" className="w-full" />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Contact Case Manager</div>
              <CaseManagerSelect value={globalContactId} onChange={setGlobalContactId} options={caseManagerOptions} allLabel="No default" className="w-full" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="text-sm font-semibold text-slate-950">Assignments</div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0}
              >
                Prev
              </button>
              <span className="text-slate-500">Page {page + 1} / {pageCount}</span>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
                disabled={page >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Primary</th>
                  <th className="px-5 py-3">Secondary</th>
                  <th className="px-5 py-3">Contact</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((customer) => (
                  <tr key={customer.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{displayName(customer)}</div>
                      <div className="text-xs text-slate-400">DOB {formatDob(customer.dob)}</div>
                    </td>
                    <td className="px-5 py-4 min-w-[200px] max-w-[260px]">
                      <CaseManagerSelect
                        value={primaryOverrides[customer.id] || null}
                        onChange={(value) =>
                          setPrimaryOverrides((prev) => {
                            const next = { ...prev };
                            if (!value) delete next[customer.id];
                            else next[customer.id] = value;
                            return next;
                          })
                        }
                        options={caseManagerOptions}
                        allLabel="Unassigned"
                        className="w-full"
                      />
                    </td>
                    <td className="px-5 py-4 min-w-[200px] max-w-[260px]">
                      <CaseManagerSelect
                        value={secondaryOverrides[customer.id] || null}
                        onChange={(value) =>
                          setSecondaryOverrides((prev) => {
                            const next = { ...prev };
                            if (!value) delete next[customer.id];
                            else next[customer.id] = value;
                            return next;
                          })
                        }
                        options={caseManagerOptions}
                        allLabel="Unassigned"
                        className="w-full"
                      />
                    </td>
                    <td className="px-5 py-4 min-w-[200px] max-w-[260px]">
                      <CaseManagerSelect
                        value={contactOverrides[customer.id] || null}
                        onChange={(value) =>
                          setContactOverrides((prev) => {
                            const next = { ...prev };
                            if (!value) delete next[customer.id];
                            else next[customer.id] = value;
                            return next;
                          })
                        }
                        options={caseManagerOptions}
                        allLabel="Unassigned"
                        className="w-full"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => void handleSave(false)}
            disabled={patchCustomers.isPending}
          >
            {patchCustomers.isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
            onClick={() => void handleSave(true)}
            disabled={patchCustomers.isPending}
          >
            {patchCustomers.isPending ? "Saving..." : "Save And Exit"}
          </button>
        </div>
      </div>
    </WorkspaceScaffold>
  );
}

function BulkPaymentsWorkspace({
  customers,
  onClose,
  onClearSelection,
}: {
  customers: CustomerRow[];
  onClose: () => void;
  onClearSelection: () => void;
}) {
  const { data: enrollmentsByCustomer, loading, setData } = useSelectedCustomerEnrollments(customers, true);
  const enrollCustomer = useEnrollCustomer();
  const buildPayments = usePaymentsBuildSchedule();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [createGrantId, setCreateGrantId] = React.useState<string | null>(null);
  const [createStartDate, setCreateStartDate] = React.useState(todayISO());
  const [copyEnrollmentId, setCopyEnrollmentId] = React.useState<string>("");
  const [previousSourceEnrollmentId, setPreviousSourceEnrollmentId] = React.useState<string>("");
  const [processedIds, setProcessedIds] = React.useState<string[]>([]);
  const currentCustomer = customers[currentIndex] || null;
  const currentCustomerId = String(currentCustomer?.id || "");
  const currentEnrollments = React.useMemo(
    () => (enrollmentsByCustomer[currentCustomerId] || []).filter(isActiveEnrollment),
    [currentCustomerId, enrollmentsByCustomer],
  );
  const currentEnrollmentOptions = React.useMemo(
    () => currentEnrollments.map(toEnrollmentOption),
    [currentEnrollments],
  );
  const selectedGrantId = React.useMemo(
    () => String(currentEnrollments[0]?.grantId || createGrantId || "").trim() || null,
    [createGrantId, currentEnrollments],
  );

  React.useEffect(() => {
    setCreateGrantId(null);
    setCreateStartDate(todayISO());
  }, [currentIndex]);

  React.useEffect(() => {
    setCopyEnrollmentId(String(currentEnrollments[0]?.id || ""));
    const grantId = String(currentEnrollments[0]?.grantId || "").trim();
    if (grantId) setCreateGrantId((prev) => prev || grantId);
  }, [currentEnrollments]);

  const advance = React.useCallback(() => {
    setProcessedIds((prev) => (currentCustomerId && !prev.includes(currentCustomerId) ? [...prev, currentCustomerId] : prev));
    setCurrentIndex((prev) => Math.min(customers.length, prev + 1));
  }, [currentCustomerId, customers.length]);

  const handleCreateEnrollment = React.useCallback(async () => {
    if (!currentCustomerId || !createGrantId || !createStartDate) {
      toast("Choose a program and start date first.", { type: "error" });
      return;
    }
    const result = await enrollCustomer.mutateAsync({
      customerId: currentCustomerId,
      grantId: createGrantId,
      extra: {
        status: "active",
        active: true,
        startDate: createStartDate,
      },
    });
    const newEnrollmentId = String((result as { id?: unknown })?.id || "").trim();
    if (!newEnrollmentId) return;
    const fresh = await EnrollmentsAPI.getById(newEnrollmentId);
    if (!fresh) return;
    setData((prev) => ({
      ...prev,
      [currentCustomerId]: [fresh, ...(prev[currentCustomerId] || [])],
    }));
    setCopyEnrollmentId(newEnrollmentId);
    toast("Enrollment created for payment scheduling.", { type: "success" });
  }, [createGrantId, createStartDate, currentCustomerId, enrollCustomer, setData]);

  const handleBuild = React.useCallback(
    async (payload: PaymentScheduleBuildInput) => {
      await buildPayments.mutateAsync(payload);
      setPreviousSourceEnrollmentId(payload.enrollmentId);
      toast("Payment schedule built.", { type: "success" });
      setBuilderOpen(false);
      advance();
    },
    [advance, buildPayments],
  );

  const handleCopyPrevious = React.useCallback(async () => {
    if (!previousSourceEnrollmentId || !copyEnrollmentId) {
      toast("Build one schedule first, then copy it forward.", { type: "error" });
      return;
    }
    await PaymentsAPI.bulkCopySchedule({
      sourceEnrollmentId: previousSourceEnrollmentId,
      targetEnrollmentIds: [copyEnrollmentId],
      mode: "replace",
      anchorByStartDate: true,
    });
    toast("Copied the previous schedule to this customer.", { type: "success" });
    advance();
  }, [advance, copyEnrollmentId, previousSourceEnrollmentId]);

  const finishAndClose = React.useCallback(() => {
    onClearSelection();
    onClose();
  }, [onClearSelection, onClose]);

  return (
    <WorkspaceScaffold
      title="Bulk Payment Tool"
      subtitle="Work one customer at a time. Use the payment builder, create enrollments when needed, and copy the last built schedule forward."
      customers={customers}
      onClose={onClose}
      leftPane={
        <div className="space-y-4 p-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Progress</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{Math.min(currentIndex + 1, customers.length)} / {customers.length}</div>
            <div className="mt-1 text-sm text-slate-500">{processedIds.length} customer{processedIds.length === 1 ? "" : "s"} processed</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Queue</div>
            <div className="mt-3 space-y-2">
              {customers.map((customer, index) => {
                const processed = processedIds.includes(customer.id);
                const current = index === currentIndex;
                return (
                  <div
                    key={customer.id}
                    className={[
                      "rounded-2xl border px-3 py-2",
                      current
                        ? "border-sky-200 bg-sky-50"
                        : processed
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="text-sm font-medium text-slate-900">{displayName(customer)}</div>
                    <div className="text-xs text-slate-500">{processed ? "Ready" : current ? "Current" : "Pending"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      }
    >
      {!currentCustomer ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-semibold text-slate-950">All selected customers are done.</div>
          <div className="mt-2 text-sm text-slate-500">You can close this workspace now.</div>
          <button
            type="button"
            className="mt-5 inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            onClick={finishAndClose}
          >
            Close Workspace
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current Customer</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{displayName(currentCustomer)}</div>
                <div className="mt-1 text-sm text-slate-500">DOB {formatDob(currentCustomer.dob)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  onClick={advance}
                  disabled={currentIndex >= customers.length}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>

          {selectedGrantId ? <GrantBudgetStrip grantId={selectedGrantId} /> : null}

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">Active Enrollments</div>
            <div className="mt-1 text-sm text-slate-500">
              {loading ? "Loading enrollments..." : currentEnrollments.length ? "Choose an enrollment to build or copy a schedule." : "This customer has no active enrollment yet."}
            </div>
            <div className="mt-4 space-y-3">
              {currentEnrollments.map((enrollment) => (
                <div key={enrollment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="font-medium text-slate-900">{enrollmentLabel(enrollment)}</div>
                  <div className="text-xs text-slate-500">
                    Start {String(enrollment.startDate || "-")} • Grant {String(enrollment.grantId || "-")}
                  </div>
                </div>
              ))}
              {!currentEnrollments.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No active enrollment is available for this customer yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">Create Enrollment For This Tool</div>
            <div className="mt-1 text-sm text-slate-500">Use this when the selected customer needs a new enrollment before you build the schedule.</div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Program</div>
                <GrantSelect
                  value={createGrantId}
                  onChange={setCreateGrantId}
                  placeholderLabel="Select program"
                  disabled={enrollCustomer.isPending}
                />
              </div>
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">Start Date</div>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  value={createStartDate}
                  onChange={(event) => setCreateStartDate(event.currentTarget.value)}
                  disabled={enrollCustomer.isPending}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
                  onClick={() => void handleCreateEnrollment()}
                  disabled={enrollCustomer.isPending}
                >
                  {enrollCustomer.isPending ? "Creating..." : "Create Enrollment"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-950">Schedule Actions</div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">Open Payment Builder</div>
                <div className="mt-1 text-sm text-slate-500">Use the existing payment schedule builder for this customer.</div>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => setBuilderOpen(true)}
                  disabled={!currentEnrollmentOptions.length || buildPayments.isPending}
                >
                  Open Builder
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">Copy Previous Schedule</div>
                <div className="mt-1 text-sm text-slate-500">After you build one schedule, copy it forward to the next matching customer.</div>
                <div className="mt-4">
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    value={copyEnrollmentId}
                    onChange={(event) => setCopyEnrollmentId(event.currentTarget.value)}
                    disabled={!currentEnrollmentOptions.length}
                  >
                    <option value="">Select target enrollment</option>
                    {currentEnrollmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
                  onClick={() => void handleCopyPrevious()}
                  disabled={!previousSourceEnrollmentId || !copyEnrollmentId}
                >
                  Copy Previous
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentScheduleBuilderDialog
        open={builderOpen}
        enrollments={currentEnrollmentOptions}
        busy={buildPayments.isPending}
        customerName={currentCustomer ? displayName(currentCustomer) : undefined}
        onCancel={() => setBuilderOpen(false)}
        onBuild={(payload) => void handleBuild(payload)}
      />
    </WorkspaceScaffold>
  );
}

function BulkOperationsWorkspace({
  customers,
  tool,
  isAdminUser,
  onClose,
  onClearSelection,
}: {
  customers: CustomerRow[];
  tool: Exclude<CustomerBulkTool, "enroll" | "payments" | "case-managers">;
  isAdminUser: boolean;
  onClose: () => void;
  onClearSelection: () => void;
}) {
  const queryClient = useQueryClient();
  const patchCustomers = usePatchCustomers();
  const softDeleteCustomers = useSoftDeleteCustomers();
  const hardDeleteCustomers = useHardDeleteCustomers();
  const { data: enrollmentsByCustomer } = useSelectedCustomerEnrollments(customers, tool !== "archive" && tool !== "delete" && tool !== "hard-delete");
  const [busy, setBusy] = React.useState(false);

  const titleByTool: Record<typeof tool, string> = {
    archive: "Bulk Archive",
    delete: "Bulk Delete",
    "hard-delete": "Bulk Hard Delete",
    "complete-past-tasks": "Bulk Complete Past Tasks",
    "mark-projections-paid": "Bulk Mark Projections Paid",
    "reverse-payments": "Bulk Reverse Payments",
    "refresh-enrollments": "Bulk Refresh Enrollments",
  };

  const descriptionByTool: Record<typeof tool, string> = {
    archive: "Marks selected customers inactive without deleting them.",
    delete: "Soft deletes selected customers.",
    "hard-delete": "Permanently deletes selected customers.",
    "complete-past-tasks": "Completes open tasks whose due date is today or earlier.",
    "mark-projections-paid": "Marks unpaid projected payments as paid across active enrollments.",
    "reverse-payments": "Reverses already-paid payments across active enrollments.",
    "refresh-enrollments": "Refreshes enrollment data for selected customers.",
  };

  const run = React.useCallback(async () => {
    const customerIds = customers.map((customer) => customer.id);
    setBusy(true);
    try {
      if (tool === "archive") {
        await patchCustomers.mutateAsync(
          customerIds.map((id) => ({
            id,
            patch: { active: false, status: "inactive" },
          })),
        );
        toast(`Archived ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, { type: "success" });
      } else if (tool === "delete") {
        await softDeleteCustomers.mutateAsync(customerIds);
        toast(`Soft deleted ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, { type: "success" });
      } else if (tool === "hard-delete") {
        if (!isAdminUser) {
          toast("Hard delete requires admin access.", { type: "error" });
          return;
        }
        await hardDeleteCustomers.mutateAsync(customerIds);
        toast(`Hard deleted ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, { type: "success" });
      } else if (tool === "complete-past-tasks") {
        const today = todayISO();
        let completed = 0;
        for (const enrollments of Object.values(enrollmentsByCustomer)) {
          const activeEnrollments = enrollments.filter(isActiveEnrollment);
          for (const group of chunkArray(activeEnrollments.map((enrollment) => String(enrollment.id || "")), 100)) {
            const response = await TasksAPI.list({
              enrollmentIds: group,
              status: "open",
              limit: 1000,
            } as ReqOf<"tasksList">);
            const rows = response && typeof response === "object" && Array.isArray((response as { items?: unknown[] }).items)
              ? (((response as { items?: Array<Record<string, unknown>> }).items) || [])
              : [];
            const grouped = new Map<string, Array<{ taskId: string; action: "complete" }>>();
            for (const row of rows) {
              if (!isOpenTask(row)) continue;
              const dueDate = String(row?.dueDate || "").trim();
              if (dueDate && dueDate > today) continue;
              const enrollmentId = String(row?.enrollmentId || "").trim();
              const taskId = String(row?.taskId || "").trim();
              if (!enrollmentId || !taskId) continue;
              const batch = grouped.get(enrollmentId) || [];
              batch.push({ taskId, action: "complete" });
              grouped.set(enrollmentId, batch);
            }
            for (const [enrollmentId, changes] of grouped.entries()) {
              for (const batch of chunkArray(changes, 500)) {
                await TasksAPI.bulkStatus({ enrollmentId, changes: batch });
                completed += batch.length;
              }
            }
          }
        }
        toast(completed ? `Completed ${completed} past-due task${completed === 1 ? "" : "s"}.` : "No past-due open tasks were found.", {
          type: completed ? "success" : "warn",
        });
      } else if (tool === "mark-projections-paid") {
        let completed = 0;
        for (const enrollments of Object.values(enrollmentsByCustomer)) {
          for (const enrollment of enrollments.filter(isActiveEnrollment)) {
            const enrollmentId = String(enrollment.id || "").trim();
            const payments = Array.isArray(enrollment.payments) ? enrollment.payments : [];
            for (const payment of payments) {
              if (!isCompletablePayment(payment)) continue;
              await PaymentsAPI.spend({ enrollmentId, paymentId: String(payment.id) } as ReqOf<"paymentsSpend">);
              completed += 1;
            }
          }
        }
        toast(completed ? `Marked ${completed} projection${completed === 1 ? "" : "s"} paid.` : "No unpaid projections were found.", {
          type: completed ? "success" : "warn",
        });
      } else if (tool === "reverse-payments") {
        let reversed = 0;
        for (const enrollments of Object.values(enrollmentsByCustomer)) {
          for (const enrollment of enrollments.filter(isActiveEnrollment)) {
            const enrollmentId = String(enrollment.id || "").trim();
            const payments = Array.isArray(enrollment.payments) ? enrollment.payments : [];
            for (const payment of payments) {
              if (!isReversiblePayment(payment)) continue;
              await PaymentsAPI.spend({ enrollmentId, paymentId: String(payment.id), reverse: true } as ReqOf<"paymentsSpend">);
              reversed += 1;
            }
          }
        }
        toast(reversed ? `Reversed ${reversed} payment${reversed === 1 ? "" : "s"}.` : "No paid payments were found.", {
          type: reversed ? "success" : "warn",
        });
      } else if (tool === "refresh-enrollments") {
        for (const customerId of customerIds) {
          await queryClient.invalidateQueries({
            queryKey: qk.enrollments.byCustomerId(customerId),
            exact: false,
          });
        }
        toast(`Refreshed enrollment data for ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}.`, {
          type: "success",
        });
      }
      onClearSelection();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed. Please try again.", { type: "error" });
    } finally {
      setBusy(false);
    }
  }, [
    customers,
    enrollmentsByCustomer,
    hardDeleteCustomers,
    isAdminUser,
    onClearSelection,
    onClose,
    patchCustomers,
    queryClient,
    softDeleteCustomers,
    tool,
  ]);

  return (
    <WorkspaceScaffold
      title={titleByTool[tool]}
      subtitle={descriptionByTool[tool]}
      customers={customers}
      onClose={onClose}
    >
      <div className="max-w-3xl space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-950">{titleByTool[tool]}</div>
          <div className="mt-2 text-sm text-slate-500">{descriptionByTool[tool]}</div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-700">
              This action will run against <span className="font-semibold">{customers.length}</span> selected customer{customers.length === 1 ? "" : "s"}.
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
              onClick={() => void run()}
              disabled={busy}
            >
              {busy ? "Working..." : "Run Action"}
            </button>
          </div>
        </div>
      </div>
    </WorkspaceScaffold>
  );
}

export default function CustomerBulkWorkspaceModal({
  isOpen,
  tool,
  customers,
  isAdminUser,
  caseManagerOptions,
  onClose,
  onClearSelection,
}: Props) {
  if (!isOpen || !tool) return null;

  if (tool === "enroll") {
    return <BulkEnrollWorkspace customers={customers} onClose={onClose} onClearSelection={onClearSelection} />;
  }
  if (tool === "payments") {
    return <BulkPaymentsWorkspace customers={customers} onClose={onClose} onClearSelection={onClearSelection} />;
  }
  if (tool === "case-managers") {
    return (
      <BulkCaseManagersWorkspace
        customers={customers}
        caseManagerOptions={caseManagerOptions}
        onClose={onClose}
        onClearSelection={onClearSelection}
      />
    );
  }

  return (
    <BulkOperationsWorkspace
      customers={customers}
      tool={tool}
      isAdminUser={isAdminUser}
      onClose={onClose}
      onClearSelection={onClearSelection}
    />
  );
}
