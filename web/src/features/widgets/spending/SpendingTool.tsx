import React from "react";
import { toApiError } from "@client/api";
import UsersClient from "@client/users";
import { useAuth } from "@app/auth/AuthProvider";
import GrantSelect from "@entities/selectors/GrantSelect";
import { useCreditCards } from "@hooks/useCreditCards";
import { usePaymentsUpdateCompliance } from "@hooks/usePayments";
import { useAutoAssignLedgerEntries, useLedgerEntries } from "@hooks/useLedger";
import {
  usePaymentQueueItems,
  useBypassClosePaymentQueueItems,
  usePostPaymentQueueToLedger,
  type PaymentQueueItem,
} from "@hooks/usePaymentQueue";
import { useMyOtherTasks } from "@hooks/useTasks";
import { useUsers } from "@hooks/useUsers";
import { useSyncJotformSelection } from "@hooks/useJotform";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import type { CreditCardEntity } from "@types";
import { buildCsv, downloadCsv } from "@entities/ui/dashboardStyle/SmartExportButton";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import ActionMenu from "@entities/ui/ActionMenu";
import {
  ComplexDateSelector,
  complexDateMatchesIsoDate,
  complexDatePrimaryMonth,
  complexDateValueLabel,
  normalizeComplexDateValue,
  type ComplexDateValue,
} from "@entities/ui/ComplexDateSelector";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import { GrantBudgetStrip } from "@entities/grants/GrantBudgetStrip";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { filterRows, SmartFilterHeader, sortRows, useTableColumnFilters, useTableSort, type TableColumnPart } from "@hooks/useTableSort";
import { monthKeyOffsetDays } from "../utils";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { SpendDetailModal } from "./SpendDetailModal";
import type { CardBudget } from "./SpendDetailModal";
import { LINE_ITEMS_FORM_IDS } from "@features/widgets/jotform/lineItemsFormMap";
import { buildNormalizedAnswerFields, jotformValueText } from "@features/widgets/jotform/jotformSubmissionView";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** typeFilter maps to row kinds:
 *  enrollment → grant-ledger + queue-projection
 *  card       → card-ledger + queue-credit-card
 *  invoice    → queue-invoice
 */
export type AdvancedQueueFilterOperator = "contains" | "equals" | "empty";

export type AdvancedQueueFilter = {
  id: string;
  fieldKey: string;
  operator: AdvancedQueueFilterOperator;
  value: string;
};

export type SpendingFilterState = {
  month: string;
  dateFilter: ComplexDateValue;
  typeFilter: "" | "forms" | "enrollment" | "card" | "invoice";
  workflowFilter: "" | "open" | "closed";
  grantId: string;
  cardFilterId: string;
  cardBucketFilter: string;
  search: string;
  showReversals: boolean;
  customerId: string;
  cmId: string;
  advancedQueueFilters: AdvancedQueueFilter[];
};

export const DEFAULT_SPENDING_FILTER: SpendingFilterState = {
  month: monthKeyOffsetDays(5),
  dateFilter: { mode: "month", month: monthKeyOffsetDays(5) },
  typeFilter: "forms",
  workflowFilter: "",
  grantId: "",
  cardFilterId: "",
  cardBucketFilter: "",
  search: "",
  showReversals: false,
  customerId: "",
  cmId: "",
  advancedQueueFilters: [],
};

type SpendingSavedView = {
  id: string;
  name: string;
  filterState: SpendingFilterState;
  builtIn?: boolean;
};

type SpendingViewsSettings = {
  defaultViewId?: string;
  views?: SpendingSavedView[];
};

const SPENDING_VIEWS_SETTINGS_KEY = "spendingViews";

function cloneSpendingFilter(value: SpendingFilterState): SpendingFilterState {
  return JSON.parse(JSON.stringify(value)) as SpendingFilterState;
}

function spendingFilterPatch(patch: Partial<SpendingFilterState>): SpendingFilterState {
  const advancedQueueFilters = Array.isArray(patch.advancedQueueFilters)
    ? patch.advancedQueueFilters
        .map((filter) => ({
          id: String(filter?.id || `advanced-${Date.now()}-${Math.random().toString(36).slice(2)}`),
          fieldKey: String(filter?.fieldKey || ""),
          operator: (filter?.operator === "equals" || filter?.operator === "empty" ? filter.operator : "contains") as AdvancedQueueFilterOperator,
          value: String(filter?.value || ""),
        }))
        .filter((filter) => filter.fieldKey)
    : [];
  return {
    ...cloneSpendingFilter(DEFAULT_SPENDING_FILTER),
    ...patch,
    dateFilter: patch.dateFilter ?? cloneSpendingFilter(DEFAULT_SPENDING_FILTER).dateFilter,
    typeFilter: ["", "forms", "enrollment", "card", "invoice"].includes(String(patch.typeFilter ?? ""))
      ? (String(patch.typeFilter ?? "") as SpendingFilterState["typeFilter"])
      : DEFAULT_SPENDING_FILTER.typeFilter,
    advancedQueueFilters,
  };
}

function builtInSpendingViews(): SpendingSavedView[] {
  return [
    {
      id: "builtin-current-month",
      name: "CC + Invoices",
      filterState: cloneSpendingFilter(DEFAULT_SPENDING_FILTER),
      builtIn: true,
    },
    {
      id: "builtin-all-current-month",
      name: "All Spending",
      filterState: spendingFilterPatch({ typeFilter: "" }),
      builtIn: true,
    },
    {
      id: "builtin-open-invoices",
      name: "Open Invoices",
      filterState: spendingFilterPatch({ typeFilter: "invoice", workflowFilter: "open" }),
      builtIn: true,
    },
    {
      id: "builtin-card-data-entry",
      name: "Card Data Entry",
      filterState: spendingFilterPatch({ typeFilter: "card", workflowFilter: "open" }),
      builtIn: true,
    },
    {
      id: "builtin-projected-enrollments",
      name: "Projected Enrollments",
      filterState: spendingFilterPatch({ typeFilter: "enrollment", workflowFilter: "open" }),
      builtIn: true,
    },
    {
      id: "builtin-reconciled",
      name: "Reconciled",
      filterState: spendingFilterPatch({ workflowFilter: "closed" }),
      builtIn: true,
    },
  ];
}

function sanitizeSavedSpendingView(value: unknown): SpendingSavedView | null {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!raw) return null;
  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim();
  const filterState = raw.filterState && typeof raw.filterState === "object"
    ? (raw.filterState as Partial<SpendingFilterState>)
    : null;
  if (!id || !name || !filterState) return null;
  return {
    id,
    name,
    filterState: spendingFilterPatch(filterState),
    builtIn: false,
  };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SpendingWorkflowState = "open" | "closed";
type CardDetection = "linked" | "saved" | "auto" | "none";
type SpendingSelection = null;

type SpendingRow = {
  id: string;
  kind: "grant-ledger" | "card-ledger" | "queue-projection" | "queue-credit-card" | "queue-invoice";
  sourceLabel: string;
  title: string;
  subtitle: string;
  date: string;
  month: string;
  amountCents: number;
  completed: boolean;
  workflowState: SpendingWorkflowState;
  workflowReason: string;
  complianceStatus: string;
  grantId: string;
  lineItemId: string;
  customerId: string;
  creditCardId: string;
  creditCardName: string;
  cardDetection: CardDetection;
  cardBucket: string;
  taskToken: string;
  searchText: string;
  vendor: string;
  expenseType: string;
  purchaser: string;
  isReversal: boolean;
  linkedLedgerId?: string;
  reversalLedgerId?: string;
  ledgerEntry?: Record<string, unknown>;
  paymentQueueItem?: PaymentQueueItem;
};

type CreditCardSummaryView = {
  id: string;
  name: string;
  code: string;
  last4: string;
  limitCents: number;
  spentCents: number;
  pendingCents: number;
  remainingCents: number;
  usagePct: number;
  openCount: number;
  rowCount: number;
  cardBuckets: Set<string>;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toCents(value: unknown, fallbackAmount?: unknown): number {
  const cents = Number(value);
  if (Number.isFinite(cents)) return Math.trunc(cents);
  const amount = Number(fallbackAmount);
  if (Number.isFinite(amount)) return Math.round(amount * 100);
  return 0;
}

function dateIso10(value: unknown): string {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthFromDate(value: unknown): string {
  const s = String(value || "").trim();
  // Already YYYY-MM — return as-is to avoid UTC parsing timezone shift
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const iso10 = dateIso10(value);
  return iso10 ? iso10.slice(0, 7) : "";
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileSafeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "all";
}

function parseLast4(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

function taskTokenFromLedgerId(ledgerId: string) {
  return `ledger:${String(ledgerId || "").trim()}`;
}

function cardDisplayName(card: Partial<CreditCardEntity> | null | undefined) {
  if (!card) return "";
  const name = String(card.name || card.id || "").trim();
  const code = String(card.code || "").trim();
  const last4 = parseLast4(card.last4);
  return [name, code, last4 ? `**** ${last4}` : ""].filter(Boolean).join(" - ");
}

function matchingTerms(card: CreditCardEntity) {
  const last4 = parseLast4(card.last4);
  const aliases = Array.isArray(card.matching?.aliases) ? card.matching.aliases : [];
  const answerValues = Array.isArray(card.matching?.cardAnswerValues) ? card.matching.cardAnswerValues : [];
  const raw = [card.name, card.code, ...aliases, ...answerValues, last4];
  return Array.from(
    new Set(
      raw
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => (/^\d{4}$/.test(value) ? value : normalizeText(value)))
        .filter((value) => value.length === 4 || value.length >= 4)
    )
  );
}

function findCardMatch(cards: CreditCardEntity[], cardId: string, haystack: string) {
  if (cardId) {
    const byId = cards.find((card) => String(card.id || "") === cardId);
    if (byId) return byId;
  }
  const normalized = normalizeText(haystack);
  if (!normalized) return null;
  return cards.find((card) => matchingTerms(card).some((term) => normalized.includes(term))) || null;
}

function complianceStatusLabel(compliance: unknown, posted: boolean): string {
  const c = compliance && typeof compliance === "object" ? (compliance as Record<string, unknown>) : null;
  const hmis = !!(c?.hmisComplete);
  const cw = !!(c?.caseworthyComplete);
  if (!posted) return "Open";
  if (hmis && cw) return "Data Entry Complete";
  if (hmis) return "Posted; HMIS Only";
  if (cw) return "Posted; CW Only";
  return "Posted";
}

function isCardRow(kind: SpendingRow["kind"]) {
  return kind === "card-ledger" || kind === "queue-credit-card";
}

function invoiceRowLooksLikeCreditCardSpend(row: SpendingRow) {
  if (row.kind !== "queue-invoice" || !row.creditCardId) return false;
  const queueItem = row.paymentQueueItem as Record<string, unknown> | undefined;
  const haystack = [
    row.expenseType,
    row.title,
    row.sourceLabel,
    queueItem?.paymentMethod,
    queueItem?.expenseType,
    queueItem?.descriptor,
    queueItem?.note,
    queueItem?.notes,
    queueItem?.purpose,
    queueItem?.formTitle,
    queueItem?.formAlias,
  ].filter(Boolean).join(" ").toLowerCase();
  return /\bcredit\s*card\b|\bcard\s*purchase\b|\bcc\b/.test(haystack);
}

function isCardBudgetRow(row: SpendingRow) {
  return isCardRow(row.kind) || invoiceRowLooksLikeCreditCardSpend(row);
}

function isQueueTransactionRow(row: SpendingRow) {
  return row.kind === "queue-credit-card" || row.kind === "queue-invoice";
}

type AdvancedQueueFieldOption = {
  key: string;
  label: string;
  fieldId: string;
  samples: string[];
};

const EXTRACTED_QUEUE_FIELDS = [
  { key: "merchant", label: "Merchant" },
  { key: "amount", label: "Amount" },
  { key: "purchaser", label: "Purchaser" },
  { key: "card", label: "Card" },
  { key: "cardBucket", label: "Card Bucket" },
  { key: "expenseType", label: "Expense Type" },
  { key: "purpose", label: "Purpose" },
  { key: "customer", label: "Customer" },
  { key: "customerId", label: "Customer ID" },
  { key: "grantId", label: "Grant ID" },
  { key: "lineItemId", label: "Line Item ID" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "submissionId", label: "Submission ID" },
  { key: "month", label: "Month" },
] as const;

function rawAnswerFields(item?: PaymentQueueItem): ReturnType<typeof buildNormalizedAnswerFields> {
  const rawAnswers = item?.rawAnswers && typeof item.rawAnswers === "object"
    ? item.rawAnswers
    : {};
  return buildNormalizedAnswerFields(rawAnswers);
}

function advancedQueueFieldValue(row: SpendingRow, fieldKey: string): string {
  const queueItem = row.paymentQueueItem;
  if (!queueItem) return "";

  if (fieldKey.startsWith("raw:")) {
    const rawKey = fieldKey.slice(4);
    return rawAnswerFields(queueItem).find((field) => field.key === rawKey)?.value || "";
  }

  const valueKey = fieldKey.startsWith("field:") ? fieldKey.slice(6) : fieldKey;
  const extracted: Record<string, unknown> = {
    merchant: queueItem.merchant || row.vendor || row.title,
    amount: queueItem.amount ?? row.amountCents / 100,
    purchaser: queueItem.purchaser || row.purchaser,
    card: queueItem.card || row.creditCardName,
    cardBucket: queueItem.cardBucket || row.cardBucket,
    expenseType: queueItem.expenseType || row.expenseType,
    purpose: queueItem.purpose,
    customer: queueItem.customer || row.customerId,
    customerId: queueItem.customerId || row.customerId,
    grantId: queueItem.grantId || row.grantId,
    lineItemId: queueItem.lineItemId || row.lineItemId,
    status: [queueItem.queueStatus, row.workflowState, row.complianceStatus].filter(Boolean).join(" "),
    source: queueItem.source || row.sourceLabel,
    submissionId: queueItem.submissionId || queueItem.paymentId || row.subtitle,
    month: queueItem.month || row.month,
  };
  return jotformValueText(extracted[valueKey]);
}

function advancedFilterMatches(row: SpendingRow, filter: AdvancedQueueFilter): boolean {
  const actual = advancedQueueFieldValue(row, filter.fieldKey).trim();
  if (filter.operator === "empty") return !actual;
  const expected = filter.value.trim();
  if (!expected) return true;
  if (filter.operator === "equals") return actual.toLowerCase() === expected.toLowerCase();
  return actual.toLowerCase().includes(expected.toLowerCase());
}

// ---------------------------------------------------------------------------
// Compact credit card row (no color, no shadow)
// ---------------------------------------------------------------------------

function CompactCardRow({
  card,
  active,
  onClick,
}: {
  card: CreditCardSummaryView;
  active: boolean;
  onClick: () => void;
}) {
  const usage = Math.max(0, Math.min(100, Math.round(card.usagePct)));
  const barColor = usage >= 100 ? "bg-rose-500" : usage >= 85 ? "bg-amber-400" : "bg-slate-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-xs transition",
        active
          ? "border-slate-800 bg-slate-50"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-slate-800">{card.name}</span>
        {card.code ? <span className="ml-1.5 text-slate-400">{card.code}</span> : null}
        {card.last4 ? <span className="ml-1 font-mono text-slate-400">···{card.last4}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-slate-500">
          Spent <b className="text-slate-700">{fmtCurrencyUSD(card.spentCents / 100)}</b>
        </span>
        <span className="text-slate-500">
          Pending <b className="text-slate-700">{fmtCurrencyUSD(card.pendingCents / 100)}</b>
        </span>
        <span className="text-slate-500">
          Remaining{" "}
          <b className={card.remainingCents < 0 ? "text-rose-600" : "text-slate-700"}>
            {fmtCurrencyUSD(card.remainingCents / 100)}
          </b>
        </span>
        <div className="hidden items-center gap-1.5 md:flex">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, usage)}%` }} />
          </div>
          <span className="text-[10px] text-slate-400">{usage}%</span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Topbar — primary filters + expandable secondary
// Primary:  [All|Enrollment|Card|Invoice]  [Grant▾]  [Month]  [Filters▾]
// Secondary (expanded): [Open|All|Closed]  [Search]  [Clear]
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { id: "" as const, label: "All" },
  { id: "forms" as const, label: "CC + Invoices" },
  { id: "enrollment" as const, label: "Enrollment" },
  { id: "card" as const, label: "Card" },
  { id: "invoice" as const, label: "Invoice" },
] satisfies { id: SpendingFilterState["typeFilter"]; label: string }[];

const SPENDING_TABLE_PARTS = {
  date: [
    { id: "header", label: "Header (date)" },
    { id: "subheader", label: "Sub header (type)" },
    { id: "chip", label: "Chip" },
  ],
  customer: [
    { id: "header", label: "Header (customer)" },
    { id: "subheader", label: "Sub header (CM/purchaser)" },
  ],
  service: [
    { id: "header", label: "Header (grant)" },
    { id: "subheader", label: "Sub header (line item)" },
    { id: "chip", label: "Chip (expense type)" },
  ],
  amount: [
    { id: "header", label: "Header (amount)" },
  ],
  vendor: [
    { id: "header", label: "Header (vendor)" },
    { id: "subheader", label: "Sub header (purchaser)" },
  ],
  status: [
    { id: "header", label: "Header (status)" },
    { id: "subheader", label: "Sub header (workflow)" },
    { id: "chip", label: "Chip (reason)" },
  ],
} satisfies Record<string, TableColumnPart[]>;

// Filter panel is embedded inside LineItemSpendingTool so it has access to
// filteredRows, stats, and action handlers. This topbar is kept as a no-op
// for the DashboardToolDefinition registration.
export const SpendingTopbar: DashboardToolDefinition<SpendingFilterState, SpendingSelection>["ToolTopbar"] = () =>
  null;

// ---------------------------------------------------------------------------
// Row status badge — color-coded per kind + workflow state
// ---------------------------------------------------------------------------

function RowStatusBadge({ row }: { row: SpendingRow }) {
  const { kind, workflowState, complianceStatus } = row;

  if (kind === "queue-projection") {
    return workflowState === "closed" ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Posted</span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">Projected</span>
    );
  }

  if (kind === "grant-ledger") {
    if (complianceStatus === "Data Entry Complete") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Data Entry ✓</span>;
    }
    if (complianceStatus.startsWith("Posted;")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 max-w-[140px] truncate">{complianceStatus}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Posted</span>;
  }

  // Card / Invoice
  if (workflowState === "open") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Data Entry</span>;
  }
  if (complianceStatus === "Data Entry Complete") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Data Entry ✓</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Posted</span>;
}

// ---------------------------------------------------------------------------
// Main tool component
// Always receives filterState/onFilterChange from SpendingMain (dashboard wrapper).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row context menu
// ---------------------------------------------------------------------------

type ContextMenuState = { x: number; y: number; row: SpendingRow };
type ContextAction = "invoice-submitted" | "data-entry-complete" | "hmis-complete" | "caseworthy-complete";

function RowContextMenu({
  menu,
  acting,
  onAction,
}: {
  menu: ContextMenuState;
  acting: boolean;
  onAction: (action: ContextAction) => void;
}) {
  const row = menu.row;
  const ledger = row.ledgerEntry as Record<string, unknown> | undefined;
  const enrollmentId = String(
    (row.paymentQueueItem as Record<string, unknown> | undefined)?.enrollmentId ||
    ledger?.enrollmentId || ""
  );
  const paymentId = String(ledger?.paymentId || "");
  const canPost =
    (row.kind === "grant-ledger" && !!enrollmentId && !!paymentId) ||
    ((row.kind === "queue-invoice" || row.kind === "queue-credit-card") &&
      row.workflowState === "open" &&
      !!row.grantId &&
      !!row.lineItemId);
  const canCompliance = row.kind === "grant-ledger" && !!enrollmentId && !!paymentId;

  const btnCls =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40";

  return (
    <div
      className="fixed z-50 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Quick Actions
      </div>
      {canPost && (
        <button type="button" disabled={acting} className={btnCls} onClick={() => onAction("invoice-submitted")}>
          Invoice Submitted
        </button>
      )}
      {canCompliance && (
        <>
          <button type="button" disabled={acting} className={btnCls} onClick={() => onAction("data-entry-complete")}>
            Data Entry Complete
          </button>
          <button type="button" disabled={acting} className={btnCls} onClick={() => onAction("hmis-complete")}>
            HMIS Complete
          </button>
          <button type="button" disabled={acting} className={btnCls} onClick={() => onAction("caseworthy-complete")}>
            Caseworthy Complete
          </button>
        </>
      )}
      {!canPost && !canCompliance && (
        <div className="px-3 py-2 text-sm text-slate-400">No quick actions available</div>
      )}
    </div>
  );
}

// Dot bg classes from BudgetConfigModal COLOR_DEFS — keyed by color name
const BUDGET_COLOR_DOT: Record<string, string> = {
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", pink: "bg-pink-500",
  rose: "bg-rose-500", red: "bg-red-500", orange: "bg-orange-500",
  amber: "bg-amber-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  slate: "bg-slate-400",
};

// ---------------------------------------------------------------------------

type SpendingToolProps = {
  filterState?: SpendingFilterState;
  onFilterChange?: (next: SpendingFilterState) => void;
};

export function LineItemSpendingTool(props: SpendingToolProps = {}) {
  const { profile, reloadProfile } = useAuth();
  const { grants, enrollments, grantNameById, customerNameById, sharedDataLoading, sharedDataError, customers } = useDashboardSharedData();
  const { data: orgConfig } = useOrgConfig();

  // Map grantId[:lineItemId] → color key from the budget display config
  const grantColorById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const group of orgConfig?.budgetDisplay?.groups ?? []) {
      const groupColor = group.color;
      for (const item of group.items ?? []) {
        const color = item.color ?? groupColor;
        if (!color) continue;
        // Specific line-item entry
        if (item.lineItemId) map.set(`${item.grantId}:${item.lineItemId}`, color);
        // Grant-level entry (also used as fallback for any line item of this grant)
        if (!map.has(`${item.grantId}:`)) map.set(`${item.grantId}:`, color);
      }
    }
    return map;
  }, [orgConfig]);
  const { sort, onSort, setSortDir } = useTableSort();
  const { filters: columnFilters, setColumnFilter } = useTableColumnFilters();

  const [localFilter, setLocalFilter] = React.useState<SpendingFilterState>(DEFAULT_SPENDING_FILTER);
  const filterState = props.filterState ?? localFilter;
  const setFilterState = props.onFilterChange ?? setLocalFilter;

  const [showFilters, setShowFilters] = React.useState(false);

  const dateFilter = normalizeComplexDateValue(filterState.dateFilter, filterState.month);
  const month = complexDatePrimaryMonth(dateFilter);
  const { typeFilter, workflowFilter, cardFilterId, grantId, cardBucketFilter, search, advancedQueueFilters } = filterState;
  const [saveViewName, setSaveViewName] = React.useState("");
  const [savingViews, setSavingViews] = React.useState(false);
  const [modalRow, setModalRow] = React.useState<SpendingRow | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const spendingViewsSettings = React.useMemo<SpendingViewsSettings>(() => {
    const settings = profile && typeof profile.settings === "object" && profile.settings
      ? (profile.settings as Record<string, unknown>)
      : {};
    const raw = settings[SPENDING_VIEWS_SETTINGS_KEY] as Record<string, unknown> | undefined;
    const saved = Array.isArray(raw?.views)
      ? raw.views.map(sanitizeSavedSpendingView).filter((v): v is SpendingSavedView => !!v)
      : [];
    return {
      defaultViewId: typeof raw?.defaultViewId === "string" ? raw.defaultViewId : undefined,
      views: saved,
    };
  }, [profile]);

  const spendingViews = React.useMemo(
    () => [...builtInSpendingViews(), ...(spendingViewsSettings.views || [])],
    [spendingViewsSettings.views]
  );

  const writeSpendingViewsSettings = React.useCallback(async (next: SpendingViewsSettings) => {
    const baseSettings = profile && typeof profile.settings === "object" && profile.settings
      ? (profile.settings as Record<string, unknown>)
      : {};
    setSavingViews(true);
    try {
      await UsersClient.meUpdate({
        settings: {
          ...baseSettings,
          [SPENDING_VIEWS_SETTINGS_KEY]: next,
        },
      });
      await reloadProfile();
      toast("Spending views saved.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Failed to save spending views.").error, { type: "error" });
    } finally {
      setSavingViews(false);
    }
  }, [profile, reloadProfile]);

  const applySpendingView = React.useCallback((view: SpendingSavedView) => {
    setFilterState(cloneSpendingFilter(view.filterState));
  }, [setFilterState]);

  const saveCurrentSpendingView = React.useCallback(async () => {
    const name = saveViewName.trim();
    if (!name) {
      toast("Name the view first.", { type: "error" });
      return;
    }
    const view: SpendingSavedView = {
      id: `user-${Date.now()}`,
      name,
      filterState: cloneSpendingFilter(filterState),
    };
    await writeSpendingViewsSettings({
      ...spendingViewsSettings,
      views: [...(spendingViewsSettings.views || []), view],
    });
    setSaveViewName("");
  }, [filterState, saveViewName, spendingViewsSettings, writeSpendingViewsSettings]);

  const setDefaultSpendingView = React.useCallback(async (viewId: string) => {
    await writeSpendingViewsSettings({
      ...spendingViewsSettings,
      defaultViewId: viewId,
    });
  }, [spendingViewsSettings, writeSpendingViewsSettings]);

  const deleteSavedSpendingView = React.useCallback(async (viewId: string) => {
    await writeSpendingViewsSettings({
      defaultViewId: spendingViewsSettings.defaultViewId === viewId ? undefined : spendingViewsSettings.defaultViewId,
      views: (spendingViewsSettings.views || []).filter((view) => view.id !== viewId),
    });
  }, [spendingViewsSettings, writeSpendingViewsSettings]);

  const defaultViewAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (defaultViewAppliedRef.current) return;
    const defaultViewId = spendingViewsSettings.defaultViewId;
    if (!defaultViewId) return;
    const hit = spendingViews.find((view) => view.id === defaultViewId);
    if (!hit) return;
    defaultViewAppliedRef.current = true;
    setFilterState(cloneSpendingFilter(hit.filterState));
  }, [setFilterState, spendingViews, spendingViewsSettings.defaultViewId]);

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: creditCards = [], isLoading: cardsLoading, isError: cardsError } = useCreditCards(
    { active: true, limit: 200 },
    { enabled: true, staleTime: 30_000 }
  );
  const { data: ledgerEntries = [], isLoading: ledgerLoading, isError: ledgerError } = useLedgerEntries(
    {
      ...(month ? { month } : {}),
      ...(grantId ? { grantId } : {}),
      limit: 500,
      sortBy: "dueDate",
      sortOrder: "desc",
    },
    { enabled: true }
  );
  const { data: paymentQueueItems = [], isLoading: queueLoading, isError: queueError } = usePaymentQueueItems(
    {
      ...(month ? { month } : {}),
      ...(grantId ? { grantId } : {}),
      limit: 500,
    },
    { enabled: true, staleTime: 30_000 }
  );
  const { data: otherTasks = [], isLoading: otherTasksLoading, isError: otherTasksError } = useMyOtherTasks(
    { ...(month ? { month } : {}), includeGroup: true },
    { enabled: true, staleTime: 10_000 }
  );

  const { data: usersRaw = [] } = useUsers({ limit: 300, status: "all" });

  const loading = sharedDataLoading || cardsLoading || ledgerLoading || queueLoading || otherTasksLoading;
  const error = sharedDataError || cardsError || ledgerError || queueError || otherTasksError;

  // ── Selection ────────────────────────────────────────────────────────────

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkPosting, setBulkPosting] = React.useState(false);
  const [bulkBypassClosing, setBulkBypassClosing] = React.useState(false);
  React.useEffect(() => { setSelectedIds(new Set()); }, [filterState]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const autoAssignMutation = useAutoAssignLedgerEntries();
  const bypassCloseMutation = useBypassClosePaymentQueueItems();
  const postMutation = usePostPaymentQueueToLedger();
  const updateCompliance = usePaymentsUpdateCompliance();
  const syncJotformSelection = useSyncJotformSelection();

  // ── Context menu ──────────────────────────────────────────────────────────

  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [contextActing, setContextActing] = React.useState(false);

  React.useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [contextMenu]);

  async function handleContextAction(action: ContextAction, row: SpendingRow) {
    setContextMenu(null);
    setContextActing(true);
    try {
      const ledger = row.ledgerEntry as Record<string, unknown> | undefined;
      const enrollmentId = String(
        (row.paymentQueueItem as Record<string, unknown> | undefined)?.enrollmentId ||
        ledger?.enrollmentId || ""
      );
      const paymentId = String(ledger?.paymentId || "");

      if (action === "invoice-submitted") {
        if (row.kind === "grant-ledger") {
          if (!enrollmentId || !paymentId) {
            toast("Cannot mark invoice — open the row for details.", { type: "error" });
            return;
          }
          await updateCompliance.mutateAsync({ enrollmentId, paymentId, patch: { status: "invoice-submitted" } });
          toast("Invoice submitted.", { type: "success" });
        } else {
          if (!row.paymentQueueItem) { toast("No queue item to post.", { type: "error" }); return; }
          await postMutation.mutateAsync({ id: row.paymentQueueItem.id });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
            queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
          ]);
          toast("Invoice submitted.", { type: "success" });
        }
      } else {
        if (!enrollmentId || !paymentId) {
          toast("Cannot update compliance — open the row for details.", { type: "error" });
          return;
        }
        const patch: { hmisComplete?: boolean; caseworthyComplete?: boolean } =
          action === "data-entry-complete" ? { hmisComplete: true, caseworthyComplete: true }
          : action === "hmis-complete" ? { hmisComplete: true }
          : { caseworthyComplete: true };
        await updateCompliance.mutateAsync({ enrollmentId, paymentId, patch });
        toast("Compliance updated.", { type: "success" });
      }
    } catch (e: unknown) {
      toast(toApiError(e, "Action failed.").error, { type: "error" });
    } finally {
      setContextActing(false);
    }
  }

  // ── Derived lookups ──────────────────────────────────────────────────────

  const creditCardList = React.useMemo(
    () => (creditCards as CreditCardEntity[]).filter((c) => String(c?.status || "").toLowerCase() !== "deleted"),
    [creditCards]
  );

  const lineItemLookup = React.useMemo(() => {
    const map = new Map<string, { grantName: string; lineItemLabel: string }>();
    for (const g of grants as Array<Record<string, unknown>>) {
      const gid = String(g?.id || "");
      const grantName = String(g?.name || gid || "-");
      const items = Array.isArray((g?.budget as Record<string, unknown> | undefined)?.lineItems)
        ? (((g?.budget as Record<string, unknown>).lineItems || []) as Array<Record<string, unknown>>)
        : [];
      for (const li of items) {
        const lineItemId = String(li?.id || "");
        if (!lineItemId) continue;
        map.set(`${gid}:${lineItemId}`, { grantName, lineItemLabel: String(li?.label || lineItemId) });
      }
    }
    return map;
  }, [grants]);

  const openTaskByToken = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const raw of otherTasks as Array<Record<string, unknown>>) {
      const joined = [String(raw?.title || ""), String(raw?.notes || raw?.note || "")].filter(Boolean).join("\n");
      for (const match of joined.matchAll(/LEDGER_ENTRY:([A-Za-z0-9_-]+)/gi)) {
        map.set(taskTokenFromLedgerId(match[1] || ""), raw);
      }
    }
    return map;
  }, [otherTasks]);

  // User display name by UID
  const userDisplayNameByUid = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersRaw as Array<{ uid?: string; displayName?: string | null; email?: string | null }>) {
      const uid = String(u?.uid || "");
      if (!uid) continue;
      const name = String(u?.displayName || u?.email || "").trim();
      if (name) map.set(uid, name);
    }
    return map;
  }, [usersRaw]);

  // CM ID by customer ID — most recent active enrollment wins
  const cmIdByCustomerId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const e of enrollments as Array<Record<string, unknown>>) {
      const cid = String(e?.customerId || e?.clientId || "");
      const cmId = String(e?.caseManagerId || "");
      if (!cid || !cmId) continue;
      // Prefer active enrollments; overwrite with later entries (sorted by createdAt desc is ideal,
      // but here we just let later array entries win — shared data is sorted newest first)
      if (String(e?.active || "").toLowerCase() !== "false") {
        map.set(cid, cmId);
      } else if (!map.has(cid)) {
        map.set(cid, cmId);
      }
    }
    return map;
  }, [enrollments]);

  const sortedCustomers = React.useMemo(
    () =>
      [...(customers as Array<Record<string, unknown>>)]
        .map((c) => ({
          id: String(c?.id || ""),
          name:
            (String(c?.firstName || "").trim() + " " + String(c?.lastName || "").trim()).trim() ||
            String(c?.displayName || c?.id || ""),
        }))
        .filter((c) => c.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  const sortedUsers = React.useMemo(
    () =>
      (usersRaw as Array<Record<string, unknown>>)
        .map((u) => ({
          uid: String(u?.uid || ""),
          name: String(u?.displayName || u?.email || u?.uid || ""),
        }))
        .filter((u) => u.uid)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [usersRaw]
  );

  const setFilter = (patch: Partial<SpendingFilterState>) =>
    setFilterState({ ...filterState, ...patch });

  const setDateFilter = (next: ComplexDateValue) => {
    const normalized = normalizeComplexDateValue(next, month);
    setFilter({
      dateFilter: normalized,
      month: complexDatePrimaryMonth(normalized),
    });
  };

  const hasActiveFilters =
    !!filterState.typeFilter ||
    !!filterState.grantId ||
    !!filterState.workflowFilter ||
    !!filterState.search ||
    !!filterState.customerId ||
    !!filterState.cmId ||
    filterState.advancedQueueFilters.length > 0 ||
    !!filterState.showReversals;

  // ── Row assembly ─────────────────────────────────────────────────────────

  const allRows = React.useMemo(() => {
    const rows: SpendingRow[] = [];
    const ledger = ledgerEntries as Array<Record<string, unknown>>;

    for (const e of ledger) {
      const source = String(e?.source || "").toLowerCase();
      const isGrantPayment = source === "enrollment";
      const isCard = source === "card";
      if (!isGrantPayment && !isCard) continue;
      if (String((e?.origin as Record<string, unknown> | undefined)?.sourcePath || "").startsWith("paymentQueue/")) continue;

      const entryId = String(e?.id || "");
      const grantId = String(e?.grantId || "");
      const lineItemId = String(e?.lineItemId || "");
      const amountCents = toCents(e?.amountCents, e?.amount);
      const date = dateIso10(e?.dueDate || e?.date || e?.createdAt || e?.ts);
      const rowMonth = monthFromDate(date);
      if (month && rowMonth !== month) continue;
      // Clean vendor: use only vendor field, not comment/notes
      const vendor = String(e?.vendor || "").trim();
      const displayTitle = vendor || String(e?.description || e?.comment || entryId || "-");
      const isReversal = amountCents < 0 || (Array.isArray(e?.labels) && (e.labels as string[]).includes("reversal"));
      const savedCardId = String(e?.creditCardId || "");
      const matchedCard = isCard
        ? findCardMatch(creditCardList, savedCardId, [
            vendor,
            String(e?.comment || ""),
            Array.isArray(e?.note) ? (e.note as unknown[]).join(" ") : String(e?.note || ""),
            Array.isArray(e?.labels) ? (e.labels as unknown[]).join(" ") : "",
            String(e?.grantNameAtSpend || ""),
          ].join(" "))
        : null;
      const creditCardId = savedCardId || String(matchedCard?.id || "");
      const taskToken = taskTokenFromLedgerId(entryId);
      const hasOpenTask = openTaskByToken.has(taskToken);
      const completed = isGrantPayment ? true : !!(grantId && lineItemId);

      rows.push({
        id: `ledger:${entryId}`,
        kind: isGrantPayment ? "grant-ledger" : "card-ledger",
        sourceLabel: isGrantPayment ? "Enrollment" : "Card",
        title: displayTitle,
        subtitle: entryId,
        date,
        month: rowMonth,
        amountCents,
        completed,
        workflowState: isGrantPayment ? "closed" : hasOpenTask || !completed ? "open" : "closed",
        workflowReason: isGrantPayment
          ? "Posted grant payment"
          : hasOpenTask
          ? "Open spend task"
          : completed
          ? "Allocated to grant"
          : "Needs allocation",
        complianceStatus: isGrantPayment
          ? complianceStatusLabel(e?.compliance, true)
          : complianceStatusLabel(null, !hasOpenTask && completed),
        grantId,
        lineItemId,
        customerId: String(e?.customerId || ""),
        creditCardId,
        creditCardName: cardDisplayName(matchedCard) || savedCardId || "",
        cardDetection: savedCardId ? "linked" : matchedCard ? "auto" : "none",
        cardBucket: "",
        taskToken,
        vendor,
        expenseType: "",
        purchaser: "",
        isReversal,
        searchText: [vendor, displayTitle, grantId, lineItemId, String(e?.customerId || "")].join(" ").toLowerCase(),
        ledgerEntry: e,
      });
    }

    for (const item of paymentQueueItems) {
      const queueItem = item as PaymentQueueItem;
      const source = String(queueItem.source || "").toLowerCase();
      if (source !== "credit-card" && source !== "invoice" && source !== "projection") continue;
      if (String(queueItem.queueStatus || "").toLowerCase() === "void") continue;

      const queueId = String(queueItem.id || "");
      const submissionId = String(queueItem.paymentId || queueItem.submissionId || queueId || "").trim();
      const date = dateIso10(queueItem.dueDate || queueItem.createdAt || queueItem.postedAt);
      const rowMonth = monthFromDate(queueItem.month || date);
      if (month && rowMonth && rowMonth !== month) continue;
      const savedCardId = String(queueItem.creditCardId || "");
      const merchant = String(queueItem.merchant || queueItem.descriptor || queueItem.formTitle || queueItem.formAlias || submissionId);
      const matchedCard = findCardMatch(
        creditCardList,
        savedCardId,
        [queueItem.card, queueItem.cardBucket, queueItem.descriptor, queueItem.note, queueItem.notes, queueItem.purpose, merchant, queueItem.formTitle, queueItem.formAlias]
          .filter(Boolean)
          .join(" ")
      );
      const queueStatus = String(queueItem.queueStatus || "pending").toLowerCase();
      const amountCents = Math.round(Number(queueItem.amount || 0) * 100);
      const workflowState: SpendingWorkflowState = queueStatus === "posted" ? "closed" : "open";
      const bypassClosed = !!queueItem.closedBypassLedger;
      const isProjection = source === "projection";
      const queueVendor = String(queueItem.merchant || "").trim();
      const queueExpenseType = String((queueItem as any).expenseType || (queueItem as any).descriptor || "").trim();
      const queuePurchaser = String((queueItem as any).purchaser || "").trim();
      const queueRawSearch = rawAnswerFields(queueItem).map((field) => `${field.label} ${field.key} ${field.value}`).join(" ");

      rows.push({
        id: `queue:${queueId}`,
        kind: source === "invoice" ? "queue-invoice" : isProjection ? "queue-projection" : "queue-credit-card",
        sourceLabel: source === "invoice" ? "Invoice" : isProjection ? "Enrollment" : "Card",
        title: merchant || queueId || "-",
        subtitle: submissionId || queueId,
        date,
        month: rowMonth,
        amountCents,
        completed: workflowState === "closed",
        workflowState,
        workflowReason:
          workflowState === "closed"
            ? bypassClosed ? "Closed without ledger" : "Posted to ledger"
            : isProjection
            ? "Projected spend, not yet paid"
            : "Waiting to post",
        grantId: String(queueItem.grantId || ""),
        lineItemId: String(queueItem.lineItemId || ""),
        customerId: String(queueItem.customerId || ""),
        creditCardId: isProjection ? "" : savedCardId || String(matchedCard?.id || ""),
        creditCardName: isProjection ? "" : cardDisplayName(matchedCard) || savedCardId || "",
        cardDetection: isProjection ? "none" : savedCardId ? "saved" : matchedCard ? "auto" : "none",
        cardBucket: String(queueItem.cardBucket || ""),
        taskToken: "",
        vendor: queueVendor,
        expenseType: queueExpenseType,
        purchaser: queuePurchaser,
        isReversal: amountCents < 0 || String((queueItem as any).direction || "").toLowerCase() === "return",
        searchText: [
          merchant,
          queueVendor,
          queueExpenseType,
          queuePurchaser,
          queueItem.card,
          queueItem.cardBucket,
          queueItem.purpose,
          queueItem.customer,
          queueItem.grantId,
          queueItem.lineItemId,
          queueItem.customerId,
          queueItem.queueStatus,
          queueItem.submissionId,
          queueRawSearch,
        ].join(" ").toLowerCase(),
        linkedLedgerId: String(queueItem.ledgerEntryId || "") || undefined,
        reversalLedgerId: String(queueItem.reversalEntryId || "") || undefined,
        paymentQueueItem: queueItem,
        complianceStatus: isProjection
          ? complianceStatusLabel((queueItem as any).compliance, queueStatus === "posted")
          : queueStatus === "posted" ? "Posted" : "Open",
      });
    }

    // Sort: open projections first, then open queue/card, then closed
    rows.sort((a, b) => {
      const rank = (r: SpendingRow) =>
        r.kind === "queue-projection" && r.workflowState === "open" ? 0
        : (r.kind === "queue-credit-card" || r.kind === "queue-invoice") && r.workflowState === "open" ? 1
        : 2;
      const rankDelta = rank(a) - rank(b);
      if (rankDelta !== 0) return rankDelta;
      if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
      return Math.abs(b.amountCents) - Math.abs(a.amountCents);
    });
    return rows;
  }, [creditCardList, ledgerEntries, month, openTaskByToken, paymentQueueItems]);

  // ── Credit card summaries (only computed when in card mode) ──────────────

  const creditCardSummaries = React.useMemo((): CreditCardSummaryView[] => {
    if (typeFilter !== "card") return [];
    return creditCardList
      .map((card) => {
        const rowsForCard = allRows.filter(
          (row) => row.creditCardId === String(card.id || "") && isCardBudgetRow(row)
        );
        const spentCents = rowsForCard.reduce((sum, row) => sum + row.amountCents, 0);
        const pendingCents = rowsForCard
          .filter((row) => (row.kind === "queue-credit-card" || invoiceRowLooksLikeCreditCardSpend(row)) && row.workflowState === "open")
          .reduce((sum, row) => sum + row.amountCents, 0);
        const limitCents = Number(card.monthlyLimitCents || 0);
        const remainingCents = limitCents - spentCents;
        const usagePct = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;
        const cardBuckets = new Set(rowsForCard.map((row) => row.cardBucket).filter(Boolean));
        return {
          id: String(card.id || ""),
          name: String(card.name || card.id || "Credit Card"),
          code: String(card.code || ""),
          last4: parseLast4(card.last4),
          limitCents,
          spentCents,
          pendingCents,
          remainingCents,
          usagePct,
          openCount: rowsForCard.filter((row) => row.workflowState === "open").length,
          rowCount: rowsForCard.length,
          cardBuckets,
        };
      })
      .filter((c) => c.rowCount > 0) // only show cards with activity this month
      .sort((a, b) => b.usagePct - a.usagePct || b.spentCents - a.spentCents || a.name.localeCompare(b.name));
  }, [allRows, creditCardList, typeFilter]);

  // Card budget map for modal (all cards, not just card-filter mode)
  const cardBudgetById = React.useMemo((): Map<string, CardBudget> => {
    const map = new Map<string, CardBudget>();
    for (const card of creditCardList) {
      const cid = String(card.id || "");
      if (!cid) continue;
      const rowsForCard = allRows.filter((r) => r.creditCardId === cid && isCardBudgetRow(r));
      const spentCents = rowsForCard.reduce((s, r) => s + r.amountCents, 0);
      const pendingCents = rowsForCard
        .filter((r) => (r.kind === "queue-credit-card" || invoiceRowLooksLikeCreditCardSpend(r)) && r.workflowState === "open")
        .reduce((s, r) => s + r.amountCents, 0);
      const limitCents = Number(card.monthlyLimitCents || 0);
      map.set(cid, {
        id: cid,
        name: String(card.name || card.id || "Card"),
        last4: parseLast4(card.last4),
        limitCents,
        spentCents,
        pendingCents,
        remainingCents: limitCents - spentCents,
      });
    }
    return map;
  }, [allRows, creditCardList]);

  // Data-driven bucket options from actual card rows
  const availableBuckets = React.useMemo(() => {
    const buckets = new Set<string>();
    for (const summary of creditCardSummaries) {
      for (const b of summary.cardBuckets) {
        if (b) buckets.add(b);
      }
    }
    return Array.from(buckets).sort();
  }, [creditCardSummaries]);

  const queueRowsForFieldDiscovery = React.useMemo(
    () => allRows.filter((row) => isQueueTransactionRow(row) && (!row.date || complexDateMatchesIsoDate(dateFilter, row.date))),
    [allRows, dateFilter]
  );

  const advancedQueueFieldOptions = React.useMemo<AdvancedQueueFieldOption[]>(() => {
    const byKey = new Map<string, AdvancedQueueFieldOption>();
    const addSample = (key: string, label: string, fieldId: string, value: unknown) => {
      const text = jotformValueText(value).trim();
      const option = byKey.get(key) || { key, label, fieldId, samples: [] };
      if (text && !option.samples.includes(text) && option.samples.length < 3) option.samples.push(text);
      byKey.set(key, option);
    };

    for (const row of queueRowsForFieldDiscovery) {
      for (const field of EXTRACTED_QUEUE_FIELDS) {
        addSample(`field:${field.key}`, field.label, field.key, advancedQueueFieldValue(row, `field:${field.key}`));
      }
      for (const field of rawAnswerFields(row.paymentQueueItem)) {
        addSample(`raw:${field.key}`, field.label || field.key, field.key, field.value);
      }
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aRaw = a.key.startsWith("raw:");
      const bRaw = b.key.startsWith("raw:");
      if (aRaw !== bRaw) return aRaw ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
  }, [queueRowsForFieldDiscovery]);

  const updateAdvancedQueueFilter = React.useCallback((id: string, patch: Partial<AdvancedQueueFilter>) => {
    setFilter({
      advancedQueueFilters: advancedQueueFilters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter
      ),
    });
  }, [advancedQueueFilters, setFilter]);

  const addAdvancedQueueFilter = React.useCallback(() => {
    const firstFieldKey = advancedQueueFieldOptions[0]?.key || "field:merchant";
    setFilter({
      advancedQueueFilters: [
        ...advancedQueueFilters,
        {
          id: `advanced-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fieldKey: firstFieldKey,
          operator: "contains",
          value: "",
        },
      ],
      typeFilter: typeFilter || "forms",
    });
    setShowFilters(true);
  }, [advancedQueueFieldOptions, advancedQueueFilters, setFilter, typeFilter]);

  const removeAdvancedQueueFilter = React.useCallback((id: string) => {
    setFilter({
      advancedQueueFilters: advancedQueueFilters.filter((filter) => filter.id !== id),
    });
  }, [advancedQueueFilters, setFilter]);

  const getSpendingColumnValue = React.useCallback((row: SpendingRow, col: string, part = "header") => {
    const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
    const isEnrollment = row.kind === "grant-ledger" || row.kind === "queue-projection";
    const isProjection = row.kind === "queue-projection";
    const rawCmId = String(
      (row.paymentQueueItem as Record<string, unknown> | undefined)?.caseManagerId
      || (row.ledgerEntry as Record<string, unknown> | undefined)?.caseManagerId
      || cmIdByCustomerId.get(row.customerId)
      || ""
    );
    const cmName = rawCmId ? (userDisplayNameByUid.get(rawCmId) || "") : "";
    const cardType = row.cardBucket
      || (row.creditCardName ? row.creditCardName.split(" - ")[0]?.trim() : "")
      || row.sourceLabel;

    if (col === "date") {
      if (part === "subheader") return isEnrollment ? (isProjection ? "Projected" : "Enrollment") : row.kind === "queue-invoice" ? "Invoice" : "Card";
      if (part === "chip") return row.isReversal ? "Reversal" : cardType;
      return row.date;
    }
    if (col === "customer") {
      if (part === "subheader") return cmName || row.purchaser || "";
      return customerNameById.get(row.customerId) ?? "";
    }
    if (col === "service") {
      if (part === "subheader") return info?.lineItemLabel ?? "";
      if (part === "chip") return row.expenseType || "";
      return info?.grantName ?? grantNameById.get(row.grantId) ?? "";
    }
    if (col === "amount") return row.amountCents;
    if (col === "vendor") {
      if (part === "subheader") return row.purchaser || "";
      return row.vendor || row.title;
    }
    if (col === "status") {
      if (part === "subheader") return row.workflowState;
      if (part === "chip") return row.workflowReason;
      return row.complianceStatus;
    }
    return null;
  }, [cmIdByCustomerId, customerNameById, grantNameById, lineItemLookup, userDisplayNameByUid]);

  // ── Filtering ────────────────────────────────────────────────────────────

  const baseFilteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const { showReversals, customerId: filterCustomerId, cmId: filterCmId } = filterState;
    return allRows.filter((row) => {
      const typePass =
        !typeFilter ? true
        : typeFilter === "forms" ? isQueueTransactionRow(row)
        : typeFilter === "enrollment" ? (row.kind === "grant-ledger" || row.kind === "queue-projection")
        : typeFilter === "card" ? isCardBudgetRow(row)
        : typeFilter === "invoice" ? row.kind === "queue-invoice"
        : true;
      const workflowPass =
        !workflowFilter ? true
        : workflowFilter === "open" ? row.workflowState === "open"
        : row.workflowState === "closed";
      const datePass = !row.date || complexDateMatchesIsoDate(dateFilter, row.date);
      const searchPass = !q || row.searchText.includes(q) || row.title.toLowerCase().includes(q);
      const cardPass = !cardFilterId || row.creditCardId === cardFilterId;
      const grantPass = !grantId || row.grantId === grantId;
      const bucketPass =
        !cardBucketFilter || !isCardBudgetRow(row) || row.cardBucket === cardBucketFilter;
      const reversalPass = showReversals || !row.isReversal;
      const customerIdPass = !filterCustomerId || row.customerId === filterCustomerId;
      const rawRowCmId = String(
        (row.paymentQueueItem as Record<string, unknown> | undefined)?.caseManagerId
        || (row.ledgerEntry as Record<string, unknown> | undefined)?.caseManagerId
        || cmIdByCustomerId.get(row.customerId)
        || ""
      );
      const cmIdPass = !filterCmId || rawRowCmId === filterCmId;
      const advancedPass = !advancedQueueFilters.length
        || (isQueueTransactionRow(row) && advancedQueueFilters.every((filter) => advancedFilterMatches(row, filter)));
      return typePass && workflowPass && datePass && searchPass && cardPass && grantPass
        && bucketPass && reversalPass && customerIdPass && cmIdPass && advancedPass;
    });
  }, [allRows, advancedQueueFilters, cardBucketFilter, cardFilterId, dateFilter, search, typeFilter, workflowFilter, grantId, filterState, cmIdByCustomerId]);

  // ── Sort + Pagination ────────────────────────────────────────────────────

  const filteredRows = React.useMemo(
    () => filterRows(baseFilteredRows, columnFilters, getSpendingColumnValue),
    [baseFilteredRows, columnFilters, getSpendingColumnValue]
  );

  const sortedRows = React.useMemo(
    () => sortRows(filteredRows, sort, getSpendingColumnValue),
    [filteredRows, sort, getSpendingColumnValue]
  );

  const PAGE_SIZE = 50;
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setPage(1); }, [filterState]);
  React.useEffect(() => { setPage(1); }, [sort]);
  React.useEffect(() => { setPage(1); }, [columnFilters]);
  const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  // ── Selection / detail state ─────────────────────────────────────────────

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = React.useMemo(() => {
    let totalCents = 0;
    let openCount = 0;
    let unallocatedCount = 0;
    let projectedCount = 0;
    for (const row of filteredRows) {
      totalCents += row.amountCents;
      if (row.workflowState === "open") {
        openCount++;
        if (isCardBudgetRow(row) && !row.grantId) unallocatedCount++;
      }
      if (row.kind === "queue-projection" && row.workflowState === "open") projectedCount++;
    }
    return { totalCents, openCount, unallocatedCount, projectedCount };
  }, [filteredRows]);

  // ── Export ───────────────────────────────────────────────────────────────

  type ExportRow = { source: string; card: string; date: string; title: string; grant: string; lineItem: string; amount: number; status: string };

  const toExportRow = React.useCallback(
    (r: SpendingRow): ExportRow => ({
      source: r.sourceLabel,
      card: r.creditCardName || r.creditCardId || "-",
      date: r.date,
      title: r.title,
      grant: grantNameById.get(r.grantId) || r.grantId || "-",
      lineItem: lineItemLookup.get(`${r.grantId}:${r.lineItemId}`)?.lineItemLabel || r.lineItemId || "-",
      amount: r.amountCents / 100,
      status: r.complianceStatus,
    }),
    [grantNameById, lineItemLookup]
  );

  const EXPORT_COLUMNS = [
    { key: "source", label: "Source", value: (r: ExportRow) => r.source },
    { key: "card", label: "Card", value: (r: ExportRow) => r.card },
    { key: "date", label: "Date", value: (r: ExportRow) => r.date },
    { key: "title", label: "Title", value: (r: ExportRow) => r.title },
    { key: "grant", label: "Grant", value: (r: ExportRow) => r.grant },
    { key: "lineItem", label: "Line Item", value: (r: ExportRow) => r.lineItem },
    { key: "amount", label: "Amount", value: (r: ExportRow) => r.amount },
    { key: "status", label: "Status", value: (r: ExportRow) => r.status },
  ];

  const exportRows = React.useMemo<ExportRow[]>(
    () => filteredRows.map(toExportRow),
    [filteredRows, toExportRow]
  );

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const allPageSelected =
    pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r.id));

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of pagedRows) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of pagedRows) next.add(r.id);
        return next;
      });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const queryClient = useQueryClient();

  async function onAutoAssign() {
    try {
      await autoAssignMutation.mutateAsync({ month, apply: true, limit: 400, forceReclass: false });
      toast("Auto assign applied.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  }

  async function onRefreshEnrollments() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
      queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
    ]);
    toast("Enrollments refreshed.", { type: "success" });
  }

  async function onRefreshJotforms() {
    try {
      const result = await syncJotformSelection.mutateAsync({
        mode: "formIds",
        formIds: [LINE_ITEMS_FORM_IDS.creditCard, LINE_ITEMS_FORM_IDS.invoice],
        limit: 50,
        maxPages: 1,
        includeRaw: false,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.jotform.root }),
        queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
      ]);

      toast(`Jotforms refreshed (${Number(result?.count || 0)} recent submission${Number(result?.count || 0) === 1 ? "" : "s"} synced).`, {
        type: "success",
      });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  }

  async function onReconcileJotforms() {
    try {
      const result = await syncJotformSelection.mutateAsync({
        mode: "formIds",
        formIds: [LINE_ITEMS_FORM_IDS.creditCard, LINE_ITEMS_FORM_IDS.invoice],
        limit: 500,
        maxPages: 10,
        includeRaw: true,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.jotform.root }),
        queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
        queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
      ]);

      toast(`Jotforms reconciled (${Number(result?.count || 0)} submission${Number(result?.count || 0) === 1 ? "" : "s"} synced).`, {
        type: "success",
      });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  }

  function onExport() {
    downloadCsv(buildCsv(exportRows, EXPORT_COLUMNS), `spending-${fileSafeLabel(complexDateValueLabel(dateFilter))}`);
  }

  async function onBulkPost() {
    const selected = filteredRows.filter((r) => selectedIds.has(r.id));
    const alreadyClosed = selected.filter((r) => r.workflowState === "closed" || !r.paymentQueueItem);
    const postable = selected.filter(
      (r) => r.paymentQueueItem && r.workflowState === "open" && r.grantId && r.lineItemId
    );
    const unassigned = selected.filter(
      (r) => r.paymentQueueItem && r.workflowState === "open" && (!r.grantId || !r.lineItemId)
    );

    if (!postable.length) {
      const parts = [
        alreadyClosed.length ? `${alreadyClosed.length} already posted` : null,
        unassigned.length ? `${unassigned.length} missing grant/line item` : null,
      ].filter(Boolean).join(", ");
      toast(
        parts ? `Nothing to post — ${parts}.` : "No selected rows are ready to post — each needs a grant and line item assigned.",
        { type: "error" }
      );
      return;
    }

    setBulkPosting(true);
    let success = 0;
    let skipped = alreadyClosed.length;
    let failed = 0;
    let aborted = false;

    for (const row of postable) {
      try {
        await postMutation.mutateAsync({ id: row.paymentQueueItem!.id });
        success++;
      } catch (e: unknown) {
        const msg = String(toApiError(e).error || "").toLowerCase();
        // Auth failures trigger the global logout handler — abort the loop immediately
        // so we don't fire more requests into a broken auth state.
        if (msg.includes("session") || msg.includes("sign in") || msg.includes("unauthenticated") || msg.includes("expired")) {
          aborted = true;
          break;
        }
        // Item already posted on the server (stale UI state) — skip gracefully
        if (/already.post|already_exist|conflict|duplicate|posted/i.test(msg)) {
          skipped++;
        } else {
          failed++;
        }
      }
    }

    setBulkPosting(false);
    if (!aborted) setSelectedIds(new Set());

    if (aborted) {
      toast("Session error during bulk post — please refresh and try again.", { type: "error" });
      return;
    }

    const parts = [
      success > 0 ? `${success} posted` : null,
      skipped > 0 ? `${skipped} skipped (already posted)` : null,
      unassigned.length > 0 ? `${unassigned.length} skipped (no grant/line item)` : null,
      failed > 0 ? `${failed} failed` : null,
    ].filter(Boolean).join(", ");
    toast(parts || "Nothing posted.", { type: success > 0 ? "success" : "error" });
  }

  async function onBulkBypassClose() {
    const selected = filteredRows.filter((r) => selectedIds.has(r.id));
    const closable = selected.filter((r) =>
      isQueueTransactionRow(r) && r.paymentQueueItem && r.workflowState === "open"
    );
    if (!closable.length) {
      toast("No selected open credit-card or invoice queue rows can be bypass closed.", { type: "error" });
      return;
    }

    const totalCents = closable.reduce((sum, row) => sum + row.amountCents, 0);
    const creditCardCount = closable.filter((row) => row.kind === "queue-credit-card").length;
    const invoiceCount = closable.filter((row) => row.kind === "queue-invoice").length;
    const ignoredCount = selected.length - closable.length;
    const confirmed = window.confirm([
      `Bypass close ${closable.length} selected queue row${closable.length === 1 ? "" : "s"}?`,
      `Total amount: ${fmtCurrencyUSD(totalCents / 100)}`,
      `Sources: ${creditCardCount} credit card, ${invoiceCount} invoice`,
      ignoredCount > 0 ? `${ignoredCount} selected row${ignoredCount === 1 ? "" : "s"} will be ignored.` : "",
      "",
      "Warning: this marks the queue rows closed without creating ledger entries, assigning grants or line items, or adjusting budgets.",
    ].filter(Boolean).join("\n"));
    if (!confirmed) return;

    setBulkBypassClosing(true);
    try {
      const result = await bypassCloseMutation.mutateAsync({
        ids: closable.map((row) => row.paymentQueueItem!.id),
        reason: "Bypass closed from Spending tracker selected rows",
      });
      await queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root });
      setSelectedIds(new Set());
      const closed = Number(result?.closed?.length || 0);
      const skipped = Number(result?.skipped?.length || 0);
      toast(
        `${closed} bypass closed${skipped ? `, ${skipped} skipped` : ""}.`,
        { type: closed > 0 ? "success" : "error" }
      );
    } catch (e: unknown) {
      toast(toApiError(e, "Failed to bypass close selected rows.").error, { type: "error" });
    } finally {
      setBulkBypassClosing(false);
    }
  }

  function onBulkExport() {
    const rows = filteredRows.filter((r) => selectedIds.has(r.id)).map(toExportRow);
    downloadCsv(buildCsv(rows, EXPORT_COLUMNS), `spending-selected-${fileSafeLabel(complexDateValueLabel(dateFilter))}`);
  }

  const columnValues = React.useCallback(
    (col: string) => (part: string) => baseFilteredRows.map((row) => getSpendingColumnValue(row, col, part)),
    [baseFilteredRows, getSpendingColumnValue]
  );

  const renderSmartHeader = (col: keyof typeof SPENDING_TABLE_PARTS, label: React.ReactNode, defaultDir: "asc" | "desc" = "asc", align?: "right") => (
    <SmartFilterHeader
      key={col}
      label={label}
      col={col}
      sort={sort}
      onSort={onSort}
      setSortDir={setSortDir}
      defaultDir={defaultDir}
      align={align}
      parts={SPENDING_TABLE_PARTS[col]}
      filter={columnFilters[col]}
      onFilterChange={(next) => setColumnFilter(col, next)}
      values={columnValues(col)}
    />
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Views</span>
          {spendingViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className={[
                "btn btn-xs btn-ghost",
                spendingViewsSettings.defaultViewId === view.id ? "border-sky-200 bg-sky-50 text-sky-700" : "",
              ].join(" ")}
              onClick={() => applySpendingView(view)}
              title={spendingViewsSettings.defaultViewId === view.id ? "Default view" : undefined}
            >
              {view.name}
            </button>
          ))}
          <div className="ml-auto flex min-w-[260px] flex-wrap items-center justify-end gap-2">
            <input
              className="input input-xs w-[150px]"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.currentTarget.value)}
              placeholder="View name"
            />
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={savingViews}
              onClick={() => void saveCurrentSpendingView()}
            >
              Save View
            </button>
            <select
              className="input input-xs w-[150px]"
              value={spendingViewsSettings.defaultViewId || ""}
              disabled={savingViews}
              onChange={(e) => void setDefaultSpendingView(e.currentTarget.value)}
              title="Default spending view"
            >
              <option value="">No default</option>
              {spendingViews.map((view) => (
                <option key={view.id} value={view.id}>{view.name}</option>
              ))}
            </select>
            {(spendingViewsSettings.views || []).length > 0 ? (
              <select
                className="input input-xs w-[130px]"
                disabled={savingViews}
                value=""
                onChange={(e) => {
                  const viewId = e.currentTarget.value;
                  if (viewId) void deleteSavedSpendingView(viewId);
                }}
                title="Delete saved view"
              >
                <option value="">Delete...</option>
                {(spendingViewsSettings.views || []).map((view) => (
                  <option key={view.id} value={view.id}>{view.name}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>
      {/* ── Unified filter panel ──────────────────────────────────────────── */}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {/* Always-visible bar: month + toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <ComplexDateSelector value={dateFilter} onChange={setDateFilter} />
          <button
            type="button"
            className={["btn btn-sm btn-ghost gap-1", hasActiveFilters ? "border-sky-200 bg-sky-50 text-sky-700" : ""].join(" ")}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters {hasActiveFilters ? "●" : showFilters ? "▴" : "▾"}
          </button>
        </div>

        {/* Collapsible: filter controls + actions + results */}
        {showFilters && (
          <div className="space-y-3 border-t border-slate-100 pt-2">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id || "all"}
                    type="button"
                    onClick={() => setFilter({ typeFilter: opt.id, cardFilterId: "", cardBucketFilter: "" })}
                    className={[
                      "rounded-md px-3 py-1 text-xs font-semibold transition",
                      filterState.typeFilter === opt.id
                        ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {filterState.typeFilter !== "card" && (
                <GrantSelect
                  value={filterState.grantId || null}
                  onChange={(next) => setFilter({ grantId: String(next || "") })}
                  includeUnassigned
                  placeholderLabel="All grants"
                  className="w-[200px]"
                />
              )}

              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(["", "open", "closed"] as const).map((w) => (
                  <button
                    key={w || "all"}
                    type="button"
                    onClick={() => setFilter({ workflowFilter: w })}
                    className={[
                      "rounded-md px-3 py-1 text-xs font-semibold transition",
                      filterState.workflowFilter === w
                        ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {w === "" ? "All Status" : w === "open" ? "Open" : "Closed"}
                  </button>
                ))}
              </div>

              <input
                type="search"
                className="input input-sm w-[160px]"
                value={filterState.search}
                onChange={(e) => setFilter({ search: e.currentTarget.value })}
                placeholder="Search…"
              />

              <select
                className="input input-sm w-[160px]"
                value={filterState.customerId || ""}
                onChange={(e) => setFilter({ customerId: e.currentTarget.value })}
              >
                <option value="">All Customers</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="input input-sm w-[150px]"
                value={filterState.cmId || ""}
                onChange={(e) => setFilter({ cmId: e.currentTarget.value })}
              >
                <option value="">All CMs</option>
                {sortedUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.name}</option>
                ))}
              </select>

              <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={!!filterState.showReversals}
                  onChange={(e) => setFilter({ showReversals: e.currentTarget.checked })}
                />
                Show reversals
              </label>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setFilterState({ ...DEFAULT_SPENDING_FILTER, month, dateFilter }); setShowFilters(false); }}
              >
                Clear
              </button>
            </div>

            <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Advanced Filters</span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={addAdvancedQueueFilter}
                  disabled={advancedQueueFieldOptions.length === 0}
                >
                  Add field filter
                </button>
                <span className="text-[11px] text-slate-500">
                  {queueRowsForFieldDiscovery.length} loaded CC/invoice row{queueRowsForFieldDiscovery.length === 1 ? "" : "s"}
                </span>
              </div>

              {advancedQueueFilters.length > 0 ? (
                <div className="space-y-1.5">
                  {advancedQueueFilters.map((filter) => {
                    const selectedOption = advancedQueueFieldOptions.find((option) => option.key === filter.fieldKey);
                    return (
                      <div key={filter.id} className="grid gap-1 md:grid-cols-[minmax(220px,1fr)_120px_minmax(160px,240px)_auto] md:items-start">
                        <select
                          className="input input-xs w-full"
                          value={filter.fieldKey}
                          onChange={(e) => updateAdvancedQueueFilter(filter.id, { fieldKey: e.currentTarget.value })}
                        >
                          {advancedQueueFieldOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label} [{option.fieldId}]{option.samples.length ? ` - ${option.samples.join(" | ")}` : ""}
                            </option>
                          ))}
                        </select>
                        <select
                          className="input input-xs w-full"
                          value={filter.operator}
                          onChange={(e) => updateAdvancedQueueFilter(filter.id, { operator: e.currentTarget.value as AdvancedQueueFilterOperator })}
                        >
                          <option value="contains">contains</option>
                          <option value="equals">equals</option>
                          <option value="empty">is empty</option>
                        </select>
                        <input
                          className="input input-xs w-full"
                          value={filter.value}
                          disabled={filter.operator === "empty"}
                          onChange={(e) => updateAdvancedQueueFilter(filter.id, { value: e.currentTarget.value })}
                          placeholder={filter.operator === "empty" ? "" : "Value"}
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost text-slate-500"
                          onClick={() => removeAdvancedQueueFilter(filter.id)}
                        >
                          Remove
                        </button>
                        {selectedOption?.samples.length ? (
                          <div className="text-[10px] text-slate-500 md:col-span-4">
                            {selectedOption.key.startsWith("raw:") ? "Raw Jotform" : "Extracted"} field {selectedOption.fieldId}: {selectedOption.samples.join(" | ")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  Add filters to search loaded credit-card and invoice queue fields.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Actions</span>
              <ActionMenu
                disabled={syncJotformSelection.isPending}
                buttonLabel={syncJotformSelection.isPending ? "Refreshing..." : "Refresh"}
                buttonAriaLabel="Refresh options"
                items={[
                  {
                    key: "enrollments",
                    label: "Refresh Enrollments",
                    onSelect: () => void onRefreshEnrollments(),
                  },
                  {
                    key: "jotforms",
                    label: "Refresh Jotforms",
                    onSelect: () => void onRefreshJotforms(),
                  },
                  {
                    key: "jotforms-reconcile",
                    label: "Reconcile with Jotform",
                    onSelect: () => void onReconcileJotforms(),
                  },
                ]}
              />
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                disabled={autoAssignMutation.isPending}
                onClick={() => void onAutoAssign()}
              >
                {autoAssignMutation.isPending ? "Auto Assigning…" : "Auto Assign"}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                disabled={exportRows.length === 0}
                onClick={onExport}
              >
                Export CSV
              </button>
            </div>

            {/* Filter results */}
            <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Results</span>
              <span className="text-slate-600">
                {filteredRows.length} rows · <b>{fmtCurrencyUSD(stats.totalCents / 100)}</b>
              </span>
              {stats.openCount > 0 && (
                <span className="text-amber-700">{stats.openCount} open</span>
              )}
              {stats.unallocatedCount > 0 && (
                <span className="text-rose-700">{stats.unallocatedCount} unallocated</span>
              )}
              {stats.projectedCount > 0 && (
                <span className="text-violet-700">{stats.projectedCount} projected</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Grant budget strip (when grant filter is active) ──────────────── */}
      {filterState.grantId && <GrantBudgetStrip grantId={filterState.grantId} />}

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
          <span className="font-medium text-sky-800">{selectedIds.size} selected</span>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            disabled={bulkPosting || bulkBypassClosing}
            onClick={() => void onBulkPost()}
          >
            {bulkPosting ? "Posting…" : "Post to Ledger"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-amber-700"
            disabled={bulkPosting || bulkBypassClosing}
            onClick={() => void onBulkBypassClose()}
          >
            {bulkBypassClosing ? "Closing..." : "Bypass Close"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={onBulkExport}
          >
            Export Selected
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-slate-500"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Card mode: bucket pills + CC tiles ────────────────────────────── */}
      {typeFilter === "card" && (
        <div className="space-y-3">
          {/* Bucket filter pills — only if multiple buckets exist */}
          {availableBuckets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide mr-1">Bucket</span>
              <button
                type="button"
                className={`btn btn-xs ${!cardBucketFilter ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setFilterState({ ...filterState, cardBucketFilter: "" })}
              >
                All
              </button>
              {availableBuckets.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`btn btn-xs ${cardBucketFilter === b ? "btn-primary" : "btn-ghost"}`}
                  onClick={() =>
                    setFilterState({ ...filterState, cardBucketFilter: cardBucketFilter === b ? "" : b })
                  }
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* CC rows */}
          {creditCardSummaries.length > 0 ? (
            <div className="space-y-1.5">
              {creditCardSummaries
                .filter((card) => !cardBucketFilter || card.cardBuckets.has(cardBucketFilter))
                .map((card) => (
                  <CompactCardRow
                    key={card.id}
                    card={card}
                    active={cardFilterId === card.id}
                    onClick={() =>
                      setFilterState({
                        ...filterState,
                        cardFilterId: cardFilterId === card.id ? "" : card.id,
                      })
                    }
                  />
                ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              {loading ? "Loading card data…" : "No card activity for this month."}
            </div>
          )}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <ToolTable
        headers={[
          <input
            key="select-all"
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={allPageSelected}
            onChange={toggleAllPage}
            title="Select all on this page"
          />,
          renderSmartHeader("date", "Date / Type", "desc"),
          renderSmartHeader("customer", "Customer / CM"),
          renderSmartHeader("service", "Service"),
          renderSmartHeader("amount", "Amount", "desc", "right"),
          renderSmartHeader("vendor", "Vendor / Purchaser"),
          renderSmartHeader("status", "Status"),
        ]}
        rows={
          loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="w-8 px-2"><div className="h-3 w-3 rounded bg-slate-200" /></td>
                  <td className="py-2.5 px-3"><div className="h-3 w-16 rounded bg-slate-200" /><div className="mt-1 h-3 w-14 rounded bg-slate-100" /></td>
                  <td className="py-2.5 px-3"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                  <td className="py-2.5 px-3"><div className="h-3 w-32 rounded bg-slate-200" /></td>
                  <td className="py-2.5 px-3 text-right"><div className="ml-auto h-3 w-16 rounded bg-slate-200" /></td>
                  <td className="py-2.5 px-3"><div className="h-3 w-20 rounded bg-slate-200" /></td>
                  <td className="py-2.5 px-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                </tr>
              ))}
            </>
          ) : error ? (
            <tr><td colSpan={7} className="text-center py-4 text-rose-500">Failed to load spending rows.</td></tr>
          ) : filteredRows.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-4 text-slate-400">No rows for current filters.</td></tr>
          ) : (
            <>
              {pagedRows.map((r) => {
                const info = lineItemLookup.get(`${r.grantId}:${r.lineItemId}`);
                const isEnrollment = r.kind === "grant-ledger" || r.kind === "queue-projection";
                const isProjection = r.kind === "queue-projection";
                const customerName = customerNameById.get(r.customerId) || "";
                const grantName = info?.grantName || grantNameById.get(r.grantId) || "";
                const lineItemLabel = info?.lineItemLabel || "";
                const cardType = r.cardBucket
                  || (r.creditCardName ? r.creditCardName.split(" - ")[0].trim() : "")
                  || r.sourceLabel;
                const rawCmId = String(
                  (r.paymentQueueItem as Record<string, unknown> | undefined)?.caseManagerId
                  || (r.ledgerEntry as Record<string, unknown> | undefined)?.caseManagerId
                  || cmIdByCustomerId.get(r.customerId)
                  || ""
                );
                const cmName = rawCmId ? (userDisplayNameByUid.get(rawCmId) || "") : "";
                return (
                  <tr
                    key={r.id}
                    className={[
                      "cursor-pointer hover:bg-slate-50/80 transition-colors",
                      r.isReversal ? "opacity-60" : "",
                      selectedIds.has(r.id) ? "bg-sky-50/60" : "",
                    ].join(" ")}
                    onClick={() => { setModalRow(r); setModalOpen(true); }}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row: r }); }}
                  >
                    {/* Checkbox — td onClick handles toggle; onChange is no-op to avoid double-fire */}
                    <td
                      className="w-8 px-2"
                      onClick={(e) => { e.stopPropagation(); toggleRow(r.id); }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selectedIds.has(r.id)}
                        onChange={() => {}}
                      />
                    </td>
                    {/* Date · Type — compact combined column */}
                    <td className="w-28 min-w-[6rem]">
                      <div className="text-xs text-slate-500 whitespace-nowrap">{fmtDateOrDash(r.date)}</div>
                      <div className="mt-0.5">
                        {isEnrollment ? (
                          <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold w-fit ${isProjection ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}>
                            {isProjection ? "Projected" : "Enrollment"}
                          </span>
                        ) : r.kind === "queue-invoice" ? (
                          <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-sky-100 text-sky-700">Invoice</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 truncate max-w-[90px]">
                            {cardType || "Card"}
                          </span>
                        )}
                        {r.isReversal && (
                          <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-rose-100 text-rose-600 ml-1">Reversal</span>
                        )}
                      </div>
                    </td>

                    {/* Customer + CM/Purchaser */}
                    <td className="min-w-0">
                      <div className="font-medium text-slate-800 truncate max-w-[150px] text-sm">
                        {customerName || "—"}
                      </div>
                      {cmName ? (
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{cmName}</div>
                      ) : r.purchaser ? (
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{r.purchaser}</div>
                      ) : null}
                    </td>

                    {/* Service — grant + line item + expense type chips */}
                    <td className="min-w-0">
                      {grantName && (() => {
                        const colorKey =
                          grantColorById.get(`${r.grantId}:${r.lineItemId}`) ??
                          grantColorById.get(`${r.grantId}:`) ??
                          null;
                        const dotClass = colorKey ? (BUDGET_COLOR_DOT[colorKey] ?? "") : "";
                        return (
                          <div className="flex items-center gap-1.5 truncate">
                            {dotClass && (
                              <span className={`shrink-0 h-2 w-2 rounded-full ${dotClass}`} title={colorKey ?? ""} />
                            )}
                            <span className="text-sm font-medium text-slate-800 truncate max-w-[190px]">{grantName}</span>
                          </div>
                        );
                      })()}
                      {lineItemLabel && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{lineItemLabel}</div>
                      )}
                      {r.expenseType && (
                        <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-slate-100 text-slate-600 mt-0.5 truncate max-w-[160px]">
                          {r.expenseType}
                        </span>
                      )}
                      {!grantName && !lineItemLabel && !r.expenseType && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Amount — right aligned */}
                    <td className="text-right font-mono font-medium whitespace-nowrap w-24">
                      <span className={r.isReversal ? "text-rose-600" : ""}>
                        {fmtCurrencyUSD(r.amountCents / 100)}
                      </span>
                    </td>

                    {/* Vendor + Purchaser */}
                    <td className="min-w-0">
                      <div className="text-sm text-slate-700 truncate max-w-[140px]">{r.vendor || r.title || "—"}</div>
                      {r.purchaser && r.purchaser !== cmName && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{r.purchaser}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <RowStatusBadge row={r} />
                    </td>
                  </tr>
                );
              })}
              {/* Totals footer */}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
                <td colSpan={4} className="text-slate-600 text-xs px-3 py-2">
                  {filteredRows.length} rows{totalPages > 1 ? ` · page ${page}/${totalPages}` : ""}
                </td>
                <td className="text-right font-mono px-3 py-2">{fmtCurrencyUSD(stats.totalCents / 100)}</td>
                <td colSpan={2} />
              </tr>
            </>
          )
        }
      />

      {/* ── Pagination ────────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1 px-1">
          <span>
            {filteredRows.length} total · showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)}
          </span>
          <div className="flex items-center gap-1">
            <button className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="px-1">Page {page} of {totalPages}</span>
            <button className="btn btn-xs btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      {/* ── Spend Detail Modal ─────────────────────────────────────────────── */}
      <SpendDetailModal
        row={modalRow as any}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setTimeout(() => setModalRow(null), 200); }}
        grantNameById={grantNameById}
        lineItemLookup={lineItemLookup}
        customerNameById={customerNameById}
        cardBudget={modalRow?.creditCardId ? (cardBudgetById.get(modalRow.creditCardId) ?? null) : null}
        workflowTask={modalRow?.taskToken ? (openTaskByToken.get(modalRow.taskToken) ?? null) : null}
      />

      {/* ── Row context menu ──────────────────────────────────────────────── */}
      {contextMenu && (
        <RowContextMenu
          menu={contextMenu}
          acting={contextActing}
          onAction={(action) => void handleContextAction(action, contextMenu.row)}
        />
      )}
    </div>
  );
}
