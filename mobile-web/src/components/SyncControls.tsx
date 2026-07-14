// Shared sync UI: a status chip + a sync/retry button. Used on session rows, in
// the session detail sheet, and (the button) for offline drafts. One visual
// language so CMs don't have to learn "calendar vs workbook vs offline" — it's
// just green = synced, yellow = needs sync, tap to sync.

// "notsynced" is the workbook-flag-only variant used on rows where we can't
// cheaply know whether the customer even has a linked workbook (feed, home) —
// neutral styling so it reads as status, not as an urgent to-do.
export type SyncChipKind = "synced" | "pending" | "offline" | "syncing" | "notsynced";

const CHIP_STYLES: Record<SyncChipKind, string> = {
  synced: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  offline: "bg-amber-100 text-amber-700",
  syncing: "bg-sky-100 text-sky-700",
  notsynced: "bg-slate-100 text-slate-500",
};

const CHIP_LABELS: Record<SyncChipKind, string> = {
  synced: "Synced",
  pending: "Needs sync",
  offline: "Offline",
  syncing: "Syncing…",
  notsynced: "Not synced",
};

export function SyncChip({ kind, className = "" }: { kind: SyncChipKind; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHIP_STYLES[kind]} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          kind === "synced" ? "bg-emerald-500" : kind === "syncing" ? "bg-sky-500 animate-pulse" : kind === "notsynced" ? "bg-slate-400" : "bg-amber-500"
        }`}
      />
      {CHIP_LABELS[kind]}
    </span>
  );
}

export function SyncButton({
  onClick,
  busy,
  disabled,
  label = "Sync",
  busyLabel = "Syncing…",
  size = "sm",
  className = "",
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "md" ? "px-4 py-2.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50 transition-colors ${sizing} ${className}`}
    >
      {busy ? (
        <span className="h-3 w-3 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.985 14.652H-.007v4.992M4.59 9.349a8.25 8.25 0 0 1 14.176-2.01M19.41 14.65a8.25 8.25 0 0 1-14.176 2.01" />
        </svg>
      )}
      {busy ? busyLabel : label}
    </button>
  );
}
