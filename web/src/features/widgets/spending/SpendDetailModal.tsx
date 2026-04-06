"use client";

// features/dashboard/tools/spend/SpendDetailModal.tsx
// Modal detail cards for spend rows. Three card types:
//   - EnrollmentSpendCard  (grant-ledger, queue-projection)
//   - CardSpendCard        (card-ledger, queue-credit-card)
//   - InvoiceSpendCard     (queue-invoice)

import React from "react";
import Link from "next/link";
import { Modal } from "@entities/ui/Modal";
import { DetailSection, DetailRow } from "@entities/detail-card/core";
import GrantSelect from "@entities/selectors/GrantSelect";
import LineItemSelect from "@entities/selectors/LineItemSelect";
import CreditCardSelect from "@entities/selectors/CreditCardSelect";
import PaymentsProjectionsAdjustDialog from "@entities/dialogs/payments/PaymentsProjectionsAdjustDialog";
import {
  useEnrollmentPayments,
  usePaymentsUpdateCompliance,
  usePaymentsSpend,
  usePaymentsAdjustProjections,
  usePaymentsAdjustSpend,
  type PaymentsProjectionsAdjustInput,
} from "@hooks/usePayments";
import { toApiError } from "@client/api";
import {
  usePatchPaymentQueueItem,
  usePostPaymentQueueToLedger,
  useReopenPaymentQueueItem,
} from "@hooks/usePaymentQueue";
import { useClassifyLedgerEntries, useLedgerEntry } from "@hooks/useLedger";
import { useJotformSubmission } from "@hooks/useJotform";
import { useTaskOtherCreate, useTaskOtherStatus } from "@hooks/useTasks";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import type {
  PaymentsAdjustProjectionsReq,
  PaymentsAdjustSpendReq,
  TPayment,
} from "@types";
import {
  buildNormalizedAnswerFields,
  stageLabelFromQueueSource,
} from "@widgets/jotform/jotformSubmissionView";

// ---------------------------------------------------------------------------
// Shared types (mirror SpendingTool internals without importing them)
// ---------------------------------------------------------------------------

export type SpendRowKind =
  | "grant-ledger"
  | "card-ledger"
  | "queue-projection"
  | "queue-credit-card"
  | "queue-invoice";

export type SpendRow = {
  id: string;
  kind: SpendRowKind;
  sourceLabel: string;
  title: string;
  subtitle: string;
  date: string;
  month: string;
  amountCents: number;
  completed: boolean;
  workflowState: "open" | "closed";
  workflowReason: string;
  grantId: string;
  lineItemId: string;
  customerId: string;
  creditCardId: string;
  creditCardName: string;
  cardBucket: string;
  taskToken: string;
  linkedLedgerId?: string;
  ledgerEntry?: Record<string, unknown>;
  paymentQueueItem?: Record<string, unknown> & {
    id: string;
    submissionId?: string;
    paymentId?: string | null;
    enrollmentId?: string | null;
    customerId?: string | null;
    grantId?: string | null;
    lineItemId?: string | null;
    creditCardId?: string | null;
    source?: string;
    queueStatus?: string;
    merchant?: string;
    purpose?: string;
    descriptor?: string;
    card?: string;
    cardBucket?: string;
    note?: string;
    notes?: string;
    formTitle?: string;
    formAlias?: string;
    rawMeta?: Record<string, unknown>;
    invoiceStatus?: string;
    reopenedAt?: string | null;
  };
};

export type CardBudget = {
  id: string;
  name: string;
  last4: string;
  limitCents: number;
  spentCents: number;
  pendingCents: number;
  remainingCents: number;
};

type ModalProps = {
  row: SpendRow | null;
  isOpen: boolean;
  onClose: () => void;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  cardBudget?: CardBudget | null;
  workflowTask?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCents(cents: number) {
  return fmtCurrencyUSD(cents / 100);
}

type ComplianceRecord = {
  hmisComplete?: boolean | null;
  caseworthyComplete?: boolean | null;
};

type PaymentRecord = TPayment & {
  id?: string | null;
  compliance?: ComplianceRecord | null;
  paid?: boolean | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readSubmissionAnswers(
  submission: { answers?: Record<string, unknown> | null } | null | undefined,
  rawMeta?: Record<string, unknown>,
): Record<string, unknown> {
  return submission?.answers || rawMeta || {};
}

function readCompliance(value: unknown): ComplianceRecord {
  return asObject(value) as ComplianceRecord;
}

function StatusBadge({ state }: { state: "open" | "closed" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        state === "open"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {state === "open" ? "Open" : "Closed"}
    </span>
  );
}

function ToggleCheck({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked ? "OK" : null}
      </div>
      <span className="font-medium text-sm">{label}</span>
      {checked && <span className="ml-auto text-xs text-emerald-600 font-semibold">Done</span>}
    </button>
  );
}

function CustomerLink({ customerId, name }: { customerId: string; name: string }) {
  if (!customerId) return null;
  return (
    <a
      href={`/customers/${customerId}`}
      className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 hover:underline font-medium"
      target="_blank"
      rel="noopener noreferrer"
    >
      {name || customerId}
      <span className="text-xs text-sky-400">Open</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// AmountHeader — shared top amount display for all cards
// ---------------------------------------------------------------------------

function AmountHeader({
  amount,
  title,
  subtitle,
  state,
  badge,
}: {
  amount: number;
  title: string;
  subtitle?: string;
  state: "open" | "closed";
  badge?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        state === "open"
          ? "bg-amber-50 border-amber-200"
          : "bg-emerald-50 border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-3xl font-extrabold tabular-nums tracking-tight ${
              state === "open" ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {fmtCents(amount)}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800 truncate max-w-[280px]">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{subtitle}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge state={state} />
          {badge}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreditCardBudgetBar
// ---------------------------------------------------------------------------

function CreditCardBudgetBar({ budget }: { budget: CardBudget }) {
  const usage = budget.limitCents > 0
    ? Math.min(100, Math.round((budget.spentCents / budget.limitCents) * 100))
    : 0;
  const tone =
    usage >= 100 ? "bg-rose-500"
    : usage >= 85 ? "bg-amber-400"
    : "bg-sky-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Card Budget</div>
          <div className="text-sm font-bold text-slate-900">
            {budget.name}{budget.last4 ? ` **** ${budget.last4}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Remaining</div>
          <div className={`text-xl font-black tabular-nums ${budget.remainingCents < 0 ? "text-rose-600" : "text-slate-900"}`}>
            {fmtCents(budget.remainingCents)}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
          <span>Spent {fmtCents(budget.spentCents)}</span>
          <span>{usage}% of {fmtCents(budget.limitCents)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-2 rounded-full transition-all ${tone}`} style={{ width: `${usage}%` }} />
        </div>
        {budget.pendingCents > 0 && (
          <div className="text-[11px] text-slate-400 mt-1">
            + {fmtCents(budget.pendingCents)} pending
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JotformViewPanel - normalized answers and raw inspector for CC / Invoice cards
// ---------------------------------------------------------------------------

type ViewMode = "detail" | "qa" | "raw";

function JotformViewPanel({
  submissionId,
  rawMeta,
  mode,
}: {
  submissionId?: string;
  rawMeta?: Record<string, unknown>;
  mode: ViewMode;
}) {
  const [copied, setCopied] = React.useState(false);

  const { data: submission, isLoading } = useJotformSubmission(submissionId, {
    enabled: !!submissionId && (mode === "qa" || mode === "raw"),
  });

  const rawAnswers = React.useMemo(() => readSubmissionAnswers(submission, rawMeta), [submission, rawMeta]);
  const normalizedFields = React.useMemo(
    () => buildNormalizedAnswerFields((rawAnswers || {}) as Record<string, unknown>),
    [rawAnswers],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rawAnswers, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed.", { type: "error" });
    }
  };

  if (mode === "qa") {
    if (isLoading && submissionId) {
      return <div className="py-4 text-sm text-slate-400 animate-pulse text-center">Loading submission...</div>;
    }

    if (!normalizedFields.length) {
      return <div className="py-3 text-sm text-slate-400">No normalized answers available.</div>;
    }

    return (
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {normalizedFields.map((field) => {
          return (
            <div key={field.key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{field.label}</div>
              <div className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap break-words">{field.value}</div>
              <div className="mt-1 text-[11px] font-mono text-slate-400">{field.key}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "raw") {
    const json = JSON.stringify(rawAnswers, null, 2);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Raw JSON</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-[360px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] text-emerald-300 leading-relaxed font-mono whitespace-pre-wrap break-all">
          {json}
        </pre>
      </div>
    );
  }

  return null;
}

function QueueLifecycleBadge({ status }: { status?: string | null }) {
  const normalized = String(status || "pending").toLowerCase();
  const tone =
    normalized === "posted" ? "bg-emerald-100 text-emerald-700"
    : normalized === "void" ? "bg-rose-100 text-rose-700"
    : "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {normalized || "pending"}
    </span>
  );
}

function ProvenanceSection({
  queueItem,
  ledgerEntry,
  title,
}: {
  queueItem?: Record<string, unknown> | null;
  ledgerEntry?: Record<string, unknown> | null;
  title?: string;
}) {
  const ledgerRecord = asObject(ledgerEntry);
  const origin = asObject(ledgerRecord.origin);
  const queueSource = queueItem?.source || origin.paymentQueueSource;
  const submissionId = String(queueItem?.submissionId || origin.jotformSubmissionId || "");
  return (
    <DetailSection title={title || "Pipeline Provenance"}>
      <DetailRow label="Queue Item" value={String(queueItem?.id || "-")} />
      <DetailRow label="Queue Status" value={<QueueLifecycleBadge status={String(queueItem?.queueStatus || "pending")} />} />
      <DetailRow label="Submission ID" value={submissionId || "-"} />
      <DetailRow label="Queue Source" value={stageLabelFromQueueSource(queueSource)} />
      <DetailRow label="Ledger Entry" value={String(queueItem?.ledgerEntryId || ledgerRecord.id || "Not posted")} />
      <DetailRow label="Origin Path" value={String(origin.sourcePath || "-")} />
      <DetailRow label="Reopened" value={String(queueItem?.reopenedAt || "-")} />
      <DetailRow label="Source Browser" value={<Link className="text-sky-600 hover:underline" href="/tools/jotforms">Open Jotforms</Link>} />
    </DetailSection>
  );
}

// ---------------------------------------------------------------------------
// EnrollmentSpendCard
// ---------------------------------------------------------------------------

function EnrollmentSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
}) {
  const isProjection = row.kind === "queue-projection";

  // IDs for compliance/spend mutations
  const enrollmentId = String(
    row.paymentQueueItem?.enrollmentId ||
    row.ledgerEntry?.enrollmentId ||
    ""
  );
  const paymentId = String(
    row.paymentQueueItem?.paymentId ||
    row.ledgerEntry?.paymentId ||
    ""
  );

  // Fetch enrollment payments to get current compliance state
  const { data: enrollmentPayments = [] } = useEnrollmentPayments(enrollmentId || null, {
    enabled: !!enrollmentId,
  });

  const thisPayment = React.useMemo(
    () => (enrollmentPayments as PaymentRecord[]).find((payment) => String(payment.id || "") === paymentId) || null,
    [enrollmentPayments, paymentId],
  );

  const [localHmis, setLocalHmis] = React.useState(false);
  const [localCw, setLocalCw] = React.useState(false);
  const [localPaid, setLocalPaid] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const compliance = readCompliance(thisPayment?.compliance);
    const ledgerCompliance = readCompliance(asObject(row.ledgerEntry).compliance);
    const ledgerPaid = asObject(row.ledgerEntry).paid;
    setLocalHmis(!!(compliance.hmisComplete ?? ledgerCompliance.hmisComplete));
    setLocalCw(!!(compliance.caseworthyComplete ?? ledgerCompliance.caseworthyComplete));
    setLocalPaid(
      !!(thisPayment?.paid ?? ledgerPaid ?? row.completed),
    );
  }, [thisPayment, row.ledgerEntry, row.completed]);

  const updateCompliance = usePaymentsUpdateCompliance();
  const spendMutation = usePaymentsSpend();
  const adjustMutation = usePaymentsAdjustProjections();
  const adjustSpendMutation = usePaymentsAdjustSpend();

  const [adjustOpen, setAdjustOpen] = React.useState(false);

  const handleToggle = async (field: "hmis" | "cw" | "paid", next: boolean) => {
    setSaving(true);
    try {
      if (field === "hmis" || field === "cw") {
        if (!enrollmentId || !paymentId) {
          toast("Missing enrollment/payment ID for compliance update.", { type: "error" });
          return;
        }
        await updateCompliance.mutateAsync({
          enrollmentId,
          paymentId,
          patch: field === "hmis" ? { hmisComplete: next } : { caseworthyComplete: next },
        });
      } else {
        // paid toggle
        if (isProjection) {
          // Queue projection: use paymentsSpend
          if (!enrollmentId || !paymentId) {
            toast("Missing enrollment/payment for spend action.", { type: "error" });
            return;
          }
          await spendMutation.mutateAsync({ body: { enrollmentId, paymentId, reverse: !next } });
        }
        // For grant-ledger (already posted) the paid field is read-only; skip silently
      }
    } catch (e: unknown) {
      if (field === "hmis") setLocalHmis(!next);
      else if (field === "cw") setLocalCw(!next);
      else setLocalPaid(!next);
      const msg = toApiError(e, "Update failed.").error;
      toast(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";

  // Build enrollment option for Adjust dialog
  const enrollmentOption = React.useMemo(() => {
    if (!enrollmentId) return [];
    const payments = enrollmentPayments as TPayment[];
    return [{ id: enrollmentId, label: `${grantName} enrollment`, grantId: row.grantId, payments }];
  }, [enrollmentId, enrollmentPayments, grantName, row.grantId]);

  const allDone = localHmis && localCw && localPaid;

  return (
    <div className="space-y-4">
      <AmountHeader
        amount={row.amountCents}
        title={row.title}
        subtitle={[grantName, lineItemLabel].filter((s) => s && s !== "-").join(" | ")}
        state={row.workflowState}
      />

      {/* Customer link */}
      {row.customerId && (
        <div className="flex items-center gap-2">
          <CustomerLink customerId={row.customerId} name={customerName} />
        </div>
      )}

      {/* Grant info */}
      <DetailSection title="Grant">
        <DetailRow label="Grant" value={grantName} />
        <DetailRow label="Line Item" value={lineItemLabel} />
        <DetailRow label="Date" value={fmtDateOrDash(row.date)} />
        {enrollmentId && <DetailRow label="Enrollment ID" value={enrollmentId} />}
        {paymentId && <DetailRow label="Payment ID" value={paymentId} />}
      </DetailSection>

      {/* Checklist — compliance + paid */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Checklist</div>
        <ToggleCheck
          label="HMIS Entry Complete"
          checked={localHmis}
          disabled={saving || !enrollmentId || !paymentId}
          onToggle={() => { const next = !localHmis; setLocalHmis(next); void handleToggle("hmis", next); }}
        />
        <ToggleCheck
          label="CW Entry Complete"
          checked={localCw}
          disabled={saving || !enrollmentId || !paymentId}
          onToggle={() => { const next = !localCw; setLocalCw(next); void handleToggle("cw", next); }}
        />
        <ToggleCheck
          label="Payment Received"
          checked={localPaid}
          disabled={saving || (!isProjection)}
          onToggle={() => { const next = !localPaid; setLocalPaid(next); void handleToggle("paid", next); }}
        />
        {allDone && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 text-center">
            All complete
          </div>
        )}
        {!isProjection && (
          <p className="text-[11px] text-slate-400 px-1">
            Payment Received is managed via the payment workflow (already posted).
          </p>
        )}
      </div>

      {/* Actions */}
      <DetailSection title="Actions">
        <div className="grid grid-cols-2 gap-2">
          {enrollmentId && (
            <button
              className="btn btn-sm btn-ghost col-span-1"
              onClick={() => setAdjustOpen(true)}
            >
              Adjust
            </button>
          )}
          {row.customerId && (
            <button
              className="btn btn-sm btn-ghost col-span-1"
              onClick={() => {
                window.open(`/customers/${row.customerId}?tab=payments`, "_blank");
              }}
            >
              Open Payment Schedule
            </button>
          )}
        </div>
      </DetailSection>

      {/* Adjust dialog */}
      {adjustOpen && (
        <PaymentsProjectionsAdjustDialog
          open={adjustOpen}
          enrollments={enrollmentOption}
          busy={adjustMutation.isPending || adjustSpendMutation.isPending}
          onCancel={() => setAdjustOpen(false)}
          onApply={async (payload: PaymentsProjectionsAdjustInput) => {
            try {
              if (payload.spendAdjustment) {
                await adjustSpendMutation.mutateAsync({ body: payload as PaymentsAdjustSpendReq });
              } else {
                await adjustMutation.mutateAsync({ body: payload as PaymentsAdjustProjectionsReq });
              }
              toast("Adjustment applied.", { type: "success" });
              setAdjustOpen(false);
            } catch (e: unknown) {
              toast(toApiError(e, "Adjustment failed.").error, { type: "error" });
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardSpendCard  (card-ledger + queue-credit-card)
// ---------------------------------------------------------------------------

function CardSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
  cardBudget,
  workflowTask,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
  cardBudget?: CardBudget | null;
  workflowTask?: Record<string, unknown> | null;
}) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("detail");
  const [assignGrantId, setAssignGrantId] = React.useState(row.grantId || "");
  const [assignLineItemId, setAssignLineItemId] = React.useState(row.lineItemId || "");
  const [saving, setSaving] = React.useState(false);

  const patchQueue = usePatchPaymentQueueItem();
  const postQueue = usePostPaymentQueueToLedger();
  const reopenQueue = useReopenPaymentQueueItem();
  const classifyLedger = useClassifyLedgerEntries();
  const createTask = useTaskOtherCreate();
  const updateTaskStatus = useTaskOtherStatus();

  const isQueue = row.kind === "queue-credit-card";
  const queueId = String(row.paymentQueueItem?.id || "");
  const ledgerId = String(row.ledgerEntry?.id || "");
  const submissionId = String(row.paymentQueueItem?.submissionId || "");
  const provenanceLedgerId = String(row.paymentQueueItem?.ledgerEntryId || ledgerId || row.linkedLedgerId || "");
  const ledgerEntryQ = useLedgerEntry(provenanceLedgerId || undefined, { enabled: !!provenanceLedgerId });

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";

  const anyMutating = patchQueue.isPending || postQueue.isPending || reopenQueue.isPending ||
    classifyLedger.isPending || createTask.isPending || updateTaskStatus.isPending;

  const handleReopen = async () => {
    setSaving(true);
    try {
      if (isQueue) {
        await reopenQueue.mutateAsync({ id: queueId });
        toast("Reopened.", { type: "success" });
      }
    } catch (e: unknown) {
      toast(toApiError(e, "Reopen failed.").error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    setSaving(true);
    try {
      if (isQueue) {
        if (assignGrantId) {
          await patchQueue.mutateAsync({
            id: queueId,
            body: { grantId: assignGrantId || null, lineItemId: assignLineItemId || null },
          });
        }
        await postQueue.mutateAsync({ id: queueId });
        toast("Posted to ledger.", { type: "success" });
      } else if (ledgerId && assignGrantId && assignLineItemId) {
        await classifyLedger.mutateAsync({
          items: [{ entryId: ledgerId, grantId: assignGrantId, lineItemId: assignLineItemId }],
          dryRun: false,
        });
        toast("Allocated.", { type: "success" });
      } else {
        toast("Select grant and line item first.", { type: "error" });
      }
    } catch (e: unknown) {
      toast(toApiError(e, "Action failed.").error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      await createTask.mutateAsync({
        title: `Allocate card spend ${row.subtitle}`,
        notify: false,
        notes: [
          `LEDGER_ENTRY:${row.subtitle}`,
          `Source: ${row.sourceLabel}`,
          `Amount: ${fmtCurrencyUSD(row.amountCents / 100)}`,
          `Title: ${row.title || "-"}`,
          row.creditCardName ? `Card: ${row.creditCardName}` : "",
        ].filter(Boolean).join("\n"),
        dueDate: row.date || undefined,
        assign: { group: "compliance", uids: null },
      });
      toast("Spend task created.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Task creation failed.").error, { type: "error" });
    }
  };

  const VIEW_TABS: { id: ViewMode; label: string }[] = [
    { id: "detail", label: "Pipeline" },
    { id: "qa", label: "Normalized Answers" },
    { id: "raw", label: "Raw Inspector" },
  ];

  return (
    <div className="space-y-4">
      <AmountHeader
        amount={row.amountCents}
        title={row.title}
        subtitle={row.creditCardName || row.creditCardId || undefined}
        state={row.workflowState}
        badge={
          row.cardBucket ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {row.cardBucket}
            </span>
          ) : undefined
        }
      />

      {/* Customer link */}
      {row.customerId && (
        <CustomerLink customerId={row.customerId} name={customerName} />
      )}

      {/* Card budget bar */}
      {cardBudget && <CreditCardBudgetBar budget={cardBudget} />}

      {/* Grant context */}
      {(row.grantId || row.lineItemId) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs uppercase tracking-wide">Grant</span>
          <span className="font-semibold text-slate-800">{grantName}</span>
          {row.lineItemId && (
            <>
              <span className="text-slate-400">{">"}</span>
              <span className="text-slate-600">{lineItemLabel}</span>
            </>
          )}
        </div>
      )}

      {/* View mode tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={[
                "relative px-4 py-2 text-sm font-medium transition",
                "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full",
                viewMode === tab.id
                  ? "text-sky-600 after:bg-sky-500"
                  : "text-slate-500 after:bg-transparent hover:text-slate-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {viewMode === "detail" ? (
        <>
          <DetailSection title="Payment Object">
            <DetailRow label="Type" value={row.sourceLabel} />
            <DetailRow label="Date" value={fmtDateOrDash(row.date)} />
            <DetailRow label="Status" value={<StatusBadge state={row.workflowState} />} />
            {row.paymentQueueItem?.source && (
              <DetailRow label="Queue Source" value={stageLabelFromQueueSource(row.paymentQueueItem.source)} />
            )}
            {row.paymentQueueItem?.merchant && (
              <DetailRow label="Merchant" value={String(row.paymentQueueItem.merchant)} />
            )}
            {(row.paymentQueueItem?.purpose || row.paymentQueueItem?.descriptor) && (
              <DetailRow
                label="Purpose"
                value={String(row.paymentQueueItem.purpose || row.paymentQueueItem.descriptor || "")}
              />
            )}
            {row.paymentQueueItem?.card && (
              <DetailRow label="Card Field" value={String(row.paymentQueueItem.card)} />
            )}
            {row.paymentQueueItem?.note && (
              <DetailRow label="Note" value={String(row.paymentQueueItem.note)} />
            )}
          </DetailSection>

          <ProvenanceSection
            queueItem={row.paymentQueueItem || null}
            ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || (row.ledgerEntry as Record<string, unknown> | null)}
            title="Pipeline Provenance"
          />
        </>
      ) : (
        <JotformViewPanel
          submissionId={submissionId}
          rawMeta={row.paymentQueueItem?.rawMeta}
          mode={viewMode}
        />
      )}

      {/* Reassign */}
      <DetailSection title="Assign to Grant">
        <div className="space-y-2">
          <GrantSelect
            value={assignGrantId || null}
            onChange={(v) => { setAssignGrantId(String(v || "")); setAssignLineItemId(""); }}
            includeUnassigned
          />
          <LineItemSelect
            grantId={assignGrantId || null}
            value={assignLineItemId || null}
            onChange={(v) => setAssignLineItemId(String(v || ""))}
            inputClassName="w-full"
          />
        </div>
      </DetailSection>

      {/* Workflow actions */}
      <div className="grid grid-cols-2 gap-2">
        {isQueue && (
          <button
            className="btn btn-ghost btn-sm"
            disabled={anyMutating || saving || row.workflowState === "open"}
            onClick={handleReopen}
          >
            Reopen
          </button>
        )}
        <button
          className="btn btn-sm"
          disabled={anyMutating || saving || row.workflowState === "closed"}
          onClick={handlePost}
        >
          {isQueue ? "Post to Ledger" : "Allocate"}
        </button>
        {row.kind === "card-ledger" && !workflowTask && (
          <button
            className="btn btn-ghost btn-sm col-span-2"
            disabled={anyMutating}
            onClick={handleCreateTask}
          >
            Create Spend Task
          </button>
        )}
        {workflowTask && (
          <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Spend task: {String(workflowTask.title || workflowTask.id || "-")}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvoiceSpendCard  (queue-invoice)
// ---------------------------------------------------------------------------

function InvoiceSpendCard({
  row,
  grantNameById,
  lineItemLookup,
  customerNameById,
}: {
  row: SpendRow;
  grantNameById: Map<string, string>;
  lineItemLookup: Map<string, { grantName: string; lineItemLabel: string }>;
  customerNameById: Map<string, string>;
}) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("detail");
  const [assignGrantId, setAssignGrantId] = React.useState(row.grantId || "");
  const [assignLineItemId, setAssignLineItemId] = React.useState(row.lineItemId || "");
  const [assignCardId, setAssignCardId] = React.useState(row.creditCardId || "");
  const [saving, setSaving] = React.useState(false);

  const patchQueue = usePatchPaymentQueueItem();
  const postQueue = usePostPaymentQueueToLedger();
  const reopenQueue = useReopenPaymentQueueItem();

  const queueId = String(row.paymentQueueItem?.id || "");
  const submissionId = String(row.paymentQueueItem?.submissionId || "");
  const provenanceLedgerId = String(row.paymentQueueItem?.ledgerEntryId || row.linkedLedgerId || "");
  const ledgerEntryQ = useLedgerEntry(provenanceLedgerId || undefined, { enabled: !!provenanceLedgerId });

  const info = lineItemLookup.get(`${row.grantId}:${row.lineItemId}`);
  const grantName = info?.grantName || grantNameById.get(row.grantId) || row.grantId || "-";
  const lineItemLabel = info?.lineItemLabel || row.lineItemId || "-";
  const customerName = customerNameById.get(row.customerId) || row.customerId || "";

  const queueStatus = String(row.paymentQueueItem?.queueStatus || "pending");
  const legacyInvoiceStatus = row.paymentQueueItem?.invoiceStatus ? String(row.paymentQueueItem.invoiceStatus) : "";

  const anyMutating = patchQueue.isPending || postQueue.isPending || reopenQueue.isPending;

  const handleSaveAssignment = async () => {
    setSaving(true);
    try {
      await patchQueue.mutateAsync({
        id: queueId,
        body: {
          grantId: assignGrantId || null,
          lineItemId: assignLineItemId || null,
          creditCardId: assignCardId || null,
        },
      });
      toast("Assignment saved.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Save failed.").error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    setSaving(true);
    try {
      if (assignGrantId && assignLineItemId) {
        await patchQueue.mutateAsync({
          id: queueId,
          body: {
            grantId: assignGrantId || null,
            lineItemId: assignLineItemId || null,
            creditCardId: assignCardId || null,
          },
        });
      }
      await postQueue.mutateAsync({ id: queueId });
      toast("Invoice posted to ledger.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Post failed.").error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    setSaving(true);
    try {
      await reopenQueue.mutateAsync({ id: queueId });
      toast("Reopened.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e, "Reopen failed.").error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const VIEW_TABS: { id: ViewMode; label: string }[] = [
    { id: "detail", label: "Pipeline" },
    { id: "qa", label: "Normalized Answers" },
    { id: "raw", label: "Raw Inspector" },
  ];

  return (
    <div className="space-y-4">
      <AmountHeader
        amount={row.amountCents}
        title={row.title}
        subtitle={[grantName, lineItemLabel].filter((s) => s && s !== "-").join(" | ")}
        state={row.workflowState}
        badge={<QueueLifecycleBadge status={queueStatus} />}
      />

      {/* Customer link */}
      {row.customerId && (
        <CustomerLink customerId={row.customerId} name={customerName} />
      )}

      {/* View mode tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={[
                "relative px-4 py-2 text-sm font-medium transition",
                "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full",
                viewMode === tab.id
                  ? "text-sky-600 after:bg-sky-500"
                  : "text-slate-500 after:bg-transparent hover:text-slate-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "detail" ? (
        <>
          <DetailSection title="Payment Queue Staging">
            <DetailRow label="Form" value={String(row.paymentQueueItem?.formTitle || row.paymentQueueItem?.formAlias || "-")} />
            <DetailRow label="Date" value={fmtDateOrDash(row.date)} />
            <DetailRow label="Status" value={<StatusBadge state={row.workflowState} />} />
            <DetailRow label="Queue Status" value={<QueueLifecycleBadge status={queueStatus} />} />
            <DetailRow label="Queue Source" value={stageLabelFromQueueSource(row.paymentQueueItem?.source)} />
            {row.paymentQueueItem?.note && (
              <DetailRow label="Note" value={String(row.paymentQueueItem.note)} />
            )}
            {legacyInvoiceStatus ? (
              <DetailRow label="Legacy Invoice Status" value={legacyInvoiceStatus} />
            ) : null}
          </DetailSection>
          <ProvenanceSection
            queueItem={row.paymentQueueItem || null}
            ledgerEntry={(ledgerEntryQ.data as Record<string, unknown> | null) || null}
            title="Pipeline Provenance"
          />
        </>
      ) : (
        <JotformViewPanel
          submissionId={submissionId}
          rawMeta={row.paymentQueueItem?.rawMeta}
          mode={viewMode}
        />
      )}

      {/* Reassign grant + card */}
      <DetailSection title="Assign">
        <div className="space-y-2">
          <GrantSelect
            value={assignGrantId || null}
            onChange={(v) => { setAssignGrantId(String(v || "")); setAssignLineItemId(""); }}
            includeUnassigned
          />
          <LineItemSelect
            grantId={assignGrantId || null}
            value={assignLineItemId || null}
            onChange={(v) => setAssignLineItemId(String(v || ""))}
            inputClassName="w-full"
          />
          <CreditCardSelect
            value={assignCardId || null}
            onChange={(v) => setAssignCardId(String(v || ""))}
            includeUnassigned
            inputClassName="w-full"
          />
          <button
            className="btn btn-ghost btn-sm w-full"
            disabled={anyMutating || saving}
            onClick={handleSaveAssignment}
          >
            Save Assignment
          </button>
        </div>
      </DetailSection>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn btn-ghost btn-sm"
          disabled={anyMutating || saving || row.workflowState === "open"}
          onClick={handleReopen}
        >
          Reopen
        </button>
        <button
          className="btn btn-sm"
          disabled={anyMutating || saving || row.workflowState === "closed"}
          onClick={handlePost}
        >
          Post to Ledger
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpendDetailModal — router + Modal wrapper
// ---------------------------------------------------------------------------

export function SpendDetailModal({
  row,
  isOpen,
  onClose,
  grantNameById,
  lineItemLookup,
  customerNameById,
  cardBudget,
  workflowTask,
}: ModalProps) {
  if (!row) return null;

  const isEnrollment = row.kind === "grant-ledger" || row.kind === "queue-projection";
  const isCard = row.kind === "card-ledger" || row.kind === "queue-credit-card";
  const isInvoice = row.kind === "queue-invoice";

  const titleMap: Record<SpendRowKind, string> = {
    "grant-ledger": "Posted Payment",
    "queue-projection": "Projected Payment",
    "card-ledger": "Card Spend",
    "queue-credit-card": "Card Queue Item",
    "queue-invoice": "Invoice Queue Item",
  };

  return (
    <Modal
      isOpen={isOpen}
      title={
        <div className="flex items-center gap-2">
          <span>{titleMap[row.kind]}</span>
          <span className="text-sm font-normal text-slate-500">{fmtCents(row.amountCents)}</span>
        </div>
      }
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      }
    >
      <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
        {isEnrollment && (
          <EnrollmentSpendCard
            row={row}
            grantNameById={grantNameById}
            lineItemLookup={lineItemLookup}
            customerNameById={customerNameById}
          />
        )}
        {isCard && (
          <CardSpendCard
            row={row}
            grantNameById={grantNameById}
            lineItemLookup={lineItemLookup}
            customerNameById={customerNameById}
            cardBudget={cardBudget}
            workflowTask={workflowTask}
          />
        )}
        {isInvoice && (
          <InvoiceSpendCard
            row={row}
            grantNameById={grantNameById}
            lineItemLookup={lineItemLookup}
            customerNameById={customerNameById}
          />
        )}
      </div>
    </Modal>
  );
}
