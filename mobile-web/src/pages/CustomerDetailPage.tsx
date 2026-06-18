import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCustomer, useOrgCustomers, usePatchCustomer, useMarkCustomerInactive, getWorkbookLink, type Customer, type DriveFolderRef } from "@/hooks/useCustomers";
import { useCustomerEnrollments, type Enrollment } from "@/hooks/useCustomerEnrollments";
import { useCustomerSessions } from "@/hooks/useCustomerSessions";
import { useWorkbookData } from "@/hooks/useWorkbookData";
import { useDriveIntegration } from "@/hooks/useCalendarIntegration";
import type { TCmActivity, TCmActivityType, tss as TssNS } from "@hdb/contracts";

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

// ─── Drive ────────────────────────────────────────────────────────────────────

const DRIVE_FOLDER_ID_RE = /^[-\w]{20,}$/;

function parseDriveFolderId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const byFolders = text.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolders) return byFolders;
  const byQuery = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  return DRIVE_FOLDER_ID_RE.test(text) ? text : "";
}

function folderUrl(idOrUrl: unknown): string {
  const text = String(idOrUrl ?? "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  const id = parseDriveFolderId(text);
  return id ? `https://drive.google.com/drive/folders/${id}` : "";
}

function getDriveLink(customer: Customer): { url: string; label: string } | null {
  const meta = customer.meta ?? {};
  const folders: DriveFolderRef[] = [
    ...(Array.isArray(meta.driveFolders) ? meta.driveFolders : []),
    ...(Array.isArray(customer.driveFolders) ? customer.driveFolders : []),
  ];
  const folder = folders.find((f) => folderUrl(f?.url) || folderUrl(f?.id));
  const url =
    folderUrl(folder?.url) || folderUrl(folder?.id) ||
    folderUrl(meta.driveFolderId) || folderUrl(customer.driveFolderId);
  if (!url) return null;
  const label = String(folder?.alias || folder?.name || "").trim() || "Open Drive folder";
  return { url, label };
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

function SessionCard({ activity }: { activity: TCmActivity }) {
  const typeLabel = TYPE_LABELS[activity.type] ?? activity.type;
  const typeColor = TYPE_COLORS[activity.type] ?? "bg-slate-100 text-slate-600";
  const dateStr = fmtDate(activity.date);
  const timeStr =
    activity.startTime
      ? activity.endTime
        ? `${activity.startTime} – ${activity.endTime}`
        : activity.startTime
      : null;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
        <span className="text-xs text-slate-400">{dateStr}</span>
        {timeStr && <span className="text-xs text-slate-400">{timeStr}</span>}
        {activity.workbookSynced && (
          <span className="ml-auto text-xs font-medium text-emerald-600" title="Pushed to workbook">📓 ✓</span>
        )}
      </div>
      {activity.note && (
        <p className="text-sm text-slate-700 leading-snug">{activity.note}</p>
      )}
    </div>
  );
}

// ─── Case Management tab ──────────────────────────────────────────────────────

function CaseManagementTab({
  customer,
  enrollments,
}: {
  customer: Customer;
  enrollments: Enrollment[];
}) {
  const { user } = useAuth();
  const { data: orgCustomers = [] } = useOrgCustomers(user);
  const patch = usePatchCustomer(customer.id);

  const [editingPrimary, setEditingPrimary] = useState(false);
  const [editingSecondary, setEditingSecondary] = useState(false);
  const [primaryDraft, setPrimaryDraft] = useState(customer.caseManagerId ?? "");
  const [secondaryDraft, setSecondaryDraft] = useState(customer.secondaryCaseManagerId ?? "");

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

function InfoTab({ customer, activeEnrollments }: { customer: Customer; activeEnrollments: Enrollment[] }) {
  const driveLink = getDriveLink(customer);
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
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${customer.active !== false ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {customer.active !== false ? "Active" : "Inactive"}
        </span>
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
        <InfoField label="Case Manager" value={customer.caseManagerName} />
      </div>

      {/* Notes */}
      {customer.meta?.notes && (
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Notes</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{customer.meta.notes}</p>
        </div>
      )}

      {/* Drive folder */}
      {driveLink ? (
        <a
          href={driveLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50 transition-colors"
        >
          <DriveIcon />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Google Drive</p>
            <p className="text-xs text-slate-500 truncate">{driveLink.label}</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-3.5">
          <DriveIcon muted />
          <div>
            <p className="text-sm font-medium text-slate-400">No Drive folder linked</p>
            <p className="text-xs text-slate-400">Set up in the web app</p>
          </div>
        </div>
      )}

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

function EnrollmentsTab({ enrollments, loading }: { enrollments: Enrollment[]; loading: boolean }) {
  const active = enrollments.filter(isActiveEnrollment);
  const past = enrollments.filter((e) => !isActiveEnrollment(e));

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {[...Array(2)].map((_, i) => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active</p>
          <span className="text-xs text-slate-400">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-1">No active enrollments</p>
        ) : (
          <div className="flex flex-col gap-3">{active.map((e) => <EnrollmentCard key={e.id} enrollment={e} />)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Past</p>
            <span className="text-xs text-slate-400">{past.length}</span>
          </div>
          <div className="flex flex-col gap-3">{past.map((e) => <EnrollmentCard key={e.id} enrollment={e} />)}</div>
        </section>
      )}

      {enrollments.length === 0 && (
        <p className="text-sm text-slate-400 italic py-4 text-center">No enrollment records found</p>
      )}
    </div>
  );
}

function SessionsTab({
  sessions,
  loading,
  customerId,
  customerName,
}: {
  sessions: TCmActivity[];
  loading: boolean;
  customerId: string;
  customerName: string;
}) {
  const navigate = useNavigate();
  const grouped = groupByDate(sessions);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* New session button */}
      <button
        type="button"
        onClick={() =>
          navigate(`/log?customerId=${customerId}&customerName=${encodeURIComponent(customerName)}`)
        }
        className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white flex items-center justify-center gap-2 active:bg-indigo-700 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Log New Session
      </button>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No sessions logged yet</p>
          <p className="text-slate-400 text-xs mt-1">Tap the button above to add the first one</p>
        </div>
      ) : (
        grouped.map(({ date, items }) => (
          <section key={date}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {fmtDate(date)}
            </p>
            <div className="flex flex-col gap-2">
              {items.map((a) => <SessionCard key={a.id} activity={a} />)}
            </div>
          </section>
        ))
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

function GoalCard({ row }: { row: TssNS.TssExtractedRow }) {
  const goal = cellText(row, "goalSmart");
  const objective = cellText(row, "objective");
  const status = cellText(row, "status");
  const responsible = cellText(row, "responsible");
  const targetDate = cellText(row, "targetDate");
  const tier = cellText(row, "serviceTier");

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug flex-1 whitespace-pre-wrap">
          {goal || "—"}
        </p>
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
    </div>
  );
}

function NoteCard({ row }: { row: TssNS.TssExtractedRow }) {
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
      </div>
    );
  }

  if (data && data.kind === "not_linked") {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4 text-center">
          <p className="text-sm font-medium text-slate-500">No workbook linked</p>
          <p className="text-xs text-slate-400 mt-1">Link a TSS workbook in the web app to see goals and notes here.</p>
        </div>
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
      </div>
    );
  }

  const goals = findEntity(data.extract, "goals");
  const notes = findEntity(data.extract, "progressNotes");
  const openLabel = link?.name || data.extract.spreadsheetName || "Open workbook";
  const openUrl = link?.url || `https://docs.google.com/spreadsheets/d/${data.extract.spreadsheetId}/edit`;

  return (
    <div className="p-4 flex flex-col gap-5">
      <WorkbookOpenLink url={openUrl} label={openLabel} />
      <PlanSection title="Goals" entity={goals} renderRow={(r) => <GoalCard row={r} />} />
      <PlanSection title="Progress Notes" entity={notes} renderRow={(r) => <NoteCard row={r} />} />
    </div>
  );
}

// ─── Drive icon ───────────────────────────────────────────────────────────────

function DriveIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg className={`w-8 h-8 flex-shrink-0 ${muted ? "opacity-30" : ""}`} viewBox="0 0 87.3 78" aria-hidden>
      <path fill="#0066da" d="M6.6 66.85 3.05 60.91l-3-5.19L29.3 10.3 41.43 31.4z" />
      <path fill="#00ac47" d="M50.86 31.4l12.13-21.1L87.3 55.72l-3 5.19-3.55 5.94z" />
      <path fill="#ea4335" d="M43.65 19.69l-14.35-9.39h56.7L70.45 47.8z" />
      <path fill="#00832d" d="M73.04 66.85H14.25l-7.65-5.94h73.76l-7.32 5.94z" />
      <path fill="#2684fc" d="M43.65 19.69 29.3 10.3h-8.69l14.35 9.39z" />
      <path fill="#ffba00" d="M43.65 19.69l26.8 28.11 3.56-5.5-14.23-22.61z" />
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("info");

  const { data: customer, isLoading: loadingCustomer } = useCustomer(id);
  const { data: enrollments = [], isLoading: loadingEnrollments } = useCustomerEnrollments(id);
  const { data: sessions = [], isLoading: loadingSessions } = useCustomerSessions(user?.uid, id);

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
    { id: "sessions", label: "Sessions", count: sessions.length || undefined },
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
          />
        )}
        {activeTab === "cm" && <CaseManagementTab customer={customer} enrollments={enrollments} />}
        {activeTab === "enrollments" && (
          <EnrollmentsTab enrollments={enrollments} loading={loadingEnrollments} />
        )}
        {activeTab === "plan" && <PlanTab customer={customer} />}
        {activeTab === "sessions" && (
          <SessionsTab
            sessions={sessions}
            loading={loadingSessions}
            customerId={customer.id}
            customerName={customer.name}
          />
        )}
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
