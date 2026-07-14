import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { useCmActivitiesFeed, type ActivityFeedFilters } from "@/hooks/useCmActivitiesFeed";
import { useArchiveActivity } from "@/hooks/useArchiveActivity";
import { useOutboxAutoFlush } from "@/hooks/useOutboxAutoFlush";
import { useCustomer, getWorkbookLink } from "@/hooks/useCustomers";
import { useSessionSync } from "@/hooks/useSessionSync";
import { SyncChip, SyncButton } from "@/components/SyncControls";
import { DATE_RANGE_CHIPS, type DateRangeKey } from "@/lib/dateRange";
import type { TCmActivity, TCmActivityType } from "@hdb/contracts";

// ─── Activity Detail Bottom Sheet ─────────────────────────────────────────────

function fmtDateLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

/**
 * Workbook sync status + later-sync action inside the detail sheet. The feed
 * spans customers, so the linked-workbook check is done here (one customer) —
 * not per row. Sync is restricted to the workbook push; the backend dedupes
 * appended progress notes by date + time, so a re-push can't double-write.
 */
function WorkbookSyncSection({ activity, user }: { activity: TCmActivity; user: User | null }) {
  const { data: customer, isLoading } = useCustomer(activity.customerId);
  const customerHasWorkbook = customer ? !!getWorkbookLink(customer) : false;
  const sync = useSessionSync(user, { customerHasWorkbook });
  const [pushed, setPushed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const synced = activity.workbookSynced === true || pushed;
  const syncing = sync.isSyncing(activity.id);

  async function handleSync() {
    setError(null);
    try {
      const result = await sync.syncOne(activity, { only: { calendar: false } });
      if (result.workbook === "ok") {
        setPushed(true);
      } else if (result.workbook === "not_connected") {
        setError("Connect Google Drive in Settings to push notes to the workbook.");
      } else if (result.workbook === "not_linked") {
        setError("No workbook is linked to this customer.");
      } else if (result.errors.length) {
        setError(result.errors.join(" "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed — please try again.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">📓</span>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex-1">Workbook</p>
        <SyncChip kind={syncing ? "syncing" : synced ? "synced" : "notsynced"} />
      </div>
      {!synced && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 flex-1">
            {isLoading
              ? "Checking for a linked workbook…"
              : !customerHasWorkbook
                ? "No workbook linked to this customer."
                : !sync.driveConnected
                  ? "Connect Google Drive in Settings to sync."
                  : "This session hasn't been pushed as a progress note yet."}
          </p>
          {customerHasWorkbook && sync.driveConnected && (
            <SyncButton onClick={() => void handleSync()} busy={syncing} label="Sync now" />
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ActivityDetailSheet({ activity, user, onClose, onCustomerClick }: {
  activity: TCmActivity;
  user: User | null;
  onClose: () => void;
  onCustomerClick: (id: string, name: string) => void;
}) {
  const typeColor = TYPE_COLORS[activity.type] ?? "bg-slate-100 text-slate-600";
  const typeLabel = TYPE_LABELS[activity.type] ?? activity.type;
  const startFmt = fmtTime(activity.startTime);
  const endFmt = fmtTime(activity.endTime);
  const timeStr = startFmt ? (endFmt ? `${startFmt} – ${endFmt}` : startFmt) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pt-2 pb-6">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColor}`}>
                {typeLabel}
              </span>
              {activity.customerName && (
                <button
                  type="button"
                  onClick={() => { onClose(); onCustomerClick(activity.customerId, activity.customerName!); }}
                  className="block mt-2 text-lg font-bold text-slate-900 text-left hover:text-indigo-600 transition-colors"
                >
                  {activity.customerName}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <DetailRow label="Date" value={fmtDateLong(activity.date)} />
            {timeStr && <DetailRow label="Time" value={timeStr} />}
            {activity.caseManagerName && (
              <DetailRow label="Logged by" value={activity.caseManagerName} />
            )}
            {activity.note && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Case Note</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{activity.note}</p>
              </div>
            )}
            {!activity.note && (
              <p className="text-sm text-slate-400 italic">No case note recorded</p>
            )}
          </div>

          {/* Workbook sync status + later sync */}
          <WorkbookSyncSection activity={activity} user={user} />

          {/* Go to customer */}
          {activity.customerName && (
            <button
              type="button"
              onClick={() => { onClose(); onCustomerClick(activity.customerId, activity.customerName!); }}
              className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 active:bg-slate-50 transition-colors"
            >
              View {activity.customerName}'s profile
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type SyncFilterKey = "all" | "synced" | "unsynced";

const SYNC_OPTIONS: { value: SyncFilterKey; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "synced",   label: "Synced" },
  { value: "unsynced", label: "Not synced" },
];

const TYPE_OPTIONS: { value: TCmActivityType | "all"; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "in-person",   label: "In Person" },
  { value: "phone",       label: "Phone" },
  { value: "data-entry",  label: "Data Entry" },
  { value: "other",       label: "On Behalf of" },
];

const TYPE_COLORS: Record<TCmActivityType, string> = {
  "in-person":  "bg-green-100 text-green-700",
  "phone":      "bg-blue-100 text-blue-700",
  "data-entry": "bg-purple-100 text-purple-700",
  "other":      "bg-slate-100 text-slate-600",
};

const TYPE_LABELS: Record<TCmActivityType, string> = {
  "in-person":  "In Person",
  "phone":      "Phone",
  "data-entry": "Data Entry",
  "other":      "On Behalf of",
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Components ──────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72;
const SWIPE_MAX = 96;

function SwipeableActivityRow({ activity, onTap, onArchive }: {
  activity: TCmActivity;
  onTap: () => void;
  onArchive: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [committed, setCommitted] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHoriz = useRef<boolean | null>(null);

  const typeColor = TYPE_COLORS[activity.type] ?? "bg-slate-100 text-slate-600";
  const typeLabel = TYPE_LABELS[activity.type] ?? activity.type;
  const startFmt = fmtTime(activity.startTime);
  const endFmt = fmtTime(activity.endTime);
  const timeStr = startFmt ? (endFmt ? `${startFmt} – ${endFmt}` : startFmt) : null;

  const actionVisible = offsetX < -SWIPE_THRESHOLD / 2;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHoriz.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock axis on first significant movement
    if (isHoriz.current === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isHoriz.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHoriz.current) return;
    e.preventDefault(); // prevent scroll while swiping horizontally
    if (dx < 0) setOffsetX(Math.max(dx, -SWIPE_MAX));
  }

  function onTouchEnd() {
    if (offsetX < -SWIPE_THRESHOLD) {
      setCommitted(true);
      setTimeout(onArchive, 250); // let exit animation finish
    } else {
      setOffsetX(0);
    }
    startX.current = null;
    startY.current = null;
    isHoriz.current = null;
  }

  if (committed) {
    return (
      <div className="overflow-hidden transition-all duration-300 max-h-0 opacity-0" />
    );
  }

  const isSnapping = startX.current === null;

  return (
    <div className="relative overflow-hidden border-b border-slate-100 last:border-0 bg-white">
      {/* Swipe action revealed behind */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-center w-24 bg-red-500 transition-opacity duration-150 ${actionVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25v6M14 11.25v6M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.375c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <span className="text-[10px] font-semibold text-white">Archive</span>
        </div>
      </div>

      {/* Row content */}
      <button
        type="button"
        onClick={offsetX === 0 ? onTap : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSnapping ? "transform 0.2s ease-out" : "none",
        }}
        className="w-full text-left bg-white px-4 py-3.5 active:bg-slate-50"
      >
        <div className="flex items-start gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${typeColor}`}>
            {typeLabel}
          </span>
          <div className="flex-1 min-w-0">
            {activity.customerName && (
              <p className="text-sm font-semibold text-slate-900 truncate">{activity.customerName}</p>
            )}
            {timeStr && <p className="text-xs text-slate-400 mt-0.5">{timeStr}</p>}
            {activity.note && (
              <p className="text-sm text-slate-500 mt-1 leading-snug line-clamp-2">{activity.note}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <SyncChip kind={activity.workbookSynced ? "synced" : "notsynced"} />
            <svg className="w-4 h-4 text-slate-300 mt-0.5 self-end" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
}

function DateGroup({ date, activities, onTap, onArchive }: {
  date: string;
  activities: TCmActivity[];
  onTap: (a: TCmActivity) => void;
  onArchive: (a: TCmActivity) => void;
}) {
  return (
    <div>
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {fmtDate(date)}
          <span className="ml-2 font-normal normal-case">
            {activities.length} {activities.length === 1 ? "session" : "sessions"}
          </span>
        </p>
      </div>
      {activities.map((a) => (
        <SwipeableActivityRow
          key={a.id}
          activity={a}
          onTap={() => onTap(a)}
          onArchive={() => onArchive(a)}
        />
      ))}
    </div>
  );
}

function LoadMoreTrigger({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} className="h-1" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ActivityFeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TCmActivityType | "all">("all");
  const [rangeFilter, setRangeFilter] = useState<DateRangeKey>("month");
  const [syncFilter, setSyncFilter] = useState<SyncFilterKey>("all");
  const [selected, setSelected] = useState<TCmActivity | null>(null);
  const archive = useArchiveActivity(user?.uid);

  const feedFilters: ActivityFeedFilters = {
    type: typeFilter !== "all" ? typeFilter : undefined,
    range: rangeFilter,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCmActivitiesFeed(user?.uid, feedFilters);

  // Offline drafts (all customers) + manual "Sync now" for the banner.
  const outbox = useOutboxAutoFlush(user ?? null);

  // Flatten all pages
  const allActivities = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // Client-side search by customer name + workbook sync filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allActivities.filter((a) => {
      if (q && !(a.customerName ?? "").toLowerCase().includes(q)) return false;
      if (syncFilter === "synced" && a.workbookSynced !== true) return false;
      if (syncFilter === "unsynced" && a.workbookSynced === true) return false;
      return true;
    });
  }, [allActivities, search, syncFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TCmActivity[]>();
    for (const a of filtered) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const totalCount = allActivities.length;

  function goToCustomer(id: string) {
    navigate(`/customers/${id}`);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {selected && (
        <ActivityDetailSheet
          activity={selected}
          user={user ?? null}
          onClose={() => setSelected(null)}
          onCustomerClick={(id) => { setSelected(null); goToCustomer(id); }}
        />
      )}
      {/* Header */}
      <div className="bg-white border-b border-slate-100 pt-safe-top flex-shrink-0">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Activity</h1>
          {totalCount > 0 && (
            <span className="text-sm text-slate-400">{filtered.length} entries</span>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search by customer name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Date range chips */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {DATE_RANGE_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setRangeFilter(chip.key)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
                rangeFilter === chip.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Type filter pills */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
                typeFilter === opt.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Workbook sync filter pills */}
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 flex-shrink-0">Workbook</span>
          {SYNC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSyncFilter(opt.value)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
                syncFilter === opt.value
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-safe-bottom">
        {/* Offline sessions waiting to sync (auto-flushes when online; manual kick here) */}
        {outbox.pendingDrafts.length > 0 && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <span className="text-xs font-medium text-amber-700">
              {outbox.pendingDrafts.length} offline session{outbox.pendingDrafts.length !== 1 ? "s" : ""} waiting to sync
            </span>
            <button
              type="button"
              onClick={() => void outbox.flush()}
              disabled={outbox.flushing}
              className="flex-shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 active:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              {outbox.flushing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        )}

        {/* Query failure — surface it instead of masquerading as an empty feed */}
        {isError && (
          <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-xs font-semibold text-red-700">Couldn't load activity</p>
            <p className="text-xs text-red-600/80 mt-0.5 break-words">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 active:bg-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-4 border-b border-slate-100 bg-white flex gap-3">
                <div className="w-16 h-5 bg-slate-100 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">
              {search
                ? `No entries matching "${search}"`
                : syncFilter !== "all"
                  ? "No sessions match this filter"
                  : "No activity logged yet"}
            </p>
            {!search && syncFilter === "all" && (
              <button
                type="button"
                onClick={() => navigate("/log")}
                className="mt-4 text-sm font-medium text-indigo-600 underline underline-offset-2"
              >
                Log your first session
              </button>
            )}
            {/* A page can be all-archived (filtered client-side) yet more pages
                remain — keep paging instead of dead-ending on an empty state. */}
            {hasNextPage && !isFetchingNextPage && <LoadMoreTrigger onVisible={fetchNextPage} />}
          </div>
        )}

        {!isLoading && grouped.length > 0 && (
          <div>
            {grouped.map(([date, items]) => (
              <DateGroup
                key={date}
                date={date}
                activities={items}
                onTap={setSelected}
                onArchive={(a) => archive.mutate(a.id)}
              />
            ))}

            {/* Infinite scroll trigger */}
            {hasNextPage && !isFetchingNextPage && (
              <LoadMoreTrigger onVisible={fetchNextPage} />
            )}

            {isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
              </div>
            )}

            {!hasNextPage && totalCount > 0 && (
              <p className="text-center text-xs text-slate-300 py-6">
                All {totalCount} entries loaded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
