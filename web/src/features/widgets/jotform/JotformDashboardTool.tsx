import React from "react";
import Link from "next/link";
import { toApiError } from "@client/api";
import { DetailCardShell, DetailRow, DetailSection } from "@entities/detail-card/core";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import type { DashboardToolDefinition } from "@entities/Page/dashboardStyle/types";
import {
  useJotformDigest,
  useJotformDigests,
  useJotformSubmission,
  useJotformSubmissionsLite,
  useJotformFormsLite,
  useLinkJotformSubmission,
  useSyncJotformSelection,
  useSyncJotformSubmissions,
  useUpsertJotformDigest,
  type JotformDigestMap,
  type JotformSubmission,
} from "@hooks/useJotform";
import { usePaymentQueueItems, type PaymentQueueItem } from "@hooks/usePaymentQueue";
import { fmtCurrencyUSD, fmtDateSmartOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import type {
  JotformDigestUpsertReq,
  JotformSyncSelectionResp,
  JotformSyncSubmissionsResp,
} from "@types";
import { buildLineItemsDigestTemplate, isLineItemsFormId } from "./lineItemsFormMap";
import {
  fileLabelFromUrl,
  stageLabelFromQueueSource,
  summarizeQueueState,
  summarizeSubmission,
} from "./jotformSubmissionView";

type DetailViewMode = "pipeline" | "raw";

export type JotformDashboardFilterState = {
  formSearch: string;
  submissionSearch: string;
  detailView: DetailViewMode;
};

export type JotformDashboardSelection = {
  formId: string;
  submissionId?: string;
} | null;

type SyncFormSummary = {
  formId?: string;
  alias?: string;
  count?: number;
};

type SyncSummaryResponse = {
  count?: number;
  forms?: SyncFormSummary[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readSyncStage(error: unknown): string {
  const meta = asObject(asObject(error).meta);
  const response = meta.response ?? error;
  const responseObj = asObject(response);
  return String(asObject(responseObj.meta).stage || responseObj.stage || "unknown");
}

function syncErrorMessage(error: unknown): string {
  return `Sync failed at ${readSyncStage(error)}: ${toApiError(error).error}`;
}

function syncSuccessSummary(response: JotformSyncSelectionResp | JotformSyncSubmissionsResp): string {
  const summary = response as SyncSummaryResponse;
  const forms = Array.isArray(summary.forms) ? summary.forms : [];
  if (!forms.length) return `${Number(summary.count || 0)} submissions synced.`;
  const labels = forms
    .map((form) => {
      const alias = String(form.alias || "").trim();
      const formId = String(form.formId || "").trim();
      const count = Number(form.count || 0);
      return `${alias || formId} (${count})`;
    })
    .filter(Boolean)
    .join(", ");
  return `${Number(summary.count || 0)} submissions synced across ${labels}.`;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "slate" | "emerald" | "amber" | "rose" | "sky";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <div className="uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-right text-slate-700">{value}</div>
    </div>
  );
}

function SubmissionRowCard({
  submission,
  digestMap,
  active,
  onClick,
}: {
  submission: JotformSubmission;
  digestMap: JotformDigestMap | null;
  active: boolean;
  onClick: () => void;
}) {
  const { summary, items } = summarizeSubmission(submission, digestMap || undefined);
  const primaryCounterparty = summary.counterparties[0] || "-";

  return (
    <button
      type="button"
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-sky-300 bg-sky-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{summary.title}</div>
          <div className="truncate text-xs text-slate-500">{summary.submissionId}</div>
        </div>
        <StatusPill tone={summary.paymentType === "invoice" ? "sky" : summary.paymentType === "credit-card" ? "amber" : "slate"}>
          {summary.paymentType}
        </StatusPill>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-700">
        <MetadataRow label="Date" value={fmtDateSmartOrDash(summary.date)} />
        <MetadataRow label="Purchaser" value={summary.purchaser || "-"} />
        <MetadataRow label="Total" value={fmtCurrencyUSD(summary.amountTotal)} />
        <MetadataRow label="Payee / Customer" value={primaryCounterparty} />
        <MetadataRow label="Transactions" value={String(items.length)} />
      </div>
    </button>
  );
}

function QueueStageCard({
  item,
  queueItem,
}: {
  item: Record<string, unknown>;
  queueItem?: PaymentQueueItem | null;
}) {
  const attachmentUrls = Array.from(new Set([
    ...((item.files as string[] | undefined) || []),
    ...((item.files_txn as string[] | undefined) || []),
    ...((item.files_uploadAll as string[] | undefined) || []),
  ].filter(Boolean)));
  const filesTyped = (item.files_typed || {}) as Record<string, string[]>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {String(item.source || "") === "credit-card"
              ? `Transaction ${String(item.txnNumber || "") || "Item"}`
              : `Invoice ${queueItem ? "Queue Item" : "Split"}`}
          </div>
          <div className="text-xs text-slate-500">{String(item.id || "")}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-900">{fmtCurrencyUSD(item.amount)}</div>
          <div className="text-xs text-slate-500">{stageLabelFromQueueSource(item.source)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DetailSection title="Extracted Payment Object">
          <DetailRow label="Merchant / Vendor" value={String(item.merchant || "-")} />
          <DetailRow label="Purpose" value={String(item.purpose || item.descriptor || "-")} />
          <DetailRow label="Expense Type" value={String(item.expenseType || "-")} />
          <DetailRow label="Program" value={String(item.program || item.project || item.billedTo || "-")} />
          <DetailRow label="Customer" value={String(item.customer || "-")} />
          <DetailRow label="Purchaser" value={String(item.purchaser || "-")} />
          <DetailRow label="Created" value={fmtDateSmartOrDash(item.createdAt)} />
        </DetailSection>

        <DetailSection title="Payment Queue Staging">
          <DetailRow label="Queue Item" value={String(queueItem?.id || "Not created")} />
          <DetailRow label="Queue Status" value={String(queueItem?.queueStatus || "pending")} />
          <DetailRow label="Grant" value={String(queueItem?.grantId || "-")} />
          <DetailRow label="Line Item" value={String(queueItem?.lineItemId || "-")} />
          <DetailRow label="Customer ID" value={String(queueItem?.customerId || "-")} />
          <DetailRow label="Ledger Entry" value={String(queueItem?.ledgerEntryId || "Not posted")} />
          <DetailRow label="Extraction Path" value={String(item.extractionPath || "-")} />
        </DetailSection>
      </div>

      {(attachmentUrls.length || Object.values(filesTyped).some((values) => values?.length)) ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Attachments</div>
          <div className="mt-2 space-y-1 text-xs text-slate-700">
            {attachmentUrls.map((url, index) => (
              <div key={`${url}:${index}`} className="flex items-center justify-between gap-3 rounded bg-white px-2 py-1">
                <span className="truncate">{fileLabelFromUrl(url, `Attachment ${index + 1}`)}</span>
                <a className="text-sky-700 hover:underline" href={url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
            ))}
            {Object.entries(filesTyped)
              .filter(([, values]) => Array.isArray(values) && values.length)
              .map(([bucket, values]) => (
                <div key={bucket} className="rounded bg-white px-2 py-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{bucket}</div>
                  <div className="space-y-1">
                    {values.map((url, index) => (
                      <div key={`${bucket}:${url}:${index}`} className="flex items-center justify-between gap-3 text-xs text-slate-700">
                        <span className="truncate">{fileLabelFromUrl(url, `${bucket} ${index + 1}`)}</span>
                        <a className="text-sky-700 hover:underline" href={url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubmissionPipelinePane({
  submission,
  digestMap,
  queueItems,
  grantId,
  customerId,
  enrollmentId,
  formAlias,
  cwId,
  hmisId,
  onGrantIdChange,
  onCustomerIdChange,
  onEnrollmentIdChange,
  onFormAliasChange,
  onCwIdChange,
  onHmisIdChange,
  onSaveLink,
  savingLink,
  grantName,
  customerName,
}: {
  submission: JotformSubmission;
  digestMap: JotformDigestMap | null;
  queueItems: PaymentQueueItem[];
  grantId: string;
  customerId: string;
  enrollmentId: string;
  formAlias: string;
  cwId: string;
  hmisId: string;
  onGrantIdChange: (value: string) => void;
  onCustomerIdChange: (value: string) => void;
  onEnrollmentIdChange: (value: string) => void;
  onFormAliasChange: (value: string) => void;
  onCwIdChange: (value: string) => void;
  onHmisIdChange: (value: string) => void;
  onSaveLink: () => void;
  savingLink: boolean;
  grantName: string;
  customerName: string;
}) {
  const { summary, fields, items } = summarizeSubmission(submission, digestMap || undefined);
  const queueState = summarizeQueueState(queueItems);
  const queueById = new Map(queueItems.map((item) => [String(item.id), item]));

  return (
    <div className="space-y-4">
      <DetailCardShell
        title="Submission Header"
        subtitle={summary.title}
        actions={
          <div className="flex flex-wrap gap-2 text-xs">
            {submission.submissionUrl ? (
              <a className="text-sky-700 hover:underline" href={String(submission.submissionUrl)} target="_blank" rel="noreferrer">
                Submission URL
              </a>
            ) : null}
            {submission.editUrl ? (
              <a className="text-sky-700 hover:underline" href={String(submission.editUrl)} target="_blank" rel="noreferrer">
                Edit URL
              </a>
            ) : null}
            {submission.pdfUrl ? (
              <a className="text-sky-700 hover:underline" href={String(submission.pdfUrl)} target="_blank" rel="noreferrer">
                PDF
              </a>
            ) : null}
          </div>
        }
      >
        <DetailSection title="Submission">
          <DetailRow label="Submission ID" value={summary.submissionId || "-"} />
          <DetailRow label="Form" value={summary.formTitle || "-"} />
          <DetailRow label="Alias" value={summary.formAlias || "-"} />
          <DetailRow label="Type" value={summary.paymentType} />
          <DetailRow label="Purchaser" value={summary.purchaser || "-"} />
          <DetailRow label="Date" value={fmtDateSmartOrDash(summary.date)} />
          <DetailRow label="Amount Total" value={fmtCurrencyUSD(summary.amountTotal)} />
          <DetailRow label="Counterparties" value={summary.counterparties.join(", ") || "-"} />
        </DetailSection>
      </DetailCardShell>

      <DetailCardShell title="Pipeline Snapshot" subtitle="Raw submission -> normalized answers -> extracted payment objects -> payment queue -> ledger">
        <DetailSection title="Status">
          <DetailRow label="Digest Map" value={digestMap ? "Configured" : "Not configured"} />
          <DetailRow label="Extracted Items" value={String(items.length)} />
          <DetailRow label="Queue Docs" value={String(queueState.total)} />
          <DetailRow label="Pending Queue" value={String(queueState.pending)} />
          <DetailRow label="Posted Queue" value={String(queueState.posted)} />
          <DetailRow label="Voided Queue" value={String(queueState.void)} />
          <DetailRow label="Ledger Entries" value={queueState.ledgerIds.join(", ") || "Not posted"} />
        </DetailSection>
        <DetailSection title="Cross-Tool Links">
          <DetailRow label="Source Browser" value={<Link className="text-sky-700 hover:underline" href="/tools/jotforms">Open Jotforms Tool</Link>} />
          <DetailRow label="Payment Staging" value={<Link className="text-sky-700 hover:underline" href="/tools/spending">Open Invoicing Tool</Link>} />
        </DetailSection>
      </DetailCardShell>

      <DetailCardShell title="Link to System Records" subtitle="Submission-level mapping that feeds queue extraction">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Grant ID" value={grantId} onChange={(e) => onGrantIdChange(e.currentTarget.value)} />
          <input className="input" placeholder="Customer ID" value={customerId} onChange={(e) => onCustomerIdChange(e.currentTarget.value)} />
          <input className="input" placeholder="Enrollment ID" value={enrollmentId} onChange={(e) => onEnrollmentIdChange(e.currentTarget.value)} />
          <input className="input" placeholder="Form Alias" value={formAlias} onChange={(e) => onFormAliasChange(e.currentTarget.value)} />
          <input className="input" placeholder="CW ID" value={cwId} onChange={(e) => onCwIdChange(e.currentTarget.value)} />
          <input className="input" placeholder="HMIS ID" value={hmisId} onChange={(e) => onHmisIdChange(e.currentTarget.value)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span>Current linked: Grant {grantName || grantId || "-"} | Customer {customerName || customerId || "-"} | Enrollment {enrollmentId || "-"}</span>
          <button className="btn btn-sm" onClick={onSaveLink} disabled={savingLink}>
            {savingLink ? "Saving..." : "Save Link"}
          </button>
        </div>
      </DetailCardShell>

      <DetailCardShell title="Normalized Answers" subtitle="Cleaned question and answer mapping from the raw Jotform payload">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {fields.length ? fields.map((field) => (
            <div key={field.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</div>
              <div className="mt-1 text-sm text-slate-900 break-words">{field.value}</div>
              <div className="mt-2 text-[11px] font-mono text-slate-400">{field.key}</div>
            </div>
          )) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No normalized answers found.
            </div>
          )}
        </div>
      </DetailCardShell>

      <DetailCardShell title="Extracted Payment Objects" subtitle="Each extracted spend line and its staging/ledger linkage">
        <div className="space-y-3">
          {items.length ? items.map((item) => (
            <QueueStageCard
              key={String(item.id)}
              item={item as unknown as Record<string, unknown>}
              queueItem={queueById.get(String(item.id)) || null}
            />
          )) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No spend items were extracted from this submission.
            </div>
          )}
        </div>
      </DetailCardShell>
    </div>
  );
}

function RawInspector({ submission }: { submission: JotformSubmission }) {
  return (
    <DetailCardShell title="Raw Inspector" subtitle="Source payload kept for audit and debugging">
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Submission JSON</summary>
        <pre className="mt-3 max-h-[70dvh] overflow-auto rounded border border-slate-200 bg-slate-950 p-3 text-[11px] text-emerald-300">
          {JSON.stringify(submission, null, 2)}
        </pre>
      </details>
    </DetailCardShell>
  );
}

function useJotformDashboardData(filterState: JotformDashboardFilterState, selection: JotformDashboardSelection) {
  const formId = String(selection?.formId || "");
  const selectedSubmissionId = String(selection?.submissionId || "");
  const formsQ = useJotformFormsLite(
    { search: filterState.formSearch || undefined, includeNoSubmissions: true, limit: 500 },
    { enabled: true, staleTime: 300_000 },
  );
  const digestsQ = useJotformDigests({}, { enabled: true, staleTime: 120_000 });
  const submissionsQ = useJotformSubmissionsLite(
    formId ? { formId, limit: 500 } : undefined,
    { enabled: !!formId, staleTime: 20_000 },
  );
  const submissionDetailQ = useJotformSubmission(
    selectedSubmissionId || undefined,
    { enabled: !!selectedSubmissionId, staleTime: 60_000 },
  );
  const digestQ = useJotformDigest(formId ? { formId } : undefined, { enabled: !!formId, staleTime: 20_000 });
  const queueQ = usePaymentQueueItems(
    selectedSubmissionId ? { submissionId: selectedSubmissionId, limit: 50 } : undefined,
    { enabled: !!selectedSubmissionId, staleTime: 20_000 },
  );

  const selectedForm = (formsQ.data || []).find((form) => String(form.id || "") === formId) || null;
  const filteredSubmissions = React.useMemo(() => {
    const search = String(filterState.submissionSearch || "").trim().toLowerCase();
    const rows = submissionsQ.data || [];
    if (!search) return rows;
    return rows.filter((submission) => {
      const { summary, fields } = summarizeSubmission(submission, digestQ.data || null);
      const haystack = [
        summary.submissionId,
        summary.title,
        summary.purchaser,
        summary.counterparties.join(" "),
        summary.formAlias,
        summary.formTitle,
        ...fields.map((field) => `${field.label} ${field.value}`),
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [submissionsQ.data, filterState.submissionSearch, digestQ.data]);

  const selectedFromList = filteredSubmissions.find(
    (submission) => String(submission.submissionId || submission.id || "") === selectedSubmissionId,
  ) || null;
  const selectedSubmission = submissionDetailQ.data ?? selectedFromList;

  return {
    formId,
    formsQ,
    digestsQ,
    submissionsQ,
    digestQ,
    queueQ,
    selectedForm,
    filteredSubmissions,
    selectedSubmission,
  };
}

export const JotformDashboardTopbar: DashboardToolDefinition<JotformDashboardFilterState, JotformDashboardSelection>["ToolTopbar"] = ({
  value,
  onChange,
  selection,
}) => {
  const { formId, formsQ, submissionsQ, selectedForm } = useJotformDashboardData(value, selection as JotformDashboardSelection);
  const syncSelection = useSyncJotformSelection();
  const syncSubmissions = useSyncJotformSubmissions();
  const upsertDigest = useUpsertJotformDigest();

  const onRefreshForms = async () => {
    try {
      await formsQ.refetch();
      toast("Forms refreshed.", { type: "success" });
    } catch (error: unknown) {
      toast(toApiError(error).error, { type: "error" });
    }
  };

  const onPullSubmissions = async () => {
    if (!formId) return;
    try {
      const result = await syncSubmissions.mutateAsync({ formId, limit: 500, maxPages: 10, includeRaw: true });
      await submissionsQ.refetch();
      toast(syncSuccessSummary(result), { type: "success" });
    } catch (error: unknown) {
      toast(syncErrorMessage(error), { type: "error" });
    }
  };

  const onSyncSelectedForm = async () => {
    if (!formId) return;
    try {
      const result = await syncSelection.mutateAsync({ mode: "formIds", formIds: [formId], limit: 500, maxPages: 10, includeRaw: true });
      await submissionsQ.refetch();
      toast(syncSuccessSummary(result), { type: "success" });
    } catch (error: unknown) {
      toast(syncErrorMessage(error), { type: "error" });
    }
  };

  const onSaveLineItemsTemplate = async () => {
    const id = String(selectedForm?.id || formId || "").trim();
    if (!id || !isLineItemsFormId(id)) return;
    const template = buildLineItemsDigestTemplate({
      formId: id,
      formTitle: String(selectedForm?.title || selectedForm?.id || ""),
      formAlias: String(selectedForm?.alias || ""),
    });
    if (!template) return;
    try {
      await upsertDigest.mutateAsync(template as JotformDigestUpsertReq);
      toast("Line-items digest template saved to DB.", { type: "success" });
    } catch (error: unknown) {
      toast(toApiError(error).error, { type: "error" });
    }
  };

  const searchingSubmissions = Boolean(formId);

  return (
    <>
      <input
        className="input w-64"
        placeholder={searchingSubmissions ? "Search cached submissions..." : "Search forms..."}
        value={searchingSubmissions ? value.submissionSearch : value.formSearch}
        onChange={(event) =>
          onChange({
            ...value,
            ...(searchingSubmissions
              ? { submissionSearch: event.currentTarget.value }
              : { formSearch: event.currentTarget.value }),
          })
        }
      />
      <button className="btn btn-ghost btn-sm" onClick={() => void onRefreshForms()} disabled={formsQ.isFetching}>
        {formsQ.isFetching ? "Refreshing..." : "Refresh Forms"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => void onPullSubmissions()}
        disabled={!formId || syncSubmissions.isPending}
        title="Pull Jotform submissions into local cache"
      >
        {syncSubmissions.isPending ? "Pulling..." : "Refresh Submissions (Pull)"}
      </button>
      <button
        className="btn btn-sm"
        onClick={() => void onSyncSelectedForm()}
        disabled={!formId || syncSelection.isPending}
        title="Sync selected forms into local submissions and refresh payment queue staging"
      >
        {syncSelection.isPending ? "Syncing..." : "Sync Submissions"}
      </button>
      {selectedForm && isLineItemsFormId(selectedForm.id) ? (
        <button className="btn btn-ghost btn-sm" onClick={() => void onSaveLineItemsTemplate()} disabled={upsertDigest.isPending}>
          {upsertDigest.isPending ? "Saving..." : "Update Line-Items Map Doc"}
        </button>
      ) : null}
    </>
  );
};

export const JotformDashboardSidebar: DashboardToolDefinition<JotformDashboardFilterState, JotformDashboardSelection>["Sidebar"] = ({
  filterState,
  selection,
  onSelect,
}) => {
  const { formsQ, digestsQ } = useJotformDashboardData(
    filterState as JotformDashboardFilterState,
    selection as JotformDashboardSelection,
  );
  const digestIds = new Set((digestsQ.data || []).map((digest) => String(digest.formId || digest.id || "")));

  return (
    <div className="space-y-2 p-2">
      <div className="px-2 py-1 text-xs text-slate-600">Forms ({(formsQ.data || []).length})</div>
      {formsQ.isLoading ? (
        <div className="rounded border border-slate-200 px-2 py-2 text-xs text-slate-500">Loading forms...</div>
      ) : (
        (formsQ.data || []).map((form) => {
          const active = String(form.id || "") === String((selection as JotformDashboardSelection)?.formId || "");
          const isSpendForm = isLineItemsFormId(String(form.id || ""));
          const hasDigest = digestIds.has(String(form.id || ""));
          return (
            <button
              key={String(form.id || "")}
              type="button"
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? "border-sky-300 bg-sky-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
              onClick={() => onSelect({ formId: String(form.id || "") })}
            >
              <div className="truncate text-sm font-semibold text-slate-900">{String(form.title || form.id || "-")}</div>
              <div className="mt-1 truncate text-xs text-slate-500">Alias: {String(form.alias || "-")}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {isSpendForm ? <StatusPill tone="amber">Payment Staging</StatusPill> : null}
                {hasDigest ? <StatusPill tone="sky">Digest</StatusPill> : null}
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600">
                <MetadataRow label="Jotform Count" value={String(Number(form.count || 0))} />
                <MetadataRow label="Last Submission" value={fmtDateSmartOrDash(form.lastSubmission)} />
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

export const JotformDashboardMain: DashboardToolDefinition<JotformDashboardFilterState, JotformDashboardSelection>["Main"] = ({
  filterState,
  onFilterChange,
  selection,
  onSelect,
}) => {
  const sel = selection as JotformDashboardSelection;
  const fs = filterState as JotformDashboardFilterState;
  const { grantNameById, customerNameById } = useDashboardSharedData();
  const { selectedForm, submissionsQ, digestQ, filteredSubmissions, selectedSubmission, queueQ } = useJotformDashboardData(fs, sel);
  const linkSubmission = useLinkJotformSubmission();
  const [grantId, setGrantId] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [cwId, setCwId] = React.useState("");
  const [hmisId, setHmisId] = React.useState("");
  const [formAlias, setFormAlias] = React.useState("");

  React.useEffect(() => {
    if (!selectedSubmission) {
      setGrantId("");
      setCustomerId("");
      setEnrollmentId("");
      setCwId("");
      setHmisId("");
      setFormAlias("");
      return;
    }
    setGrantId(String(selectedSubmission.grantId || ""));
    setCustomerId(String(selectedSubmission.customerId || ""));
    setEnrollmentId(String(selectedSubmission.enrollmentId || ""));
    setFormAlias(String(selectedSubmission.formAlias || ""));
    setCwId(String(selectedSubmission.cwId || ""));
    setHmisId(String(selectedSubmission.hmisId || ""));
  }, [selectedSubmission]);

  const onLink = async () => {
    const submissionId = String(selectedSubmission?.submissionId || selectedSubmission?.id || "").trim();
    if (!submissionId) {
      toast("Select a submission to link.", { type: "error" });
      return;
    }
    try {
      await linkSubmission.mutateAsync({
        submissionId,
        ...(grantId ? { grantId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(cwId ? { cwId } : {}),
        ...(hmisId ? { hmisId } : {}),
        ...(formAlias ? { formAlias } : {}),
      });
      toast("Submission link saved.", { type: "success" });
    } catch (error: unknown) {
      toast(toApiError(error).error, { type: "error" });
    }
  };

  if (!selectedForm) {
    return <div className="p-4 text-sm text-slate-500">Select a form from the sidebar to browse cached submissions.</div>;
  }

  return (
    <div className="grid h-full min-h-0 gap-4 p-3 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-900">{String(selectedForm.title || selectedForm.id || "-")}</div>
          <div className="mt-1 text-xs text-slate-500">Alias: {String(selectedForm.alias || "-")}</div>
          <div className="mt-3 grid gap-1 text-xs text-slate-600">
            <MetadataRow label="Local Cache" value={String(filteredSubmissions.length)} />
            <MetadataRow label="Last Pull" value={fmtDateSmartOrDash(submissionsQ.dataUpdatedAt)} />
            <MetadataRow label="Digest" value={digestQ.data ? "Configured" : "Not configured"} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cached Submissions</div>
          <div className="text-xs text-slate-400">{filteredSubmissions.length}</div>
        </div>

        <div className="mt-3 space-y-2">
          {submissionsQ.isLoading ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Loading cached submissions...
            </div>
          ) : filteredSubmissions.length ? (
            filteredSubmissions.map((submission) => {
              const rowId = String(submission.submissionId || submission.id || "");
              return (
                <SubmissionRowCard
                  key={rowId}
                  submission={submission}
                  digestMap={digestQ.data || null}
                  active={rowId === String(sel?.submissionId || "")}
                  onClick={() => onSelect({ formId: String(selectedForm.id || ""), submissionId: rowId })}
                />
              );
            })
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800">
              No cached submissions found for this form. Use `Refresh Submissions (Pull)` to populate local records.
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-auto">
        {!selectedSubmission ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Select a submission to inspect the raw form, normalized answers, extracted payment objects, payment queue staging docs, and ledger linkage.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Submission {String(selectedSubmission.submissionId || selectedSubmission.id || "-")}
                </div>
                <div className="text-xs text-slate-500">{String(selectedSubmission.formTitle || selectedSubmission.formAlias || selectedSubmission.formId || "-")}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`btn btn-sm ${fs.detailView === "pipeline" ? "" : "btn-ghost"}`}
                  onClick={() => onFilterChange?.({ ...fs, detailView: "pipeline" })}
                >
                  Pipeline
                </button>
                <button
                  className={`btn btn-sm ${fs.detailView === "raw" ? "" : "btn-ghost"}`}
                  onClick={() => onFilterChange?.({ ...fs, detailView: "raw" })}
                >
                  Raw Inspector
                </button>
              </div>
            </div>

            {fs.detailView === "pipeline" ? (
              <SubmissionPipelinePane
                submission={selectedSubmission}
                digestMap={digestQ.data || null}
                queueItems={queueQ.data || []}
                grantId={grantId}
                customerId={customerId}
                enrollmentId={enrollmentId}
                formAlias={formAlias}
                cwId={cwId}
                hmisId={hmisId}
                onGrantIdChange={setGrantId}
                onCustomerIdChange={setCustomerId}
                onEnrollmentIdChange={setEnrollmentId}
                onFormAliasChange={setFormAlias}
                onCwIdChange={setCwId}
                onHmisIdChange={setHmisId}
                onSaveLink={() => void onLink()}
                savingLink={linkSubmission.isPending}
                grantName={grantNameById.get(grantId) || ""}
                customerName={customerNameById.get(customerId) || ""}
              />
            ) : (
              <RawInspector submission={selectedSubmission} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
