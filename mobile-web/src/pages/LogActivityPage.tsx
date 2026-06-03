import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCreateActivity } from "@/hooks/useCreateActivity";
import { CustomerPicker } from "@/components/CustomerPicker";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { useCalendarIntegration, useDriveIntegration } from "@/hooks/useCalendarIntegration";
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
  const [searchParams] = useSearchParams();
  const createActivity = useCreateActivity(user);
  const { prefs } = useUserPrefs(user?.uid);
  const { connected, needsReconnect, postEvent } = useCalendarIntegration(user ?? null);
  const drive = useDriveIntegration(user ?? null);

  const preCustomerId = searchParams.get("customerId");
  const preCustomerName = searchParams.get("customerName");

  const [customer, setCustomer] = useState<CustomerOption | null>(
    preCustomerId && preCustomerName
      ? { id: preCustomerId, name: preCustomerName, status: "active" }
      : null,
  );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;

    // 1. Save the session — always first, never blocked by calendar
    await createActivity.mutateAsync({
      customerId: customer.id,
      customerName: customer.name,
      type,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      note: note.trim() || undefined,
    });

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
        const resp = await GoogleIntegrations.pushWorkbookRow({
          customerId: customer.id,
          entityId: "progressNotes",
          values: {
            progressDate: date,
            ...(startTime ? { startTime } : {}),
            ...(endTime ? { endTime } : {}),
            ...(note.trim() ? { summary: note.trim() } : {}),
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
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="text-xs text-indigo-600 font-semibold mt-0.5 active:text-indigo-800"
              >
                Connect in Settings →
              </button>
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
            <span className="text-xs text-slate-400 flex-shrink-0">Not connected</span>
          )}
        </div>

        {/* Push to workbook toggle */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-3">
          <span className="text-lg flex-shrink-0">📓</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Push to workbook (progress note)</p>
            {!drive.connected && (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="text-xs text-indigo-600 font-semibold mt-0.5 active:text-indigo-800"
              >
                Connect Google Drive in Settings →
              </button>
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
            <span className="text-xs text-slate-400 flex-shrink-0">Not connected</span>
          )}
        </div>

        {createActivity.error && (
          <p className="text-xs text-red-500">Failed to save. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={!customer || createActivity.isPending}
          className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm active:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {createActivity.isPending ? "Saving…" : "Save Session"}
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
