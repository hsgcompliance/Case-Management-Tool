import React from "react";
import { toApiError } from "@client/api";
import GrantSelect from "@entities/selectors/GrantSelect";
import { useCreditCards } from "@hooks/useCreditCards";
import { useAutoAssignLedgerEntries, useLedgerEntries } from "@hooks/useLedger";
import {
  usePaymentQueueItems,
  type PaymentQueueItem,
} from "@hooks/usePaymentQueue";
import { useMyOtherTasks } from "@hooks/useTasks";
import { useUsers } from "@hooks/useUsers";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import type { CreditCardEntity } from "@types";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { useTableSort, SortableHeader, sortRows } from "@hooks/useTableSort";
import { monthKeyOffsetDays } from "../utils";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import { SpendDetailModal } from "./SpendDetailModal";
import type { CardBudget } from "./SpendDetailModal";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** typeFilter maps to row kinds:
 *  enrollment → grant-ledger + queue-projection
 *  card       → card-ledger + queue-credit-card
 *  invoice    → queue-invoice
 */
export type SpendingFilterState = {
  month: string;
  typeFilter: "" | "enrollment" | "card" | "invoice";
  workflowFilter: "" | "open" | "closed";
  grantId: string;
  cardFilterId: string;
  cardBucketFilter: string;
  search: string;
  showReversals: boolean;
  customerId: string;
  cmId: string;
};

export const DEFAULT_SPENDING_FILTER: SpendingFilterState = {
  month: monthKeyOffsetDays(5),
  typeFilter: "",
  workflowFilter: "",
  grantId: "",
  cardFilterId: "",
  cardBucketFilter: "",
  search: "",
  showReversals: false,
  customerId: "",
  cmId: "",
};

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

// ---------------------------------------------------------------------------
// Credit card tile
// ---------------------------------------------------------------------------

function CreditCardTile({
  card,
  active,
  onClick,
}: {
  card: CreditCardSummaryView;
  active: boolean;
  onClick: () => void;
}) {
  const usage = Math.max(0, Math.min(100, Math.round(card.usagePct)));
  const tone =
    usage >= 100
      ? "from-rose-500 to-orange-400"
      : usage >= 85
      ? "from-amber-400 to-orange-300"
      : "from-sky-500 to-cyan-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative overflow-hidden rounded-[26px] border bg-white p-0 text-left shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] transition",
        active
          ? "border-slate-900 ring-2 ring-slate-900/20"
          : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300",
      ].join(" ")}
    >
      <div className={`h-2 w-full bg-gradient-to-r ${tone}`} />
      <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Credit Card</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{card.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              {[card.code, card.last4 ? `**** ${card.last4}` : ""].filter(Boolean).join(" - ") || "Spend tracker"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Remaining</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              {fmtCurrencyUSD(card.remainingCents / 100)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Usage</span>
              <span>{usage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-3 rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${usage}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Spent</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{fmtCurrencyUSD(card.spentCents / 100)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Pending</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{fmtCurrencyUSD(card.pendingCents / 100)}</div>
            <div className="mt-1 text-xs text-slate-500">{card.openCount} open</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Limit</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{fmtCurrencyUSD(card.limitCents / 100)}</div>
            <div className="mt-1 text-xs text-slate-500">{card.rowCount} rows</div>
          </div>
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
  { id: "enrollment" as const, label: "Enrollment" },
  { id: "card" as const, label: "Card" },
  { id: "invoice" as const, label: "Invoice" },
] satisfies { id: SpendingFilterState["typeFilter"]; label: string }[];

export const SpendingTopbar: DashboardToolDefinition<SpendingFilterState, SpendingSelection>["ToolTopbar"] = ({
  value,
  onChange,
}) => {
  const [showMore, setShowMore] = React.useState(false);
  const { customers } = useDashboardSharedData();
  const { data: usersForFilter = [] } = useUsers({ limit: 300, status: "all" });

  const month = /^\d{4}-\d{2}$/.test(String(value?.month ?? "")) ? value.month : monthKeyOffsetDays(5);

  const setFilter = (patch: Partial<SpendingFilterState>) => onChange({ ...value, ...patch });

  const hasSecondaryFilters =
    !!value.workflowFilter || !!value.search || !!value.customerId || !!value.cmId || !!value.showReversals;

  // Sort customers by name for the dropdown
  const sortedCustomers = React.useMemo(() => {
    return [...(customers as Array<Record<string, unknown>>)]
      .map((c) => ({
        id: String(c?.id || ""),
        name: (String(c?.firstName || "").trim() + " " + String(c?.lastName || "").trim()).trim()
          || String(c?.displayName || c?.id || ""),
      }))
      .filter((c) => c.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  // Sort users for CM dropdown
  const sortedUsers = React.useMemo(() => {
    return (usersForFilter as Array<Record<string, unknown>>)
      .map((u) => ({
        uid: String(u?.uid || ""),
        name: String(u?.displayName || u?.email || u?.uid || ""),
      }))
      .filter((u) => u.uid)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usersForFilter]);

  return (
    <div className="w-full space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type tabs */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id || "all"}
              type="button"
              onClick={() =>
                setFilter({ typeFilter: opt.id, cardFilterId: "", cardBucketFilter: "" })
              }
              className={[
                "rounded-md px-3 py-1 text-xs font-semibold transition",
                value.typeFilter === opt.id
                  ? "bg-white border border-slate-200 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Grant select — not relevant in card-only mode */}
        {value.typeFilter !== "card" && (
          <GrantSelect
            value={value.grantId || null}
            onChange={(next) => setFilter({ grantId: String(next || "") })}
            includeUnassigned
            placeholderLabel="All grants"
            className="w-[200px]"
          />
        )}

        {/* Month with clear button */}
        <div className="flex items-center gap-0.5">
          <input
            type="month"
            className="input input-sm w-[130px]"
            value={month}
            onChange={(e) => setFilter({ month: e.currentTarget.value })}
          />
          {month && (
            <button
              type="button"
              className="btn btn-xs btn-ghost text-slate-400 hover:text-slate-600 px-1"
              title="Clear month filter (show all months)"
              onClick={() => setFilter({ month: "" })}
            >
              ✕
            </button>
          )}
        </div>

        {/* Secondary toggle */}
        <button
          type="button"
          className={[
            "btn btn-sm btn-ghost gap-1",
            hasSecondaryFilters ? "text-sky-700 border-sky-200 bg-sky-50" : "",
          ].join(" ")}
          onClick={() => setShowMore((v) => !v)}
        >
          Filters {hasSecondaryFilters ? "●" : "▾"}
        </button>
      </div>

      {/* Secondary row (expandable) */}
      {showMore && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          {/* Workflow toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["", "open", "closed"] as const).map((w) => (
              <button
                key={w || "all"}
                type="button"
                onClick={() => setFilter({ workflowFilter: w })}
                className={[
                  "rounded-md px-3 py-1 text-xs font-semibold transition",
                  value.workflowFilter === w
                    ? "bg-white border border-slate-200 text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {w === "" ? "All Status" : w === "open" ? "Open" : "Closed"}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="search"
            className="input input-sm w-[160px]"
            value={value.search}
            onChange={(e) => setFilter({ search: e.currentTarget.value })}
            placeholder="Search…"
          />

          {/* Customer filter */}
          <select
            className="input input-sm w-[160px]"
            value={value.customerId || ""}
            onChange={(e) => setFilter({ customerId: e.currentTarget.value })}
          >
            <option value="">All Customers</option>
            {sortedCustomers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* CM filter */}
          <select
            className="input input-sm w-[150px]"
            value={value.cmId || ""}
            onChange={(e) => setFilter({ cmId: e.currentTarget.value })}
          >
            <option value="">All CMs</option>
            {sortedUsers.map((u) => (
              <option key={u.uid} value={u.uid}>{u.name}</option>
            ))}
          </select>

          {/* Show reversals toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={!!value.showReversals}
              onChange={(e) => setFilter({ showReversals: e.currentTarget.checked })}
            />
            Show reversals
          </label>

          {/* Clear */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onChange({ ...DEFAULT_SPENDING_FILTER, month });
              setShowMore(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

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

type SpendingToolProps = {
  filterState?: SpendingFilterState;
  onFilterChange?: (next: SpendingFilterState) => void;
};

export function LineItemSpendingTool(props: SpendingToolProps = {}) {
  const { grants, enrollments, grantNameById, customerNameById, sharedDataLoading, sharedDataError } = useDashboardSharedData();
  const { sort, onSort } = useTableSort();

  const [localFilter, setLocalFilter] = React.useState<SpendingFilterState>(DEFAULT_SPENDING_FILTER);
  const filterState = props.filterState ?? localFilter;
  const setFilterState = props.onFilterChange ?? setLocalFilter;

  const { month, typeFilter, workflowFilter, cardFilterId, grantId, cardBucketFilter, search } = filterState;
  const [modalRow, setModalRow] = React.useState<SpendingRow | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

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

  // ── Mutations ────────────────────────────────────────────────────────────

  const autoAssignMutation = useAutoAssignLedgerEntries();

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
      const workflowState: SpendingWorkflowState = queueStatus === "posted" ? "closed" : "open";
      const isProjection = source === "projection";
      const queueVendor = String(queueItem.merchant || "").trim();
      const queueExpenseType = String((queueItem as any).expenseType || (queueItem as any).descriptor || "").trim();
      const queuePurchaser = String((queueItem as any).purchaser || "").trim();

      rows.push({
        id: `queue:${queueId}`,
        kind: source === "invoice" ? "queue-invoice" : isProjection ? "queue-projection" : "queue-credit-card",
        sourceLabel: source === "invoice" ? "Invoice" : isProjection ? "Enrollment" : "Card",
        title: merchant || queueId || "-",
        subtitle: submissionId || queueId,
        date,
        month: rowMonth,
        amountCents: Math.round(Math.max(0, Number(queueItem.amount || 0)) * 100),
        completed: workflowState === "closed",
        workflowState,
        workflowReason:
          workflowState === "closed"
            ? "Posted to ledger"
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
        isReversal: false,
        searchText: [merchant, queueVendor, queueExpenseType, queueItem.grantId, queueItem.lineItemId, queueItem.customerId].join(" ").toLowerCase(),
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
          (row) => row.creditCardId === String(card.id || "") && isCardRow(row.kind)
        );
        const spentCents = rowsForCard
          .filter((row) => row.kind === "card-ledger" || (row.kind === "queue-credit-card" && row.workflowState === "closed"))
          .reduce((sum, row) => sum + row.amountCents, 0);
        const pendingCents = rowsForCard
          .filter((row) => row.kind === "queue-credit-card" && row.workflowState === "open")
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
      const rowsForCard = allRows.filter((r) => r.creditCardId === cid && isCardRow(r.kind));
      const spentCents = rowsForCard
        .filter((r) => r.kind === "card-ledger" || (r.kind === "queue-credit-card" && r.workflowState === "closed"))
        .reduce((s, r) => s + r.amountCents, 0);
      const pendingCents = rowsForCard
        .filter((r) => r.kind === "queue-credit-card" && r.workflowState === "open")
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

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const { showReversals, customerId: filterCustomerId, cmId: filterCmId } = filterState;
    return allRows.filter((row) => {
      const typePass =
        !typeFilter ? true
        : typeFilter === "enrollment" ? (row.kind === "grant-ledger" || row.kind === "queue-projection")
        : typeFilter === "card" ? isCardRow(row.kind)
        : typeFilter === "invoice" ? row.kind === "queue-invoice"
        : true;
      const workflowPass =
        !workflowFilter ? true
        : workflowFilter === "open" ? row.workflowState === "open"
        : row.workflowState === "closed";
      const monthPass = !month || row.month === month || !row.month;
      const searchPass = !q || row.searchText.includes(q) || row.title.toLowerCase().includes(q);
      const cardPass = !cardFilterId || row.creditCardId === cardFilterId;
      const grantPass = !grantId || row.grantId === grantId;
      const bucketPass =
        !cardBucketFilter || !isCardRow(row.kind) || row.cardBucket === cardBucketFilter;
      const reversalPass = showReversals || !row.isReversal;
      const customerIdPass = !filterCustomerId || row.customerId === filterCustomerId;
      const rawRowCmId = String(
        (row.paymentQueueItem as Record<string, unknown> | undefined)?.caseManagerId
        || (row.ledgerEntry as Record<string, unknown> | undefined)?.caseManagerId
        || cmIdByCustomerId.get(row.customerId)
        || ""
      );
      const cmIdPass = !filterCmId || rawRowCmId === filterCmId;
      return typePass && workflowPass && monthPass && searchPass && cardPass && grantPass
        && bucketPass && reversalPass && customerIdPass && cmIdPass;
    });
  }, [allRows, cardBucketFilter, cardFilterId, month, search, typeFilter, workflowFilter, grantId, filterState, cmIdByCustomerId]);

  // ── Sort + Pagination ────────────────────────────────────────────────────

  const sortedRows = React.useMemo(
    () =>
      sortRows(filteredRows, sort, (row, col) => {
        if (col === "date") return row.date;
        if (col === "customer") return customerNameById.get(row.customerId) ?? "";
        if (col === "service") {
          const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
          return info?.grantName ?? grantNameById.get(row.grantId) ?? "";
        }
        if (col === "amount") return row.amountCents;
        if (col === "vendor") return row.vendor || row.title;
        if (col === "status") return row.complianceStatus;
        return null;
      }),
    [filteredRows, sort, customerNameById, lineItemLookup, grantNameById]
  );

  const PAGE_SIZE = 50;
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setPage(1); }, [filterState]);
  React.useEffect(() => { setPage(1); }, [sort]);
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
        if (isCardRow(row.kind) && !row.grantId) unallocatedCount++;
      }
      if (row.kind === "queue-projection" && row.workflowState === "open") projectedCount++;
    }
    return { totalCents, openCount, unallocatedCount, projectedCount };
  }, [filteredRows]);

  // ── Export ───────────────────────────────────────────────────────────────

  type ExportRow = { source: string; card: string; date: string; title: string; grant: string; lineItem: string; amount: number; status: string };
  const exportRows = React.useMemo<ExportRow[]>(
    () =>
      filteredRows.map((r) => ({
        source: r.sourceLabel,
        card: r.creditCardName || r.creditCardId || "-",
        date: r.date,
        title: r.title,
        grant: grantNameById.get(r.grantId) || r.grantId || "-",
        lineItem: lineItemLookup.get(`${r.grantId}:${r.lineItemId}`)?.lineItemLabel || r.lineItemId || "-",
        amount: r.amountCents / 100,
        status: r.complianceStatus,
      })),
    [filteredRows, grantNameById, lineItemLookup]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function onAutoAssign() {
    try {
      await autoAssignMutation.mutateAsync({ month, apply: true, limit: 400, forceReclass: false });
      toast("Auto assign applied.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ToolCard
      title="Spending"
      actions={
        <>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void onAutoAssign()}
            disabled={autoAssignMutation.isPending}
            title="Automatically match unclassified ledger entries to grants and line items based on existing patterns. Applies up to 400 entries for the selected month."
          >
            Auto Assign
          </button>
          <SmartExportButton
            allRows={exportRows}
            activeRows={exportRows}
            filenameBase={`spending-${month || "all"}`}
            buttonLabel="Export"
            columns={[
              { key: "source", label: "Source", value: (r: ExportRow) => r.source },
              { key: "card", label: "Card", value: (r: ExportRow) => r.card },
              { key: "date", label: "Date", value: (r: ExportRow) => r.date },
              { key: "title", label: "Title", value: (r: ExportRow) => r.title },
              { key: "grant", label: "Grant", value: (r: ExportRow) => r.grant },
              { key: "lineItem", label: "Line Item", value: (r: ExportRow) => r.lineItem },
              { key: "amount", label: "Amount", value: (r: ExportRow) => r.amount },
              { key: "status", label: "Status", value: (r: ExportRow) => r.status },
            ]}
          />
        </>
      }
    >
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded border border-slate-200 px-3 py-3 text-xs">
          <div className="text-slate-500">Total ({filteredRows.length} rows)</div>
          <div className="font-semibold text-base">{fmtCurrencyUSD(stats.totalCents / 100)}</div>
        </div>
        <div className="rounded border border-slate-200 px-3 py-3 text-xs">
          <div className="text-slate-500">Open</div>
          <div className={`font-semibold text-base ${stats.openCount > 0 ? "text-amber-700" : ""}`}>
            {stats.openCount} rows
          </div>
        </div>
        <div className="rounded border border-slate-200 px-3 py-3 text-xs">
          <div className="text-slate-500">Unallocated (card)</div>
          <div className={`font-semibold text-base ${stats.unallocatedCount > 0 ? "text-rose-700" : ""}`}>
            {stats.unallocatedCount} rows
          </div>
          <div className="text-slate-400 text-[10px]">Card rows with no grant</div>
        </div>
        <div className="rounded border border-slate-200 px-3 py-3 text-xs">
          <div className="text-slate-500">Projected Spend</div>
          <div className="font-semibold text-base">{stats.projectedCount} rows</div>
          <div className="text-slate-400 text-[10px]">Not yet paid</div>
        </div>
      </div>

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

          {/* CC tiles */}
          {creditCardSummaries.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {creditCardSummaries
                .filter((card) => !cardBucketFilter || card.cardBuckets.has(cardBucketFilter))
                .map((card) => (
                  <CreditCardTile
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
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              {loading ? "Loading card data…" : "No card activity for this month."}
            </div>
          )}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <ToolTable
        headers={[
          <SortableHeader key="date" label="Date · Type" col="date" sort={sort} onSort={onSort} defaultDir="desc" />,
          <SortableHeader key="customer" label="Customer / CM" col="customer" sort={sort} onSort={onSort} />,
          <SortableHeader key="service" label="Service" col="service" sort={sort} onSort={onSort} />,
          <SortableHeader key="amount" label="Amount" col="amount" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="vendor" label="Vendor / Purchaser" col="vendor" sort={sort} onSort={onSort} />,
          <SortableHeader key="status" label="Status" col="status" sort={sort} onSort={onSort} />,
        ]}
        rows={
          loading ? (
            <tr><td colSpan={6} className="text-center py-4 text-slate-400">Loading…</td></tr>
          ) : error ? (
            <tr><td colSpan={6} className="text-center py-4 text-rose-500">Failed to load spending rows.</td></tr>
          ) : filteredRows.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-4 text-slate-400">No rows for current filters.</td></tr>
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
                    ].join(" ")}
                    onClick={() => { setModalRow(r); setModalOpen(true); }}
                  >
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
                      {grantName && (
                        <div className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{grantName}</div>
                      )}
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
                <td colSpan={3} className="text-slate-600 text-xs px-3 py-2">
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
    </ToolCard>
  );
}
