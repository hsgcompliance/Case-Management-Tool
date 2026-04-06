"use client";

import React from "react";
import { fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import { getInboxDetailKind, isInboxClosed } from "@hooks/useInboxDetail";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import { DetailCardShell, DetailRow, DetailSection } from "./core";
import { TaskInboxSubtypeDetailCard, NoteEditor } from "./taskTypeCards";
import { DetailAdvancedView, DetailQuickLinks, DetailUniversalHeader } from "./inboxDetailLayout";

type InboxDetailExtras = {
  onAssignCM?: (uid: string | null) => void;
  onSaveNote?: (note: string) => Promise<void>;
  onUpdateCompliance?: (patch: { hmisComplete?: boolean; caseworthyComplete?: boolean }) => Promise<void>;
  onMarkPaid?: (paid: boolean) => Promise<void>;
  onAutoClose?: () => void;
};

type InboxDetailProps = {
  item: any;
  actions?: React.ReactNode;
  extras?: InboxDetailExtras;
};

function statusLabel(item: any): string {
  return isInboxClosed(item?.status) ? "Closed" : "Open";
}

function caseManagerLabel(item: any): string {
  return String(item?.caseManagerName || item?.cmUid || item?.assignedToUid || "-");
}

function reasonLabel(item: any): string {
  const source = String(item?.source || "").toLowerCase();
  if (source === "paymentcompliance") return "Payment row has unresolved compliance checks and requires review.";
  if (source === "payment") return "Payment row is pending or marked for processing.";
  if (source === "adminenrollment") return "Enrollment is active and missing a case manager assignment.";
  if (source === "userverification") return "User verification is required before access/workflow can proceed.";
  if (source === "task") {
    if (item?.workflowBlocked) return "This step is waiting on a previous sequential task.";
    if (item?.managed === true || item?.defId) return "Generated from managed enrollment task definitions.";
    return "Manual enrollment task requiring follow-up.";
  }
  if (source === "other") return "General operational task from the shared queue.";
  return "Operational workflow task.";
}

function notesLabel(item: any): string {
  return String(item?.note || item?.notes || item?.subtitle || "-");
}

function customerId(item: any): string {
  return String(item?.customerId || item?.clientId || "").trim();
}

/** Compact payment surface panel — shows amount, type, compliance status inline without heavy sections. */
function PaymentSurface({
  item,
  isCompliance,
}: {
  item: any;
  isCompliance?: boolean;
}) {
  const amount =
    item?.paymentAmount != null ? `$${Number(item.paymentAmount).toFixed(2)}` : null;
  const compStatus = String(item?.paymentComplianceStatus || "");
  const payType = String(item?.paymentType || "");
  const lineItem = String(item?.paymentLineItemLabel || item?.paymentLineItemId || "");
  const notes = notesLabel(item);

  const accentBg = isCompliance ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200";
  const amountColor = isCompliance ? "text-amber-700" : "text-blue-700";

  const compBadge = compStatus
    ? compStatus === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : compStatus === "rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700"
    : null;

  return (
    <div className={`rounded-lg border overflow-hidden ${accentBg}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`text-2xl font-extrabold tabular-nums ${amountColor}`}>
          {amount ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          {payType && (
            <div className="text-sm font-semibold text-slate-700 leading-tight">{payType}</div>
          )}
          {lineItem && lineItem !== "-" && (
            <div className="text-xs text-slate-500 truncate">{lineItem}</div>
          )}
        </div>
        {isCompliance && compBadge && (
          <span
            className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full ${compBadge}`}
          >
            {compStatus}
          </span>
        )}
      </div>
      {notes && notes !== "-" && (
        <div className="border-t border-white/70 px-4 py-2 bg-white/60 text-sm text-slate-600">
          {notes}
        </div>
      )}
    </div>
  );
}

function TaskTypeDetailCard({ item, actions, extras }: InboxDetailProps) {
  return <TaskInboxSubtypeDetailCard item={item} actions={actions} extras={extras} />;
}

function AssessmentTaskDetailCard({ item, actions, extras }: InboxDetailProps) {
  return <TaskInboxSubtypeDetailCard item={item} actions={actions} extras={extras} />;
}

function UserVerificationDetailCard({ item, actions }: InboxDetailProps) {
  return (
    <DetailCardShell title="User Verification" subtitle={String(item?.title || "") || null} actions={actions}>
      <DetailUniversalHeader item={item} />
      <DetailSection title="Verification Info">
        <DetailRow label="Verification Status" value={statusLabel(item)} />
        <DetailRow label="Assigned Group" value={String(item?.assignedToGroup || "-")} />
        <DetailRow label="Updated" value={fmtDateOrDash(item?.updatedAtISO)} />
      </DetailSection>
      <DetailSection title="Links">
        <DetailRow label="Source" value={String(item?.sourcePath || "-")} />
      </DetailSection>
      <DetailSection title="Why">
        <DetailRow label="Reason" value={reasonLabel(item)} />
      </DetailSection>
      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

function OtherTaskDetailCard({ item, actions, extras }: InboxDetailProps) {
  const notes = notesLabel(item);
  return (
    <DetailCardShell title="Other Task" subtitle={String(item?.title || "") || null} actions={actions}>
      <DetailUniversalHeader item={item} />
      <DetailSection title="Task Info">
        <DetailRow label="Task Status" value={statusLabel(item)} />
        <DetailRow label="Description" value={String(item?.description || "-")} />
      </DetailSection>
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 px-1">Notes</div>
        <div className="space-y-2">
          {notes && notes !== "-" ? (
            <div className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-800 min-h-[48px]">
              {notes}
            </div>
          ) : null}
          <NoteEditor onSave={extras?.onSaveNote} />
        </div>
      </div>
      <DetailSection title="Why">
        <DetailRow label="Reason" value={reasonLabel(item)} />
      </DetailSection>
      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

/** Merged Monthly Payment/Service card — shows all 3 toggles: HMIS, CW, Paid. All checked = auto-close. */
function MonthlyPaymentServiceCard({ item, actions, extras }: InboxDetailProps) {
  const [localHmis, setLocalHmis] = React.useState(!!item?.hmisComplete);
  const [localCw, setLocalCw] = React.useState(!!item?.caseworthyComplete);
  const [localPaid, setLocalPaid] = React.useState(!!(item?.paymentPaid ?? item?.paid ?? false));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalHmis(!!item?.hmisComplete);
    setLocalCw(!!item?.caseworthyComplete);
    setLocalPaid(!!(item?.paymentPaid ?? item?.paid ?? false));
  }, [item?.hmisComplete, item?.caseworthyComplete, item?.paymentPaid, item?.paid]);

  const checkAutoClose = (hmis: boolean, cw: boolean, paid: boolean) => {
    if (hmis && cw && paid) extras?.onAutoClose?.();
  };

  const handleToggle = async (
    field: "hmis" | "cw" | "paid",
    nextVal: boolean,
    hmis: boolean, cw: boolean, paid: boolean,
  ) => {
    setSaving(true);
    try {
      if (field === "hmis") {
        await extras?.onUpdateCompliance?.({ hmisComplete: nextVal });
      } else if (field === "cw") {
        await extras?.onUpdateCompliance?.({ caseworthyComplete: nextVal });
      } else {
        await extras?.onMarkPaid?.(nextVal);
      }
      checkAutoClose(hmis, cw, paid);
    } catch (e: unknown) {
      // revert local state and surface the error
      if (field === "hmis") setLocalHmis(!nextVal);
      else if (field === "cw") setLocalCw(!nextVal);
      else setLocalPaid(!nextVal);
      const msg = String((e as any)?.meta?.response?.error || (e as any)?.message || "Update failed.");
      toast(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleItems = [
    {
      key: "hmis",
      label: "HMIS Entry Complete",
      value: localHmis,
      onToggle: () => {
        const next = !localHmis;
        setLocalHmis(next);
        void handleToggle("hmis", next, next, localCw, localPaid);
      },
    },
    {
      key: "cw",
      label: "CW Entry Complete",
      value: localCw,
      onToggle: () => {
        const next = !localCw;
        setLocalCw(next);
        void handleToggle("cw", next, localHmis, next, localPaid);
      },
    },
    {
      key: "paid",
      label: "Payment Received",
      value: localPaid,
      onToggle: () => {
        const next = !localPaid;
        setLocalPaid(next);
        void handleToggle("paid", next, localHmis, localCw, next);
      },
    },
  ];

  const allDone = localHmis && localCw && localPaid;

  return (
    <DetailCardShell
      title="Monthly Payment / Service"
      subtitle={String(item?.title || item?.paymentType || "")}
      actions={actions}
    >
      <DetailUniversalHeader item={item} />
      <PaymentSurface item={item} />

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Checklist</div>
        {toggleItems.map(({ key, label, value, onToggle }) => (
          <button
            key={key}
            type="button"
            disabled={saving || (!extras?.onUpdateCompliance && !extras?.onMarkPaid)}
            onClick={onToggle}
            className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
              value
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            } ${saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                value ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {value ? "✓" : null}
            </div>
            <span className="font-medium text-sm">{label}</span>
            {value && <span className="ml-auto text-xs text-emerald-600 font-semibold">Done</span>}
          </button>
        ))}
        {allDone && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 text-center">
            All complete — task auto-closed
          </div>
        )}
      </div>

      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

/** Inline HMIS + CW Entry toggle pair used in both compliance card types. */
function ComplianceToggles({
  hmisComplete,
  caseworthyComplete,
  saving,
  onToggle,
}: {
  hmisComplete: boolean;
  caseworthyComplete: boolean;
  saving: boolean;
  onToggle?: (patch: { hmisComplete?: boolean; caseworthyComplete?: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      {[
        { key: "hmisComplete" as const, label: "HMIS Entry Complete", value: hmisComplete },
        { key: "caseworthyComplete" as const, label: "CW Entry Complete", value: caseworthyComplete },
      ].map(({ key, label, value }) => (
        <button
          key={key}
          type="button"
          disabled={saving || !onToggle}
          onClick={() => onToggle?.({ [key]: !value })}
          className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
            value
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          } ${saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
              value ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {value ? "✓" : null}
          </div>
          <span className="font-medium text-sm">{label}</span>
          {value && <span className="ml-auto text-xs text-emerald-600 font-semibold">Done</span>}
        </button>
      ))}
    </div>
  );
}

/** Payment compliance inbox surface — delegates to unified Monthly Payment/Service card. */
function PaymentTaskDetailCard({ item, actions, extras }: InboxDetailProps) {
  return <MonthlyPaymentServiceCard item={item} actions={actions} extras={extras} />;
}

/** Payment compliance inbox surface — delegates to unified Monthly Payment/Service card. */
function PaymentComplianceDetailCard({ item, actions, extras }: InboxDetailProps) {
  return <MonthlyPaymentServiceCard item={item} actions={actions} extras={extras} />;
}

/** Grant compliance card — HMIS + CW entry for a grant open/close event. */
function GrantComplianceDetailCard({ item, actions, extras }: InboxDetailProps) {
  const [saving, setSaving] = React.useState(false);

  const handleToggle = async (patch: { hmisComplete?: boolean; caseworthyComplete?: boolean }) => {
    if (!extras?.onUpdateCompliance) return;
    setSaving(true);
    try { await extras.onUpdateCompliance(patch); }
    finally { setSaving(false); }
  };

  const grantName = String(item?.grantName || item?.grantId || "-").trim();

  return (
    <DetailCardShell
      title="Grant Entry"
      subtitle={grantName}
      actions={actions}
    >
      <DetailUniversalHeader item={item} />
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <div className="font-semibold">{grantName}</div>
        <div className="text-xs text-blue-600 mt-0.5">New grant activity requires HMIS and CW data entry.</div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Compliance Checklist</div>
        <ComplianceToggles
          hmisComplete={!!item?.hmisComplete}
          caseworthyComplete={!!item?.caseworthyComplete}
          saving={saving}
          onToggle={extras?.onUpdateCompliance ? handleToggle : undefined}
        />
      </div>
      <DetailAdvancedView item={item} />
    </DetailCardShell>
  );
}

/** Intelligent Assign Case Manager card — shows customer info, enrollment list, and inline CM selector. */
function AdminEnrollmentDetailCard({ item, actions, extras }: InboxDetailProps) {
  const cid = customerId(item);
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useCustomerEnrollments(
    cid || null,
    { enabled: !!cid }
  );

  const [selectedCM, setSelectedCM] = React.useState<string | null>(
    item?.assignedToUid || null
  );

  const handleCMChange = (uid: string | null) => {
    setSelectedCM(uid);
  };

  const handleAssign = () => {
    extras?.onAssignCM?.(selectedCM);
  };

  const firstName = String(item?.firstName || "").trim();
  const lastName = String(item?.lastName || "").trim();
  const customerName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    String(item?.customerName || item?.clientName || item?.customerId || item?.clientId || "Unknown Customer").trim();
  const customerHref = cid ? `/customers/${cid}` : null;

  return (
    <DetailCardShell
      title="Assign Case Manager"
      subtitle={customerName}
      actions={actions}
    >
      <DetailUniversalHeader item={item} />

      {/* Customer summary */}
      <DetailSection title="Customer">
        <div className="flex items-center gap-3 py-1 px-2">
          <div className="flex-1">
            <div className="font-semibold text-slate-900">{customerName}</div>
            {cid && (
              <div className="text-xs text-slate-500 font-mono">{cid}</div>
            )}
          </div>
          {customerHref && (
            <a
              href={customerHref}
              className="btn btn-ghost btn-xs shrink-0"
            >
              View Customer →
            </a>
          )}
        </div>
      </DetailSection>

      {/* Enrollment list */}
      <DetailSection title={`Enrollments${enrollments.length ? ` (${enrollments.length})` : ""}`}>
        {enrollmentsLoading ? (
          <div className="py-2 text-xs text-slate-400 animate-pulse">Loading enrollments…</div>
        ) : enrollments.length === 0 ? (
          <div className="py-2 text-xs text-slate-400">No enrollments found.</div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {enrollments.map((enr: any) => (
              <div
                key={enr.id}
                className="flex items-center justify-between rounded-md bg-white border border-slate-200 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 truncate">
                    {enr.name ||
                      (enr.grantName && enr.startDate
                        ? `${enr.grantName} · ${String(enr.startDate).slice(0, 10)}`
                        : enr.grantName || enr.grantId || enr.id)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {enr.caseManagerName ? `CM: ${enr.caseManagerName}` : "No CM assigned"}
                  </div>
                </div>
                <span
                  className={`ml-2 shrink-0 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                    enr.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {enr.status || "active"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      {/* Inline CM selector */}
      <DetailSection title="Assign Case Manager">
        <div className="space-y-2 py-1 px-2">
          <div className="text-xs text-slate-500">Select a case manager to assign to this enrollment:</div>
          <CaseManagerSelect
            value={selectedCM}
            onChange={handleCMChange}
            includeAll={false}
            allLabel="Select case manager…"
            onlyActive
          />
          {extras?.onAssignCM && (
            <button
              className="btn btn-sm btn-primary w-full mt-1"
              onClick={handleAssign}
              disabled={!selectedCM}
            >
              Assign
            </button>
          )}
        </div>
      </DetailSection>

      <DetailSection title="Why">
        <DetailRow label="Reason" value={reasonLabel(item)} />
        <DetailRow label="Current Assignee" value={caseManagerLabel(item)} />
      </DetailSection>

      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

function UnknownDetailCard({ item, actions }: InboxDetailProps) {
  return (
    <DetailCardShell title="Task Detail" subtitle={String(item?.title || "") || null} actions={actions}>
      <DetailUniversalHeader item={item} />
      <DetailSection title="Summary">
        <DetailRow label="Task Status" value={statusLabel(item)} />
        <DetailRow label="Source" value={String(item?.source || "-")} />
      </DetailSection>
      <DetailSection title="Why">
        <DetailRow label="Reason" value={reasonLabel(item)} />
      </DetailSection>
      <DetailSection title="Notes">
        <DetailRow label="Notes" value={notesLabel(item)} />
      </DetailSection>
      <DetailAdvancedView item={item} />
      <DetailQuickLinks item={item} />
    </DetailCardShell>
  );
}

export function InboxDetailCardRouter({ item, actions, extras }: InboxDetailProps) {
  const kind = getInboxDetailKind(item);
  if (kind === "task") return <TaskTypeDetailCard item={item} actions={actions} extras={extras} />;
  if (kind === "assessment") return <AssessmentTaskDetailCard item={item} actions={actions} extras={extras} />;
  if (kind === "userVerification") return <UserVerificationDetailCard item={item} actions={actions} />;
  if (kind === "other") return <OtherTaskDetailCard item={item} actions={actions} extras={extras} />;
  if (kind === "payment") return <PaymentTaskDetailCard item={item} actions={actions} />;
  if (kind === "complianceTask") return <PaymentComplianceDetailCard item={item} actions={actions} extras={extras} />;
  if (kind === "grantCompliance") return <GrantComplianceDetailCard item={item} actions={actions} extras={extras} />;
  if (kind === "customer") return <AdminEnrollmentDetailCard item={item} actions={actions} extras={extras} />;
  return <UnknownDetailCard item={item} actions={actions} />;
}
