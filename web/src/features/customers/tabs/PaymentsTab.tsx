"use client";

import React from "react";
import type { ReqOf, TPayment } from "@types";
import type { CustomerPaymentRow } from "@client/payments";
import { toApiError } from "@client/api";
import {
  useCustomerPayments,
  usePaymentsBuildSchedule,
  usePaymentsDeleteRows,
  usePaymentsProjectionsAdjust,
  usePaymentsSpend,
  usePaymentsUpdateCompliance,
  usePaymentRentCert,
  type PaymentScheduleBuildInput,
  type PaymentsProjectionsAdjustInput,
} from "@hooks/usePayments";
import { useCustomerEnrollments, useEnrollmentAllocationSet, useEnrollmentContinuumSummary } from "@hooks/useEnrollments";
import { useGrants } from "@hooks/useGrants";
import { useLedgerEntries } from "@hooks/useLedger";
import { useTasksList, type TasksListItem } from "@hooks/useTasks";
import PaymentPaidDialog from "@entities/dialogs/payments/PaymentPaidDialog";
import PaymentsDeleteDialog from "@entities/dialogs/payments/PaymentsDeleteDialog";
import PaymentScheduleBuilderDialog from "@entities/dialogs/payments/PaymentScheduleBuilderDialog";
import PaymentsProjectionsAdjustDialog from "@entities/dialogs/payments/PaymentsProjectionsAdjustDialog";
import dynamic from "next/dynamic";
const GrantBudgetStrip = dynamic(
  () => import("@entities/grants/GrantBudgetStrip").then((m) => m.GrantBudgetStrip),
  { ssr: false, loading: () => <div className="h-6 animate-pulse rounded bg-slate-100" /> },
);
const PaymentEditorSheetSurface = dynamic(
  () => import("@features/payment-editor-lab/PaymentEditorLabPage"),
  { ssr: false, loading: () => <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading sheet editor...</div> },
);
import { CustomerPaymentsTable } from "../components";
import { addMonthsISO } from "../components/paymentScheduleUtils";
import { summarizePaymentScheduleBuild, type PaymentScheduleBuildSummary } from "../paymentScheduleBuildSummary";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10 } from "@lib/date";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { toast } from "@lib/toast";

type SelectedPayment = {
  enrollmentId: string;
  paymentKey: string;
  payment: TPayment;
  row: CustomerPaymentRow;
};

type RentCertStatus = "notDue" | "due" | "completed" | "effective";

function paymentDate(p: TPayment): string {
  const legacyDate = (p as Record<string, unknown>).date;
  return safeISODate10(p.dueDate || legacyDate) || "";
}

function paymentTypeKey(p: TPayment): string {
  const type = String(p?.type || "monthly").toLowerCase();
  if (type !== "monthly") return type;
  const noteValue = (p as Record<string, unknown>).note;
  const notes = Array.isArray(noteValue) ? noteValue : noteValue != null ? [noteValue] : [];
  const tags = notes.map((x: unknown) => String(x || "").toLowerCase());
  const isUtility = tags.some((t) => t === "sub:utility" || t === "utility" || t.startsWith("sub:utility") || t.startsWith("utility:"));
  return isUtility ? "monthly:utility" : "monthly:rent";
}

const BY_TYPE_LABELS: Record<string, string> = {
  "monthly:rent": "Rent",
  "monthly:utility": "Utility",
  "deposit": "Deposit",
  "prorated": "Pro-Rated",
  "service": "Support Service",
};

function grantBudgetTotal(grant: unknown): number {
  const g = grant && typeof grant === "object" ? (grant as Record<string, unknown>) : {};
  const budget = g.budget && typeof g.budget === "object" ? (g.budget as Record<string, unknown>) : {};
  const totals = budget.totals && typeof budget.totals === "object" ? (budget.totals as Record<string, unknown>) : {};
  const directTotal = Number(budget.total ?? totals.total ?? 0);
  if (Number.isFinite(directTotal) && directTotal > 0) return directTotal;
  const lineItems = Array.isArray(budget.lineItems) ? budget.lineItems : [];
  return lineItems.reduce((sum, raw) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const amount = Number(item.amount ?? item.total ?? item.budget ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function isOpenEnrollment(enrollment: unknown): boolean {
  const row = enrollment && typeof enrollment === "object" ? (enrollment as Record<string, unknown>) : {};
  const status = String(row.status || "").trim().toLowerCase();
  if (status === "closed" || status === "deleted") return false;
  if (typeof row.active === "boolean") return row.active;
  return true;
}

function positiveLedgerPaymentKey(entry: unknown): string | null {
  const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  const amountCents = Number(row.amountCents ?? Number(row.amount || 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
  if (row.reversalOf) return null;
  const enrollmentId = String(row.enrollmentId || "").trim();
  const origin = row.origin && typeof row.origin === "object" ? (row.origin as Record<string, unknown>) : {};
  const paymentId = String(row.paymentId || origin.baseId || "").trim();
  if (!enrollmentId || !paymentId) return null;
  return `${enrollmentId}:${paymentId}`;
}

function rentCertTargetDate(task: TasksListItem): string {
  const defId = String((task as Record<string, unknown>).defId || "");
  const defMatch = defId.match(/(\d{4}-\d{2}-\d{2})(?:_[a-z]+)?$/i);
  if (defMatch) return defMatch[1];
  const dueDate = safeISODate10((task as Record<string, unknown>).dueDate);
  return dueDate ? addMonthsISO(dueDate, 1) : "";
}

function isRentCertTask(task: TasksListItem): boolean {
  const row = task as Record<string, unknown>;
  const defId = String(row.defId || "");
  if (defId.startsWith("payment_rent_cert_") || defId.startsWith("pay_cert_")) return true;
  const title = String(row.title || "").toLowerCase();
  const note = String(row.note || "").toLowerCase();
  return title.includes("rent cert") || note.includes("rent certification");
}

function rentCertDone(task: TasksListItem): boolean {
  const status = String((task as Record<string, unknown>).status || "").toLowerCase();
  return status === "done" || status === "verified";
}

export function PaymentsTab({ customerId, customerName }: { customerId: string; customerName?: string }) {
  const { data: rows = [], isLoading } = useCustomerPayments(customerId);
  const { data: enrollments = [] } = useCustomerEnrollments(customerId, { enabled: !!customerId });
  const { data: grants = [] } = useGrants({ limit: 500 }, { enabled: !!customerId });
  const {
    data: customerLedgerEntries = [],
    isLoading: isLedgerLoading,
    isError: isLedgerError,
  } = useLedgerEntries(
    { customerId, limit: 500, sortBy: "dueDate", sortOrder: "desc" },
    { enabled: !!customerId },
  );
  const spend = usePaymentsSpend();
  const compliance = usePaymentsUpdateCompliance();
  const deleteRows = usePaymentsDeleteRows();
  const buildScheduleMutation = usePaymentsBuildSchedule();
  const adjustMutation = usePaymentsProjectionsAdjust();
  const rentCertMutation = usePaymentRentCert();

  const [selected, setSelected] = React.useState<SelectedPayment | null>(null);
  const [paidDialogOpen, setPaidDialogOpen] = React.useState(false);
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [adjustInitialEnrollmentId, setAdjustInitialEnrollmentId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [hmisComplete, setHmisComplete] = React.useState(false);
  const [caseworthyComplete, setCaseworthyComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enrollmentFilterId, setEnrollmentFilterId] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"legacy" | "sheet">("legacy");
  const [buildSummary, setBuildSummary] = React.useState<PaymentScheduleBuildSummary | null>(null);

  const grantBudgetById = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const grant of grants as Array<Record<string, unknown>>) {
      const id = String(grant?.id || "").trim();
      if (id) m.set(id, grantBudgetTotal(grant));
    }
    return m;
  }, [grants]);

  const fundedEnrollments = React.useMemo(() => {
    return enrollments.filter((enrollment) => {
      const grantId = String(enrollment?.grantId || "").trim();
      return !!grantId && (grantBudgetById.get(grantId) || 0) > 0;
    });
  }, [enrollments, grantBudgetById]);

  const grantEnrollments = React.useMemo(
    () => fundedEnrollments.filter(isOpenEnrollment),
    [fundedEnrollments],
  );

  const grantEnrollmentIds = React.useMemo(
    () => new Set(fundedEnrollments.map((enrollment) => String(enrollment.id || ""))),
    [fundedEnrollments],
  );

  React.useEffect(() => {
    if (enrollmentFilterId === "all") return;
    if (!grantEnrollmentIds.has(enrollmentFilterId)) setEnrollmentFilterId("all");
  }, [enrollmentFilterId, grantEnrollmentIds]);

  const sorted = React.useMemo(() => {
    return rows
      .filter((row) => grantEnrollmentIds.has(String(row.enrollmentId || "")))
      .slice()
      .sort((a: CustomerPaymentRow, b: CustomerPaymentRow) => {
        const ad = paymentDate(a.payment);
        const bd = paymentDate(b.payment);
        return ad.localeCompare(bd);
      });
  }, [rows, grantEnrollmentIds]);

  const filteredRows = React.useMemo(() => {
    if (enrollmentFilterId === "all") return sorted;
    return sorted.filter((r) => String(r.enrollmentId || "") === enrollmentFilterId);
  }, [sorted, enrollmentFilterId]);

  const filteredEnrollmentIds = React.useMemo(
    () => Array.from(new Set(filteredRows.map((row) => String(row.enrollmentId || "")).filter(Boolean))),
    [filteredRows],
  );
  const continuumSeedId = enrollmentFilterId !== "all"
    ? enrollmentFilterId
    : String(grantEnrollments[0]?.id || "");
  const { data: continuumData } = useEnrollmentContinuumSummary(continuumSeedId);
  const continuum = continuumData as any;
  const allocationSet = useEnrollmentAllocationSet();

  const editAllocation = async (enrollment: any) => {
    const current = enrollment.editableAllocation == null ? "" : String(enrollment.editableAllocation);
    const raw = window.prompt("Client allocation amount. Leave blank to use the calculated schedule amount.", current);
    if (raw == null) return;
    const amount = raw.trim() === "" ? null : Number(raw);
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      toast("Allocation must be a non-negative amount.", { type: "error" });
      return;
    }
    try {
      await allocationSet.mutateAsync({ enrollmentId: enrollment.id, amount, note: null });
      toast("Client allocation updated.", { type: "success" });
    } catch (error) {
      toast(toApiError(error).error || "Failed to update allocation.", { type: "error" });
    }
  };

  const { data: rentCertTasks = [] } = useTasksList(
    filteredEnrollmentIds.length
      ? { enrollmentIds: filteredEnrollmentIds, limit: 1000 }
      : undefined,
    { enabled: filteredEnrollmentIds.length > 0 },
  );

  const rentCertStateByPaymentKey = React.useMemo(() => {
    const tasksByPaymentKey = new Map<string, TasksListItem[]>();
    for (const task of rentCertTasks) {
      if (!isRentCertTask(task)) continue;
      const enrollmentId = String((task as Record<string, unknown>).enrollmentId || "").trim();
      const linkedPaymentId = String((task as Record<string, unknown>).rentCertPaymentId || "").trim();
      const targetDate = rentCertTargetDate(task);
      if (!enrollmentId || !targetDate) continue;
      const key = `${enrollmentId}:${linkedPaymentId || targetDate}`;
      const list = tasksByPaymentKey.get(key) || [];
      list.push(task);
      tasksByPaymentKey.set(key, list);
    }

    const statuses: Record<string, RentCertStatus> = {};
    const dueDates: Record<string, string> = {};
    for (const row of filteredRows) {
      const payment = row.payment as Record<string, unknown>;
      const pid = String(payment?.id || "").trim();
      const enrollmentId = String(row.enrollmentId || "").trim();
      if (!pid || !enrollmentId) continue;
      const linkedRentCert = payment?.rentCert && typeof payment.rentCert === "object"
        ? payment.rentCert as Record<string, unknown>
        : null;
      if (linkedRentCert?.dueDate) {
        const status = String(linkedRentCert.status || "due");
        statuses[`${enrollmentId}:${pid}`] =
          status === "completed" ? "completed" : status === "effective" ? "effective" : "due";
        dueDates[`${enrollmentId}:${pid}`] = String(linkedRentCert.dueDate).slice(0, 10);
        continue;
      }
      const targetDate = paymentDate(row.payment);
      const tasks = tasksByPaymentKey.get(`${enrollmentId}:${pid}`) || (targetDate ? tasksByPaymentKey.get(`${enrollmentId}:${targetDate}`) || [] : []);
      statuses[`${enrollmentId}:${pid}`] =
        tasks.length === 0 ? "notDue" : tasks.every(rentCertDone) ? "completed" : "due";
      const legacyDueDate = tasks.map((task) => safeISODate10((task as Record<string, unknown>).dueDate)).find(Boolean);
      if (legacyDueDate) dueDates[`${enrollmentId}:${pid}`] = legacyDueDate;
    }
    return { statuses, dueDates };
  }, [filteredRows, rentCertTasks]);

  const ledgerPaymentKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const entry of customerLedgerEntries) {
      const key = positiveLedgerPaymentKey(entry);
      if (key) keys.add(key);
    }
    return keys;
  }, [customerLedgerEntries]);

  const rowIssues = React.useMemo(() => {
    if (!customerId || isLedgerLoading || isLedgerError) return {};
    const issues: Record<string, { label: string }> = {};
    for (const row of filteredRows) {
      const payment = row.payment as Record<string, unknown>;
      if (!payment?.paid) continue;
      const pid = String(payment.id || "").trim();
      const enrollmentId = String(row.enrollmentId || "").trim();
      if (!pid || !enrollmentId) continue;
      const key = `${enrollmentId}:${pid}`;
      if (!ledgerPaymentKeys.has(key)) {
        issues[key] = { label: "Paid schedule row is missing a matching ledger entry." };
      }
    }
    return issues;
  }, [customerId, filteredRows, isLedgerError, isLedgerLoading, ledgerPaymentKeys]);

  const totals = React.useMemo(() => {
    let total = 0;
    let paid = 0;
    let projectedUnpaid = 0;
    let overdue = 0;
    let dueThisMonth = 0;
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    let nextDue = "";
    for (const row of filteredRows) {
      const amt = Number((row.payment as any)?.amount || 0);
      if (!Number.isFinite(amt)) continue;
      total += amt;
      const isPaid = Boolean((row.payment as any)?.paid);
      const due = paymentDate(row.payment);
      if (isPaid) paid += amt;
      else {
        projectedUnpaid += amt;
        if (due && due < today) overdue += 1;
        if (due && due.slice(0, 7) === thisMonth) dueThisMonth += 1;
        if (due && (!nextDue || due < nextDue)) nextDue = due;
      }
    }
    return { total, paid, projectedUnpaid, overdue, dueThisMonth, nextDue };
  }, [filteredRows]);

  const byType = React.useMemo(() => {
    const m = new Map<string, { count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = paymentTypeKey(row.payment);
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || { count: 0, total: 0, paid: 0, unpaid: 0 };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filteredRows]);

  const byLineItem = React.useMemo(() => {
    const m = new Map<string, { count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = String((row.payment as any)?.lineItemId || "").trim() || "(none)";
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || { count: 0, total: 0, paid: 0, unpaid: 0 };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [filteredRows]);

  const byEnrollment = React.useMemo(() => {
    const m = new Map<string, { label: string; count: number; total: number; paid: number; unpaid: number }>();
    for (const row of filteredRows) {
      const key = String(row.enrollmentId || "");
      const amt = Number((row.payment as any)?.amount || 0) || 0;
      const cur = m.get(key) || {
        label: formatEnrollmentLabel(row.enrollment as Record<string, unknown>, { fallback: key }),
        count: 0,
        total: 0,
        paid: 0,
        unpaid: 0,
      };
      cur.count += 1;
      cur.total += amt;
      if ((row.payment as any)?.paid) cur.paid += amt;
      else cur.unpaid += amt;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [filteredRows]);

  const builderEnrollments = React.useMemo(() => {
    return grantEnrollments.map((e) => {
      const status = String(e?.status || "").toLowerCase();
      const statusLabel: "open" | "closed" = status === "closed" || status === "deleted" ? "closed" : "open";
      const lineItemIds = Array.from(
        new Set(
          (Array.isArray(e?.payments) ? e.payments : [])
            .map((p) => String((p as Record<string, unknown>)?.lineItemId || "").trim())
            .filter(Boolean),
        ),
      );
      return {
        id: String(e.id || ""),
        label: formatEnrollmentLabel(e as Record<string, unknown>),
        grantId: String(e.grantId || ""),
        endDate: e.endDate ? String(e.endDate).slice(0, 10) : null,
        statusLabel,
        lineItemIds,
        scheduleMeta: (e as Record<string, unknown>).scheduleMeta,
        payments: (Array.isArray(e.payments) ? e.payments : []) as TPayment[],
      };
    });
  }, [grantEnrollments]);

  const adjustEnrollments = React.useMemo(() => {
    return grantEnrollments.map((e) => {
      const lineItemIds = Array.from(
        new Set(
          (Array.isArray(e?.payments) ? e.payments : [])
            .map((p) => String((p as Record<string, unknown>)?.lineItemId || "").trim())
            .filter(Boolean),
        ),
      );
      return {
        id: String(e.id || ""),
        label: formatEnrollmentLabel(e as Record<string, unknown>),
        grantId: String(e.grantId || ""),
        lineItemIds,
        payments: (Array.isArray(e.payments) ? e.payments : []) as TPayment[],
      };
    });
  }, [grantEnrollments]);

  const visibleGrantIds = React.useMemo(() => {
    const relevant = enrollmentFilterId === "all"
      ? adjustEnrollments
      : adjustEnrollments.filter((e) => e.id === enrollmentFilterId);
    return Array.from(new Set(relevant.map((e) => e.grantId).filter(Boolean))) as string[];
  }, [enrollmentFilterId, adjustEnrollments]);

  const selectedEnrollmentForBudget = React.useMemo(() => {
    if (enrollmentFilterId === "all") return null;
    return adjustEnrollments.find((e) => e.id === enrollmentFilterId) || null;
  }, [adjustEnrollments, enrollmentFilterId]);

  const budgetStripEmptyState = React.useMemo(() => {
    if (visibleGrantIds.length > 0) return null;
    if (adjustEnrollments.length === 0) return "No grant enrollments with a funded budget are available for this customer.";
    if (enrollmentFilterId === "all") return "No enrolled grants are available for this customer.";
    if (!selectedEnrollmentForBudget) return "The selected enrollment could not be found.";
    return `${selectedEnrollmentForBudget.label} is not linked to a grant, so no budget is available.`;
  }, [adjustEnrollments.length, enrollmentFilterId, selectedEnrollmentForBudget, visibleGrantIds.length]);

  const selectedGrantId = React.useMemo(
    () => adjustEnrollments.find((e) => e.id === selected?.enrollmentId)?.grantId || null,
    [selected, adjustEnrollments],
  );

  const selectedIssue = selected ? rowIssues[selected.paymentKey] || null : null;
  const rowIssueCount = React.useMemo(() => Object.keys(rowIssues).length, [rowIssues]);

  React.useEffect(() => {
    setError(null);
    setHmisComplete(Boolean(selected?.payment?.compliance?.hmisComplete));
    setCaseworthyComplete(Boolean(selected?.payment?.compliance?.caseworthyComplete));
  }, [selected]);

  const selectRow = React.useCallback((row: CustomerPaymentRow, key: string) => {
    setSelected({
      enrollmentId: row.enrollmentId,
      paymentKey: key,
      payment: row.payment,
      row,
    });
  }, []);

  const paymentId = selected?.payment?.id ? String(selected.payment.id) : "";
  const markUnpaid = async () => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId: selected.enrollmentId,
          paymentId,
          reverse: true,
          forceSync: false,
        },
      });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
    }
  };

  const markPaid = async (meta: { note?: string; vendor?: string; comment?: string }) => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId: selected.enrollmentId,
          paymentId,
          reverse: false,
          forceSync: false,
          ...(meta.note ? { note: meta.note } : {}),
          ...(meta.vendor ? { vendor: meta.vendor } : {}),
          ...(meta.comment ? { comment: meta.comment } : {}),
        },
      });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
    }
  };

  const syncLedgerSpend = async () => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId: selected.enrollmentId,
          paymentId,
          reverse: false,
          forceSync: true,
        },
      });
      toast("Ledger/spend synced.", { type: "success" });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to sync ledger/spend.", { type: "error" });
    }
  };

  const syncVisibleLedgerSpend = async () => {
    const targets = filteredRows
      .map((row) => {
        const pid = String((row.payment as Record<string, unknown>)?.id || "").trim();
        const enrollmentId = String(row.enrollmentId || "").trim();
        const key = `${enrollmentId}:${pid}`;
        return rowIssues[key] && enrollmentId && pid ? { enrollmentId, paymentId: pid } : null;
      })
      .filter((x): x is { enrollmentId: string; paymentId: string } => !!x);
    if (!targets.length) return;
    setError(null);
    try {
      for (const target of targets) {
        await spend.mutateAsync({
          body: {
            enrollmentId: target.enrollmentId,
            paymentId: target.paymentId,
            reverse: false,
            forceSync: true,
          },
        });
      }
      toast(`Synced ${targets.length} ledger/spend issue${targets.length === 1 ? "" : "s"}.`, { type: "success" });
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to sync ledger/spend issues.", { type: "error" });
    }
  };

  const saveCompliance = async () => {
    if (!selected?.enrollmentId || !paymentId) return;
    setError(null);
    try {
      await compliance.mutateAsync({
        enrollmentId: selected.enrollmentId,
        paymentId,
        patch: { hmisComplete, caseworthyComplete },
      });
      setSelected(null);
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update compliance.", { type: "error" });
    }
  };

  const togglePaidInline = async (row: CustomerPaymentRow, nextPaid: boolean) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const pid = String((row.payment as Record<string, unknown>)?.id || "").trim();
    if (!enrollmentId || !pid) return;
    setError(null);
    try {
      await spend.mutateAsync({
        body: {
          enrollmentId,
          paymentId: pid,
          reverse: !nextPaid,
          forceSync: false,
        },
      });
      if (selected?.enrollmentId === enrollmentId && paymentId === pid) {
        setSelected(null);
        setPaidDialogOpen(false);
      }
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update paid state.", { type: "error" });
      throw e;
    }
  };

  const toggleComplianceInline = async (
    row: CustomerPaymentRow,
    field: "hmisComplete" | "caseworthyComplete",
    nextValue: boolean,
  ) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const pid = String((row.payment as Record<string, unknown>)?.id || "").trim();
    if (!enrollmentId || !pid) return;
    const current = (row.payment as Record<string, unknown>)?.compliance as Record<string, unknown> | undefined;
    setError(null);
    try {
      await compliance.mutateAsync({
        enrollmentId,
        paymentId: pid,
        patch: {
          hmisComplete: field === "hmisComplete" ? nextValue : Boolean(current?.hmisComplete),
          caseworthyComplete: field === "caseworthyComplete" ? nextValue : Boolean(current?.caseworthyComplete),
        },
      });
    } catch (e: unknown) {
      toast(toApiError(e).error || "Failed to update compliance.", { type: "error" });
      throw e;
    }
  };

  const setRentCert = async (row: CustomerPaymentRow, status: RentCertStatus) => {
    const enrollmentId = String(row.enrollmentId || "").trim();
    const payment = row.payment as Record<string, any>;
    const paymentId = String(payment?.id || "").trim();
    if (!enrollmentId || !paymentId) return;
    try {
      // Due date is derived server-side as the month prior to the payment date.
      await rentCertMutation.mutateAsync({ enrollmentId, paymentId, status });
      toast(status === "notDue" ? "Rent cert cleared." : "Rent cert updated.", { type: "success" });
    } catch (error) {
      toast(toApiError(error).error || "Failed to update rent cert.", { type: "error" });
      throw error;
    }
  };

  const buildSchedule = async (payload: PaymentScheduleBuildInput) => {
    setError(null);
    const summary = summarizePaymentScheduleBuild(payload, builderEnrollments);
    setBuildSummary(summary);
    try {
      await buildScheduleMutation.mutateAsync(payload);
      setBuilderOpen(false);
      toast("Payment schedule built.", { type: "success" });
    } catch (e: unknown) {
      setError(toApiError(e).error || "Failed to build payment schedule.");
      setBuildSummary(null);
    }
  };

  const applyAdjustments = async (payload: PaymentsProjectionsAdjustInput) => {
    setError(null);
    try {
      await adjustMutation.mutateAsync(payload);
      setAdjustOpen(false);
    } catch (e: unknown) {
      const message = toApiError(e).error || "Failed to apply payment/projection adjustments.";
      setError(message);
      throw new Error(message);
    }
  };

  const deletePayments = async (payload: ReqOf<"paymentsDeleteRows">) => {
    setError(null);
    try {
      await deleteRows.mutateAsync(payload);
      setDeleteOpen(false);
      setSelected(null);
      setPaidDialogOpen(false);
    } catch (e: unknown) {
      setError(toApiError(e).error || "Failed to delete payment rows.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Payment Schedule</div>
          <div className="text-xs text-slate-500">Create schedules, post payments, adjust rows, and preview budget impact.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              className={[
                "rounded px-2.5 py-1.5 font-semibold transition",
                viewMode === "legacy" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setViewMode("legacy")}
            >
              Legacy View
            </button>
            <button
              type="button"
              className={[
                "rounded px-2.5 py-1.5 font-semibold transition",
                viewMode === "sheet" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
              ].join(" ")}
              onClick={() => setViewMode("sheet")}
            >
              Sheet View
            </button>
          </div>
          {viewMode === "legacy" ? (
            <>
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  setAdjustInitialEnrollmentId(enrollmentFilterId === "all" ? null : enrollmentFilterId);
                  setAdjustOpen(true);
                }}
                disabled={adjustMutation.isPending || adjustEnrollments.length === 0}
                title={adjustEnrollments.length === 0 ? "Create an enrollment first." : "Adjust payments and projections"}
              >
                {adjustMutation.isPending ? "Applying..." : "Adjust Schedule"}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setBuilderOpen(true)}
                disabled={buildScheduleMutation.isPending || builderEnrollments.length === 0}
                title={builderEnrollments.length === 0 ? "Create an enrollment first." : "Build projected schedule rows"}
              >
                {buildScheduleMutation.isPending ? "Building..." : "Build Schedule"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {continuum?.ok ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="text-xs font-medium uppercase text-slate-500">Assistance received</div><div className="text-xl font-semibold">{continuum.assistanceMonthsReceived} months</div></div>
            <div><div className="text-xs font-medium uppercase text-slate-500">Continuum allocation</div><div className="text-xl font-semibold">{fmtCurrencyUSD(continuum.allocation.effective)}</div></div>
            <div><div className="text-xs font-medium uppercase text-slate-500">Grant cycles</div><div className="text-xl font-semibold">{continuum.enrollments.length}</div></div>
          </div>
          <div className="mt-3 space-y-1 border-t border-sky-200 pt-2 dark:border-sky-900">
            {continuum.enrollments.map((enrollment: any) => (
              <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{enrollment.grantName || enrollment.grantId} · {enrollment.startDate || "?"}–{enrollment.endDate || "open"}</span>
                <span className="flex items-center gap-2">
                  <span>{fmtCurrencyUSD(enrollment.effectiveAllocation)}{enrollment.editableAllocation == null ? " calculated" : " assigned"}</span>
                  <button className="btn-ghost btn-xs" type="button" disabled={allocationSet.isPending} onClick={() => void editAllocation(enrollment)}>Edit</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {buildScheduleMutation.isPending && buildSummary ? (
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Building {buildSummary.rowCount} payment row{buildSummary.rowCount === 1 ? "" : "s"} for {buildSummary.enrollmentLabel}. Budget totals and task schedules will refresh when it completes.
        </div>
      ) : buildSummary ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Built {buildSummary.rowCount} payment row{buildSummary.rowCount === 1 ? "" : "s"} for {buildSummary.enrollmentLabel}. Payment rows, budget projections, and schedule metadata have been refreshed.
        </div>
      ) : null}

      {viewMode === "sheet" ? (
        <PaymentEditorSheetSurface fixedCustomerId={customerId} fixedCustomerName={customerName} embedded />
      ) : (
        <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            <span className="label">Filter by Grant Enrollment</span>
            <select
              className="input min-w-[18rem]"
              value={enrollmentFilterId}
              onChange={(e) => setEnrollmentFilterId(e.currentTarget.value)}
            >
              <option value="all">All funded grant enrollments</option>
              {builderEnrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500">
            Showing {filteredRows.length} payment row{filteredRows.length === 1 ? "" : "s"} from funded grant enrollments
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Projected Total (Paid + Projected)</div>
            <div className="text-lg font-semibold text-slate-900">{fmtCurrencyUSD(totals.total)}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Paid Total</div>
            <div className="text-lg font-semibold text-emerald-700">{fmtCurrencyUSD(totals.paid)}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">Projected (Unpaid) Total</div>
            <div className="text-lg font-semibold text-sky-700">{fmtCurrencyUSD(totals.projectedUnpaid)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <div className="text-xs text-slate-500">Next Unpaid Due</div>
            <div className="text-sm font-semibold text-slate-900">{totals.nextDue ? fmtDateOrDash(totals.nextDue) : "-"}</div>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <div className="text-xs text-slate-500">Due This Month</div>
            <div className="text-sm font-semibold text-slate-900">{totals.dueThisMonth}</div>
          </div>
          <div className={`rounded border px-3 py-2 ${totals.overdue ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
            <div className="text-xs text-slate-500">Overdue Unpaid</div>
            <div className={`text-sm font-semibold ${totals.overdue ? "text-rose-700" : "text-slate-900"}`}>{totals.overdue}</div>
          </div>
        </div>

        <div className="space-y-2">
          {visibleGrantIds.length > 0 ? (
            visibleGrantIds.map((gid) => (
              <GrantBudgetStrip key={gid} grantId={gid} />
            ))
          ) : (
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {budgetStripEmptyState}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {([
            { title: "By Line Item", rows: byLineItem.map((r) => ({ label: r.key, ...r })) },
            { title: "By Enrollment", rows: byEnrollment.map((r) => ({ ...r, label: r.label })) },
            { title: "By Type", rows: byType.map((r) => ({ label: BY_TYPE_LABELS[r.key] ?? r.key, ...r })) },
          ] as const).map((section) => (
            <div key={section.title} className="rounded border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {section.title}
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Key</th>
                      <th className="px-3 py-1.5 text-right">Rows</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                      <th className="px-3 py-1.5 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length ? (
                      section.rows.map((r) => (
                        <tr key={`${section.title}:${r.label}`} className="border-t border-slate-100">
                          <td className={["px-3 py-1.5 text-slate-800", section.title === "By Enrollment" ? "text-sm font-semibold" : ""].join(" ")}>{r.label}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">{r.count}</td>
                          <td className="px-3 py-1.5 text-right text-slate-800">{fmtCurrencyUSD(r.total)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-700">{fmtCurrencyUSD(r.paid)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-slate-500">No rows.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-600">Loading payments...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-sm text-slate-600">No payments found for this customer.</div>
      ) : (
        <>
          {isLedgerError ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="font-semibold">Ledger sync check unavailable</div>
              <div className="text-xs text-amber-800">
                Paid-row drift detection is paused because ledger entries could not be loaded.
              </div>
            </div>
          ) : null}
          {rowIssueCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div>
                <div className="font-semibold">{rowIssueCount} paid row{rowIssueCount === 1 ? "" : "s"} missing ledger actuals</div>
                <div className="text-xs text-amber-800">These rows can show in the schedule but stay out of grant budget actuals until synced.</div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void syncVisibleLedgerSpend()}
                disabled={spend.isPending}
              >
                {spend.isPending ? "Syncing..." : "Sync visible issues"}
              </button>
            </div>
          ) : null}
          <CustomerPaymentsTable
            rows={filteredRows}
            rowIssues={rowIssues}
            rentCertStatuses={rentCertStateByPaymentKey.statuses}
            selectedKey={selected?.paymentKey || null}
          renderSelectedRowDetail={() =>
            selected ? (
              <div>
                <div className="mb-2 text-sm font-medium text-slate-900">Payment Actions</div>
                <div className="mb-3 text-xs text-slate-600">
                  Due {fmtDateOrDash(paymentDate(selected.payment))} | Enrollment {selected.enrollmentId}
                </div>

                {error ? <div className="mb-2 text-sm text-red-700">{error}</div> : null}

                {selectedIssue ? (
                  <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="font-semibold">Paid row is not in ledger.</div>
                    <div className="mt-1 text-xs text-amber-800">
                      This schedule row is marked paid, but grant budget actuals only read ledger entries.
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mt-2"
                      onClick={() => void syncLedgerSpend()}
                      disabled={spend.isPending}
                    >
                      {spend.isPending ? "Syncing..." : "Sync ledger/spend"}
                    </button>
                  </div>
                ) : null}

                <div className="mb-3 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hmisComplete}
                      onChange={(e) => setHmisComplete(e.currentTarget.checked)}
                    />
                    <span>HMIS complete</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={caseworthyComplete}
                      onChange={(e) => setCaseworthyComplete(e.currentTarget.checked)}
                    />
                    <span>Caseworthy complete</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn btn-sm"
                    onClick={() => setPaidDialogOpen(true)}
                  >
                    Mark paid
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void markUnpaid()}
                  >
                    Mark unpaid
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => void saveCompliance()}
                    disabled={compliance.isPending}
                  >
                    {compliance.isPending ? "Saving..." : "Save compliance"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-rose-700"
                    onClick={() => setDeleteOpen(true)}
                    disabled={deleteRows.isPending}
                  >
                    {deleteRows.isPending ? "Deleting..." : "Delete..."}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelected(null);
                      setPaidDialogOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null
          }
          onTogglePaid={togglePaidInline}
          onToggleCompliance={toggleComplianceInline}
          onSetRentCert={setRentCert}
          onManage={selectRow}
          onAdjustSchedule={(row, key) => {
            selectRow(row, key);
            setAdjustInitialEnrollmentId(String(row.enrollmentId || ""));
            setAdjustOpen(true);
          }}
          onDeleteRow={(row, key) => {
            selectRow(row, key);
            setDeleteOpen(true);
          }}
          />
        </>
      )}

      <PaymentPaidDialog
        open={paidDialogOpen}
        amount={Number(selected?.payment?.amount || 0)}
        dueDate={String(selected?.payment?.dueDate || "")}
        grantId={selectedGrantId}
        onCancel={() => setPaidDialogOpen(false)}
        onSave={(meta) => void markPaid(meta)}
      />

      <PaymentsDeleteDialog
        open={deleteOpen}
        busy={deleteRows.isPending}
        grantId={selectedGrantId}
        selected={
          selected
            ? {
                enrollmentId: selected.enrollmentId,
                paymentId: String(selected.payment?.id || ""),
                paid: !!selected.payment?.paid,
                amount: Number(selected.payment?.amount || 0),
                dueDate: String(selected.payment?.dueDate || ""),
              }
            : null
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={(payload) => void deletePayments(payload)}
      />

      <PaymentScheduleBuilderDialog
        open={builderOpen}
        busy={buildScheduleMutation.isPending}
        enrollments={builderEnrollments}
        customerName={customerName}
        onCancel={() => setBuilderOpen(false)}
        onBuild={(payload) => void buildSchedule(payload)}
      />

      <PaymentsProjectionsAdjustDialog
        open={adjustOpen}
        busy={adjustMutation.isPending}
        enrollments={adjustEnrollments}
        initialEnrollmentId={adjustInitialEnrollmentId}
        paymentIssues={rowIssues}
        rentCertDueDates={rentCertStateByPaymentKey.dueDates}
        onCancel={() => setAdjustOpen(false)}
        onApply={applyAdjustments}
      />
        </>
      )}
    </div>
  );
}

export default PaymentsTab;
