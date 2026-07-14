import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { useCustomer, useOrgCustomers, usePatchCustomer, useMarkCustomerInactive, useToggleCustomerActive, getWorkbookLink, type Customer, type DriveFolderRef } from "@/hooks/useCustomers";
import { useCustomerEnrollments, useUpdateEnrollment, type Enrollment } from "@/hooks/useCustomerEnrollments";
import { useCustomerSessions } from "@/hooks/useCustomerSessions";
import { useWorkbookData } from "@/hooks/useWorkbookData";
import { useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { useSessionSync } from "@/hooks/useSessionSync";
import { useCreateActivity } from "@/hooks/useCreateActivity";
import { useEditActivity, useDeleteActivity, type SessionEditFields } from "@/hooks/useEditActivity";
import { useCaseNoteAssistantConfig, useGenerateSmartGoalSuggestion } from "@/hooks/useCaseNoteAssistant";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { CaseNoteAssistant } from "@/components/CaseNoteAssistant";
import { sessionDurationMinutes } from "@/lib/sessionDuration";
import { SyncChip, SyncButton } from "@/components/SyncControls";
import { CustomerFolderSection } from "@/components/CustomerFolderSection";
import { WorkbookLinkSection } from "@/components/WorkbookLinkSection";
import { WorkbookVariantToggle } from "@/components/WorkbookVariantToggle";
import { ProgramEditSheet, type ProgramEditPatch } from "@/components/ProgramEditSheet";
import { EnrollProgramSheet } from "@/components/EnrollProgramSheet";
import { DATE_RANGE_CHIPS, type DateRangeKey } from "@/lib/dateRange";
import { listOutbox, removeOutbox, subscribeOutbox, type OutboxEntry } from "@/lib/sessionOutbox";
import type { SyncState } from "@/lib/sessionSync";
import { GoogleIntegrations } from "@/lib/googleIntegrations";
import { tss } from "@hdb/contracts";
import type { TCmActivity, TCmActivityType, tss as TssNS } from "@hdb/contracts";

const SESSION_TYPE_OPTIONS: { value: TCmActivityType; label: string; emoji: string }[] = [
  { value: "in-person",  label: "In Person",   emoji: "🤝" },
  { value: "phone",      label: "Phone",        emoji: "📞" },
  { value: "data-entry", label: "Data Entry",   emoji: "💻" },
  { value: "other",      label: "On Behalf of", emoji: "📋" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.floor((Date.now() - t) / (365.25 * 86400000));
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDOB(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const age = calcAge(s);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return age !== null ? `${dateStr} (${age}y)` : dateStr;
}

function fmtCurrency(n?: number): string {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function populationColors(pop?: string): { bg: string; text: string } {
  switch ((pop ?? "").toLowerCase()) {
    case "youth":      return { bg: "bg-sky-100",     text: "text-sky-700" };
    case "family":     return { bg: "bg-amber-100",   text: "text-amber-700" };
    case "individual": return { bg: "bg-emerald-100", text: "text-emerald-700" };
    default:           return { bg: "bg-slate-100",   text: "text-slate-500" };
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TCmActivityType, string> = {
  "in-person": "In Person",
  "phone": "Phone",
  "data-entry": "Data Entry",
  "other": "On Behalf of",
};

const TYPE_COLORS: Record<TCmActivityType, string> = {
  "in-person": "bg-green-100 text-green-700",
  "phone": "bg-blue-100 text-blue-700",
  "data-entry": "bg-purple-100 text-purple-700",
  "other": "bg-slate-100 text-slate-600",
};

function groupByDate(activities: TCmActivity[]): Array<{ date: string; items: TCmActivity[] }> {
  const map = new Map<string, TCmActivity[]>();
  for (const a of activities) {
    const list = map.get(a.date) ?? [];
    list.push(a);
    map.set(a.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | undefined | null }) {
  const display = String(value ?? "").trim() || "—";
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-900 break-words">{display}</p>
    </div>
  );
}

function isActiveEnrollment(e: Enrollment): boolean {
  if (e.deleted === true) return false;
  const s = String(e.status ?? "").toLowerCase();
  return e.active === true || s === "active";
}

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const active = isActiveEnrollment(enrollment);
  const label =
    (enrollment.grantName && String(enrollment.grantName).trim()) ||
    (enrollment.name && String(enrollment.name).trim()) ||
    "Enrollment";
  const balance = (enrollment.totalProjected ?? 0) - (enrollment.totalPaid ?? 0);
  const hasFinancials = enrollment.totalProjected != null || enrollment.totalPaid != null;

  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-indigo-100 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-900 leading-snug flex-1">{label}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {active ? "Active" : (enrollment.status ?? "Closed")}
        </span>
      </div>

      {(enrollment.startDate || enrollment.endDate) && (
        <p className="text-xs text-slate-500 mb-3">
          {fmtDate(enrollment.startDate)}{enrollment.endDate ? ` – ${fmtDate(enrollment.endDate)}` : " – ongoing"}
        </p>
      )}

      {hasFinancials && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">Projected</p>
            <p className="text-sm font-semibold text-slate-800">{fmtCurrency(enrollment.totalProjected)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">Paid</p>
            <p className="text-sm font-semibold text-slate-800">{fmtCurrency(enrollment.totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">Balance</p>
            <p className="text-sm font-semibold text-slate-800">{fmtCurrency(balance >= 0 ? balance : 0)}</p>
          </div>
        </div>
      )}

      {(enrollment.nextDue?.date || enrollment.rentCertDue) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-4">
          {enrollment.nextDue?.date && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Next Due</p>
              <p className="text-sm font-medium text-slate-700">
                {fmtDate(enrollment.nextDue.date)}
                {enrollment.nextDue.amount != null && (
                  <span className="ml-1 text-slate-500 text-xs">({fmtCurrency(enrollment.nextDue.amount)})</span>
                )}
              </p>
            </div>
          )}
          {enrollment.rentCertDue && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Rent Cert</p>
              <p className="text-sm font-medium text-slate-700">{fmtDate(enrollment.rentCertDue)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function sessionTimeStr(a: { startTime?: string; endTime?: string }): string | null {
  return a.startTime ? (a.endTime ? `${a.startTime} – ${a.endTime}` : a.startTime) : null;
}

function SessionRow({
  activity,
  syncState,
  syncing,
  onSync,
  onOpen,
}: {
  activity: TCmActivity;
  syncState: SyncState;
  syncing: boolean;
  onSync: () => void;
  onOpen: () => void;
}) {
  const typeLabel = TYPE_LABELS[activity.type] ?? activity.type;
  const typeColor = TYPE_COLORS[activity.type] ?? "bg-slate-100 text-slate-600";
  const timeStr = sessionTimeStr(activity);
  const chipKind = syncing ? "syncing" : syncState.pending ? "pending" : "synced";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-slate-100 bg-white p-3.5 active:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
        {timeStr && <span className="text-xs text-slate-400">{timeStr}</span>}
        <span className="ml-auto flex items-center gap-2">
          <SyncChip kind={chipKind} />
        </span>
      </div>
      {activity.note && <p className="text-sm text-slate-700 leading-snug line-clamp-2">{activity.note}</p>}
      {syncState.actionable && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-amber-600">
            {[syncState.needsCalendar && "calendar", syncState.needsWorkbook && "workbook"].filter(Boolean).join(" + ")} pending
          </span>
          <SyncButton onClick={onSync} busy={syncing} label="Sync" />
        </div>
      )}
    </button>
  );
}

function DraftRow({
  draft,
  syncing,
  onSync,
  onDiscard,
}: {
  draft: OutboxEntry;
  syncing: boolean;
  onSync: () => void;
  onDiscard: () => void;
}) {
  const typeLabel = TYPE_LABELS[draft.body.type] ?? draft.body.type;
  const timeStr = sessionTimeStr(draft.body);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{typeLabel}</span>
        <span className="text-xs text-slate-400">{fmtDate(draft.body.date)}</span>
        {timeStr && <span className="text-xs text-slate-400">{timeStr}</span>}
        <span className="ml-auto"><SyncChip kind={syncing ? "syncing" : "offline"} /></span>
      </div>
      {draft.body.note && <p className="text-sm text-slate-700 leading-snug line-clamp-2">{draft.body.note}</p>}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button type="button" onClick={onDiscard} className="text-[11px] font-semibold text-slate-400 active:text-red-600">
          Discard
        </button>
        <SyncButton onClick={onSync} busy={syncing} label="Sync now" busyLabel="Saving…" />
      </div>
    </div>
  );
}

function SessionEditSheet({
  session,
  use24h,
  assistant,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  session: TCmActivity;
  use24h: boolean;
  /** Non-null when the AI case-note assistant is eligible for this customer. */
  assistant: { clientLabel: string; staffLabel: string } | null;
  onClose: () => void;
  onSave: (fields: SessionEditFields, updateWorkbook: boolean) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [type, setType] = useState<TCmActivityType>(session.type);
  const [date, setDate] = useState(session.date);
  const [startTime, setStartTime] = useState(session.startTime ?? "");
  const [endTime, setEndTime] = useState(session.endTime ?? "");
  const [note, setNote] = useState(session.note ?? "");
  const [updateWorkbook, setUpdateWorkbook] = useState(false); // optional, default false
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const wasWorkbookSynced = session.workbookSynced === true;
  void use24h;

  const save = () =>
    onSave(
      { type, date, startTime: startTime || undefined, endTime: endTime || undefined, note: note.trim() || undefined },
      updateWorkbook,
    );

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-2 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Edit Session</h2>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            {SESSION_TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${
                  type === t.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Case Note</label>
            <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" />
          </div>

          {/* AI case-note assistant — same gating as the Log Session form. */}
          {assistant && (
            <CaseNoteAssistant
              customerId={session.customerId}
              draft={note}
              visitLengthMinutes={sessionDurationMinutes(startTime, endTime)}
              contactType={type === "in-person" ? "in person" : type === "phone" ? "phone" : type === "other" ? "on behalf of the customer" : type === "data-entry" ? "data entry (on behalf of the customer)" : null}
              clientLabel={assistant.clientLabel}
              staffLabel={assistant.staffLabel}
              onAccept={setNote}
            />
          )}

          {/* Optional workbook re-push (append-only → appends a corrected row) */}
          {wasWorkbookSynced && (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
              <input type="checkbox" checked={updateWorkbook} onChange={(e) => setUpdateWorkbook(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              <span className="text-xs text-slate-600">
                Update the progress note in the workbook
                <span className="block text-[11px] text-slate-400">Appends a corrected note dated today. Calendar updates automatically.</span>
              </span>
            </label>
          )}

          <button type="button" onClick={save} disabled={saving || deleting}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save changes"}
          </button>

          {/* Delete */}
          {!confirmingDelete ? (
            <button type="button" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting}
              className="w-full text-sm font-semibold text-red-600 active:text-red-800 py-1 disabled:opacity-50">
              Delete session
            </button>
          ) : (
            <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 space-y-2">
              <p className="text-xs text-red-800">Delete this session? Any calendar event or workbook note already pushed stays in place.</p>
              <div className="flex gap-2">
                <button type="button" onClick={onDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50">
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Case Management tab ──────────────────────────────────────────────────────

function CaseManagementTab({
  customer,
  enrollments,
  autoEditPrimary,
  onAutoEditHandled,
}: {
  customer: Customer;
  enrollments: Enrollment[];
  autoEditPrimary?: boolean;
  onAutoEditHandled?: () => void;
}) {
  const { user } = useAuth();
  const { data: orgCustomers = [] } = useOrgCustomers(user);
  const patch = usePatchCustomer(customer.id);

  const [editingPrimary, setEditingPrimary] = useState(false);
  const [editingSecondary, setEditingSecondary] = useState(false);
  const [primaryDraft, setPrimaryDraft] = useState(customer.caseManagerId ?? "");
  const [secondaryDraft, setSecondaryDraft] = useState(customer.secondaryCaseManagerId ?? "");

  useEffect(() => {
    if (!autoEditPrimary) return;
    setPrimaryDraft(customer.caseManagerId ?? "");
    setEditingPrimary(true);
    onAutoEditHandled?.();
  }, [autoEditPrimary, customer.caseManagerId, onAutoEditHandled]);

  const knownCMs = useMemo(() => {
    const seen = new Map<string, string>();
    if (user?.uid && user.displayName) seen.set(user.uid, user.displayName);
    for (const c of orgCustomers) {
      if (c.caseManagerId && c.caseManagerName) seen.set(c.caseManagerId, c.caseManagerName);
      if (c.secondaryCaseManagerId && c.secondaryCaseManagerName)
        seen.set(c.secondaryCaseManagerId, c.secondaryCaseManagerName);
    }
    return [...seen.entries()]
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgCustomers, user?.uid, user?.displayName]);

  const labelFor = (uid: string | undefined) =>
    uid ? (knownCMs.find((cm) => cm.uid === uid)?.name ?? uid) : "Unassigned";

  const savePrimary = async () => {
    const name = labelFor(primaryDraft) !== primaryDraft ? labelFor(primaryDraft) : undefined;
    await patch.mutateAsync({ caseManagerId: primaryDraft || undefined, caseManagerName: primaryDraft ? name : undefined });
    setEditingPrimary(false);
  };

  const saveSecondary = async () => {
    const name = labelFor(secondaryDraft) !== secondaryDraft ? labelFor(secondaryDraft) : undefined;
    await patch.mutateAsync({ secondaryCaseManagerId: secondaryDraft || undefined, secondaryCaseManagerName: secondaryDraft ? name : undefined });
    setEditingSecondary(false);
  };

  const activeEnrollments = enrollments.filter(isActiveEnrollment);
  const isBusy = patch.isPending;

  const selectCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors";

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-2xl font-bold text-indigo-600">{activeEnrollments.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active Programs</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-2xl font-bold text-slate-700">{enrollments.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total Enrollments</p>
        </div>
      </div>

      {/* Primary CM */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Primary Case Manager</p>
          {!editingPrimary && (
            <button
              type="button"
              onClick={() => { setPrimaryDraft(customer.caseManagerId ?? ""); setEditingPrimary(true); }}
              className="text-xs font-semibold text-indigo-600 active:text-indigo-800"
            >
              Change
            </button>
          )}
        </div>

        {editingPrimary ? (
          <div className="flex flex-col gap-2">
            <select
              className={selectCls}
              value={primaryDraft}
              onChange={(e) => setPrimaryDraft(e.target.value)}
              disabled={isBusy}
            >
              <option value="">— Unassigned —</option>
              {knownCMs
                .filter((cm) => cm.uid !== (customer.secondaryCaseManagerId ?? ""))
                .map((cm) => <option key={cm.uid} value={cm.uid}>{cm.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void savePrimary()}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50 active:bg-indigo-700"
              >
                {isBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingPrimary(false)}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-900">
            {customer.caseManagerName || labelFor(customer.caseManagerId) || "Unassigned"}
          </p>
        )}
      </div>

      {/* Secondary CM */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Secondary Case Manager</p>
          {!editingSecondary && (
            <button
              type="button"
              onClick={() => { setSecondaryDraft(customer.secondaryCaseManagerId ?? ""); setEditingSecondary(true); }}
              className="text-xs font-semibold text-indigo-600 active:text-indigo-800"
            >
              Change
            </button>
          )}
        </div>

        {editingSecondary ? (
          <div className="flex flex-col gap-2">
            <select
              className={selectCls}
              value={secondaryDraft}
              onChange={(e) => setSecondaryDraft(e.target.value)}
              disabled={isBusy}
            >
              <option value="">— None —</option>
              {knownCMs
                .filter((cm) => cm.uid !== (customer.caseManagerId ?? ""))
                .map((cm) => <option key={cm.uid} value={cm.uid}>{cm.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveSecondary()}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50 active:bg-indigo-700"
              >
                {isBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingSecondary(false)}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-900">
            {customer.secondaryCaseManagerName || labelFor(customer.secondaryCaseManagerId) || "None"}
          </p>
        )}
      </div>

      {/* Other contacts */}
      {customer.otherContacts && customer.otherContacts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Other Contacts</p>
          {customer.otherContacts.map((c, i) => (
            <div key={`${c.uid}-${i}`} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-500">
                  {(c.name ?? c.uid)[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{c.name ?? c.uid}</p>
                {c.role && <p className="text-xs text-slate-400">{c.role}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "info" | "cm" | "enrollments" | "plan" | "sessions";

function StatusToggle({ customer }: { customer: Customer }) {
  const toggleActive = useToggleCustomerActive(customer.id);
  const isActive = customer.active !== false;

  return (
    <button
      type="button"
      onClick={() => toggleActive.mutate({ active: !isActive })}
      disabled={toggleActive.isPending}
      className={`text-sm font-medium px-3 py-1 rounded-full transition-colors active:scale-95 disabled:opacity-60 ${
        isActive ? "bg-green-100 text-green-700 active:bg-green-200" : "bg-slate-100 text-slate-500 active:bg-slate-200"
      }`}
    >
      {toggleActive.isPending ? "Saving…" : isActive ? "Active" : "Inactive"}
    </button>
  );
}

function InfoTab({
  customer,
  activeEnrollments,
  onReassignCM,
}: {
  customer: Customer;
  activeEnrollments: Enrollment[];
  onReassignCM: () => void;
}) {
  const age = calcAge(customer.dob);
  const markInactive = useMarkCustomerInactive(customer.id);
  const [confirmingInactive, setConfirmingInactive] = useState(false);

  const handleMarkInactive = async () => {
    const ids = activeEnrollments.map((e) => e.id);
    await markInactive.mutateAsync(ids);
    setConfirmingInactive(false);
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        <StatusToggle customer={customer} />
        {customer.population && (
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${populationColors(customer.population).bg} ${populationColors(customer.population).text}`}>
            {customer.population}
          </span>
        )}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-2">
        <InfoField label="Date of Birth" value={fmtDOB(customer.dob)} />
        <InfoField label="CW ID" value={customer.cwId} />
        {customer.hmisId && <InfoField label="HMIS ID" value={customer.hmisId} />}
        {customer.phone && <InfoField label="Phone" value={customer.phone} />}
        {customer.email && <InfoField label="Email" value={customer.email} />}
      </div>

      {/* Case Manager + reassign */}
      <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Case Manager</p>
          <p className="text-sm font-medium text-slate-900 truncate">{customer.caseManagerName || "Unassigned"}</p>
        </div>
        <button
          type="button"
          onClick={onReassignCM}
          className="text-xs font-semibold text-indigo-600 active:text-indigo-800 flex-shrink-0"
        >
          Reassign
        </button>
      </div>

      {/* Notes */}
      {customer.meta?.notes && (
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Notes</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{customer.meta.notes}</p>
        </div>
      )}

      {/* Drive folder — link an indexed folder, build a new one, or paste a link */}
      <CustomerFolderSection customer={customer} />

      {/* Mark inactive */}
      {customer.active !== false && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col gap-3 mt-1">
          {!confirmingInactive ? (
            <button
              type="button"
              onClick={() => setConfirmingInactive(true)}
              className="text-sm font-semibold text-red-600 active:text-red-800 text-left"
            >
              Mark Customer Inactive…
            </button>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-800">Mark as inactive?</p>
              <p className="text-xs text-slate-500">
                This will close the customer record
                {activeEnrollments.length > 0
                  ? ` and mark ${activeEnrollments.length} active program${activeEnrollments.length !== 1 ? "s" : ""} inactive`
                  : ""}.
              </p>
              {markInactive.isError && (
                <p className="text-xs text-red-600">{(markInactive.error as Error).message}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleMarkInactive()}
                  disabled={markInactive.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50 active:bg-red-700 transition-colors"
                >
                  {markInactive.isPending ? "Saving…" : "Confirm Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingInactive(false)}
                  disabled={markInactive.isPending}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Wraps a program card with a left-swipe "Close Today" reveal action (active
// enrollments only) and routes plain taps to the edit sheet.
function SwipeCloseRow({
  swipeEnabled,
  closing,
  onOpen,
  onCloseToday,
  children,
}: {
  swipeEnabled: boolean;
  closing: boolean;
  onOpen: () => void;
  onCloseToday: () => void;
  children: React.ReactNode;
}) {
  const REVEAL = 92;
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const dragging = useRef(false);
  const wasDragged = useRef(false);
  const startX = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    if (!swipeEnabled) return;
    dragging.current = true;
    wasDragged.current = false;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) wasDragged.current = true;
    const base = revealed ? -REVEAL : 0;
    const next = Math.min(0, Math.max(-REVEAL, base + delta));
    setDragX(next);
  }
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldReveal = dragX <= -REVEAL / 2;
    setRevealed(shouldReveal);
    setDragX(shouldReveal ? -REVEAL : 0);
  }
  function handleClick() {
    // A drag-to-reveal gesture ends with a trailing click on the same element —
    // swallow it so the reveal doesn't immediately collapse before it can be tapped.
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    if (revealed) {
      setRevealed(false);
      setDragX(0);
      return;
    }
    onOpen();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {swipeEnabled && (
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          <button
            type="button"
            onClick={() => {
              onCloseToday();
              setRevealed(false);
              setDragX(0);
            }}
            disabled={closing}
            className="w-[92px] flex flex-col items-center justify-center gap-1 bg-red-600 text-white active:bg-red-700 disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            <span className="text-[11px] font-semibold">{closing ? "Closing…" : "Close Today"}</span>
          </button>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? "none" : "transform 200ms ease",
          touchAction: swipeEnabled ? "pan-y" : undefined,
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}

function EnrollmentsTab({ customer, enrollments, loading }: { customer: Customer; enrollments: Enrollment[]; loading: boolean }) {
  const active = enrollments.filter(isActiveEnrollment);
  const past = enrollments.filter((e) => !isActiveEnrollment(e));

  const updateEnrollment = useUpdateEnrollment(customer.id);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  async function handleSaveEdit(patch: ProgramEditPatch) {
    if (!editing) return;
    await updateEnrollment.mutateAsync({ id: editing.id, ...patch });
    setEditing(null);
  }

  async function handleCloseToday(e: Enrollment) {
    setClosingId(e.id);
    try {
      await updateEnrollment.mutateAsync({
        id: e.id,
        active: false,
        status: "closed",
        endDate: new Date().toISOString().slice(0, 10),
      });
    } finally {
      setClosingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {[...Array(2)].map((_, i) => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {editing && (
        <ProgramEditSheet
          enrollment={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => void handleSaveEdit(patch)}
          saving={updateEnrollment.isPending}
        />
      )}

      {enrolling && (
        <EnrollProgramSheet
          customer={customer}
          enrollments={enrollments}
          onClose={() => setEnrolling(false)}
          onEnrolled={() => setEnrolling(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setEnrolling(true)}
        className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white flex items-center justify-center gap-2 active:bg-indigo-700 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Enroll in Program
      </button>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active</p>
          <span className="text-xs text-slate-400">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-1">No active enrollments</p>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((e) => (
              <SwipeCloseRow
                key={e.id}
                swipeEnabled
                closing={closingId === e.id}
                onOpen={() => setEditing(e)}
                onCloseToday={() => void handleCloseToday(e)}
              >
                <EnrollmentCard enrollment={e} />
              </SwipeCloseRow>
            ))}
          </div>
        )}
        {active.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-2">Tap a program to edit · swipe left to close today</p>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Past</p>
            <span className="text-xs text-slate-400">{past.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {past.map((e) => (
              <SwipeCloseRow key={e.id} swipeEnabled={false} closing={false} onOpen={() => setEditing(e)} onCloseToday={() => {}}>
                <EnrollmentCard enrollment={e} />
              </SwipeCloseRow>
            ))}
          </div>
        </section>
      )}

      {enrollments.length === 0 && (
        <p className="text-sm text-slate-400 italic py-4 text-center">No enrollment records found</p>
      )}
    </div>
  );
}

// Outbox drafts for this customer, kept in sync with localStorage changes.
function useOutboxDrafts(uid: string | undefined, customerId: string): OutboxEntry[] {
  const [drafts, setDrafts] = useState<OutboxEntry[]>([]);
  useEffect(() => {
    const update = () => setDrafts(listOutbox(uid).filter((d) => d.body.customerId === customerId));
    update();
    return subscribeOutbox(update);
  }, [uid, customerId]);
  return drafts;
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

const SESSION_SYNC_CHIPS = [
  { key: "all" as const, label: "All" },
  { key: "synced" as const, label: "Synced" },
  { key: "unsynced" as const, label: "Not synced" },
];
type SessionSyncFilter = (typeof SESSION_SYNC_CHIPS)[number]["key"];

function SessionsTab({ customer, user }: { customer: Customer; user: User | null }) {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeKey>("month");
  const [syncFilter, setSyncFilter] = useState<SessionSyncFilter>("all");

  const q = useCustomerSessions(user?.uid, customer.id, range);
  const sessions = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  // Workbook synced/not-synced filter (list only — pendingCount/Sync all still
  // look at every loaded session so nothing silently drops out of a bulk sync).
  const visibleSessions = useMemo(() => {
    if (syncFilter === "all") return sessions;
    return sessions.filter((s) =>
      syncFilter === "synced" ? s.workbookSynced === true : s.workbookSynced !== true,
    );
  }, [sessions, syncFilter]);

  const customerHasWorkbook = !!getWorkbookLink(customer);
  const sync = useSessionSync(user, { customerHasWorkbook });
  const drafts = useOutboxDrafts(user?.uid, customer.id);
  const createActivity = useCreateActivity(user);
  const editActivity = useEditActivity();
  const deleteActivity = useDeleteActivity();

  // AI case-note assistant eligibility — mirrors the Log Session form: org
  // config enabled + personal opt-in + linked workbook whose variant is in the
  // org allowlist.
  const aiConfig = useCaseNoteAssistantConfig();
  const { prefs } = useUserPrefs(user?.uid);
  const normVariant = (v: unknown) => String(v ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  const wb = (customer as Customer & { customerDrive?: { linkedWorkbooks?: { tss?: Record<string, unknown> } } }).customerDrive?.linkedWorkbooks?.tss;
  const workbookVariant = normVariant(wb?.variant ?? wb?.workbookVariant ?? wb?.detectedVariant ?? "");
  const allowedVariants = (aiConfig.data?.allowedWorkbookVariants ?? ["payer"]).map(normVariant);
  const assistant =
    aiConfig.data?.enabled === true && prefs.allowAiAssistance && customerHasWorkbook && !!workbookVariant && allowedVariants.includes(workbookVariant)
      ? {
          clientLabel: aiConfig.data?.defaultClientLabel ?? "client",
          staffLabel: aiConfig.data?.defaultStaffLabel ?? "case manager",
        }
      : null;

  const [editing, setEditing] = useState<TCmActivity | null>(null);
  const [syncingDraftId, setSyncingDraftId] = useState<string | null>(null);

  const grouped = useMemo(() => groupByDate(visibleSessions), [visibleSessions]);
  const pendingCount = sync.pendingCount(sessions) + drafts.length;

  async function flushDraft(draft: OutboxEntry) {
    if (!user) return;
    setSyncingDraftId(draft.localId);
    try {
      const id = await createActivity.mutateAsync(draft.body);
      const session: TCmActivity = {
        id,
        orgId: customer.orgId ?? "",
        caseManagerId: user.uid,
        caseManagerName: user.displayName ?? "",
        customerId: draft.body.customerId,
        customerName: draft.body.customerName,
        type: draft.body.type,
        date: draft.body.date,
        startTime: draft.body.startTime,
        endTime: draft.body.endTime,
        note: draft.body.note,
        calendarSynced: false,
        workbookSynced: false,
        createdAt: new Date().toISOString(),
      };
      await sync.syncOne(session, {
        linkedGoals: draft.intent.linkedGoals,
        only: { calendar: draft.intent.calendar, workbook: draft.intent.workbook },
      });
      removeOutbox(user.uid, draft.localId);
    } finally {
      setSyncingDraftId(null);
    }
  }

  async function handleSyncAll() {
    for (const d of [...drafts]) await flushDraft(d);
    await sync.syncAll(sessions);
  }

  async function handleSaveEdit(fields: SessionEditFields, updateWorkbook: boolean) {
    if (!editing) return;
    const updated = await editActivity.mutateAsync({ session: editing, fields, updateWorkbook });
    // Smart re-sync: calendar updates in place; workbook re-pushes only if asked.
    if (sync.calendarConnected || sync.driveConnected) {
      await sync.syncOne(updated, { useTodayDate: true });
    }
    setEditing(null);
  }

  async function handleDelete() {
    if (!editing) return;
    await deleteActivity.mutateAsync(editing.id);
    setEditing(null);
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {editing && (
        <SessionEditSheet
          session={editing}
          use24h={false}
          assistant={assistant}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          saving={editActivity.isPending}
          deleting={deleteActivity.isPending}
        />
      )}

      {/* New session button */}
      <button
        type="button"
        onClick={() =>
          navigate(`/log?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`)
        }
        className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white flex items-center justify-center gap-2 active:bg-indigo-700 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Log New Session
      </button>

      {/* Sync all */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
          <span className="text-xs font-medium text-amber-700">
            {pendingCount} session{pendingCount !== 1 ? "s" : ""} need{pendingCount === 1 ? "s" : ""} syncing
          </span>
          <SyncButton onClick={() => void handleSyncAll()} busy={sync.syncAllRunning} label="Sync all" busyLabel="Syncing…" />
        </div>
      )}

      {/* Date filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        {DATE_RANGE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setRange(chip.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
              range === chip.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Workbook sync filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">Workbook</span>
        {SESSION_SYNC_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setSyncFilter(chip.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
              syncFilter === chip.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Offline drafts (always shown, newest first) */}
      {drafts.length > 0 && (
        <div className="flex flex-col gap-2">
          {drafts.map((d) => (
            <DraftRow
              key={d.localId}
              draft={d}
              syncing={syncingDraftId === d.localId}
              onSync={() => void flushDraft(d)}
              onDiscard={() => user && removeOutbox(user.uid, d.localId)}
            />
          ))}
        </div>
      )}

      {/* Query failure — surface it instead of masquerading as an empty list */}
      {q.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
          <p className="text-xs font-semibold text-red-700">Couldn't load sessions</p>
          <p className="text-xs text-red-600/80 mt-0.5 break-words">
            {q.error instanceof Error ? q.error.message : "Please try again."}
          </p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 active:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : grouped.length === 0 && drafts.length === 0 ? (
        !q.isError && (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No sessions in this range</p>
            <p className="text-slate-400 text-xs mt-1">Try a wider filter or log a new session</p>
          </div>
        )
      ) : (
        <>
          {grouped.map(({ date, items }) => (
            <section key={date}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{fmtDate(date)}</p>
              <div className="flex flex-col gap-2">
                {items.map((a) => (
                  <SessionRow
                    key={a.id}
                    activity={a}
                    syncState={sync.stateFor(a)}
                    syncing={sync.isSyncing(a.id)}
                    onSync={() => void sync.syncOne(a)}
                    onOpen={() => setEditing(a)}
                  />
                ))}
              </div>
            </section>
          ))}

          {q.hasNextPage && !q.isFetchingNextPage && <LoadMoreTrigger onVisible={() => void q.fetchNextPage()} />}
          {q.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Plan tab (Goals + Progress Notes from the linked workbook) ───────────────

function cellText(row: TssNS.TssExtractedRow, fieldId: string): string {
  const c = row.values?.[fieldId];
  if (!c) return "";
  const v = c.displayValue ?? c.value;
  return v == null ? "" : String(v).trim();
}

function rowExpectedValues(row: TssNS.TssExtractedRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [fieldId, cell] of Object.entries(row.values ?? {})) {
    const value = String(cell?.displayValue ?? cell?.value ?? "").trim();
    if (value) out[fieldId] = value;
  }
  return out;
}

function findEntity(
  extract: TssNS.TssWorkbookExtract,
  entityId: string,
): TssNS.TssExtractedEntity | undefined {
  return extract.entities.find((e) => e.entityId === entityId);
}

function goalStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "open":    return "bg-amber-100 text-amber-700";
    case "closed":  return "bg-emerald-100 text-emerald-700";
    case "on hold": return "bg-slate-100 text-slate-600";
    default:        return "bg-indigo-100 text-indigo-700";
  }
}

function GoalCard({ row, n, onEdit, onDelete }: {
  row: TssNS.TssExtractedRow;
  n: number;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const goal = cellText(row, "goalSmart");
  const objective = cellText(row, "objective");
  const status = cellText(row, "status");
  const responsible = cellText(row, "responsible");
  const targetDate = cellText(row, "targetDate");
  const tier = cellText(row, "serviceTier");

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
            {n}
          </span>
          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1 whitespace-pre-wrap">
            {goal || "—"}
          </p>
        </div>
        {status && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${goalStatusColor(status)}`}>
            {status}
          </span>
        )}
      </div>
      {objective && <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap">{objective}</p>}
      {(responsible || targetDate || tier) && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {responsible && <span><span className="text-slate-400">Owner:</span> {responsible}</span>}
          {targetDate && <span><span className="text-slate-400">Target:</span> {fmtDate(targetDate)}</span>}
          {tier && <span><span className="text-slate-400">Tier:</span> {tier}</span>}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div className="mt-2.5 flex justify-end gap-3">
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-xs font-semibold text-red-600 active:text-red-800">
              Delete
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-indigo-600 active:text-indigo-800">
            Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Writable goal fields, sourced from the TSS config so labels/dropdowns stay in
// sync with the contract. (Org overrides aren't applied here — baseline fields.)
const GOAL_FIELDS = (tss.TSS_GOALS_ENTITY.fields ?? []).filter(
  (f) => f.dataType !== "computed" && f.write?.enabled !== false,
);

function goalFieldOptions(field: TssNS.TssSmartHeaderConfig): string[] {
  const id = field.optionSourceId;
  if (!id) return [];
  const list = (tss.TSS_DROPDOWN_LISTS as Record<string, { values?: string[] }>)[id];
  return Array.isArray(list?.values) ? list!.values : [];
}

const AI_GOAL_FIELD_IDS = ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria"] as const;

function SmartGoalAssist({
  customerId,
  disabled,
  onGenerated,
}: {
  customerId: string;
  disabled: boolean;
  onGenerated: (goal: Record<string, string>, missingInfo: string[]) => void;
}) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useGenerateSmartGoalSuggestion();

  async function generate() {
    if (!description.trim()) return;
    setError(null);
    try {
      const resp = await mutation.mutateAsync({ customerId, description: description.trim(), clientLabel: "client", staffLabel: "case manager" });
      onGenerated(resp.goal, resp.missingInfo ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the goal.");
    }
  }

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-indigo-900">SMART Goal Assistant <span className="font-medium text-indigo-600">Beta</span></p>
      </div>
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={disabled || mutation.isPending}
        placeholder="Describe the goal in 1-2 sentences."
        className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
      />
      <button
        type="button"
        onClick={() => void generate()}
        disabled={disabled || mutation.isPending || !description.trim()}
        className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
      >
        {mutation.isPending ? "Generating..." : "Generate Recommendation"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

function GoalEditSheet({
  customerId,
  goalRow,
  onClose,
  onSaved,
}: {
  customerId: string;
  /** null → add a new goal; otherwise edit this extracted row in place. */
  goalRow: TssNS.TssExtractedRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!goalRow;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (goalRow) {
      for (const f of GOAL_FIELDS) {
        const c = goalRow.values?.[f.id];
        init[f.id] = c ? String(c.displayValue ?? c.value ?? "").trim() : "";
      }
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiConfig = useCaseNoteAssistantConfig();
  const [aiNotes, setAiNotes] = useState<string[]>([]);

  const setField = (id: string, v: string) => setValues((cur) => ({ ...cur, [id]: v }));
  const missingRequired = GOAL_FIELDS.some((f) => f.required && !String(values[f.id] || "").trim());
  const aiEnabled = aiConfig.data?.enabled === true;

  function applyGenerated(goal: Record<string, string>, missingInfo: string[]) {
    setValues((cur) => {
      const next = { ...cur };
      for (const id of AI_GOAL_FIELD_IDS) {
        const v = String(goal[id] ?? "").trim();
        if (v) next[id] = v;
      }
      if (!String(next.status ?? "").trim()) next.status = "Open";
      return next;
    });
    setAiNotes(missingInfo);
  }

  async function save() {
    if (missingRequired) { setError("Fill in the required fields."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const f of GOAL_FIELDS) {
        const v = String(values[f.id] ?? "").trim();
        // Edit sends every field (empty clears); add sends only filled fields.
        if (isEdit) payload[f.id] = v;
        else if (v) payload[f.id] = v;
      }
      const resp = await GoogleIntegrations.pushWorkbookRow({
        customerId,
        entityId: "goals",
        values: payload,
        ...(isEdit ? { mode: "update" as const, rowKey: goalRow!.rowKey } : { mode: "insert" as const }),
      });
      if (!resp.ok) { setError(resp.error || "Could not save the goal."); return; }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pt-2 pb-6 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? "Edit Goal" : "Add Goal"}</h2>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Available for edits too — regenerating overwrites the AI-mapped fields. */}
          {aiEnabled && (
            <SmartGoalAssist customerId={customerId} disabled={saving} onGenerated={applyGenerated} />
          )}

          {aiNotes.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Missing info:</span> {aiNotes.join(", ")}
            </div>
          )}

          {GOAL_FIELDS.map((f) => {
            const label = f.display?.label ?? f.expected;
            const value = values[f.id] ?? "";
            const opts = goalFieldOptions(f);
            const base = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
            return (
              <div key={f.id} className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {label}{f.required ? <span className="text-red-500"> *</span> : null}
                </label>
                {f.dataType === "select" && opts.length ? (
                  <select className={base} value={value} onChange={(e) => setField(f.id, e.target.value)} disabled={saving}>
                    <option value="">—</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.dataType === "date" ? (
                  <input type="date" className={base} value={value} onChange={(e) => setField(f.id, e.target.value)} disabled={saving} />
                ) : f.dataType === "longText" ? (
                  <textarea rows={2} className={`${base} resize-none`} value={value} onChange={(e) => setField(f.id, e.target.value)} disabled={saving} />
                ) : (
                  <input type="text" className={base} value={value} onChange={(e) => setField(f.id, e.target.value)} disabled={saving} />
                )}
              </div>
            );
          })}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {!isEdit && (
            <p className="text-[11px] text-slate-400">
              Adds a new row to the goals table — the sections below it are pushed down, never overwritten.
            </p>
          )}

          <button type="button" onClick={() => void save()} disabled={saving || missingRequired}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add goal"}
          </button>
        </div>
      </div>
    </>
  );
}

function NoteCard({ row, onDelete }: { row: TssNS.TssExtractedRow; onDelete?: () => void }) {
  const date = cellText(row, "progressDate");
  const summary = cellText(row, "summary");
  const response = cellText(row, "clientResponseProgress");
  const tier = cellText(row, "serviceTier");
  const linkedGoal = cellText(row, "linkedPlanGoal");
  const staff = cellText(row, "staffName") || cellText(row, "staffInitial");
  const time = (() => {
    const s = cellText(row, "startTime");
    const e = cellText(row, "endTime");
    return s ? (e ? `${s} – ${e}` : s) : "";
  })();

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {date && <span className="text-xs font-semibold text-slate-700">{fmtDate(date)}</span>}
        {time && <span className="text-xs text-slate-400">{time}</span>}
        {tier && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{tier}</span>}
        {staff && <span className="ml-auto text-xs text-slate-400">{staff}</span>}
        {onDelete && (
          <button type="button" onClick={onDelete} className="ml-auto text-xs font-semibold text-red-600 active:text-red-800">
            Delete
          </button>
        )}
      </div>
      {summary && <p className="text-sm text-slate-700 leading-snug whitespace-pre-wrap">{summary}</p>}
      {response && (
        <p className="text-sm text-slate-500 mt-1.5 whitespace-pre-wrap">
          <span className="text-slate-400">Response: </span>{response}
        </p>
      )}
      {linkedGoal && <p className="text-xs text-slate-400 mt-1.5">Linked goal: {linkedGoal}</p>}
    </div>
  );
}

function PlanSection({
  title,
  entity,
  renderRow,
}: {
  title: string;
  entity: TssNS.TssExtractedEntity | undefined;
  renderRow: (row: TssNS.TssExtractedRow) => React.ReactNode;
}) {
  const rows = entity?.rows ?? [];
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        {rows.length > 0 && <span className="text-xs text-slate-400">{rows.length}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-1">No {title.toLowerCase()} recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">{rows.map((r) => <div key={r.rowKey}>{renderRow(r)}</div>)}</div>
      )}
    </section>
  );
}

function WorkbookOpenLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50 transition-colors"
    >
      <span className="text-base">↗</span>
      <span className="text-sm font-semibold text-slate-700 truncate">{label}</span>
    </a>
  );
}

function PlanTab({ customer }: { customer: Customer }) {
  const { user } = useAuth();
  const wb = useWorkbookData(customer.id);
  const drive = useDriveIntegration(user ?? null);
  const link = getWorkbookLink(customer);

  // Goal add/edit sheet. { row: null } = add; { row } = edit that goal in place.
  const [goalEdit, setGoalEdit] = useState<{ row: TssNS.TssExtractedRow | null } | null>(null);
  const [deletingRowKey, setDeletingRowKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ row: TssNS.TssExtractedRow; entityId: "goals" | "progressNotes" } | null>(null);
  const [deleteCalendarEvent, setDeleteCalendarEvent] = useState(false);

  const handleConnect = async () => {
    const res = await drive.connectViaPopup();
    if (res.result === "connected") void wb.refetch();
  };

  if (wb.isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const data = wb.data;

  if (data && (data.kind === "not_connected" || data.kind === "scope_missing")) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-900">
            {data.kind === "scope_missing" ? "Reconnect Google Drive" : "Connect Google Drive"}
          </p>
          <p className="text-xs text-slate-500">
            Connect Google Drive to view this customer's goals and progress notes from their TSS workbook here in the app.
          </p>
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={drive.connectingViaPopup}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 active:bg-indigo-700 transition-colors"
          >
            {drive.connectingViaPopup ? "Connecting…" : data.kind === "scope_missing" ? "Reconnect" : "Connect now"}
          </button>
        </div>
        {link && <WorkbookOpenLink url={link.url} label={link.name} />}
        {link && <WorkbookVariantToggle customerId={customer.id} variant={customer.customerDrive?.linkedWorkbooks?.tss?.variant} />}
      </div>
    );
  }

  if (data && data.kind === "not_linked") {
    return (
      <div className="p-4">
        <WorkbookLinkSection customer={customer} onLinked={() => void wb.refetch()} />
      </div>
    );
  }

  if (!data || data.kind === "error") {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Couldn't load workbook content</p>
          <p className="text-xs text-amber-700 mt-1">{data?.kind === "error" ? data.message : "Please try again."}</p>
        </div>
        {link && <WorkbookOpenLink url={link.url} label={link.name} />}
        {link && <WorkbookVariantToggle customerId={customer.id} variant={customer.customerDrive?.linkedWorkbooks?.tss?.variant} />}
      </div>
    );
  }

  const goals = findEntity(data.extract, "goals");
  const notes = findEntity(data.extract, "progressNotes");
  const goalRows = goals?.rows ?? [];
  const canEditGoals = drive.connected;
  const canDeleteRows = drive.connected;
  const openLabel = link?.name || data.extract.spreadsheetName || "Open workbook";
  const openUrl = link?.url || `https://docs.google.com/spreadsheets/d/${data.extract.spreadsheetId}/edit`;

  function requestDeleteWorkbookRow(row: TssNS.TssExtractedRow, entityId: "goals" | "progressNotes") {
    setDeleteCalendarEvent(false);
    setPendingDelete({ row, entityId });
  }

  async function confirmDeleteWorkbookRow() {
    if (!pendingDelete) return;
    const { row, entityId } = pendingDelete;
    const label = entityId === "goals" ? "goal" : "progress note";
    setDeletingRowKey(row.rowKey);
    try {
      const resp = await GoogleIntegrations.deleteWorkbookRow({
        customerId: customer.id,
        entityId,
        rowKey: row.rowKey,
        expectedValues: rowExpectedValues(row),
        ...(entityId === "progressNotes"
          ? {
              deleteCalendarEvent,
              rowFingerprint: {
                date: cellText(row, "progressDate"),
                startTime: cellText(row, "startTime"),
                endTime: cellText(row, "endTime"),
                summary: cellText(row, "summary"),
              },
            }
          : {}),
      });
      if (!resp.ok) throw new Error(resp.error || `Could not delete the ${label}.`);
      setPendingDelete(null);
      void wb.refetch();
    } catch (e) {
      const message = e instanceof Error && /row_out_of_sync|row_fingerprint_required/.test(e.message)
        ? "The workbook changed since this screen loaded. Open the workbook and make this change manually so the wrong row is not deleted."
        : e instanceof Error ? e.message : `Could not delete the ${label}.`;
      window.alert(message);
    } finally {
      setDeletingRowKey(null);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      {goalEdit && (
        <GoalEditSheet
          customerId={customer.id}
          goalRow={goalEdit.row}
          onClose={() => setGoalEdit(null)}
          onSaved={() => { setGoalEdit(null); void wb.refetch(); }}
        />
      )}

      <WorkbookOpenLink url={openUrl} label={openLabel} />
      <WorkbookVariantToggle customerId={customer.id} variant={customer.customerDrive?.linkedWorkbooks?.tss?.variant} />

      {/* Goals */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Goals{goalRows.length > 0 && <span className="ml-1.5 text-slate-300">{goalRows.length}</span>}
          </p>
          {canEditGoals && (
            <button
              type="button"
              onClick={() => setGoalEdit({ row: null })}
              className="text-xs font-semibold text-indigo-600 active:text-indigo-800 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add goal
            </button>
          )}
        </div>
        {goalRows.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-1">No goals recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {goalRows.map((r, i) => (
              <GoalCard
                key={r.rowKey}
                row={r}
                n={i + 1}
                onEdit={canEditGoals ? () => setGoalEdit({ row: r }) : undefined}
                onDelete={canDeleteRows ? () => requestDeleteWorkbookRow(r, "goals") : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {deletingRowKey && (
        <p className="text-xs text-slate-400">Deleting row {deletingRowKey.replace("row-", "")}...</p>
      )}

      <PlanSection
        title="Progress Notes"
        entity={notes}
        renderRow={(r) => (
          <NoteCard
            row={r}
            onDelete={canDeleteRows ? () => requestDeleteWorkbookRow(r, "progressNotes") : undefined}
          />
        )}
      />
      {pendingDelete && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPendingDelete(null)} />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="px-5 pt-2 pb-6 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Are you sure?</h2>
              <p className="text-sm text-slate-600">
                This will clear the {pendingDelete.entityId === "goals" ? "goal" : "progress note"} cells only if the workbook still matches this screen.
                If it changed, deletion will stop and you will need to update the workbook manually.
              </p>
              {pendingDelete.entityId === "progressNotes" && (
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={deleteCalendarEvent}
                    onChange={(e) => setDeleteCalendarEvent(e.target.checked)}
                  />
                  Delete linked calendar event if one exists
                </label>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={!!deletingRowKey}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 active:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteWorkbookRow()}
                  disabled={!!deletingRowKey}
                  className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50"
                >
                  {deletingRowKey ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Drive icon ───────────────────────────────────────────────────────────────

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [autoEditPrimaryCM, setAutoEditPrimaryCM] = useState(false);

  const { data: customer, isLoading: loadingCustomer } = useCustomer(id);
  const { data: enrollments = [], isLoading: loadingEnrollments } = useCustomerEnrollments(id);

  const handleReassignCM = () => {
    setAutoEditPrimaryCM(true);
    setActiveTab("cm");
  };

  const pop = populationColors(customer?.population);

  if (loadingCustomer) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-indigo-600 pt-safe-top px-4 pb-4">
          <button onClick={() => navigate(-1)} className="text-indigo-200 mt-2 mb-3 flex items-center gap-1 text-sm">
            <ChevronLeft />Back
          </button>
          <div className="h-7 w-48 bg-indigo-500 rounded-lg animate-pulse" />
        </div>
        <div className="p-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-indigo-600 pt-safe-top px-4 pb-4">
          <button onClick={() => navigate(-1)} className="text-indigo-200 mt-2 mb-3 flex items-center gap-1 text-sm">
            <ChevronLeft />Customers
          </button>
          <p className="text-white text-lg font-semibold">Customer not found</p>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "info", label: "Info" },
    { id: "cm", label: "CM" },
    { id: "enrollments", label: "Programs", count: enrollments.length || undefined },
    { id: "plan", label: "Plan" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-600 pt-safe-top flex-shrink-0">
        <div className="px-4 pt-2 pb-0">
          <button
            onClick={() => navigate(-1)}
            className="text-indigo-200 mb-2 flex items-center gap-1 text-sm active:text-white transition-colors"
          >
            <ChevronLeft />Customers
          </button>
          <h1 className="text-xl font-bold text-white leading-tight">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-3">
            {customer.population && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${pop.bg} ${pop.text}`}>
                {customer.population}
              </span>
            )}
            {calcAge(customer.dob) !== null && (
              <span className="text-xs text-indigo-200">{calcAge(customer.dob)}y</span>
            )}
            {customer.cwId && (
              <span className="text-xs text-indigo-200">CW {customer.cwId}</span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-indigo-500/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "text-white border-white"
                  : "text-indigo-300 border-transparent hover:text-indigo-100"
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-indigo-500/50 text-indigo-200"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-safe-bottom">
        {activeTab === "info" && (
          <InfoTab
            customer={customer}
            activeEnrollments={enrollments.filter(isActiveEnrollment)}
            onReassignCM={handleReassignCM}
          />
        )}
        {activeTab === "cm" && (
          <CaseManagementTab
            customer={customer}
            enrollments={enrollments}
            autoEditPrimary={autoEditPrimaryCM}
            onAutoEditHandled={() => setAutoEditPrimaryCM(false)}
          />
        )}
        {activeTab === "enrollments" && (
          <EnrollmentsTab customer={customer} enrollments={enrollments} loading={loadingEnrollments} />
        )}
        {activeTab === "plan" && <PlanTab customer={customer} />}
        {activeTab === "sessions" && <SessionsTab customer={customer} user={user} />}
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}
