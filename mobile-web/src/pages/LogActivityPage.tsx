import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCreateActivity, markSessionWorkbookSynced } from "@/hooks/useCreateActivity";
import { qk } from "@/hooks/queryKeys";
import { CustomerPicker } from "@/components/CustomerPicker";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { useCalendarIntegration, useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { useCustomer, getWorkbookLink } from "@/hooks/useCustomers";
import { useWorkbookData, type WorkbookDataState } from "@/hooks/useWorkbookData";
import { GoogleIntegrations } from "@/lib/googleIntegrations";
import type { CustomerOption } from "@/components/CustomerPicker";
import type { TCmActivityType } from "@hdb/contracts";

const TYPES: { value: TCmActivityType; label: string; emoji: string }[] = [
  { value: "in-person",  label: "In Person",    emoji: "🤝" },
  { value: "phone",      label: "Phone",         emoji: "📞" },
  { value: "data-entry", label: "Data Entry",    emoji: "💻" },
  { value: "other",      label: "On Behalf of",  emoji: "📋" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** "2026-06-18" → "6/18/2026" for the in-note signature line. */
function prettyDate(iso: string): string {
  const [y, m, d] = String(iso || "").split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

/**
 * Structured goals from the linked workbook, numbered by their position in the
 * goals table (1-based). TSS goals have no explicit number column — progress
 * notes reference them by that position ("Goal #"), so the note's Linked Plan
 * Goal is the comma-joined list of selected numbers (e.g. "1,3,4").
 */
function goalsFromWorkbook(data: WorkbookDataState | undefined): { n: number; label: string }[] {
  if (!data || data.kind !== "ok") return [];
  const goalsEntity = data.extract.entities.find((e) => e.entityId === "goals");
  const rows = goalsEntity?.rows ?? [];
  return rows.map((row, i) => {
    const cell = row.values?.goalSmart;
    const label = cell ? String(cell.displayValue ?? cell.value ?? "").trim() : "";
    return { n: i + 1, label: label || `Goal ${i + 1}` };
  });
}

/** Initials from a display name: "Griffin Seyfried" → "GS"; single token → first 2 chars. */
function staffInitials(name?: string | null): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Calendar sync failure sheet ─────────────────────────────────────────────

interface SyncWarningProps {
  error: string;
  needsReconnect: boolean;
  onDismiss: () => void;
}

function CalendarSyncWarning({ error, needsReconnect, onDismiss }: SyncWarningProps) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
      <div className="pointer-events-auto w-full px-4 pb-safe-bottom pb-6 animate-slide-up">
        <div className="rounded-2xl bg-white border border-amber-200 shadow-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {needsReconnect ? "Google connection expired" : "Calendar sync failed"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Session saved successfully.{" "}
                {needsReconnect
                  ? "Your Google connection expired — reconnect in Settings to sync future sessions."
                  : `Calendar error: ${error}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {needsReconnect && (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700 transition-colors"
              >
                Go to Settings
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workbook push notice sheet ──────────────────────────────────────────────

function WorkbookPushNotice({
  message,
  showSettings,
  onDismiss,
}: {
  message: string;
  showSettings: boolean;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
      <div className="pointer-events-auto w-full px-4 pb-safe-bottom pb-6 animate-slide-up">
        <div className="rounded-2xl bg-white border border-amber-200 shadow-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Workbook push</p>
              <p className="text-xs text-slate-500 mt-0.5">Session saved successfully. {message}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {showSettings && (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700 transition-colors"
              >
                Go to Settings
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LogActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const createActivity = useCreateActivity(user);
  const { prefs } = useUserPrefs(user?.uid);
  const {
    connected,
    needsReconnect,
    postEvent,
    connectViaPopup: connectCalendar,
    connectingViaPopup: connectingCalendar,
  } = useCalendarIntegration(user ?? null);
  const drive = useDriveIntegration(user ?? null);

  const preCustomerId = searchParams.get("customerId");
  const preCustomerName = searchParams.get("customerName");

  const [customer, setCustomer] = useState<CustomerOption | null>(
    preCustomerId && preCustomerName
      ? { id: preCustomerId, name: preCustomerName, status: "active" }
      : null,
  );

  // Full record for the selected customer — surfaces the linked workbook link.
  const { data: customerDetail } = useCustomer(customer?.id);
  const workbookLink = customerDetail ? getWorkbookLink(customerDetail) : null;

  // Structured goals from the linked workbook (only fetched once Drive is
  // connected and a customer is selected). Shared query key with the Plan tab.
  const { data: workbookData } = useWorkbookData(customer?.id, {
    enabled: drive.connected && !!customer,
  });
  const goals = goalsFromWorkbook(workbookData);
  const [linkedGoals, setLinkedGoals] = useState<number[]>([]);
  // Reset the goal selection whenever the customer changes.
  useEffect(() => { setLinkedGoals([]); }, [customer?.id]);
  const toggleGoal = (n: number) =>
    setLinkedGoals((cur) => (cur.includes(n) ? cur.filter((g) => g !== n) : [...cur, n].sort((a, b) => a - b)));

  const [type, setType] = useState<TCmActivityType>("in-person");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");

  // Calendar toggle — default from pref, only if connected
  const [addToCalendar, setAddToCalendar] = useState(false);
  useEffect(() => {
    setAddToCalendar(connected && prefs.calendarDefault);
  }, [connected, prefs.calendarDefault]);

  // Push-to-workbook toggle — default from pref, only if Drive connected
  const [pushToWorkbook, setPushToWorkbook] = useState(false);
  useEffect(() => {
    setPushToWorkbook(drive.connected && prefs.workbookPushDefault);
  }, [drive.connected, prefs.workbookPushDefault]);

  // Inline connect (popup) — keeps the unsaved session on screen. We flip the
  // matching toggle ON after a successful connect so the push goes through.
  async function handleConnectCalendar() {
    const res = await connectCalendar();
    if (res.result === "connected") setAddToCalendar(true);
  }
  async function handleConnectDrive() {
    const res = await drive.connectViaPopup();
    if (res.result === "connected") setPushToWorkbook(true);
  }

  // Warning sheet state
  const [syncWarning, setSyncWarning] = useState<{
    error: string;
    needsReconnect: boolean;
    navigateTo: string;
  } | null>(null);
  const [workbookNotice, setWorkbookNotice] = useState<{
    message: string;
    showSettings: boolean;
    navigateTo: string;
  } | null>(null);

  // Covers the WHOLE submit (save + calendar/workbook pushes), not just the
  // Firestore write — so the button stays locked through the pushes and a second
  // tap can't create a duplicate session. (The notice sheets are click-through.)
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !customer) return;
    setSubmitting(true);

    // 1. Save the session — optimistic, never blocked by calendar/workbook.
    let sessionId: string;
    try {
      sessionId = await createActivity.mutateAsync({
        customerId: customer.id,
        customerName: customer.name,
        type,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        note: note.trim() || undefined,
      });
    } catch {
      // Nothing was saved — release the lock so the user can retry.
      setSubmitting(false);
      return;
    }

    const destination = preCustomerId ? `/customers/${preCustomerId}` : "/";

    // 2. Optionally post to calendar (non-blocking)
    if (addToCalendar && connected) {
      try {
        await postEvent({
          customerName: customer.name,
          type,
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          note: note.trim() || undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const isReconnect = msg.includes("calendar_needs_reconnect") || needsReconnect;
        setSyncWarning({ error: msg, needsReconnect: isReconnect, navigateTo: destination });
        return;
      }
    }

    // 3. Optionally push to the customer's TSS workbook (non-blocking).
    if (pushToWorkbook) {
      if (!drive.connected) {
        // Setting on but Drive not set up → notify + link to settings (session is saved).
        setWorkbookNotice({
          message: "Connect Google Drive in Settings to push notes to the workbook.",
          showSettings: true,
          navigateTo: destination,
        });
        return;
      }
      try {
        // Push the FULL progress note. The Summary cell is built to read as a
        // self-contained note — modality + the case note, signed with the case
        // manager's initials and the service date. We ALSO fill the dedicated
        // Date / Staff name / Staff initial columns, but the TSS payer and
        // non-payer layouts each omit one of the staff columns, so embedding the
        // signature in the Summary guarantees the attribution is never lost.
        const modalityLabel = TYPES.find((t) => t.value === type)?.label ?? "";
        const trimmedNote = note.trim();
        const staffName = (user?.displayName ?? "").trim();
        const staffInitial = staffInitials(user?.displayName);

        const noteBody = [modalityLabel, trimmedNote].filter(Boolean).join(" — ");
        const signature = [staffInitial, prettyDate(date)].filter(Boolean).join(" · ");
        const summary = [noteBody, signature ? `— ${signature}` : ""].filter(Boolean).join("\n");

        // Linked Plan Goal — written as "Goal #1, Goal #3" for the goals the note
        // addresses (goals are referenced by their 1-based position in the sheet).
        const linkedPlanGoal = linkedGoals.map((n) => `Goal #${n}`).join(", ");

        const resp = await GoogleIntegrations.pushWorkbookRow({
          customerId: customer.id,
          entityId: "progressNotes",
          values: {
            progressDate: date,
            ...(startTime ? { startTime } : {}),
            ...(endTime ? { endTime } : {}),
            ...(summary ? { summary } : {}),
            ...(linkedPlanGoal ? { linkedPlanGoal } : {}),
            ...(staffName ? { staffName } : {}),
            ...(staffInitial ? { staffInitial } : {}),
          },
        });
        if (!resp.ok) {
          const linkable = resp.error === "google_not_connected" || resp.error === "workbook_not_linked";
          setWorkbookNotice({
            message: resp.error === "workbook_not_linked"
              ? "No workbook is linked to this customer yet."
              : `Couldn't push to the workbook (${resp.error ?? "error"}).`,
            showSettings: linkable,
            navigateTo: destination,
          });
          return;
        }
        // Push succeeded → flag the session doc as synced to the workbook.
        try {
          await markSessionWorkbookSynced(sessionId, resp.rowKey);
          void qc.invalidateQueries({ queryKey: qk.cmActivities.root });
        } catch {
          // Non-fatal: the note is in the workbook even if the flag write failed.
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setWorkbookNotice({
          message: `Couldn't push to the workbook: ${msg}`,
          showSettings: msg.includes("google_not_connected"),
          navigateTo: destination,
        });
        return;
      }
    }

    navigate(destination, { replace: true });
  }

  function handleDismissWarning() {
    const dest = syncWarning?.navigateTo ?? "/";
    setSyncWarning(null);
    navigate(dest, { replace: true });
  }

  function handleDismissWorkbookNotice() {
    const dest = workbookNotice?.navigateTo ?? "/";
    setWorkbookNotice(null);
    navigate(dest, { replace: true });
  }

  return (
    <div className="page-content bg-slate-50">
      {/* Calendar sync failure sheet */}
      {syncWarning && (
        <CalendarSyncWarning
          error={syncWarning.error}
          needsReconnect={syncWarning.needsReconnect}
          onDismiss={handleDismissWarning}
        />
      )}
      {/* Workbook push notice sheet */}
      {workbookNotice && (
        <WorkbookPushNotice
          message={workbookNotice.message}
          showSettings={workbookNotice.showSettings}
          onDismiss={handleDismissWorkbookNotice}
        />
      )}

      <div className="px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Log Session</h1>
        <p className="text-sm text-slate-500 mt-1">Record a customer interaction</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-4 pb-8">
        {/* Customer */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</label>
          {user && <CustomerPicker user={user} value={customer} onChange={setCustomer} />}
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-xl border-2 px-3 py-3 text-sm font-medium flex items-center gap-2 transition-colors ${
                  type === t.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Time range */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-4">
          <TimeRangePicker
            startTime={startTime}
            endTime={endTime}
            onChange={(s, e) => { setStartTime(s); setEndTime(e); }}
            step={prefs.timeInterval}
            use24h={prefs.timeFormat === "24h"}
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Case Note (optional)</label>
          <textarea
            rows={4}
            placeholder="Brief notes for your reference…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 resize-none"
          />
        </div>

        {/* Calendar toggle */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-3">
          <span className="text-lg flex-shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Add to Google Calendar</p>
            {!connected && (
              <p className="text-xs text-slate-400 mt-0.5">
                {needsReconnect ? "Connection expired — reconnect to sync." : "Connect to sync sessions to your calendar."}
              </p>
            )}
          </div>
          {connected ? (
            <button
              type="button"
              role="switch"
              aria-checked={addToCalendar}
              onClick={() => setAddToCalendar((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                addToCalendar ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  addToCalendar ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnectCalendar()}
              disabled={connectingCalendar}
              className="flex-shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {connectingCalendar ? "Connecting…" : needsReconnect ? "Reconnect" : "Connect now"}
            </button>
          )}
        </div>

        {/* Push to workbook toggle */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">📓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Push to workbook (progress note)</p>
              {!drive.connected && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {drive.needsReconnect
                    ? "Drive connection expired — reconnect to push notes."
                    : "Connect Google Drive to push notes to the workbook."}
                </p>
              )}
            </div>
            {drive.connected ? (
              <button
                type="button"
                role="switch"
                aria-checked={pushToWorkbook}
                onClick={() => setPushToWorkbook((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  pushToWorkbook ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    pushToWorkbook ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnectDrive()}
                disabled={drive.connectingViaPopup}
                className="flex-shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {drive.connectingViaPopup ? "Connecting…" : drive.needsReconnect ? "Reconnect" : "Connect now"}
              </button>
            )}
          </div>

          {/* Surface the customer's linked workbook so staff can open it directly. */}
          {workbookLink ? (
            <a
              href={workbookLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 active:bg-slate-100 transition-colors"
            >
              <span className="text-sm">↗</span>
              <span className="truncate">{workbookLink.name}</span>
            </a>
          ) : customer ? (
            <p className="mt-3 text-xs text-slate-400">No workbook linked to this customer yet.</p>
          ) : null}

          {/* Structured goals from the workbook — tap to link this note to goals. */}
          {drive.connected && goals.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">Link to goals</p>
                {linkedGoals.length > 0 && (
                  <span className="text-xs font-semibold text-indigo-600">
                    Goal {linkedGoals.map((n) => `#${n}`).join(", ")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {goals.map((g) => {
                  const selected = linkedGoals.includes(g.n);
                  return (
                    <button
                      key={g.n}
                      type="button"
                      onClick={() => toggleGoal(g.n)}
                      aria-pressed={selected}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                        selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                          : "border-slate-200 bg-white text-slate-600 active:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                          selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {g.n}
                      </span>
                      <span className="flex-1 leading-snug">{g.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {createActivity.error && (
          <p className="text-xs text-red-500">Failed to save. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={!customer || submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm active:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {submitting ? "Saving…" : "Save Session"}
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full text-sm text-slate-400 py-2"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
