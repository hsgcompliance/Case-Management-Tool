import React from "react";
import { toApiError } from "@client/api";
import UsersClient from "@client/users";
import { useAuth } from "@app/auth/AuthProvider";
import GrantSelect from "@entities/selectors/GrantSelect";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import { useCreditCards } from "@hooks/useCreditCards";
import { usePaymentsSpend, usePaymentsUpdateCompliance } from "@hooks/usePayments";
import { useAutoAssignLedgerEntries, useLedgerEntries } from "@hooks/useLedger";
import {
  usePaymentQueueItems,
  useBypassClosePaymentQueueItems,
  usePatchPaymentQueueItem,
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
import { useOrgConfig, useSaveOrgConfig, type OrgDisplayConfig, type SpendingPreset } from "@hooks/useOrgConfig";
import { isAdminLike } from "@lib/roles";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import ActionMenu from "@entities/ui/ActionMenu";
import { PageFilterBar } from "@entities/Page/PageFilterBar";
import { FilterToggleGroup } from "@entities/ui/FilterToggleGroup";
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
import { HelpButton } from "@entities/help/HelpButton";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { filterRows, SmartFilterHeader, sortRows, useTableColumnFilters, useTableSort, type TableColumnPart } from "@hooks/useTableSort";
import { monthKeyOffsetDays } from "../utils";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { SpendDetailModal } from "./SpendDetailModal";
import type { CardBudget } from "./SpendDetailModal";
import { LINE_ITEMS_FORM_IDS } from "@features/widgets/jotform/lineItemsFormMap";
import { buildNormalizedAnswerFields, jotformValueText } from "@features/widgets/jotform/jotformSubmissionView";
import { GRANT_ACCENT_COLORS, grantAccentSolid, grantAccentChip } from "@lib/colorRegistry";
import { buildQueueLedgerIndex, queueLedgerIssue } from "./spendingReconciliation";

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
  typeFilter: "",
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
  /** System preset set by an admin via the filter recorder — shown to all users. */
  isPreset?: boolean;
  /** Dynamically generated tab for an org-pinned grant — always visible, never stored. */
  isGrantPin?: boolean;
  updatedAt?: string;
  /** Accent color key: "slate"|"sky"|"emerald"|"amber"|"rose"|"violet"|"orange" */
  color?: string;
  description?: string;
};

type SpendingViewsSettings = {
  defaultViewId?: string;
  views?: SpendingSavedView[];
  /** IDs of built-in or user views the user has hidden from the strip. */
  hiddenViewIds?: string[];
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

// Last day of the month 3 months from today — used when a grant has no end date
function grantFallbackEndDate(): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

function builtInSpendingViews(): SpendingSavedView[] {
  const nextMonth = monthKeyOffsetDays(35);
  return [
    {
      id: "builtin-all-spending",
      name: "All Spending",
      filterState: cloneSpendingFilter(DEFAULT_SPENDING_FILTER),
      builtIn: true,
      description: "All spending types, current month",
    },
    {
      id: "builtin-cc-invoices",
      name: "CC + Invoices",
      filterState: spendingFilterPatch({ typeFilter: "forms" }),
      builtIn: true,
      description: "Credit card and invoice submissions",
    },
    {
      id: "builtin-all-open",
      name: "All Open",
      filterState: spendingFilterPatch({ workflowFilter: "open" }),
      builtIn: true,
      description: "All open / unreconciled items",
    },
    {
      id: "builtin-next-month-enrollments",
      name: "Next Month",
      filterState: spendingFilterPatch({
        typeFilter: "enrollment",
        month: nextMonth,
        dateFilter: { mode: "month", month: nextMonth },
      }),
      builtIn: true,
      description: "Projected enrollments for next month",
    },
    {
      id: "builtin-open-invoices",
      name: "Open Invoices",
      filterState: spendingFilterPatch({ typeFilter: "invoice", workflowFilter: "open" }),
      builtIn: true,
      description: "Open invoice queue items",
    },
    {
      id: "builtin-card-data-entry",
      name: "Card Data Entry",
      filterState: spendingFilterPatch({ typeFilter: "card", workflowFilter: "open" }),
      builtIn: true,
      description: "Credit card items awaiting data entry",
    },
    {
      id: "builtin-reconciled",
      name: "Reconciled",
      filterState: spendingFilterPatch({ workflowFilter: "closed" }),
      builtIn: true,
      description: "Posted / reconciled items",
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
  const VALID_COLORS = new Set(GRANT_ACCENT_COLORS);
  const color = typeof raw.color === "string" && VALID_COLORS.has(raw.color) ? raw.color : undefined;
  return {
    id,
    name,
    filterState: spendingFilterPatch(filterState),
    builtIn: false,
    isPreset: raw.isPreset === true,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    color,
    description: typeof raw.description === "string" ? raw.description : undefined,
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
  reconciliationIssue?: string;
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

function todayIso10() {
  return dateIso10(new Date().toISOString());
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

function queueCustomerDisplayName(row: SpendingRow, customerNameById: Map<string, string>) {
  const linked = row.customerId ? customerNameById.get(row.customerId) : "";
  if (linked) return linked;
  const queueItem = row.paymentQueueItem as Record<string, unknown> | undefined;
  return String(
    queueItem?.customer ||
    queueItem?.customerName ||
    queueItem?.customerId ||
    row.customerId ||
    ""
  ).trim();
}

function rowPaymentRef(row: SpendingRow): { enrollmentId: string; paymentId: string } {
  const queueItem = row.paymentQueueItem as Record<string, unknown> | undefined;
  const ledger = row.ledgerEntry as Record<string, unknown> | undefined;
  return {
    enrollmentId: String(queueItem?.enrollmentId || ledger?.enrollmentId || ""),
    paymentId: String(queueItem?.paymentId || ledger?.paymentId || ""),
  };
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

const TYPE_OPTIONS: { id: SpendingFilterState["typeFilter"]; label: string }[] = [
  { id: "", label: "All" },
  { id: "forms", label: "CC + Invoices" },
  { id: "enrollment", label: "Enrollment" },
  { id: "card", label: "Card" },
  { id: "invoice", label: "Invoice" },
];

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
} as Record<string, TableColumnPart[]>;

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

  if (row.reconciliationIssue) {
    return <span title={row.reconciliationIssue} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 max-w-[150px] truncate">Needs reconciliation</span>;
  }

  if (kind === "queue-projection") {
    if (workflowState !== "closed") return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">Projected</span>
    );
    if (complianceStatus === "Data Entry Complete") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Data Entry ✓</span>;
    }
    if (complianceStatus.startsWith("Posted;")) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 max-w-[140px] truncate">{complianceStatus}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Posted</span>;
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
type BulkActionOptions = {
  markPaid: boolean;
  hmisComplete: boolean;
  caseworthyComplete: boolean;
};

const DEFAULT_BULK_ACTIONS: BulkActionOptions = {
  markPaid: true,
  hmisComplete: false,
  caseworthyComplete: false,
};

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


// ---------------------------------------------------------------------------
// Filter Recorder — admin panel for inspecting + saving system-level presets
// ---------------------------------------------------------------------------

function FilterRecorder({
  filterState,
  orgConfig,
}: {
  filterState: SpendingFilterState;
  orgConfig: OrgDisplayConfig | undefined;
}) {
  const { profile } = useAuth();
  const isAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);
  const saveOrgConfig = useSaveOrgConfig();

  const [presetName, setPresetName] = React.useState("");
  const [presetDescription, setPresetDescription] = React.useState("");
  const [presetColor, setPresetColor] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const jsonStr = JSON.stringify(filterState, null, 2);

  const handleCopy = () => {
    void navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const existingPresets = orgConfig?.spendingPresets ?? [];

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) { toast("Name required.", { type: "error" }); return; }
    if (!orgConfig) { toast("Org config not loaded.", { type: "error" }); return; }
    const newPreset: SpendingPreset = {
      id: `preset-${Date.now()}`,
      name,
      description: presetDescription.trim() || undefined,
      color: presetColor || undefined,
      filterState: filterState as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      createdBy: (profile as Record<string, unknown>)?.id as string | undefined,
    };
    try {
      await saveOrgConfig.mutateAsync({ ...orgConfig, spendingPresets: [...existingPresets, newPreset] });
      toast(`Preset "${name}" saved.`, { type: "success" });
      setPresetName("");
      setPresetDescription("");
      setPresetColor("");
    } catch (e) {
      toast(toApiError(e, "Failed to save preset.").error, { type: "error" });
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!orgConfig) return;
    try {
      await saveOrgConfig.mutateAsync({
        ...orgConfig,
        spendingPresets: existingPresets.filter((p) => p.id !== id),
      });
      toast("Preset removed.", { type: "success" });
    } catch (e) {
      toast(toApiError(e, "Failed to remove preset.").error, { type: "error" });
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">Filter Recorder</div>
        {!isAdmin && <span className="text-xs text-amber-600">Read-only — admin required to save system presets</span>}
      </div>

      {/* Current filter state JSON */}
      <div className="relative">
        <pre className="overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 max-h-[200px] font-mono">
          {jsonStr}
        </pre>
        <button
          type="button"
          className="absolute right-2 top-2 btn btn-xs btn-ghost"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      {/* Existing system presets */}
      {existingPresets.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            System Presets ({existingPresets.length})
          </div>
          {existingPresets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              {preset.color && (
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${grantAccentSolid(preset.color)}`} />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{preset.name}</div>
                {preset.description && (
                  <div className="truncate text-xs text-slate-500">{preset.description}</div>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                  disabled={saveOrgConfig.isPending}
                  onClick={() => void handleDeletePreset(preset.id)}
                  title="Remove system preset"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save controls — admin only */}
      {isAdmin && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <div className="text-xs font-semibold text-amber-800">Save Current Filters as System Preset</div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input input-xs min-w-[150px] flex-1"
              value={presetName}
              onChange={(e) => setPresetName(e.currentTarget.value)}
              placeholder="Preset name (required)"
            />
            <input
              className="input input-xs min-w-[150px] flex-1"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.currentTarget.value)}
              placeholder="Description (optional)"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Color:</span>
            {(["", ...GRANT_ACCENT_COLORS] as string[]).map((c) => (
              <button
                key={c || "none"}
                type="button"
                onClick={() => setPresetColor(c)}
                className={[
                  "h-4 w-4 rounded-full border-2 transition",
                  presetColor === c ? "border-slate-600 scale-110" : "border-transparent hover:border-slate-400",
                  c ? grantAccentSolid(c) : "bg-white border border-slate-200",
                ].join(" ")}
                title={c || "No color"}
                aria-label={`Color: ${c || "none"}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={saveOrgConfig.isPending || !presetName.trim()}
            onClick={() => void handleSavePreset()}
          >
            {saveOrgConfig.isPending ? "Saving..." : "Save as System Preset"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewTab — renders one tab pill in the views strip.
// Defined at module scope so the bundler never gets a TDZ on it.
// ---------------------------------------------------------------------------

function ViewTab({
  view,
  active,
  isDefault,
  showDelete,
  savingViews,
  onApply,
  onDelete,
}: {
  view: SpendingSavedView;
  active: boolean;
  isDefault: boolean;
  showDelete?: boolean;
  savingViews: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) {
  const dotClass = view.color ? grantAccentSolid(view.color) : null;
  const activeClass = view.color && active ? grantAccentChip(view.color) : "";
  return (
    <span className="inline-flex overflow-hidden rounded border border-slate-200 bg-white">
      <button
        type="button"
        className={[
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold transition hover:bg-slate-50",
          isDefault ? "bg-sky-50 text-sky-700" : active ? activeClass || "bg-slate-100 text-slate-800" : "text-slate-600",
        ].join(" ")}
        onClick={onApply}
        title={view.description || view.name}
      >
        {dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />}
        {view.name}
      </button>
      {showDelete && onDelete && (
        <button
          type="button"
          className="border-l border-slate-200 px-1.5 text-xs text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          disabled={savingViews}
          onClick={onDelete}
          title="Delete saved view"
        >
          ×
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------

type SpendingToolProps = {
  filterState?: SpendingFilterState;
  onFilterChange?: (next: SpendingFilterState) => void;
};

export function LineItemSpendingTool(props: SpendingToolProps = {}) {
  const { profile, reloadProfile } = useAuth();
  const canSyncJotforms = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);
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



  const dateFilter = normalizeComplexDateValue(filterState.dateFilter, filterState.month);
  const month = complexDatePrimaryMonth(dateFilter);
  const { typeFilter, workflowFilter, cardFilterId, grantId, cardBucketFilter, search, advancedQueueFilters } = filterState;
  const [saveViewName, setSaveViewName] = React.useState("");
  const [saveViewColor, setSaveViewColor] = React.useState("");
  const [savingViews, setSavingViews] = React.useState(false);
  const [activeSpendingViewId, setActiveSpendingViewId] = React.useState("");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = React.useState(false);
  const [showFilterRecorder, setShowFilterRecorder] = React.useState(false);
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
    const hiddenViewIds = Array.isArray(raw?.hiddenViewIds)
      ? (raw.hiddenViewIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    return {
      defaultViewId: typeof raw?.defaultViewId === "string" ? raw.defaultViewId : undefined,
      views: saved,
      hiddenViewIds,
    };
  }, [profile]);

  const systemPresetViews = React.useMemo((): SpendingSavedView[] => {
    const rawPresets = orgConfig?.spendingPresets;
    if (!Array.isArray(rawPresets)) return [];
    return rawPresets
      .map((p) => {
        const raw = p as Record<string, unknown>;
        const id = String(raw.id || "").trim();
        const name = String(raw.name || "").trim();
        const fs = raw.filterState && typeof raw.filterState === "object"
          ? (raw.filterState as Partial<SpendingFilterState>)
          : null;
        if (!id || !name || !fs) return null;
        return sanitizeSavedSpendingView({ ...raw, isPreset: true }) as SpendingSavedView | null;
      })
      .filter((v): v is SpendingSavedView => !!v);
  }, [orgConfig?.spendingPresets]);

  const pinnedGrantViews = React.useMemo((): SpendingSavedView[] => {
    return (grants as Record<string, unknown>[])
      .flatMap((g) => {
        const pins = g?.pins as Record<string, unknown> | undefined;
        const digest = pins?.digest as Record<string, unknown> | undefined;
        const invoice = pins?.invoice as Record<string, unknown> | undefined;
        const grantId = String(g.id || "");
        if (!grantId) return [];
        const endDate = String(g.endDate || "").slice(0, 10);
        const effectiveEndDate = endDate || grantFallbackEndDate();
        const name = String(g.name || grantId);
        const views: SpendingSavedView[] = [];
        if (digest?.enabled) {
          views.push({
            id: `pinned-grant-${grantId}`,
            name,
            filterState: spendingFilterPatch({
              typeFilter: "enrollment",
              grantId,
              showReversals: true,
              dateFilter: { mode: "before" as const, date: effectiveEndDate },
            }),
            isGrantPin: true,
            color: "emerald",
            description: endDate ? `Enrollments through ${endDate}` : `Enrollments through ${effectiveEndDate}`,
          });
        }
        if (invoice?.enabled) {
          views.push({
            id: `pinned-invoice-${grantId}`,
            name: `${String(invoice.label || "Invoice")} - ${name}`,
            filterState: spendingFilterPatch({
              typeFilter: "invoice",
              workflowFilter: "open",
              grantId,
              dateFilter: { mode: "before" as const, date: effectiveEndDate },
            }),
            isGrantPin: true,
            color: "violet",
            description: endDate
              ? `Open invoices for this grant through ${endDate}`
              : `Open invoices for this grant through ${effectiveEndDate}`,
          });
        }
        return views;
      });
  }, [grants]);

  const spendingViews = React.useMemo(
    () => [...builtInSpendingViews(), ...systemPresetViews, ...(spendingViewsSettings.views || [])],
    [systemPresetViews, spendingViewsSettings.views]
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
    setActiveSpendingViewId(view.id);
    setSaveViewName(view.builtIn || view.isPreset ? "" : view.name);
    setSaveViewColor(view.color || "");
    setFilterState(cloneSpendingFilter(view.filterState));
  }, [setFilterState]);

  const saveCurrentSpendingView = React.useCallback(async () => {
    const currentViews = spendingViewsSettings.views || [];
    const activeUserView = currentViews.find((view) => view.id === activeSpendingViewId);
    const name = saveViewName.trim() || activeUserView?.name || "";
    if (!name) {
      toast("Name the view first.", { type: "error" });
      return;
    }
    const existingByName = currentViews.find((view) => view.name.toLowerCase() === name.toLowerCase());
    const targetId = activeUserView?.id || existingByName?.id || `user-${Date.now()}`;
    const view: SpendingSavedView = {
      id: targetId,
      name,
      filterState: cloneSpendingFilter(filterState),
      updatedAt: new Date().toISOString(),
      ...(saveViewColor ? { color: saveViewColor } : {}),
    };
    await writeSpendingViewsSettings({
      ...spendingViewsSettings,
      views: currentViews.some((existing) => existing.id === targetId)
        ? currentViews.map((existing) => existing.id === targetId ? view : existing)
        : [...currentViews, view],
    });
    setActiveSpendingViewId(targetId);
    setSaveViewName("");
    setSaveViewColor("");
    setSaveViewDialogOpen(false);
  }, [activeSpendingViewId, filterState, saveViewColor, saveViewName, spendingViewsSettings, writeSpendingViewsSettings]);

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
    if (activeSpendingViewId === viewId) {
      setActiveSpendingViewId("");
      setSaveViewName("");
      setSaveViewColor("");
    }
  }, [activeSpendingViewId, spendingViewsSettings, writeSpendingViewsSettings]);

  const defaultViewAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (defaultViewAppliedRef.current) return;
    const defaultViewId = spendingViewsSettings.defaultViewId;
    if (!defaultViewId) return;
    const hit = spendingViews.find((view) => view.id === defaultViewId);
    if (!hit) return;
    defaultViewAppliedRef.current = true;
    setActiveSpendingViewId(hit.id);
    setSaveViewName(hit.builtIn || hit.isPreset ? "" : hit.name);
    setSaveViewColor(hit.color || "");
    setFilterState(cloneSpendingFilter(hit.filterState));
  }, [setFilterState, spendingViews, spendingViewsSettings.defaultViewId]);

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: creditCards = [], isLoading: cardsLoading, isError: cardsError } = useCreditCards(
    { active: true, limit: 200 },
    { enabled: true, staleTime: 30_000 }
  );
  const { data: ledgerEntries = [], isError: ledgerError } = useLedgerEntries(
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

  // Queue data is the operational read model. Ledger enrichment is non-blocking:
  // the table can render and remain actionable while authoritative posting data loads.
  const loading = sharedDataLoading || cardsLoading || queueLoading || otherTasksLoading;
  const error = sharedDataError || cardsError || queueError || otherTasksError;

  // ── Selection ────────────────────────────────────────────────────────────

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkPosting, setBulkPosting] = React.useState(false);
  const [bulkBypassClosing, setBulkBypassClosing] = React.useState(false);
  const [bulkPostDialogOpen, setBulkPostDialogOpen] = React.useState(false);
  const [bulkPostGrantId, setBulkPostGrantId] = React.useState("");
  const [bulkPostLineItemId, setBulkPostLineItemId] = React.useState("");
  const [bulkActions, setBulkActions] = React.useState<BulkActionOptions>(DEFAULT_BULK_ACTIONS);
  React.useEffect(() => { setSelectedIds(new Set()); setBulkPostDialogOpen(false); }, [filterState]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const autoAssignMutation = useAutoAssignLedgerEntries();
  const bypassCloseMutation = useBypassClosePaymentQueueItems();
  const patchQueueMutation = usePatchPaymentQueueItem();
  const postMutation = usePostPaymentQueueToLedger();
  const spendMutation = usePaymentsSpend();
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
      const paymentId = String(
        (row.paymentQueueItem as Record<string, unknown> | undefined)?.paymentId ||
        ledger?.paymentId || ""
      );

      if (action === "invoice-submitted") {
        if (row.kind === "grant-ledger") {
          if (!enrollmentId || !paymentId) {
            toast("Cannot mark invoice — open the row for details.", { type: "error" });
            return;
          }
          await updateCompliance.mutateAsync({ enrollmentId, paymentId, patch: { status: "invoice-submitted" } });
          toast("Invoice submitted.", { type: "success" });
        } else if (row.kind === "queue-projection") {
          if (!enrollmentId || !paymentId) {
            toast("Cannot mark projected payment complete - missing enrollment/payment ID.", { type: "error" });
            return;
          }
          await spendMutation.mutateAsync({ body: { enrollmentId, paymentId, reverse: false } });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
            queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
          ]);
          toast("Marked complete.", { type: "success" });
        } else if (isQueueTransactionRow(row)) {
          if (!row.paymentQueueItem) { toast("No queue item to post.", { type: "error" }); return; }
          await postMutation.mutateAsync({ id: row.paymentQueueItem.id });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
            queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
          ]);
          toast("Invoice submitted.", { type: "success" });
        } else {
          toast("Open this row for completion details.", { type: "error" });
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
    const queue = paymentQueueItems as Array<Record<string, unknown>>;
    const reconciliation = buildQueueLedgerIndex(queue, ledger);

    for (const e of ledger) {
      const source = String(e?.source || "").toLowerCase();
      const isGrantPayment = source === "enrollment";
      const isCard = source === "card";
      if (!isGrantPayment && !isCard) continue;
      if (reconciliation.isLedgerRepresentedByQueue(e)) continue;

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
          ? "Ledger-only payment"
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
        purchaser: String(e?.purchaser || "").trim(),
        isReversal,
        searchText: [vendor, displayTitle, grantId, lineItemId, String(e?.customerId || "")].join(" ").toLowerCase(),
        ledgerEntry: e,
        reconciliationIssue: isGrantPayment ? "Reconciliation: ledger entry has no loaded queue item" : undefined,
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
      const linkedLedgers = reconciliation.ledgersForQueue(queueItem as Record<string, unknown>);
      const linkedLedger = reconciliation.primaryLedgerForQueue(queueItem as Record<string, unknown>);
      const postedLedger = queueStatus === "posted" ? linkedLedger : null;
      const amountCents = postedLedger
        ? toCents(postedLedger.amountCents, postedLedger.amount)
        : Math.round(Number(queueItem.amount || 0) * 100);
      const workflowState: SpendingWorkflowState = queueStatus === "posted" ? "closed" : "open";
      const bypassClosed = !!queueItem.closedBypassLedger;
      const isProjection = source === "projection";
      const queueVendor = String(queueItem.merchant || postedLedger?.vendor || "").trim();
      const queueExpenseType = String((queueItem as any).expenseType || (queueItem as any).descriptor || "").trim();
      const queuePurchaser = String((queueItem as any).purchaser || "").trim();
      const queueRawSearch = rawAnswerFields(queueItem).map((field) => `${field.label} ${field.key} ${field.value}`).join(" ");
      const ledgerCompliance = postedLedger?.compliance && typeof postedLedger.compliance === "object"
        ? postedLedger.compliance as Record<string, unknown>
        : {};
      const queueCompliance = (queueItem as any).compliance && typeof (queueItem as any).compliance === "object"
        ? (queueItem as any).compliance as Record<string, unknown>
        : {};
      const effectiveCompliance = { ...ledgerCompliance, ...queueCompliance };

      rows.push({
        id: `queue:${queueId}`,
        kind: source === "invoice" ? "queue-invoice" : isProjection ? "queue-projection" : "queue-credit-card",
        sourceLabel: source === "invoice" ? "Invoice" : isProjection ? "Enrollment" : "Card",
        title: merchant || queueId || "-",
        subtitle: submissionId || queueId,
        date: postedLedger ? dateIso10(postedLedger.dueDate || postedLedger.date || postedLedger.createdAt || date) : date,
        month: postedLedger ? monthFromDate(postedLedger.month || postedLedger.dueDate || date) : rowMonth,
        amountCents,
        completed: workflowState === "closed",
        workflowState,
        workflowReason:
          workflowState === "closed"
            ? bypassClosed ? "Closed without ledger" : "Posted to ledger"
            : isProjection
            ? "Projected spend, not yet paid"
            : "Waiting to post",
        grantId: String(postedLedger?.grantId || queueItem.grantId || ""),
        lineItemId: String(postedLedger?.lineItemId || queueItem.lineItemId || ""),
        customerId: String(postedLedger?.customerId || queueItem.customerId || ""),
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
        ledgerEntry: linkedLedger || undefined,
        reconciliationIssue: queueLedgerIssue(queueItem as Record<string, unknown>, linkedLedgers) || undefined,
        complianceStatus: isProjection
          ? complianceStatusLabel(effectiveCompliance, queueStatus === "posted")
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
  // Always scoped to the current calendar month regardless of the date filter,
  // so the strip never shows false overspend from multi-month ranges.
  const currentCalendarMonth = monthKeyOffsetDays(5);

  const creditCardSummaries = React.useMemo((): CreditCardSummaryView[] => {
    if (typeFilter !== "card") return [];
    return creditCardList
      .map((card) => {
        const rowsForCard = allRows.filter(
          (row) => row.creditCardId === String(card.id || "") && isCardBudgetRow(row) && row.month === currentCalendarMonth
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

  // Card budget map for modal (all cards, not just card-filter mode) — always current month
  const cardBudgetById = React.useMemo((): Map<string, CardBudget> => {
    const map = new Map<string, CardBudget>();
    for (const card of creditCardList) {
      const cid = String(card.id || "");
      if (!cid) continue;
      const rowsForCard = allRows.filter((r) => r.creditCardId === cid && isCardBudgetRow(r) && r.month === currentCalendarMonth);
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
      return queueCustomerDisplayName(row, customerNameById);
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

  const selectedRows = React.useMemo(
    () => filteredRows.filter((row) => selectedIds.has(row.id)),
    [filteredRows, selectedIds]
  );

  const selectedQueueTransactionRows = React.useMemo(
    () => selectedRows.filter((row) => isQueueTransactionRow(row) && row.paymentQueueItem && row.workflowState === "open"),
    [selectedRows]
  );

  const selectedOpenProjectionRows = React.useMemo(
    () => selectedRows.filter((row) => {
      const ref = rowPaymentRef(row);
      return row.kind === "queue-projection" && row.workflowState === "open" && !!ref.enrollmentId && !!ref.paymentId;
    }),
    [selectedRows]
  );

  const selectedComplianceRows = React.useMemo(
    () => selectedRows.filter((row) => {
      const ref = rowPaymentRef(row);
      return (row.kind === "grant-ledger" || row.kind === "queue-projection") && !!ref.enrollmentId && !!ref.paymentId;
    }),
    [selectedRows]
  );

  const selectedNonQueueTransactionCount = Math.max(0, selectedRows.length - selectedQueueTransactionRows.length);
  const selectedBulkEligibleCount =
    (bulkActions.markPaid ? selectedQueueTransactionRows.length + selectedOpenProjectionRows.length : 0) +
    (bulkActions.hmisComplete || bulkActions.caseworthyComplete ? selectedComplianceRows.length : 0);

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

  type ExportRow = {
    date: string; type: string; customer: string; caseManager: string;
    grant: string; lineItem: string; amount: string; vendor: string; status: string;
  };

  const toExportRow = React.useCallback(
    (r: SpendingRow): ExportRow => {
      const info = lineItemLookup.get(`${r.grantId}:${r.lineItemId}`);
      const rawCmId = String(
        (r.paymentQueueItem as Record<string, unknown> | undefined)?.caseManagerId
        || (r.ledgerEntry as Record<string, unknown> | undefined)?.caseManagerId
        || cmIdByCustomerId.get(r.customerId)
        || ""
      );
      const typeLabel = (() => {
        const isProjection = r.kind === "queue-projection";
        const isEnrollment = r.kind === "grant-ledger" || isProjection;
        const isInvoice = r.kind === "queue-invoice";
        let label = isProjection ? "Projected"
          : isEnrollment ? "Enrollment"
          : isInvoice ? "Invoice"
          : r.cardBucket || (r.creditCardName ? r.creditCardName.split(" - ")[0].trim() : "") || r.sourceLabel || "Card";
        if (r.isReversal) label += " (Reversal)";
        return label;
      })();
      const statusLabel = (() => {
        const { kind, workflowState, complianceStatus } = r;
        if (kind === "queue-projection") return workflowState === "closed" ? "Posted" : "Projected";
        if (kind === "grant-ledger") {
          if (complianceStatus === "Data Entry Complete") return "Data Entry ✓";
          if (complianceStatus.startsWith("Posted;")) return complianceStatus;
          return "Posted";
        }
        if (workflowState === "open") return "Data Entry";
        if (complianceStatus === "Data Entry Complete") return "Data Entry ✓";
        return "Posted";
      })();
      return {
        date: fmtDateOrDash(r.date),
        type: typeLabel,
        customer: queueCustomerDisplayName(r, customerNameById) || "-",
        caseManager: (rawCmId && userDisplayNameByUid.get(rawCmId)) || "-",
        grant: info?.grantName || grantNameById.get(r.grantId) || r.grantId || "-",
        lineItem: info?.lineItemLabel || r.lineItemId || "-",
        amount: fmtCurrencyUSD(r.amountCents / 100),
        vendor: r.vendor || r.purchaser || r.title || "-",
        status: statusLabel,
      };
    },
    [grantNameById, lineItemLookup, customerNameById, cmIdByCustomerId, userDisplayNameByUid]
  );

  const EXPORT_COLUMNS = [
    { key: "date", label: "Date", value: (r: ExportRow) => r.date },
    { key: "type", label: "Type", value: (r: ExportRow) => r.type },
    { key: "customer", label: "Customer", value: (r: ExportRow) => r.customer },
    { key: "caseManager", label: "Case Manager", value: (r: ExportRow) => r.caseManager },
    { key: "grant", label: "Grant", value: (r: ExportRow) => r.grant },
    { key: "lineItem", label: "Line Item", value: (r: ExportRow) => r.lineItem },
    { key: "amount", label: "Amount", value: (r: ExportRow) => r.amount },
    { key: "vendor", label: "Vendor / Purchaser", value: (r: ExportRow) => r.vendor },
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
    if (!canSyncJotforms) {
      toast("Admin access is required to sync Jotforms.", { type: "error" });
      return;
    }
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
    if (!canSyncJotforms) {
      toast("Admin access is required to sync Jotforms.", { type: "error" });
      return;
    }
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

  async function onBulkPost(overrideGrantId?: string, overrideLineItemId?: string, options: BulkActionOptions = bulkActions) {
    const selected = selectedRows;
    const alreadyClosed = selected.filter((r) => r.workflowState === "closed" || !r.paymentQueueItem);
    const postable = options.markPaid
      ? selected.filter((r) => isQueueTransactionRow(r) && r.paymentQueueItem && r.workflowState === "open")
      : [];
    const payableProjections = options.markPaid
      ? selected.filter((r) => {
          const ref = rowPaymentRef(r);
          return r.kind === "queue-projection" && r.workflowState === "open" && !!ref.enrollmentId && !!ref.paymentId;
        })
      : [];
    const compliancePatch: { hmisComplete?: boolean; caseworthyComplete?: boolean } = {
      ...(options.hmisComplete ? { hmisComplete: true } : {}),
      ...(options.caseworthyComplete ? { caseworthyComplete: true } : {}),
    };
    const shouldUpdateCompliance = Object.keys(compliancePatch).length > 0;
    const complianceRows = shouldUpdateCompliance
      ? selected.filter((r) => {
          const ref = rowPaymentRef(r);
          return (r.kind === "grant-ledger" || r.kind === "queue-projection") && !!ref.enrollmentId && !!ref.paymentId;
        })
      : [];
    const actionable = new Set([...postable, ...payableProjections, ...complianceRows].map((r) => r.id));
    const ignoredRows = selected.filter((r) => !actionable.has(r.id) && !alreadyClosed.includes(r));

    if (overrideGrantId && !overrideLineItemId) {
      toast("Select a budget for the chosen grant, or leave Grant as No Grant Classification.", { type: "error" });
      return;
    }

    if (!postable.length && !payableProjections.length && !complianceRows.length) {
      const parts = [
        alreadyClosed.length ? `${alreadyClosed.length} already closed/posted` : null,
        ignoredRows.length ? `${ignoredRows.length} row${ignoredRows.length === 1 ? "" : "s"} not eligible for the selected action` : null,
      ].filter(Boolean).join(", ");
      toast(
        parts ? `Nothing to update - ${parts}.` : "No selected rows are eligible for the selected bulk actions.",
        { type: "error" }
      );
      return;
    }

    setBulkPostDialogOpen(false);
    setBulkPosting(true);
    let success = 0;
    let markedPaid = 0;
    let complianceUpdated = 0;
    let skipped = options.markPaid ? alreadyClosed.length : 0;
    let skippedIncomplete = 0;
    let failed = 0;

    for (const row of postable) {
      try {
        if (overrideGrantId) {
          await patchQueueMutation.mutateAsync({
            id: row.paymentQueueItem!.id,
            body: {
              grantId: overrideGrantId,
              lineItemId: overrideLineItemId,
              okUnassigned: false,
            },
          });
        } else if (!row.grantId) {
          await patchQueueMutation.mutateAsync({
            id: row.paymentQueueItem!.id,
            body: {
              grantId: null,
              lineItemId: null,
              okUnassigned: true,
            },
          });
        } else if (!row.lineItemId) {
          skippedIncomplete++;
          continue;
        }
        await postMutation.mutateAsync({ id: row.paymentQueueItem!.id });
        success++;
      } catch (e: unknown) {
        const msg = String(toApiError(e).error || "").toLowerCase();
        if (/already.post|already_exist|conflict|duplicate|posted/i.test(msg)) {
          skipped++;
        } else {
          failed++;
        }
      }
    }

    for (const row of payableProjections) {
      try {
        const ref = rowPaymentRef(row);
        await spendMutation.mutateAsync({ body: { enrollmentId: ref.enrollmentId, paymentId: ref.paymentId, reverse: false } });
        markedPaid++;
      } catch {
        failed++;
      }
    }

    if (shouldUpdateCompliance) {
      const seen = new Set<string>();
      for (const row of complianceRows) {
        const ref = rowPaymentRef(row);
        const key = `${ref.enrollmentId}:${ref.paymentId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          await updateCompliance.mutateAsync({ enrollmentId: ref.enrollmentId, paymentId: ref.paymentId, patch: compliancePatch });
          complianceUpdated++;
        } catch {
          failed++;
        }
      }
    }

    setBulkPosting(false);
    setSelectedIds(new Set());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.paymentQueue.root }),
      queryClient.invalidateQueries({ queryKey: qk.ledger.root }),
      queryClient.invalidateQueries({ queryKey: qk.grants.root }),
      queryClient.invalidateQueries({ queryKey: qk.inbox.root }),
    ]);

    const parts = [
      success > 0 ? `${success} CC/invoice posted` : null,
      markedPaid > 0 ? `${markedPaid} enrollment payment${markedPaid === 1 ? "" : "s"} marked paid` : null,
      complianceUpdated > 0 ? `${complianceUpdated} compliance row${complianceUpdated === 1 ? "" : "s"} updated` : null,
      skipped > 0 ? `${skipped} skipped (already closed/posted)` : null,
      skippedIncomplete > 0 ? `${skippedIncomplete} skipped (grant needs budget)` : null,
      ignoredRows.length > 0 ? `${ignoredRows.length} ignored (not eligible)` : null,
      failed > 0 ? `${failed} failed` : null,
    ].filter(Boolean).join(", ");
    const didWork = success + markedPaid + complianceUpdated > 0;
    toast(parts || "Nothing updated.", { type: didWork ? "success" : "error" });
  }

  async function onBulkBypassClose() {
    const selected = selectedRows;
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

  // ── Saved view pre-computations ──────────────────────────────────────────

  const allBuiltIns = builtInSpendingViews();
  const hidden = new Set(spendingViewsSettings.hiddenViewIds ?? []);
  const visibleBuiltIns = allBuiltIns.filter((v) => !hidden.has(v.id));
  const visiblePresets = systemPresetViews.filter((v) => !hidden.has(v.id));
  const visibleUserViews = (spendingViewsSettings.views ?? []).filter((v) => !hidden.has(v.id));
  const activeView = spendingViews.find((view) => view.id === activeSpendingViewId);
  const activeUserView = (spendingViewsSettings.views ?? []).find((view) => view.id === activeSpendingViewId);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Invoicing</h2>
              <HelpButton pageKey="invoiceTool" />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Filter payment objects, review enrollment/card/invoice rows, and post finalized spend to the ledger.
            </p>
          </div>
          <a
            href="/tools/budget-map"
            className="shrink-0 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            title="Open Budget Pipelines to manage automatic grant and line-item assignment rules."
          >
            Budget Pipelines
          </a>
        </div>
        {ledgerError && (
          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Payment queue data is available, but ledger verification could not load. Posting remains available; reconciliation details may be incomplete.
          </div>
        )}
        {/* ── Saved view strip ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-1.5">

          {/* Visible built-in tabs */}
          {visibleBuiltIns.map((view) => (
            <ViewTab
              key={view.id}
              view={view}
              active={activeSpendingViewId === view.id}
              isDefault={spendingViewsSettings.defaultViewId === view.id}
              savingViews={savingViews}
              onApply={() => applySpendingView(view)}
            />
          ))}

          {/* Pinned grant tabs — always visible, never in library */}
          {pinnedGrantViews.length > 0 && (
            <>
              <span className="h-5 w-px self-center bg-slate-200" aria-hidden />
              <span className="self-center text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Grants</span>
              {pinnedGrantViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={[
                    "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold transition",
                    view.color === "violet"
                      ? activeSpendingViewId === view.id
                        ? "border-violet-200 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-700"
                      : activeSpendingViewId === view.id
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700",
                  ].join(" ")}
                  onClick={() => applySpendingView(view)}
                  title={view.description || view.name}
                >
                  <span className={["h-1.5 w-1.5 shrink-0 rounded-full", view.color === "violet" ? "bg-violet-500" : "bg-emerald-500"].join(" ")} />
                  {view.name}
                </button>
              ))}
            </>
          )}

          {/* Visible system preset tabs */}
          {visiblePresets.length > 0 && (
            <>
              <span className="h-5 w-px self-center bg-slate-200" aria-hidden />
              {visiblePresets.map((view) => (
                <ViewTab
                  key={view.id}
                  view={view}
                  active={activeSpendingViewId === view.id}
                  isDefault={spendingViewsSettings.defaultViewId === view.id}
                  savingViews={savingViews}
                  onApply={() => applySpendingView(view)}
                />
              ))}
            </>
          )}

          {/* Visible user-saved tabs */}
          {visibleUserViews.length > 0 && (
            <>
              <span className="h-5 w-px self-center bg-slate-200" aria-hidden />
              {visibleUserViews.map((view) => (
                <ViewTab
                  key={view.id}
                  view={view}
                  active={activeSpendingViewId === view.id}
                  isDefault={spendingViewsSettings.defaultViewId === view.id}
                  showDelete
                  savingViews={savingViews}
                  onApply={() => applySpendingView(view)}
                  onDelete={() => void deleteSavedSpendingView(view.id)}
                />
              ))}
            </>
          )}

          <div className="ml-auto">
            <ActionMenu
              disabled={savingViews}
              buttonAriaLabel="Spending view actions"
              buttonTitle="Spending view actions"
              items={[
                {
                  key: "save-filter-view",
                  label: "Save Filter View",
                  onSelect: () => {
                    setSaveViewName((name) => name || activeUserView?.name || "");
                    setSaveViewColor((color) => color || activeView?.color || "");
                    setSaveViewDialogOpen(true);
                  },
                },
                {
                  key: "set-default",
                  label: "Set Active View as Default",
                  disabled: !activeView,
                  onSelect: () => activeView ? void setDefaultSpendingView(activeView.id) : undefined,
                },
                {
                  key: "recorder",
                  label: showFilterRecorder ? "Close Recorder" : "Open Recorder",
                  onSelect: () => setShowFilterRecorder((v) => !v),
                },
                {
                  key: "show-all-tabs",
                  label: "Show All View Tabs",
                  disabled: !(spendingViewsSettings.hiddenViewIds ?? []).length,
                  onSelect: () => void writeSpendingViewsSettings({ ...spendingViewsSettings, hiddenViewIds: [] }),
                },
                {
                  key: "delete-view",
                  label: "Delete Active Saved View",
                  disabled: !activeUserView,
                  danger: true,
                  onSelect: () => activeUserView ? void deleteSavedSpendingView(activeUserView.id) : undefined,
                },
              ]}
            />
          </div>
        </div>

        {/* ── Filter Recorder ───────────────────────────────────────────── */}
        {saveViewDialogOpen && (
          <div className="ml-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">Save Filter View</div>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => setSaveViewDialogOpen(false)}
                aria-label="Close save filter view dialog"
              >
                x
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="input input-sm w-full"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.currentTarget.value)}
                placeholder="View name"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Color</span>
                {(["", ...GRANT_ACCENT_COLORS] as string[]).map((c) => (
                  <button
                    key={c || "none"}
                    type="button"
                    onClick={() => setSaveViewColor(c)}
                    className={[
                      "h-5 w-5 rounded-full border-2 transition",
                      saveViewColor === c ? "border-slate-700 scale-110" : "border-transparent hover:border-slate-400",
                      c ? grantAccentSolid(c) : "bg-white border border-slate-200",
                    ].join(" ")}
                    title={c || "No color"}
                    aria-label={`Color: ${c || "none"}`}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSaveViewDialogOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={savingViews || !saveViewName.trim()}
                  onClick={() => void saveCurrentSpendingView()}
                >
                  {savingViews ? "Saving..." : "Save View"}
                </button>
              </div>
            </div>
          </div>
        )}
        {showFilterRecorder && <FilterRecorder filterState={filterState} orgConfig={orgConfig} />}
      </div>
      {/* ── Unified filter panel ──────────────────────────────────────────── */}
      <PageFilterBar
        search={filterState.search}
        onSearchChange={(v) => setFilter({ search: v })}
        searchPlaceholder="Search spending…"
        resultLabel={
          `${filteredRows.length} rows · ${fmtCurrencyUSD(stats.totalCents / 100)}` +
          (stats.openCount > 0 ? ` · ${stats.openCount} open` : "") +
          (stats.unallocatedCount > 0 ? ` · ${stats.unallocatedCount} unallocated` : "") +
          (stats.projectedCount > 0 ? ` · ${stats.projectedCount} projected` : "")
        }
        actions={
          <button
            type="button"
            className="btn btn-sm rounded-lg"
            onClick={() => setFilterState({ ...DEFAULT_SPENDING_FILTER, month, dateFilter })}
          >
            Clear
          </button>
        }
      >
        <div className="flex flex-wrap gap-4">
          {/* Date */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Date</div>
            <div className="flex items-center gap-1">
              <ComplexDateSelector value={dateFilter} onChange={setDateFilter} />
              <button
                type="button"
                className="btn btn-sm btn-ghost h-8 w-8 px-0 text-slate-500"
                onClick={() => setDateFilter({ mode: "before", date: todayIso10() })}
                title="Switch date filter to before today."
                aria-label="Use before today date filter"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Type */}
          <FilterToggleGroup
            label="Type"
            value={filterState.typeFilter}
            options={TYPE_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
            onChange={(v) => setFilter({ typeFilter: v, cardFilterId: "", cardBucketFilter: "" })}
          />

          {/* Status */}
          <FilterToggleGroup
            label="Status"
            value={filterState.workflowFilter}
            options={[
              { value: "" as const, label: "All" },
              { value: "open" as const, label: "Open" },
              { value: "closed" as const, label: "Closed" },
            ]}
            onChange={(v) => setFilter({ workflowFilter: v })}
          />

          {/* Grant */}
          {filterState.typeFilter !== "card" && (
            <div className="min-w-[200px] space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Grant</div>
              <GrantSelect
                value={filterState.grantId || null}
                onChange={(next) => setFilter({ grantId: String(next || "") })}
                includeUnassigned
                mode="grant"
                placeholderLabel="All grants"
                className="w-[200px]"
              />
            </div>
          )}

          {/* Customer */}
          <div className="min-w-[160px] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Customer</div>
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
          </div>

          {/* Case Manager */}
          <div className="min-w-[150px] space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Case Manager</div>
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
          </div>

          {/* Options */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Options</div>
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={!!filterState.showReversals}
                onChange={(e) => setFilter({ showReversals: e.currentTarget.checked })}
              />
              Show reversals
            </label>
          </div>

          {/* Advanced Filters */}
          <div className="w-full space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
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
              buttonTitle="Pull latest data from Jotform or refresh enrollment/payment queue data. 'Refresh Jotforms' syncs recent submissions; 'Reconcile' does a full deep sync."
              items={[
                {
                  key: "enrollments",
                  label: "Refresh Enrollments",
                  onSelect: () => void onRefreshEnrollments(),
                },
                {
                  key: "jotforms",
                  label: "Refresh Jotforms",
                  disabled: !canSyncJotforms,
                  onSelect: () => void onRefreshJotforms(),
                },
                {
                  key: "jotforms-reconcile",
                  label: "Reconcile with Jotform",
                  disabled: !canSyncJotforms,
                  onSelect: () => void onReconcileJotforms(),
                },
              ]}
            />
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              disabled={autoAssignMutation.isPending}
              onClick={() => void onAutoAssign()}
              title="Automatically match unallocated card ledger entries to grants and line items based on saved card matching rules."
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
        </div>
      </PageFilterBar>

      {/* ── Grant budget strip (when grant filter is active) ──────────────── */}
      {filterState.grantId && <GrantBudgetStrip grantId={filterState.grantId} />}

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
          <span className="font-medium text-sky-800">{selectedIds.size} selected</span>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            disabled={bulkPosting || bulkBypassClosing || selectedRows.length === 0}
            onClick={() => setBulkPostDialogOpen((v) => !v)}
          >
            {bulkPosting ? "Updating..." : "Bulk Actions"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-amber-700"
            disabled={bulkPosting || bulkBypassClosing || selectedQueueTransactionRows.length === 0}
            onClick={() => void onBulkBypassClose()}
            title="Mark selected queue rows as closed without creating ledger entries or adjusting grant budgets. Use when an item was handled outside the system."
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
            onClick={() => { setSelectedIds(new Set()); setBulkPostDialogOpen(false); }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Bulk post dialog ─────────────────────────────────────────────── */}
      {bulkPostDialogOpen && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4" onClick={() => setBulkPostDialogOpen(false)}>
          <div className="w-full max-w-2xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">
              Bulk Actions
              <div className="mt-0.5 text-xs font-normal text-slate-500">
                {selectedRows.length} selected - {selectedQueueTransactionRows.length} CC/invoice - {selectedOpenProjectionRows.length} open enrollment - {selectedComplianceRows.length} compliance-capable
              </div>
            </div>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setBulkPostDialogOpen(false)}>x</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ["markPaid", "Mark Paid", `${selectedQueueTransactionRows.length + selectedOpenProjectionRows.length} eligible`],
              ["hmisComplete", "HMIS Complete", `${selectedComplianceRows.length} eligible`],
              ["caseworthyComplete", "CW Complete", `${selectedComplianceRows.length} eligible`],
            ] as const).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
                <span>
                  <span className="block font-semibold text-slate-800">{label}</span>
                  <span className="text-slate-500">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={bulkActions[key]}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setBulkActions((prev) => ({ ...prev, [key]: checked }));
                  }}
                />
              </label>
            ))}
          </div>
          {selectedQueueTransactionRows.length > 0 && bulkActions.markPaid ? (
            <>
              <p className="text-xs text-slate-500">
                Assign grant only applies to selected credit-card and invoice queue rows. Leave blank to mark them as No Grant Classification.
              </p>
              {selectedNonQueueTransactionCount > 0 && (
                <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {selectedNonQueueTransactionCount} selected row{selectedNonQueueTransactionCount === 1 ? "" : "s"} will be ignored because bulk grant assignment only applies to CC/invoice queue rows.
                </p>
              )}
              <GrantSelect
                value={bulkPostGrantId || null}
                onChange={(v) => { setBulkPostGrantId(String(v || "")); setBulkPostLineItemId(""); }}
                includeUnassigned
                mode="grant"
                placeholderLabel="No Grant Classification"
              />
              {bulkPostGrantId && (
                <>
                  <GrantBudgetStrip grantId={bulkPostGrantId} />
                  <LineItemSelect
                    grantId={bulkPostGrantId}
                    value={bulkPostLineItemId || null}
                    onChange={(v) => setBulkPostLineItemId(String(v || ""))}
                    inputClassName="w-full"
                  />
                </>
              )}
            </>
          ) : null}
          <div className="max-h-64 overflow-y-auto rounded border border-slate-200">
            {selectedRows.map((row) => {
              const isForm = isQueueTransactionRow(row);
              const isOpenProjection = row.kind === "queue-projection" && row.workflowState === "open";
              const canCompliance = selectedComplianceRows.includes(row);
              const customerName = queueCustomerDisplayName(row, customerNameById);
              const typeLabel = row.kind === "queue-invoice" ? "Invoice"
                : row.kind === "queue-credit-card" ? "Credit Card"
                : row.kind === "queue-projection" ? "Enrollment"
                : row.kind === "grant-ledger" ? "Posted Enrollment"
                : "Card Ledger";
              const actions = [
                bulkActions.markPaid && isForm && row.workflowState === "open" ? "post" : null,
                bulkActions.markPaid && isOpenProjection ? "mark paid" : null,
                (bulkActions.hmisComplete || bulkActions.caseworthyComplete) && canCompliance
                  ? [bulkActions.hmisComplete ? "HMIS" : null, bulkActions.caseworthyComplete ? "CW" : null].filter(Boolean).join("+")
                  : null,
              ].filter(Boolean).join(", ");
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{customerName || row.title || row.subtitle}</div>
                    <div className="truncate text-slate-500">{typeLabel} - {fmtCurrencyUSD(row.amountCents / 100)} - {row.vendor || row.title || "-"}</div>
                  </div>
                  <div className={actions ? "text-sky-700" : "text-slate-400"}>{actions || "not applicable"}</div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBulkPostDialogOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={
                bulkPosting ||
                (!bulkActions.markPaid && !bulkActions.hmisComplete && !bulkActions.caseworthyComplete) ||
                (!!bulkPostGrantId && !bulkPostLineItemId) ||
                selectedBulkEligibleCount === 0
              }
              onClick={() => void onBulkPost(bulkPostGrantId || undefined, bulkPostLineItemId || undefined, bulkActions)}
            >
              {bulkPosting ? "Updating..." : "Apply"}
            </button>
          </div>
          </div>
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
                const customerName = queueCustomerDisplayName(r, customerNameById);
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
                        const dotClass = colorKey ? grantAccentSolid(colorKey) : "";
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
                      <div className="text-sm text-slate-700 truncate max-w-[140px]">{r.vendor || "—"}</div>
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
