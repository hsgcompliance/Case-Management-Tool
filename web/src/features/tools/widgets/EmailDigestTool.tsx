"use client";

// features/tools/widgets/EmailDigestTool.tsx
import React from "react";
import Inbox from "@client/inbox";
import { useUsers } from "@hooks/useUsers";
import { useAuth } from "@app/auth/AuthProvider";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import { toast } from "@lib/toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type DigestType = "caseload" | "budget" | "enrollments" | "caseManagers";

type DigestSubRecord = {
  uid: string;
  email: string;
  displayName?: string;
  roles: string[];
  topRole: string;
  subs: Partial<Record<DigestType, boolean>>;
  effective: Record<DigestType, boolean>;
};

// ── Config ────────────────────────────────────────────────────────────────────

const DIGEST_DEFS: { type: DigestType; label: string; schedule: string }[] = [
  { type: "caseload",     label: "Caseload",      schedule: "1st of each month, 7 AM MT" },
  { type: "budget",       label: "Budget",         schedule: "1st of each month, 7 AM MT" },
  { type: "enrollments",  label: "Enrollments",    schedule: "1st of each month, 7 AM MT" },
  { type: "caseManagers", label: "Case Managers",  schedule: "1st of each month, 7 AM MT" },
];

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch { return ym; }
}

// ── Left panel ────────────────────────────────────────────────────────────────

function TemplatePanel({
  def,
  month,
  setMonth,
  forUid,
  forUidName,
  onClearUser,
  onSendNow,
  sending,
  disabled,
}: {
  def: (typeof DIGEST_DEFS)[number];
  month: string;
  setMonth: (m: string) => void;
  forUid: string | null;
  forUidName: string;
  onClearUser: () => void;
  onSendNow: () => void;
  sending: boolean;
  disabled: boolean;
}) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const loadPreview = React.useCallback(async () => {
    setLoadingPreview(true);
    setHtml(null);
    try {
      const resp = await Inbox.digestHtmlPreview({
        digestType: def.type,
        month,
        ...(forUid ? { forUid } : {}),
      });
      setHtml(resp.html);
      setSubject(resp.subject);
    } catch (e: any) {
      toast(e?.message || "Preview failed.", { type: "error" });
    } finally {
      setLoadingPreview(false);
    }
  }, [def.type, month, forUid]);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Disabled banner */}
      {disabled && (
        <div className="shrink-0 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            This digest is disabled. Scheduled and manual sends are blocked.
          </span>
        </div>
      )}

      {/* Actions bar */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 space-y-3">
        {/* Month + refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.currentTarget.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {month && <span className="text-xs text-slate-400">{monthLabel(month)}</span>}
          </div>
          <button
            type="button"
            className="btn btn-xs btn-ghost border border-slate-300"
            onClick={loadPreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? "Loading…" : "Refresh Preview"}
          </button>
        </div>

        {/* User context pill */}
        {forUid ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
              Previewing as: {forUidName}
            </span>
            <button
              type="button"
              onClick={onClearUser}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              title="Clear — show generic preview"
            >
              ✕ Clear
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Generic preview — click a name in the subscriber list to preview for a specific user.
          </div>
        )}

        {/* Subject */}
        {subject && (
          <div className="text-xs text-slate-500 truncate">
            <span className="font-semibold text-slate-700">Subject: </span>{subject}
          </div>
        )}

        {/* Send button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onSendNow}
            disabled={sending || !month || disabled}
            title={disabled ? "Re-enable this digest before sending" : undefined}
          >
            {sending ? "Sending…" : forUid ? `Send to ${forUidName}` : "Send Now (All)"}
          </button>
          <div className="text-xs text-slate-400 ml-1">
            Scheduled: <span className="text-slate-600">{def.schedule}</span>
          </div>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 min-h-0 overflow-hidden bg-slate-100">
        {loadingPreview ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">Loading preview…</div>
        ) : html ? (
          <iframe
            srcDoc={html}
            title={`${def.label} Digest Preview${forUidName ? ` — ${forUidName}` : ""}`}
            className="w-full h-full border-0"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">No preview available.</div>
        )}
      </div>
    </div>
  );
}

// ── Right panel (subscribers) ─────────────────────────────────────────────────

function SubscribersPanel({
  def,
  records,
  myUid,
  isAdmin,
  selectedUid,
  onSelectUser,
  onToggle,
  onAdd,
}: {
  def: (typeof DIGEST_DEFS)[number];
  records: DigestSubRecord[];
  myUid: string;
  isAdmin: boolean;
  selectedUid: string | null;
  onSelectUser: (uid: string, name: string) => void;
  onToggle: (uid: string, type: DigestType, value: boolean) => Promise<void>;
  onAdd: (uid: string, type: DigestType) => void;
}) {
  const { data: allUsers = [] } = useUsers({ status: "all", limit: 500 });
  const [addUid, setAddUid] = React.useState("");
  const [togglingUids, setTogglingUids] = React.useState<Set<string>>(new Set());

  const subscribed   = records.filter((r) =>  r.effective[def.type]);
  const unsubscribed = records.filter((r) => !r.effective[def.type]);

  const recordUids = new Set(records.map((r) => r.uid));
  const addable = (allUsers as any[])
    .filter((u: any) => u?.uid && !recordUids.has(u.uid) && u.email)
    .map((u: any) => ({ uid: String(u.uid), label: String(u.displayName || u.email) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const handleToggle = async (uid: string, on: boolean) => {
    setTogglingUids((prev) => new Set(prev).add(uid));
    try {
      await onToggle(uid, def.type, !on);
    } finally {
      setTogglingUids((prev) => { const s = new Set(prev); s.delete(uid); return s; });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="font-semibold text-slate-900 text-sm">Subscribers</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {subscribed.length} subscribed · click name to preview
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {records.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-6">No eligible users.</div>
        ) : (
          [...subscribed, ...unsubscribed].map((r) => {
            const isMe = r.uid === myUid;
            const canToggle = true;
            const on = !!r.effective[def.type];
            const isDefault = !(def.type in r.subs);
            const isSelected = selectedUid === r.uid;
            const toggling = togglingUids.has(r.uid);
            const displayName = r.displayName || r.email;

            return (
              <div
                key={r.uid}
                className={[
                  "flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-300 dark:ring-sky-700"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                ].join(" ")}
              >
                {/* Clickable name */}
                <button
                  type="button"
                  onClick={() => onSelectUser(r.uid, displayName)}
                  className="min-w-0 flex-1 text-left group"
                  title={`Preview digest for ${displayName}`}
                >
                  <div className={[
                    "text-sm truncate transition-colors",
                    isSelected
                      ? "font-semibold text-sky-700 dark:text-sky-300"
                      : "text-slate-700 group-hover:text-sky-600 dark:text-slate-300 dark:group-hover:text-sky-400",
                  ].join(" ")}>
                    {displayName}
                    {isMe && <span className="ml-1 text-xs text-blue-500">you</span>}
                    {isSelected && <span className="ml-1 text-[10px] text-sky-500">← previewing</span>}
                  </div>
                  {isDefault && <div className="text-xs text-slate-400">default</div>}
                </button>

                {/* On/Off toggle */}
                <button
                  type="button"
                  disabled={!canToggle || toggling}
                  onClick={() => handleToggle(r.uid, on)}
                  className={[
                    "shrink-0 ml-2 rounded-full border text-xs font-semibold px-2.5 py-0.5 transition-colors min-w-[40px]",
                    on
                      ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:border-green-700 dark:text-green-300"
                      : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400",
                    (!canToggle || toggling) ? "opacity-40 cursor-default" : "cursor-pointer",
                  ].join(" ")}
                >
                  {toggling ? "…" : on ? "On" : "Off"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add subscriber */}
      {isAdmin && (
        <div className="shrink-0 border-t border-slate-200 px-3 py-3 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Add Subscriber</div>
          <div className="flex gap-2">
            <select
              value={addUid}
              onChange={(e) => setAddUid(e.currentTarget.value)}
              className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Select user…</option>
              {addable.map((u) => (
                <option key={u.uid} value={u.uid}>{u.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addUid}
              onClick={() => { if (addUid) { onAdd(addUid, def.type); setAddUid(""); } }}
              className="btn btn-sm btn-primary shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EmailDigestMain() {
  const { user, profile } = useAuth();
  const myUid   = user?.uid || "";
  const isAdmin = ["admin", "dev", "org_dev"].includes(profile?.topRole ?? "");

  const [activeTab, setActiveTab] = React.useState<DigestType>("caseload");
  const [month, setMonth]         = React.useState(currentMonthValue);
  const [records, setRecords]     = React.useState<DigestSubRecord[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [sending, setSending]     = React.useState(false);
  const [forUid, setForUid]       = React.useState<string | null>(null);
  const [forUidName, setForUidName] = React.useState("");
  const [savingDisable, setSavingDisable] = React.useState(false);

  const { data: orgConfig } = useOrgConfig();
  const saveOrgConfig = useSaveOrgConfig();

  const def = DIGEST_DEFS.find((d) => d.type === activeTab)!;

  // A digest is enabled unless explicitly set to false
  const isDisabled = (type: DigestType) =>
    orgConfig?.digestsEnabled[type] === false;

  const handleToggleDisable = async () => {
    if (!orgConfig) return;
    setSavingDisable(true);
    try {
      const next = {
        ...orgConfig,
        digestsEnabled: {
          ...orgConfig.digestsEnabled,
          [activeTab]: isDisabled(activeTab), // toggle: false → true, true → false (or absent → false)
        },
      };
      await saveOrgConfig.mutateAsync(next);
      toast(
        isDisabled(activeTab)
          ? `${def.label} digest re-enabled.`
          : `${def.label} digest disabled.`,
        { type: "success" }
      );
    } catch (e: any) {
      toast(e?.message || "Failed to save setting.", { type: "error" });
    } finally {
      setSavingDisable(false);
    }
  };

  const loadRecords = React.useCallback(async () => {
    setLoading(true);
    try {
      const resp = await Inbox.digestSubsGet();
      setRecords(resp.records as DigestSubRecord[]);
    } catch (e: any) {
      toast(e?.message || "Failed to load subscriptions.", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleSelectUser = (uid: string, name: string) => {
    if (forUid === uid) {
      setForUid(null);
      setForUidName("");
    } else {
      setForUid(uid);
      setForUidName(name);
    }
  };

  const handleToggle = async (uid: string, type: DigestType, subscribed: boolean) => {
    // Optimistic update
    setRecords((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, subs: { ...r.subs, [type]: subscribed }, effective: { ...r.effective, [type]: subscribed } }
          : r
      )
    );
    try {
      await Inbox.digestSubUpdate({ uid, digestType: type, subscribed });
      toast(
        subscribed
          ? `Subscribed ${uid === myUid ? "you" : "user"} to ${def.label} digest.`
          : `Unsubscribed from ${def.label} digest.`,
        { type: "success" }
      );
    } catch (e: any) {
      toast(e?.message || "Update failed.", { type: "error" });
      loadRecords(); // revert optimistic update
    }
  };

  const handleAdd = async (uid: string, type: DigestType) => {
    await handleToggle(uid, type, true);
  };

  const handleSendNow = async () => {
    if (!month) { toast("Select a month.", { type: "error" }); return; }
    if (isDisabled(activeTab)) { toast("Re-enable this digest before sending.", { type: "error" }); return; }
    setSending(true);
    try {
      const body: Record<string, unknown> = { months: [month], digestType: activeTab };
      if (forUid) body.cmUid = forUid;
      const resp = await (Inbox.sendDigestNow as any)(body);
      const { sent = 0, skipped = 0, failed = 0 } = resp || {};
      if (failed > 0) {
        toast(`Sent ${sent}, skipped ${skipped}, failed ${failed}.`, { type: "error" });
      } else {
        toast(`Sent ${sent} digest${sent !== 1 ? "s" : ""}${skipped ? ` (${skipped} already sent)` : ""}.`, { type: "success" });
      }
    } catch (e: any) {
      toast(e?.message || "Send failed.", { type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex gap-0">
          {DIGEST_DEFS.map((d) => {
            const tabDisabled = orgConfig?.digestsEnabled[d.type] === false;
            return (
              <button
                key={d.type}
                type="button"
                onClick={() => setActiveTab(d.type)}
                className={[
                  "relative px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  activeTab === d.type
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {d.label}
                {tabDisabled && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400 align-middle" title="Disabled" />
                )}
              </button>
            );
          })}
        </div>

        {/* Global disable toggle — admin only */}
        {isAdmin && orgConfig && (
          <button
            type="button"
            onClick={handleToggleDisable}
            disabled={savingDisable}
            className={[
              "shrink-0 rounded-full border text-xs font-semibold px-3 py-1 transition-colors",
              isDisabled(activeTab)
                ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300"
                : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300",
            ].join(" ")}
            title={isDisabled(activeTab) ? "Re-enable scheduled sends for this digest" : "Disable scheduled sends for this digest"}
          >
            {savingDisable ? "Saving..." : isDisabled(activeTab) ? "Enable Digest" : "Disable Digest"}
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 min-h-0">
            <TemplatePanel
              def={def}
              month={month}
              setMonth={setMonth}
              forUid={forUid}
              forUidName={forUidName}
              onClearUser={() => { setForUid(null); setForUidName(""); }}
              onSendNow={handleSendNow}
              sending={sending}
              disabled={isDisabled(activeTab)}
            />
          </div>
          <div className="w-64 shrink-0 min-h-0 flex flex-col">
            <SubscribersPanel
              def={def}
              records={records}
              myUid={myUid}
              isAdmin={isAdmin}
              selectedUid={forUid}
              onSelectUser={handleSelectUser}
              onToggle={handleToggle}
              onAdd={handleAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}
