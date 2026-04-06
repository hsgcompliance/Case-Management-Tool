import React from "react";
import { useMyInbox, useMyInboxMetrics } from "@hooks/useInbox";
import { getInboxDetailKind, isInboxClosed } from "@hooks/useInboxDetail";
import { useInboxWorkloadList } from "@hooks/useInbox";
import { InboxMetricsBar } from "@entities/metrics/InboxMetricsBar";
import { useMe, useUsers } from "@hooks/useUsers";
import { useLedgerEntries } from "@hooks/useLedger";
import {
  useTaskOtherAssign,
  useTaskOtherUpdate,
  useTasksAssign,
  useTasksDelete,
  useTasksReschedule,
  useTasksUpdateFields,
} from "@hooks/useTasks";
import { usePaymentsSpend, usePaymentsUpdateCompliance } from "@hooks/usePayments";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { metricTone } from "@lib/colorRegistry";
import { hasRole, isAdminLike, normalizeRole } from "@lib/roles";
import { reassignDebugLog } from "@lib/reassignDebug";
import { toast } from "@lib/toast";
import PaymentPaidDialog from "@entities/dialogs/payments/PaymentPaidDialog";
import { FilteringMetricChip } from "@entities/metrics/FilteringMetricChip";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { InboxCompletionBalloon } from "@entities/ui/dashboardStyle/InboxCompletionBalloon";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { useDashboardToolModal } from "@entities/Page/dashboardStyle/hooks/useDashboardToolModal";
import { AnyDashboardToolDefinition, DashboardToolDefinition, DashboardToolId, NavCrumb } from "@entities/Page/dashboardStyle/types";
import QuickBreakModal from "@features/games/QuickBreakModal";
import {
  CustomerFoldersFilterState,
  CustomerFoldersTool,
  CustomerFoldersTopbar,
} from "./customer-folders/CustomerFoldersTool";
import {
  AllEnrollmentsFilterState,
  AllEnrollmentsMain,
  AllEnrollmentsSidebar,
  AllEnrollmentsTopbar,
} from "./enrollments/AllEnrollmentsTool";
import {
  CaseManagerLoadFilterState,
  CaseManagerLoadSelection,
  CaseManagerLoadTool,
  CaseManagerLoadTopbar,
} from "./inbox/CaseManagerLoadTool";
import {
  LineItemSpendingTool,
  SpendingFilterState,
  SpendingTopbar,
} from "./spending/SpendingTool";
import { monthKeyOffsetDays } from "./utils";
import {
  CaseLoadBoardFilterState,
  CaseLoadBoardMain,
  CaseLoadBoardTopbar,
  createCaseLoadBoardFilterState,
} from "@widgets/caseload-board/CaseLoadBoardTool";
import {
  JotformSubmissionManagerFilterState,
  JotformSubmissionManagerTool,
  JotformSubmissionManagerTopbar,
} from "./jotform/JotformSubmissionManagerTool";
import {
  LiveJotformSubmissionsFilterState,
  LiveJotformSubmissionsTool,
  LiveJotformSubmissionsTopbar,
} from "./jotform/LiveJotformSubmissionsTool";
import {
  JotformDashboardFilterState,
  JotformDashboardMain,
  JotformDashboardSelection,
  JotformDashboardSidebar,
  JotformDashboardTopbar,
} from "./jotform/JotformDashboardTool";
import type { TaskReassignTarget } from "@entities/selectors/TaskReassignSelect";
import { InboxDetailCardRouter } from "@entities/detail-card/inboxCards";
import {
  appendInboxReassignNote,
  appendStampedInboxNote,
  formatInboxActionError,
  inboxIdOf,
  parseGenericInboxId,
  parsePaymentRef,
  parseTaskRef,
  readInboxNote,
  sourceKind,
  useInboxTaskRegistry,
} from "@entities/tasks/inboxTaskRegistry";

type GrantBudgetsFilterState = { showInactive: boolean; query: string };
type GrantSelection = { grantId: string } | null;
type GrantLineItem = { id?: string; label?: string; spent?: number; projected?: number };
type GrantBudgetRow = {
  id: string;
  name: string;
  spent: number;
  projected: number;
  remaining: number;
  enrolled: number;
  lineItems: GrantLineItem[];
};
type InboxRow = {
  id?: string;
  utid?: string;
  dueDate?: string;
  title?: string;
  source?: string;
  assignedToGroup?: string;
  status?: string;
};

function useGrantBudgetRows(filterState: GrantBudgetsFilterState) {
  const { grants, enrollments } = useDashboardSharedData();
  return React.useMemo(() => {
    const q = filterState.query.trim().toLowerCase();
    return (grants as Array<Record<string, unknown>>)
      .filter((g) => String(g?.status || "").toLowerCase() !== "deleted" && g?.deleted !== true)
      .filter((g) => (filterState.showInactive ? true : g?.status === "active" || g?.active === true))
      .filter((g) => (q ? String(g?.name || g?.id || "").toLowerCase().includes(q) : true))
      .map<GrantBudgetRow>((g) => {
        const b = g?.budget || {};
        const totals = (b as Record<string, unknown>)?.totals as Record<string, unknown> | undefined;
        const total = Number(b?.total ?? b?.startAmount ?? 0);
        const spent = Number(totals?.spent ?? b?.spent ?? 0);
        const projected = Number(totals?.projected ?? b?.projected ?? 0);
        return {
          id: String(g?.id || ""),
          name: String(g?.name || g?.id || "-"),
          spent,
          projected,
          remaining: total - spent - projected,
          enrolled: (enrollments as Array<Record<string, unknown>>).filter((e) => String(e?.grantId || "") === String(g?.id || "")).length,
          lineItems: Array.isArray((g?.budget as Record<string, unknown>)?.lineItems) ? ((g?.budget as Record<string, unknown>).lineItems as GrantLineItem[]) : [],
        };
      });
  }, [grants, enrollments, filterState.showInactive, filterState.query]);
}

const GrantBudgetsTopbar: DashboardToolDefinition<GrantBudgetsFilterState, GrantSelection>["ToolTopbar"] = ({
  value,
  onChange,
  nav,
}) => {
  const rows = useGrantBudgetRows(value);
  return (
    <div className="flex items-center gap-2">
      <label className="inline-flex items-center gap-1 text-xs">
        <input type="checkbox" checked={value.showInactive} onChange={(e) => onChange({ ...value, showInactive: e.currentTarget.checked })} />
        Show inactive
      </label>
      <input
        className="input w-56"
        placeholder="Filter grants..."
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.currentTarget.value })}
      />
      <button className="btn btn-ghost btn-xs" onClick={nav.reset}>
        Reset Nav
      </button>
      <SmartExportButton
        allRows={rows}
        activeRows={rows}
        filenameBase="grant-budgets"
        columns={[
          { key: "name", label: "Grant", value: (r: GrantBudgetRow) => r.name },
          { key: "enrolled", label: "Enrolled", value: (r: GrantBudgetRow) => r.enrolled },
          { key: "spent", label: "Spent", value: (r: GrantBudgetRow) => r.spent },
          { key: "projected", label: "Projected", value: (r: GrantBudgetRow) => r.projected },
          { key: "remaining", label: "Remaining", value: (r: GrantBudgetRow) => r.remaining },
        ]}
      />
    </div>
  );
};

const GrantBudgetsSidebar: DashboardToolDefinition<GrantBudgetsFilterState, GrantSelection>["Sidebar"] = ({
  filterState,
  selection,
  onSelect,
  nav,
}) => {
  const rows = useGrantBudgetRows(filterState);
  return (
    <div className="p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Grants ({rows.length})</div>
      <button
        className={`w-full text-left text-xs px-2 py-1 rounded border ${!selection ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
        onClick={() => {
          onSelect(null);
          nav.reset();
        }}
      >
        All Grants
      </button>
      <div className="space-y-1 max-h-[60vh] overflow-auto">
        {rows.map((r) => {
          const active = (selection as GrantSelection)?.grantId === r.id;
          return (
            <button
              key={r.id}
              className={`w-full text-left text-xs px-2 py-1 rounded border ${active ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
              onClick={() => {
                const next: GrantSelection = { grantId: r.id };
                onSelect(next);
                nav.push({ key: r.id, label: r.name, selection: next } as NavCrumb<GrantSelection>);
              }}
            >
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-slate-500">Remaining: {fmtCurrencyUSD(r.remaining)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const GrantBudgetsMain: DashboardToolDefinition<GrantBudgetsFilterState, GrantSelection>["Main"] = ({
  filterState,
  selection,
  onSelect,
  nav,
}) => {
  const rows = useGrantBudgetRows(filterState);
  const { sharedDataLoading, sharedDataError } = useDashboardSharedData();
  const pagination = usePagination(rows, 50);
  const selectedRow = rows.find((r) => r.id === (selection as GrantSelection)?.grantId);
  const [detailView, setDetailView] = React.useState<"lineItems" | "audit" | "spending">("lineItems");
  const [spendingLineItemIds, setSpendingLineItemIds] = React.useState<string[]>([]);
  const { data: ledgerEntries = [] } = useLedgerEntries(
    { limit: 5000, sortBy: "createdAt", sortOrder: "desc" },
    { enabled: !!selectedRow }
  );
  const selectedGrantLedgerEntries = React.useMemo(
    () => (ledgerEntries as any[]).filter((e) => String(e?.grantId || "") === String(selectedRow?.id || "")),
    [ledgerEntries, selectedRow?.id]
  );
  const selectedGrantSpendingFiltered = React.useMemo(
    () =>
      selectedGrantLedgerEntries.filter((e) => {
        if (!spendingLineItemIds.length) return true;
        const lineItemId = String(e?.lineItemId || "");
        return spendingLineItemIds.includes(lineItemId);
      }),
    [selectedGrantLedgerEntries, spendingLineItemIds]
  );
  const spendingPager = usePagination(selectedGrantSpendingFiltered, 50);
  const selectedGrantCardCharges = React.useMemo(() => {
    let count = 0;
    let cents = 0;
    for (const e of selectedGrantSpendingFiltered as any[]) {
      if (String(e?.source || "").toLowerCase() !== "card") continue;
      count += 1;
      const c = Number.isFinite(Number(e?.amountCents)) ? Number(e.amountCents) : Math.round(Number(e?.amount || 0) * 100);
      cents += c;
    }
    return { count, amount: cents / 100 };
  }, [selectedGrantSpendingFiltered]);

  React.useEffect(() => {
    setDetailView("lineItems");
    setSpendingLineItemIds([]);
  }, [selectedRow?.id]);

  if (selectedRow) {
    const lineItems = Array.isArray(selectedRow.lineItems) ? selectedRow.lineItems : [];
    const lineItemLabelById = new Map<string, string>(
      lineItems.map((li) => [String(li?.id || ""), String(li?.label || li?.id || "-")])
    );
    const grantLedgerEntries = selectedGrantLedgerEntries;
    const auditRows = lineItems.map((li: GrantLineItem) => {
      const lineItemId = String(li?.id || "");
      let ledgerSpent = 0;
      for (const e of grantLedgerEntries) {
        if (String(e?.lineItemId || "") !== lineItemId) continue;
        const cents = Number.isFinite(Number(e?.amountCents)) ? Number(e.amountCents) : Math.round(Number(e?.amount || 0) * 100);
        ledgerSpent += cents / 100;
      }
      const budgetSpent = Number(li?.spent || 0);
      return {
        lineItemId,
        label: String(li?.label || li?.id || "-"),
        budgetSpent,
        ledgerSpent,
        diff: budgetSpent - ledgerSpent,
      };
    });
    const toggleSpendingLineItem = (lineItemId: string) => {
      if (!lineItemId) return;
      setSpendingLineItemIds((prev) =>
        prev.includes(lineItemId) ? prev.filter((id) => id !== lineItemId) : [...prev, lineItemId]
      );
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{selectedRow.name}</h3>
          <div className="flex items-center gap-2">
            <button
              className={`btn btn-sm ${detailView === "lineItems" ? "" : "btn-ghost"}`}
              onClick={() => setDetailView("lineItems")}
            >
              Line Items
            </button>
            <button
              className={`btn btn-sm ${detailView === "audit" ? "" : "btn-ghost"}`}
              onClick={() => setDetailView("audit")}
            >
              Audit
            </button>
            <button
              className={`btn btn-sm ${detailView === "spending" ? "" : "btn-ghost"}`}
              onClick={() => setDetailView("spending")}
            >
              Spending
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onSelect(null);
                nav.reset();
              }}
            >
              Back to all grants
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card-section border border-slate-200 rounded"><div className="text-xs text-slate-500">Enrolled</div><div className="text-xl font-semibold">{selectedRow.enrolled}</div></div>
          <div className="card-section border border-slate-200 rounded"><div className="text-xs text-slate-500">Spent</div><div className="text-xl font-semibold">{fmtCurrencyUSD(selectedRow.spent)}</div></div>
          <div className="card-section border border-slate-200 rounded"><div className="text-xs text-slate-500">Projected</div><div className="text-xl font-semibold">{fmtCurrencyUSD(selectedRow.projected)}</div></div>
          <div className="card-section border border-slate-200 rounded"><div className="text-xs text-slate-500">Remaining</div><div className="text-xl font-semibold">{fmtCurrencyUSD(selectedRow.remaining)}</div></div>
        </div>
        {detailView === "lineItems" ? (
          <ToolTable
            caption="Selected grant line items"
            headers={["Line Item", "Spent", "Projected"]}
            rows={
              selectedRow.lineItems.length ? (
                selectedRow.lineItems.map((li: GrantLineItem) => (
                  <tr key={String(li?.id || "")}>
                    <td>{String(li?.label || li?.id || "-")}</td>
                    <td className="text-right">{fmtCurrencyUSD(Number(li?.spent || 0))}</td>
                    <td className="text-right">{fmtCurrencyUSD(Number(li?.projected || 0))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No line items.</td>
                </tr>
              )
            }
          />
        ) : null}
        {detailView === "audit" ? (
          <ToolTable
            caption="Grant audit (budget vs ledger)"
            headers={["Line Item", "Budget Spent", "Ledger Net", "Diff"]}
            rows={
              auditRows.length ? (
                auditRows.map((r) => (
                  <tr key={r.lineItemId}>
                    <td>{r.label}</td>
                    <td className="text-right">{fmtCurrencyUSD(r.budgetSpent)}</td>
                    <td className="text-right">{fmtCurrencyUSD(r.ledgerSpent)}</td>
                    <td className="text-right">{fmtCurrencyUSD(r.diff)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No line items found for this grant.</td>
                </tr>
              )
            }
          />
        ) : null}
        {detailView === "spending" ? (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Card charges captured in this grant activity: {selectedGrantCardCharges.count} rows | {fmtCurrencyUSD(selectedGrantCardCharges.amount)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Line item filter:</span>
              <button
                className={`btn btn-xs ${spendingLineItemIds.length === 0 ? "" : "btn-ghost"}`}
                onClick={() => setSpendingLineItemIds([])}
              >
                All
              </button>
              {lineItems.map((li) => {
                const id = String(li?.id || "");
                if (!id) return null;
                const active = spendingLineItemIds.includes(id);
                return (
                  <button
                    key={id}
                    className={`btn btn-xs ${active ? "" : "btn-ghost"}`}
                    onClick={() => toggleSpendingLineItem(id)}
                    title={String(li?.label || id)}
                  >
                    {String(li?.label || id)}
                  </button>
                );
              })}
              <span className="text-xs text-slate-500">
                {spendingLineItemIds.length
                  ? `Showing selected (${spendingLineItemIds.length})`
                  : "Showing all line items"}
              </span>
            </div>
            <ToolTable
              caption="Grant spending (ledger entries)"
              headers={["Date", "Line Item", "Source", "Vendor/Note", "Amount"]}
              rows={
                spendingPager.pageRows.length ? (
                  spendingPager.pageRows.map((r: any) => {
                    const lineItemId = String(r?.lineItemId || "");
                    const amount =
                      Number.isFinite(Number(r?.amount))
                        ? Number(r?.amount)
                        : Number(r?.amountCents || 0) / 100;
                    return (
                      <tr key={String(r?.id || `${String(r?.createdAt || "")}:${lineItemId}`)}>
                        <td>{fmtDateOrDash(r?.date || r?.dueDate || r?.createdAt)}</td>
                        <td>{lineItemLabelById.get(lineItemId) || lineItemId || "-"}</td>
                        <td>{String(r?.source || "-")}</td>
                        <td>{String(r?.vendor || r?.comment || (Array.isArray(r?.note) ? r.note.join(", ") : r?.note || "-"))}</td>
                        <td className="text-right">{fmtCurrencyUSD(amount)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      {grantLedgerEntries.length
                        ? "No spending rows match the selected line-item filter."
                        : "No ledger spending rows found for this grant in the loaded ledger window."}
                    </td>
                  </tr>
                )
              }
            />
            <Pagination page={spendingPager.page} pageCount={spendingPager.pageCount} setPage={spendingPager.setPage} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ToolTable
        caption="Grant budgets"
        headers={["Grant", "Enrolled", "Spent", "Projected", "Remaining"]}
        rows={
          sharedDataLoading ? (
            <tr>
              <td colSpan={5}>Loading grants...</td>
            </tr>
          ) : sharedDataError ? (
            <tr>
              <td colSpan={5}>Failed to load grants.</td>
            </tr>
          ) : pagination.pageRows.length ? (
            pagination.pageRows.map((r: GrantBudgetRow) => (
              <tr
                key={r.id}
                className="cursor-pointer"
                onClick={() => {
                  const next: GrantSelection = { grantId: r.id };
                  onSelect(next);
                  nav.push({ key: r.id, label: r.name, selection: next } as NavCrumb<GrantSelection>);
                }}
              >
                <td>{r.name}</td>
                <td className="text-right">{r.enrolled}</td>
                <td className="text-right">{fmtCurrencyUSD(r.spent)}</td>
                <td className="text-right">{fmtCurrencyUSD(r.projected)}</td>
                <td className="text-right">{fmtCurrencyUSD(r.remaining)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No grants.</td>
            </tr>
          )
        }
      />
      <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
    </div>
  );
};

type InboxToggle = "open" | "completed" | "shared" | "assigned" | "overdue";
type InboxFilterState = {
  month: string;
  toggles: InboxToggle[];
  viewMode: "list" | "detail";
};
type InboxSelection = { inboxId: string } | null;
type InboxDerivedRow = InboxRow & { inboxId: string; customerId: string };
type InboxViewMode = "topbar" | "sidebar" | "main-list" | "main-detail";

function isSharedInboxRow(row: InboxRow): boolean {
  const group = String((row as any)?.assignedToGroup || "").trim();
  const waitingOnUid = String((row as any)?.waitingOnUid || "").trim();
  return !!group || !!waitingOnUid;
}

function normalizeInboxToggles(value: unknown): InboxToggle[] {
  if (!Array.isArray(value)) return [];
  const valid: InboxToggle[] = [];
  for (const entry of value) {
    if (
      entry === "open" ||
      entry === "completed" ||
      entry === "shared" ||
      entry === "assigned" ||
      entry === "overdue"
    ) {
      valid.push(entry);
    }
  }
  return Array.from(new Set(valid));
}

function toDateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function useInboxRows(filterState: InboxFilterState, mode: InboxViewMode = "main-list") {
  const { customerNameById, grantNameById, customers, enrollments } = useDashboardSharedData();
  const usersQ = useUsers({ status: "all", limit: 1000 });
  const { data: me } = useMe();
  const myUid = String((me as any)?.uid || "");
  const month = /^\d{4}-\d{2}$/.test(String(filterState.month || "")) ? String(filterState.month) : monthKeyOffsetDays(5);
  const toggles = normalizeInboxToggles(filterState.toggles);
  const includeOverdue = true;
  const includeGroup = true;
  const staleTimeByMode: Record<InboxViewMode, number> = {
    topbar: 20_000,
    sidebar: 25_000,
    "main-list": 20_000,
    "main-detail": 10_000,
  };
  const inboxQuery = useMyInbox(
    { month, includeOverdue, includeGroup },
    {
      enabled: true,
      staleTime: staleTimeByMode[mode],
      fallbackToCachedMonth: true,
    }
  );
  const inboxItems = inboxQuery.data || [];
  const isLoading = inboxQuery.isLoading || (inboxQuery.isFetching && !inboxQuery.data);
  const hasLoaded = inboxQuery.isFetched;
  const today = toDateOnlyKey(new Date());
  const hasOpen = toggles.includes("open");
  const hasCompleted = toggles.includes("completed");
  const requireShared = toggles.includes("shared");
  const requireAssigned = toggles.includes("assigned");
  const requireOverdue = toggles.includes("overdue");

  const allRows = React.useMemo(() => {
    const base = (inboxItems as InboxRow[]).map((r: any) => {
      const customerId = String((r as any)?.customerId || (r as any)?.clientId || "");
      return {
        ...r,
        status: isInboxClosed((r as any)?.status) ? "done" : "open",
        inboxId: inboxIdOf(r),
        customerId,
      } as InboxDerivedRow;
    });
    return base;
  }, [inboxItems]);

  const rowsWithCustomer = React.useMemo(
    () =>
      {
        const userNameByUid = new Map<string, string>();
        for (const u of usersQ.data || []) {
          const uid = String((u as any)?.uid || "").trim();
          if (!uid) continue;
          userNameByUid.set(uid, String((u as any)?.displayName || (u as any)?.email || uid));
        }
        const enrollmentById = new Map<string, Record<string, unknown>>();
        for (const e of enrollments as Array<Record<string, unknown>>) {
          const id = String(e?.id || "");
          if (!id) continue;
          enrollmentById.set(id, e);
        }
        const customerById = new Map<string, Record<string, unknown>>();
        for (const c of customers as Array<Record<string, unknown>>) {
          const id = String(c?.id || "");
          if (!id) continue;
          customerById.set(id, c);
        }
        return allRows.map((r: any) => {
          const waitingOnUid = String((r as any)?.waitingOnUid || "").trim();
          const enrollmentId = String((r as any)?.enrollmentId || "");
          const enrollment = enrollmentId ? enrollmentById.get(enrollmentId) : null;
          const customerId = String((r as any)?.customerId || (r as any)?.clientId || "");
          const customer = customerId ? customerById.get(customerId) : null;
          const grantId = String((r as any)?.grantId || "");
          const cmUid = String((r as any)?.cmUid || "");
          const assignedToUid = String((r as any)?.assignedToUid || "");
          const fallbackCmUid = cmUid || assignedToUid;
          const caseManagerName =
            String((r as any)?.caseManagerName || "").trim() ||
            (fallbackCmUid ? userNameByUid.get(fallbackCmUid) || fallbackCmUid : "") ||
            String((enrollment as any)?.caseManagerName || "").trim() ||
            String((customer as any)?.caseManagerName || "").trim() ||
            "";
          const grantName =
            String((r as any)?.grantName || "").trim() ||
            (grantId ? grantNameById.get(grantId) || grantId : "") ||
            String((enrollment as any)?.grantName || "").trim() ||
            "";
          const customerName =
            String((r as any)?.customerName || "").trim() ||
            (customerId ? customerNameById.get(customerId) || customerId : "") ||
            String((enrollment as any)?.customerName || (enrollment as any)?.clientName || "").trim() ||
            "-";
          return {
            ...r,
            customerName,
            grantName: grantName || null,
            caseManagerName: caseManagerName || null,
            enrollmentName:
              String((r as any)?.enrollmentName || "").trim() ||
              String((enrollment as any)?.name || "").trim() ||
              null,
            waitingOnName: waitingOnUid ? userNameByUid.get(waitingOnUid) || null : null,
          };
        });
      },
    [allRows, customerNameById, grantNameById, usersQ.data, customers, enrollments]
  );

  const filteredRows = React.useMemo(
    () =>
      rowsWithCustomer.filter((r) => {
        const isClosed = isInboxClosed((r as any)?.status);
        const statusPass =
          hasOpen || hasCompleted
            ? (hasOpen && !isClosed) || (hasCompleted && isClosed)
            : true;
        const sharedPass = requireShared ? isSharedInboxRow(r) : true;
        const assignedPass = requireAssigned
          ? String((r as any)?.assignedToUid || "") === myUid
          : true;
        const overduePass = requireOverdue
          ? !isClosed && !!(r as any)?.dueDate && String((r as any).dueDate) < today
          : true;
        return statusPass && sharedPass && assignedPass && overduePass;
      }),
    [
      rowsWithCustomer,
      hasOpen,
      hasCompleted,
      requireShared,
      requireAssigned,
      requireOverdue,
      myUid,
      today,
    ]
  );

  return { rows: filteredRows, allRows: rowsWithCustomer, isLoading, hasLoaded, month, toggles };
}

const InboxTopbar: DashboardToolDefinition<InboxFilterState, InboxSelection>["ToolTopbar"] = ({
  value,
  onChange,
  nav,
}) => {
  const { rows, allRows, isLoading, month, toggles } = useInboxRows(value, "topbar");
  const { data: me } = useMe();
  const myUid = String((me as any)?.uid || "");
  const today = toDateOnlyKey(new Date());

  // Endpoint-derived metrics (primary source — reconciled, not list-bounded).
  const { data: inboxMetricsData, isLoading: inboxMetricsLoading } = useMyInboxMetrics(month);
  const endpointTotal = (inboxMetricsData as any)?.data?.total;

  // Toggle-card counts are derived from locally-loaded rows (for filter chip counts).
  const metricCounts = React.useMemo(() => {
    const universe = allRows.filter((r: any) => String(r?.status || "") !== "cancelled");
    const open = universe.filter((r: any) => !isInboxClosed(r?.status)).length;
    const completed = universe.filter((r: any) => isInboxClosed(r?.status)).length;
    const shared = universe.filter((r: any) => isSharedInboxRow(r)).length;
    const assigned = universe.filter((r: any) => String((r as any)?.assignedToUid || "") === myUid).length;
    const overdue = universe.filter(
      (r: any) => !isInboxClosed(r?.status) && !!(r as any)?.dueDate && String((r as any).dueDate) < today
    ).length;
    return { open, completed, shared, assigned, overdue, assignedCount: universe.length };
  }, [allRows, myUid, today]);

  // InboxMetricsBar prefers endpoint metrics; falls back to row-derived.
  const metrics = React.useMemo(() => {
    if (endpointTotal) {
      return {
        assignedCount: Number(endpointTotal.assignedCount ?? metricCounts.assignedCount),
        completedCount: Number(endpointTotal.completedCount ?? metricCounts.completed),
        completionPct: Number(endpointTotal.completionPct ?? 0),
        overdueCount: Number(endpointTotal.overdueCount ?? metricCounts.overdue),
      };
    }
    return {
      assignedCount: Number(metricCounts.assignedCount ?? 0),
      completedCount: Number(metricCounts.completed ?? 0),
      completionPct:
        Number(metricCounts.assignedCount ?? 0) > 0
          ? (Number(metricCounts.completed ?? 0) / Number(metricCounts.assignedCount ?? 0)) * 100
          : 0,
      overdueCount: Number(metricCounts.overdue ?? 0),
    };
  }, [endpointTotal, metricCounts]);

  const applyHeaderChange = React.useCallback(
    (next: InboxFilterState) => {
      const keepMode: "list" | "detail" = value.viewMode === "detail" ? "detail" : "list";
      onChange({ ...next, viewMode: keepMode });
      nav.reset();
    },
    [onChange, nav, value.viewMode]
  );

  const toggleFilter = (toggle: InboxToggle) => {
    const isActive = toggles.includes(toggle);
    const nextToggles = isActive
      ? toggles.filter((x) => x !== toggle)
      : [...toggles, toggle];
    applyHeaderChange({ ...value, month, toggles: Array.from(new Set(nextToggles)) });
  };

  const isActive = (toggle: InboxToggle) => toggles.includes(toggle);

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-600">
            Showing <b>{rows.length}</b> item{rows.length === 1 ? "" : "s"} • <b>{month}</b>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                onChange({ ...value, month, toggles, viewMode: "list" });
                nav.reset();
              }}
              disabled={value.viewMode === "list"}
            >
              Back View
            </button>
            <SmartExportButton
              allRows={allRows}
              activeRows={rows}
              filenameBase="task-inbox"
              columns={[
                { key: "due", label: "Due", value: (r: any) => String(r?.dueDate || "") },
                { key: "title", label: "Title", value: (r: any) => String(r?.title || "-") },
                { key: "customer", label: "Customer", value: (r: any) => String(r?.customerName || "-") },
                { key: "source", label: "Source", value: (r: any) => String(r?.source || "-") },
                { key: "status", label: "Status", value: (r: any) => String(r?.status || "-") },
              ]}
            />
          </div>
        </div>

        <InboxMetricsBar metrics={metrics} loading={(isLoading || inboxMetricsLoading) && !allRows.length} />

        <div className="flex flex-wrap items-end gap-2">
          {[
            { key: "open" as InboxToggle, label: "Open", metricId: "inbox-open" as const },
            { key: "completed" as InboxToggle, label: "Completed", metricId: "inbox-completed" as const },
            { key: "shared" as InboxToggle, label: "Shared", metricId: "inbox-shared" as const },
            { key: "assigned" as InboxToggle, label: "Assigned", metricId: "inbox-assigned" as const },
            { key: "overdue" as InboxToggle, label: "Overdue", metricId: "inbox-overdue" as const },
          ].map((item) => (
            <FilteringMetricChip
              key={item.key}
              label={item.label}
              value={isLoading ? null : metricCounts[item.key]}
              loading={isLoading && !allRows.length}
              tone={metricTone(item.metricId)}
              active={isActive(item.key)}
              onClick={() => toggleFilter(item.key)}
              hoverText={true}
            />
          ))}

          <div className="flex items-center">
            <input
              type="month"
              className="input"
              value={month}
              onChange={(e) =>
                applyHeaderChange({
                  ...value,
                  month: e.currentTarget.value || month,
                  toggles,
                })
              }
            />
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              applyHeaderChange({
                month: monthKeyOffsetDays(5),
                toggles: [],
                viewMode: value.viewMode,
              });
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

const InboxSidebar: DashboardToolDefinition<InboxFilterState, InboxSelection>["Sidebar"] = ({
  filterState,
  onFilterChange,
  selection,
  onSelect,
  nav,
}) => {
  // Sidebar ignores toggle-filters — it always shows all items for the month so the
  // user can navigate to any task regardless of what the main-panel filter is set to.
  const { allRows, isLoading, hasLoaded } = useInboxRows(filterState, "sidebar");
  const selectedId = (selection as InboxSelection)?.inboxId || "";
  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-700">
        Tasks ({isLoading ? "..." : allRows.length})
      </div>
      <div className="space-y-1 max-h-[56vh] overflow-auto">
        {isLoading ? <div className="text-xs text-slate-500 p-2">Loading inbox...</div> : null}
        {!isLoading && hasLoaded && !allRows.length ? <div className="text-xs text-slate-500 p-2">No inbox items.</div> : null}
        {allRows.map((r: any) => {
          const active = selectedId === r.inboxId;
          const closed = isInboxClosed(String(r?.status || ""));
          return (
            <button
              key={r.inboxId}
              className={`w-full text-left rounded border px-2 py-2 ${
                active ? "border-slate-400 bg-slate-100" : "border-slate-200 hover:bg-slate-50"
              } ${closed ? "opacity-70" : ""}`}
              onClick={() => {
                const next: InboxSelection = { inboxId: r.inboxId };
                onFilterChange({ ...filterState, viewMode: "detail" });
                onSelect(next);
                nav.setStack([{ key: r.inboxId, label: String(r.title || "Task"), selection: next } as NavCrumb<InboxSelection>]);
              }}
            >
              <div className="text-xs font-medium truncate">{String(r.title || "-")}</div>
              <div className="text-[11px] text-slate-600 truncate">{String(r.customerName || "-")}</div>
              <div className="text-[11px] text-slate-500 truncate">
                {String(r.caseManagerName || "CM unassigned")}
                {String(r.grantName || "").trim() ? ` • ${String(r.grantName)}` : ""}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{fmtDateOrDash(r.dueDate)}</span>
                <span className={`capitalize ${closed ? "text-slate-400" : "text-slate-700 font-medium"}`}>
                  {String(r.status || "open")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const InboxMain: DashboardToolDefinition<InboxFilterState, InboxSelection>["Main"] = ({
  filterState,
  onFilterChange,
  selection,
  onSelect,
  nav,
}) => {
  const { rows, allRows, isLoading, hasLoaded, month } = useInboxRows(
    filterState,
    filterState.viewMode === "detail" ? "main-detail" : "main-list"
  );
  const { data: me } = useMe();
  const { openTaskReassign } = useDashboardToolModal();
  const myUid = String((me as any)?.uid || "");
  const allOpenCount = React.useMemo(
    () =>
      allRows.filter(
        (r: any) => String((r as any)?.status || "") !== "cancelled" && !isInboxClosed((r as any)?.status)
      ).length,
    [allRows]
  );
  const taskRegistry = useInboxTaskRegistry();
  const rescheduleTask = useTasksReschedule();
  const deleteTask = useTasksDelete();
  const updateFields = useTasksUpdateFields();
  const reassignTask = useTasksAssign();
  const reassignOther = useTaskOtherAssign();
  const updateOther = useTaskOtherUpdate();
  const spendPayment = usePaymentsSpend();
  const updatePaymentCompliance = usePaymentsUpdateCompliance();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentDialogRow, setPaymentDialogRow] = React.useState<any | null>(null);
  const [showCompletionBalloon, setShowCompletionBalloon] = React.useState(false);
  const [quickBreakOpen, setQuickBreakOpen] = React.useState(false);
  const prevOpenCountRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    prevOpenCountRef.current = null;
    setShowCompletionBalloon(false);
  }, [month, myUid]);

  React.useEffect(() => {
    if (!hasLoaded) return;
    const prev = prevOpenCountRef.current;
    if (prev !== null && prev > 0 && allOpenCount === 0) {
      setShowCompletionBalloon(true);
    }
    if (allOpenCount > 0) {
      setShowCompletionBalloon(false);
    }
    prevOpenCountRef.current = allOpenCount;
  }, [allOpenCount, hasLoaded]);

  const celebrationLayer = (
    <>
      <InboxCompletionBalloon
        visible={showCompletionBalloon}
        onDismiss={() => setShowCompletionBalloon(false)}
        onClick={() => {
          setShowCompletionBalloon(false);
          setQuickBreakOpen(true);
        }}
      />
      <QuickBreakModal open={quickBreakOpen} onClose={() => setQuickBreakOpen(false)} />
    </>
  );

  const selectedRow = React.useMemo(() => {
    const id = (selection as InboxSelection)?.inboxId || "";
    return rows.find((r: any) => r.inboxId === id) || null;
  }, [rows, selection]);

  React.useEffect(() => {
    const visible = new Set(rows.map((r: any) => String(r.inboxId || "")));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      if (next.size !== prev.size) return next;
      for (const id of next) {
        if (!prev.has(id)) return next;
      }
      return prev;
    });
  }, [rows]);

  const selectedRows = React.useMemo(
    () => rows.filter((r: any) => selectedIds.has(String(r.inboxId || ""))),
    [rows, selectedIds]
  );

  const actionableRows = React.useMemo(
    () => selectedRows.filter((r: any) => sourceKind(r) !== "unsupported"),
    [selectedRows]
  );
  const statusActionableRows = React.useMemo(
    () =>
      actionableRows.filter((r: any) => {
        const actions = taskRegistry.resolve(r);
        return actions.canComplete || actions.canReopen;
      }),
    [actionableRows, taskRegistry]
  );

  const setRowSelected = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setAllSelected = (on: boolean) => {
    if (!on) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r: any) => String(r.inboxId || ""))));
  };

  const onCompleteOrReopen = async (row: any, action: "complete" | "reopen") => {
    try {
      const actions = taskRegistry.resolve(row);
      const fn = action === "complete" ? actions.complete : actions.reopen;
      if (!fn) {
        toast(actions.blockedStatusReason || "This item must be resolved through its source workflow.", { type: "error" });
        return;
      }
      await fn();
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to update task status."), { type: "error" });
    }
  };

  const onVerifyTask = async (row: any) => {
    try {
      const actions = taskRegistry.resolve(row);
      if (!actions.verify) {
        toast("Verify is only available for enrollment task items.", { type: "error" });
        return;
      }
      await actions.verify();
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to verify task."), { type: "error" });
    }
  };

  const onBulkCompleteOrReopen = async (action: "complete" | "reopen") => {
    try {
      const scope = statusActionableRows;
      if (!scope.length) {
        toast("No status-updatable tasks selected.", { type: "error" });
        return;
      }
      for (const row of scope) {
        await onCompleteOrReopen(row, action);
      }
      setSelectedIds(new Set());
    } catch (e: any) {
      toast(formatInboxActionError(e, "Bulk status update failed."), { type: "error" });
    }
  };

  const onReassignTo = async (row: any, target: TaskReassignTarget, note: string) => {
    try {
      reassignDebugLog("InboxMain", "onReassignTo:start", {
        inboxId: String(row?.inboxId || row?.utid || row?.id || ""),
        source: String(row?.source || ""),
        assignedToUid: String(row?.assignedToUid || ""),
        target,
        noteLength: String(note || "").trim().length,
      });
      const existingNote = readInboxNote(row);
      const mergedNote = appendInboxReassignNote(existingNote, note);
      const taskRef = parseTaskRef(row);
      if (taskRef) {
        if (target.kind === "compliance" || target.kind === "admin") {
          await reassignTask.mutateAsync({
            enrollmentId: taskRef.enrollmentId,
            taskId: taskRef.taskId,
            assign: { group: target.kind, uid: null },
          });
          reassignDebugLog("InboxMain", "task:assigned-group", { taskRef, targetGroup: target.kind });
        } else {
          const uid = String(target.cmUid || "").trim();
          if (!uid) return;
          await reassignTask.mutateAsync({
            enrollmentId: taskRef.enrollmentId,
            taskId: taskRef.taskId,
            assign: { group: null, uid },
          });
          reassignDebugLog("InboxMain", "task:assigned-cm", { taskRef, targetUid: uid });
        }
        if (mergedNote !== existingNote) {
          await updateFields.mutateAsync({
            enrollmentId: taskRef.enrollmentId,
            taskId: taskRef.taskId,
            patch: { notes: mergedNote },
          } as any);
          reassignDebugLog("InboxMain", "task:note-updated", { taskRef, noteLength: mergedNote.length });
        }
        return;
      }

      const otherId = parseGenericInboxId(row);
      if (otherId) {
        if (target.kind === "compliance" || target.kind === "admin") {
          await reassignOther.mutateAsync({
            id: otherId,
            assign: { group: target.kind, uids: null },
          });
          reassignDebugLog("InboxMain", "other:assigned-group", { otherId, targetGroup: target.kind });
        } else {
          const uid = String(target.cmUid || "").trim();
          if (!uid) return;
          await reassignOther.mutateAsync({
            id: otherId,
            assign: { group: null, uids: [uid] },
          });
          reassignDebugLog("InboxMain", "other:assigned-cm", { otherId, targetUid: uid });
        }
        if (mergedNote !== existingNote) {
          await updateOther.mutateAsync({ id: otherId, patch: { notes: mergedNote } } as any);
          reassignDebugLog("InboxMain", "other:note-updated", { otherId, noteLength: mergedNote.length });
        }
        return;
      }

      toast("Could not resolve reassign route for this item.", { type: "error" });
      reassignDebugLog("InboxMain", "onReassignTo:unsupported", {
        inboxId: String(row?.inboxId || row?.utid || row?.id || ""),
        source: String(row?.source || ""),
      });
    } catch (e: any) {
      reassignDebugLog("InboxMain", "onReassignTo:error", {
        inboxId: String(row?.inboxId || row?.utid || row?.id || ""),
        target,
        error: formatInboxActionError(e, "Failed to reassign task."),
        raw: e,
      });
      toast(formatInboxActionError(e, "Failed to reassign task."), { type: "error" });
    }
  };

  const onApplyReassign = async (payload: { target: TaskReassignTarget; note: string }) => {
    const scope = selectedRows.length ? actionableRows : selectedRow ? [selectedRow] : [];
    if (!scope.length) {
      toast("No reassignable tasks selected.", { type: "error" });
      return;
    }

    const target =
      payload.target.kind === "cm" && !payload.target.cmUid && myUid
        ? ({ kind: "cm", cmUid: myUid } as TaskReassignTarget)
        : payload.target;

    for (const row of scope) {
      await onReassignTo(row, target, payload.note);
    }
    setSelectedIds(new Set());
  };

  const onAddNote = async (row: any) => {
    const next = window.prompt("Add note");
    if (next == null) return;
    const existing = readInboxNote(row);
    const merged = appendStampedInboxNote(existing, next, "note");
    if (merged === existing) return;
    try {
      const taskRef = parseTaskRef(row);
      if (taskRef) {
        await updateFields.mutateAsync({
          enrollmentId: taskRef.enrollmentId,
          taskId: taskRef.taskId,
          patch: { notes: merged },
        } as any);
        return;
      }
      const genericId = parseGenericInboxId(row);
      if (!genericId) {
        toast("Could not resolve note route for this item.", { type: "error" });
        return;
      }
      await updateOther.mutateAsync({ id: genericId, patch: { notes: merged } } as any);
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to update notes."), { type: "error" });
    }
  };

  const onReschedule = async (row: any) => {
    const currentDue = String((row as any)?.dueDate || "");
    const nextDue = String(window.prompt("New due date (YYYY-MM-DD)", currentDue) || "").trim();
    if (!nextDue) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
      toast("Due date must be YYYY-MM-DD.", { type: "error" });
      return;
    }
    try {
      const taskRef = parseTaskRef(row);
      if (taskRef) {
        await rescheduleTask.mutateAsync({
          enrollmentId: taskRef.enrollmentId,
          taskId: taskRef.taskId,
          newDueDate: nextDue,
        } as any);
        return;
      }
      const genericId = parseGenericInboxId(row);
      if (!genericId) {
        toast("Could not resolve reschedule route for this item.", { type: "error" });
        return;
      }
      await updateOther.mutateAsync({ id: genericId, patch: { dueDate: nextDue } } as any);
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to reschedule task."), { type: "error" });
    }
  };

  const onDeleteTask = async (row: any) => {
    const taskRef = parseTaskRef(row);
    if (!taskRef) {
      toast("Delete is only available for enrollment task items.", { type: "error" });
      return;
    }
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    try {
      await deleteTask.mutateAsync({
        enrollmentId: taskRef.enrollmentId,
        taskId: taskRef.taskId,
      });
      onSelect(null);
      nav.reset();
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to delete task."), { type: "error" });
    }
  };

  const onApproveUser = async (row: any) => {
    try {
      const actions = taskRegistry.resolve(row);
      if (!actions.approveUser) {
        toast("Approve is not available for this item.", { type: "error" });
        return;
      }
      await actions.approveUser();
      toast("User approved.", { type: "success" });
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to approve user."), { type: "error" });
    }
  };

  const onOpenPaymentDialog = (row: any) => {
    const paymentRef = parsePaymentRef(row);
    if (!paymentRef) {
      toast("Payment reference not available for this item.", { type: "error" });
      return;
    }
    setPaymentDialogRow(row);
    setPaymentDialogOpen(true);
  };

  const onSavePaymentComplete = async (meta: { note?: string; vendor?: string; comment?: string }) => {
    if (!paymentDialogRow) return;
    const paymentRef = parsePaymentRef(paymentDialogRow);
    if (!paymentRef) {
      toast("Payment reference not available.", { type: "error" });
      return;
    }
    try {
      await spendPayment.mutateAsync({
        body: {
          enrollmentId: paymentRef.enrollmentId,
          paymentId: paymentRef.paymentId,
          reverse: false,
          ...(meta.note ? { note: meta.note } : {}),
          ...(meta.vendor ? { vendor: meta.vendor } : {}),
          ...(meta.comment ? { comment: meta.comment } : {}),
        },
      });
      if (paymentRef.source === "paymentcompliance") {
        await updatePaymentCompliance.mutateAsync({
          enrollmentId: paymentRef.enrollmentId,
          paymentId: paymentRef.paymentId,
          patch: { status: "approved" },
        });
      }
      setPaymentDialogOpen(false);
      setPaymentDialogRow(null);
      toast("Payment marked complete.", { type: "success" });
    } catch (e: any) {
      toast(formatInboxActionError(e, "Failed to complete payment."), { type: "error" });
    }
  };

  if (filterState.viewMode === "detail" && selectedRow) {
    const selectedActions = taskRegistry.resolve(selectedRow as any);
    const status = String(selectedRow.status || "open");
    const isClosed = isInboxClosed(status);
    const kind = getInboxDetailKind(selectedRow as any);
    const canMutate = sourceKind(selectedRow) !== "unsupported" || !!parsePaymentRef(selectedRow);
    const canComplete = !!selectedActions.complete && !isClosed;
    const canReopen = !!selectedActions.reopen && isClosed;
    const canVerify = !!selectedActions.verify;
    const canReschedule = !parsePaymentRef(selectedRow);
    const canDeleteTask = !!parseTaskRef(selectedRow);
    const canApproveUser = !!selectedActions.approveUser;
    const canPaymentComplete = !!parsePaymentRef(selectedRow);
    const isVerified =
      (selectedRow as any)?.verified === true ||
      String((selectedRow as any)?.rawTaskStatus || "").toLowerCase() === "verified";
    const anyPending =
      taskRegistry.pending.updateStatus ||
      taskRegistry.pending.otherStatus ||
      spendPayment.isPending ||
      updatePaymentCompliance.isPending ||
      taskRegistry.pending.patchEnrollment ||
      taskRegistry.pending.setCustomerCaseManager ||
      taskRegistry.pending.setUserActive;

    // Payment and compliance tasks use their own completion mechanism — no generic "Complete" button
    const isPaymentKind = kind === "payment" || kind === "complianceTask" || kind === "grantCompliance";

    const detailActions = canMutate ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Primary actions — only show what's contextually relevant */}
        {!isClosed && !isPaymentKind && canComplete && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => void onCompleteOrReopen(selectedRow, "complete")}
            disabled={anyPending}
          >
            ✓ Complete
          </button>
        )}
        {canPaymentComplete ? (
          <button
            className="btn btn-sm btn-success"
            onClick={() => onOpenPaymentDialog(selectedRow)}
            disabled={spendPayment.isPending || updatePaymentCompliance.isPending}
          >
            Mark Paid
          </button>
        ) : null}
        {canApproveUser ? (
          <button
            className="btn btn-sm btn-success"
            onClick={() => void onApproveUser(selectedRow)}
            disabled={taskRegistry.pending.setUserActive || taskRegistry.pending.otherStatus}
          >
            Approve User
          </button>
        ) : null}

        {/* Secondary actions */}
        {canReopen ? (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void onCompleteOrReopen(selectedRow, "reopen")}
            disabled={anyPending}
          >
            Reopen
          </button>
        ) : null}
        <button
          className="btn btn-sm btn-ghost"
          onClick={() =>
            openTaskReassign({ title: "Reassign Task", onSubmit: onApplyReassign })
          }
          disabled={reassignTask.isPending || reassignOther.isPending}
        >
          Reassign
        </button>
        {canReschedule ? (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void onReschedule(selectedRow)}
            disabled={rescheduleTask.isPending || updateOther.isPending}
          >
            Reschedule
          </button>
        ) : null}
        {canVerify && !isVerified ? (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void onVerifyTask(selectedRow)}
            disabled={taskRegistry.pending.updateStatus}
          >
            Verify
          </button>
        ) : isVerified ? (
          <span className="text-xs font-medium text-emerald-600 px-1">✓ Verified</span>
        ) : null}

        {/* Destructive */}
        {canDeleteTask ? (
          <button
            className="btn btn-sm btn-ghost text-rose-600 hover:text-rose-700"
            onClick={() => void onDeleteTask(selectedRow)}
            disabled={deleteTask.isPending}
          >
            Delete
          </button>
        ) : null}
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Managed by workflow</span>
      </div>
    );

  const onAssignCMDirect = async (uid: string | null) => {
    if (!uid || !selectedRow) return;
    try {
      const actions = taskRegistry.resolve(selectedRow);
      if (actions.assignCaseManager) {
        await actions.assignCaseManager(uid);
        return;
      }
      await onReassignTo(selectedRow, { kind: "cm", cmUid: uid }, "");
    } catch (e: any) {
      toast(formatInboxActionError(e, "Assignment failed."), { type: "error" });
    }
  };

    const onSaveNoteInline = async (text: string) => {
      const row = selectedRow;
      if (!row || !text.trim()) return;
      try {
        const actions = taskRegistry.resolve(row);
        if (!actions.saveNote) return;
        const existing = readInboxNote(row);
        const merged = appendStampedInboxNote(existing, text.trim(), "note");
        if (merged === existing) return;
        await actions.saveNote(merged);
      } catch (e: any) {
        toast(formatInboxActionError(e, "Failed to save note."), { type: "error" });
      }
    };

    const onUpdateComplianceInline = async (patch: { hmisComplete?: boolean; caseworthyComplete?: boolean }) => {
      try {
        const actions = taskRegistry.resolve(selectedRow);
        if (!actions.updateCompliance) return;
        await actions.updateCompliance(patch);
      } catch (e: any) {
        toast(formatInboxActionError(e, "Failed to update compliance."), { type: "error" });
      }
    };

    const onMarkPaidInline = async (paid: boolean) => {
      try {
        const actions = taskRegistry.resolve(selectedRow);
        if (!actions.markPaid) return;
        await actions.markPaid(paid);
      } catch (e: any) {
        toast(formatInboxActionError(e, "Failed to update paid state."), { type: "error" });
      }
    };

    const onAutoCloseInline = () => {
      void onCompleteOrReopen(selectedRow, "complete");
    };

    return (
      <div className="relative space-y-3">
        {celebrationLayer}
        <InboxDetailCardRouter
          item={selectedRow as any}
          actions={detailActions}
          extras={{
            onAssignCM: onAssignCMDirect,
            onSaveNote: onSaveNoteInline,
            onUpdateCompliance: onUpdateComplianceInline,
            onMarkPaid: onMarkPaidInline,
            onAutoClose: onAutoCloseInline,
          }}
        />
        <PaymentPaidDialog
          open={paymentDialogOpen}
          amount={Number((paymentDialogRow as any)?.amount || 0)}
          dueDate={String((paymentDialogRow as any)?.dueDate || "")}
          onCancel={() => {
            setPaymentDialogOpen(false);
            setPaymentDialogRow(null);
          }}
          onSave={(meta) => void onSavePaymentComplete(meta)}
        />
      </div>
    );
  }

  if (filterState.viewMode === "detail" && !selectedRow) {
    return (
      <div className="relative">
        {celebrationLayer}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <div className="text-sm font-medium text-slate-700">None selected</div>
          <div className="mt-1 text-xs text-slate-500">
            Pick a task from the sidebar or switch back to list view.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      {celebrationLayer}
      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2">
        <span className="text-xs text-slate-600">Selected: {selectedRows.length}</span>
        <span className="text-xs text-slate-500">Actionable: {actionableRows.length}</span>
        <button
          className="btn btn-xs"
          disabled={!statusActionableRows.length || taskRegistry.pending.updateStatus || taskRegistry.pending.otherStatus}
          onClick={() => void onBulkCompleteOrReopen("complete")}
        >
          Mark Closed
        </button>
        <button
          className="btn btn-xs btn-ghost"
          disabled={!statusActionableRows.length || taskRegistry.pending.updateStatus || taskRegistry.pending.otherStatus}
          onClick={() => void onBulkCompleteOrReopen("reopen")}
        >
          Mark Open
        </button>
        <button
          className="btn btn-xs btn-ghost"
          disabled={!actionableRows.length || reassignTask.isPending || reassignOther.isPending}
          onClick={() =>
            openTaskReassign({
              title: `Reassign ${actionableRows.length} Selected Tasks`,
              onSubmit: onApplyReassign,
            })
          }
        >
          Reassign Selected
        </button>
      </div>
      <ToolTable
        caption="Task inbox"
        headers={["", "Due", "Title", "Customer", "Source", "Status", "Actions"]}
        rows={
          isLoading ? (
            <tr>
              <td colSpan={7}>Loading inbox...</td>
            </tr>
          ) : rows.length ? (
            rows.map((r: any) => {
              const rowActions = taskRegistry.resolve(r);
              const id = String(r.inboxId || "");
              const checked = selectedIds.has(id);
              const closed = isInboxClosed(String(r?.status || ""));
              const canMutate = sourceKind(r) !== "unsupported";
              const canToggleStatus = closed ? !!rowActions.reopen : !!rowActions.complete;
              const canVerify = !!rowActions.verify;
              const isVerified =
                (r as any)?.verified === true ||
                String((r as any)?.rawTaskStatus || "").toLowerCase() === "verified";
              return (
                <tr
                  key={id}
                  className="cursor-pointer"
              onClick={() => {
                const next: InboxSelection = { inboxId: r.inboxId };
                onFilterChange?.({ ...filterState, viewMode: "detail" });
                onSelect(next);
                nav.setStack([{ key: r.inboxId, label: String(r.title || "Task"), selection: next } as NavCrumb<InboxSelection>]);
              }}
            >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setRowSelected(id, e.currentTarget.checked)}
                      aria-label={`Select ${String(r?.title || "task")}`}
                    />
                  </td>
                  <td>{fmtDateOrDash(r?.dueDate)}</td>
                  <td>{String(r?.title || "-")}</td>
                  <td>{String(r?.customerName || "-")}</td>
                  <td>{String(r?.source || "-")}</td>
                  <td className={`capitalize ${closed ? "text-slate-400" : "text-slate-700 font-medium"}`}>
                    {closed ? "closed" : "open"}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!canToggleStatus}
                        onClick={() => void onCompleteOrReopen(r, closed ? "reopen" : "complete")}
                      >
                        {closed ? "Mark Open" : "Mark Closed"}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!canVerify || isVerified}
                        onClick={() => void onVerifyTask(r)}
                      >
                        {isVerified ? "Verified" : "Verify"}
                      </button>
                      <button className="btn btn-ghost btn-xs" disabled={!canMutate} onClick={() => {
                        setSelectedIds(new Set());
                        onFilterChange?.({ ...filterState, viewMode: "detail" });
                        onSelect({ inboxId: r.inboxId });
                        openTaskReassign({
                          title: "Reassign Task",
                          onSubmit: onApplyReassign,
                        });
                      }}>
                        Reassign
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7}>{hasLoaded ? "No inbox items." : "Loading inbox..."}</td>
            </tr>
          )
        }
      />
      {!!rows.length && (
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedIds.size === rows.length}
            onChange={(e) => setAllSelected(e.currentTarget.checked)}
          />
          Select all visible
        </label>
      )}
    </div>
  );
};

const CaseManagerLoadMain: DashboardToolDefinition<CaseManagerLoadFilterState, CaseManagerLoadSelection>["Main"] = ({
  filterState,
  onFilterChange,
  selection,
  onSelect,
  nav,
}) => (
  <CaseManagerLoadTool
    mode="dashboard"
    month={filterState.month}
    onMonthChange={(nextMonth) => onFilterChange?.({ ...filterState, month: nextMonth })}
    showLegacyCols={filterState.showLegacyCols}
    onShowLegacyColsChange={(nextShow) => onFilterChange?.({ ...filterState, showLegacyCols: nextShow })}
    selection={selection as CaseManagerLoadSelection}
    onSelectionChange={(next, row) => {
      onSelect(next);
      if (next) {
        nav.setStack([
          {
            key: next.caseManagerId,
            label: row?.caseManagerName || next.caseManagerId,
            selection: next,
          } as NavCrumb<CaseManagerLoadSelection>,
        ]);
      } else {
        nav.reset();
      }
    }}
  />
);

const CaseManagerLoadSidebar: DashboardToolDefinition<CaseManagerLoadFilterState, CaseManagerLoadSelection>["Sidebar"] = ({
  filterState,
  selection,
  onSelect,
  nav,
}) => {
  const { data: me } = useMe();
  const usersQ = useUsers({ status: "all", limit: 1000 });
  const { customers, enrollmentsByCustomer } = useDashboardSharedData();
  const canOverseeLoads =
    isAdminLike(me as { topRole?: unknown; role?: unknown } | null) ||
    hasRole((me as any)?.roles, "compliance") ||
    hasRole((me as any)?.roles, "supervisor") ||
    normalizeRole((me as any)?.topRole || (me as any)?.role) === "supervisor";
  const myUid = String((me as any)?.uid || "");
  const workloadQ = useInboxWorkloadList(
    {
      month: filterState.month,
      ...(canOverseeLoads ? {} : myUid ? { assigneeUid: myUid } : {}),
      includeUnassigned: true,
      limit: 5000,
    },
    { enabled: !!filterState.month && (canOverseeLoads || !!myUid), staleTime: 20_000 }
  );

  const userNameByUid = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersQ.data || []) {
      const uid = String(u.uid || "");
      if (!uid) continue;
      const name = String(u.displayName || u.email || uid).trim() || uid;
      m.set(uid, name);
    }
    return m;
  }, [usersQ.data]);

  const baseLoadByUid = React.useMemo(() => {
    const m = new Map<string, { customers: number; enrollments: number }>();
    for (const c of customers as Array<Record<string, unknown>>) {
      const uid = String(c.caseManagerId || "").trim();
      if (!uid) continue;
      const cur = m.get(uid) || { customers: 0, enrollments: 0 };
      cur.customers += 1;
      cur.enrollments += enrollmentsByCustomer.get(String(c.id || "")) || 0;
      m.set(uid, cur);
    }
    return m;
  }, [customers, enrollmentsByCustomer]);

  const rows = React.useMemo(() => {
    const ownerKey = (r: any) => {
      const uid = String((r as any)?.assignedToUid || "").trim();
      if (uid) return uid;
      const group = String((r as any)?.assignedToGroup || "").trim().toLowerCase();
      if (group) return `queue:${group}`;
      return "queue:unassigned";
    };
    const ownerName = (key: string) => {
      if (!key.startsWith("queue:")) return userNameByUid.get(key) || key;
      const queue = key.slice("queue:".length);
      if (queue === "compliance") return "Compliance Queue";
      if (queue === "admin") return "Admin Queue";
      if (queue === "casemanager") return "Case Manager Queue";
      if (!queue || queue === "unassigned") return "Unassigned Queue";
      return `${queue.charAt(0).toUpperCase()}${queue.slice(1)} Queue`;
    };

    const byUid = new Map<string, { open: number; done: number; total: number }>();
    for (const r of workloadQ.data || []) {
      const key = ownerKey(r as any);
      const cur = byUid.get(key) || { open: 0, done: 0, total: 0 };
      const closed = isInboxClosed((r as any)?.status);
      if (closed) cur.done += 1;
      else cur.open += 1;
      cur.total += 1;
      byUid.set(key, cur);
    }

    const uids = new Set<string>([...Array.from(userNameByUid.keys()), ...Array.from(baseLoadByUid.keys()), ...Array.from(byUid.keys())]);
    const out = Array.from(uids).map((uid) => {
      const stats = byUid.get(uid) || { open: 0, done: 0, total: 0 };
      const base = baseLoadByUid.get(uid) || { customers: 0, enrollments: 0 };
      return {
        uid,
        name: ownerName(uid),
        ...stats,
        ...base,
      };
    });
    out.sort((a, b) => (b.open - a.open) || a.name.localeCompare(b.name));
    return out;
  }, [workloadQ.data, userNameByUid, baseLoadByUid]);

  const selectedUid = String((selection as CaseManagerLoadSelection)?.caseManagerId || "");

  return (
    <div className="p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Case Loads ({rows.length})</div>
      <button
        className={`w-full text-left text-xs px-2 py-1 rounded border ${!selectedUid ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
        onClick={() => {
          onSelect(null);
          nav.reset();
        }}
      >
        All Loads
      </button>
      <div className="space-y-1 max-h-[60vh] overflow-auto">
        {rows.map((r) => {
          const active = selectedUid === r.uid;
          return (
            <button
              key={r.uid}
              className={`w-full text-left text-xs px-2 py-1 rounded border ${active ? "bg-slate-100 border-slate-300" : "border-slate-200"}`}
              onClick={() => {
                const next: CaseManagerLoadSelection = { caseManagerId: r.uid };
                onSelect(next);
                nav.setStack([{ key: r.uid, label: r.name, selection: next } as NavCrumb<CaseManagerLoadSelection>]);
              }}
            >
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-slate-500">Open: {r.open} · Total: {r.total}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SpendingMain: DashboardToolDefinition<SpendingFilterState, null>["Main"] = ({
  filterState,
  onFilterChange,
}) => (
  <LineItemSpendingTool
    filterState={filterState as SpendingFilterState}
    onFilterChange={(next) => onFilterChange?.(next)}
  />
);

const CustomerFoldersMain: DashboardToolDefinition<CustomerFoldersFilterState, null>["Main"] = ({
  filterState,
  onFilterChange,
}) => (
  <CustomerFoldersTool
    filterState={filterState as CustomerFoldersFilterState}
    onFilterChange={(next) => onFilterChange?.(next)}
  />
);

const LiveJotformSubmissionsMain: DashboardToolDefinition<LiveJotformSubmissionsFilterState, null>["Main"] = ({
  filterState,
  onFilterChange,
}) => (
  <LiveJotformSubmissionsTool
    filterState={filterState as LiveJotformSubmissionsFilterState}
    onFilterChange={(next) => onFilterChange?.(next)}
  />
);

const JotformSubmissionManagerMain: DashboardToolDefinition<JotformSubmissionManagerFilterState, null>["Main"] = ({
  filterState,
  onFilterChange,
}) => (
  <JotformSubmissionManagerTool
    filterState={filterState as JotformSubmissionManagerFilterState}
    onFilterChange={(next) => onFilterChange?.(next)}
  />
);

export const dashboardToolPath = (toolId: DashboardToolId) => `/reports/${toolId}`;

export const DASHBOARD_TOOL_DEFS: readonly AnyDashboardToolDefinition[] = [
  {
    id: "inbox",
    title: "Inbox",
    hidden: true,
    defaultPinned: true,
    createFilterState: () =>
      ({ month: monthKeyOffsetDays(5), toggles: [], viewMode: "list" } satisfies InboxFilterState),
    ToolTopbar: InboxTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: InboxSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: InboxMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "grant-budgets",
    title: "Budgets",
    defaultPinned: true,
    createFilterState: () => ({ showInactive: false, query: "" } satisfies GrantBudgetsFilterState),
    ToolTopbar: GrantBudgetsTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: GrantBudgetsSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: GrantBudgetsMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "spending",
    title: "Spending",
    hidden: true,
    createFilterState: () =>
      ({
        month: monthKeyOffsetDays(5),
        typeFilter: "",
        workflowFilter: "",
        cardFilterId: "",
        grantId: "",
        cardBucketFilter: "",
        search: "",
      } satisfies SpendingFilterState),
    ToolTopbar: SpendingTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: SpendingMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "case-manager-load",
    title: "Case Managers",
    defaultPinned: true,
    createFilterState: () => ({ month: monthKeyOffsetDays(5), showLegacyCols: true } satisfies CaseManagerLoadFilterState),
    ToolTopbar: CaseManagerLoadTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: CaseManagerLoadSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: CaseManagerLoadMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "caseload-board",
    title: "Caseload Board",
    hidden: true,
    defaultPinned: true,
    createFilterState: () => createCaseLoadBoardFilterState() satisfies CaseLoadBoardFilterState,
    ToolTopbar: CaseLoadBoardTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: CaseLoadBoardMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "customer-folders",
    title: "Customer Folders",
    hidden: true,
    createFilterState: () => ({ search: "", showExited: true } satisfies CustomerFoldersFilterState),
    ToolTopbar: CustomerFoldersTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: CustomerFoldersMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "all-enrollments",
    title: "Customers",
    createFilterState: () => ({ bucket: "all", caseManagerId: "all" } satisfies AllEnrollmentsFilterState),
    ToolTopbar: AllEnrollmentsTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: AllEnrollmentsSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: AllEnrollmentsMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "jotform-dashboard",
    title: "Jotform Dashboard",
    hidden: true,
    createFilterState: () =>
      ({ formSearch: "", submissionSearch: "", detailView: "custom" } satisfies JotformDashboardFilterState),
    shouldRenderSidebar: ({ selection }) => {
      const sel = selection as JotformDashboardSelection;
      return !sel || !!sel.formId;
    },
    ToolTopbar: JotformDashboardTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Sidebar: JotformDashboardSidebar as AnyDashboardToolDefinition["Sidebar"],
    Main: JotformDashboardMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "jotform-live-submissions",
    title: "Live Jotform Submissions",
    createFilterState: () => ({ liveAlias: "" } satisfies LiveJotformSubmissionsFilterState),
    ToolTopbar: LiveJotformSubmissionsTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: LiveJotformSubmissionsMain as AnyDashboardToolDefinition["Main"],
  },
  {
    id: "jotform-submission-manager",
    title: "Jotform Submission Manager",
    createFilterState: () =>
      ({
        managerFormId: "",
        managerSubmissionId: "",
        managerGrantId: "",
        managerCustomerId: "",
        managerEnrollmentId: "",
        managerCwId: "",
        managerHmisId: "",
        managerFormAlias: "",
      } satisfies JotformSubmissionManagerFilterState),
    ToolTopbar: JotformSubmissionManagerTopbar as AnyDashboardToolDefinition["ToolTopbar"],
    Main: JotformSubmissionManagerMain as AnyDashboardToolDefinition["Main"],
  },
] as const;

export function getDashboardToolDef(toolId: string) {
  return DASHBOARD_TOOL_DEFS.find((x) => x.id === toolId);
}
