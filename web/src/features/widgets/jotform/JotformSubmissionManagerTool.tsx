import React from "react";
import {
  useJotformApiSubmissions,
  useJotformForms,
  useJotformSubmissions,
  useLinkJotformSubmission,
  useSyncJotformSelection,
} from "@hooks/useJotform";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import type { DashboardToolDefinition, NavCrumb } from "@entities/Page/dashboardStyle/types";

export type JotformSubmissionManagerFilterState = {
  managerFormId: string;
  managerSubmissionId: string;
  managerGrantId: string;
  managerCustomerId: string;
  managerEnrollmentId: string;
  managerCwId: string;
  managerHmisId: string;
  managerFormAlias: string;
};

type JotformSubmissionManagerSelection = null;

type JotformSubmissionManagerToolProps = {
  filterState?: JotformSubmissionManagerFilterState;
  onFilterChange?: (next: JotformSubmissionManagerFilterState) => void;
};

type JotformSubmissionManagerTopbarProps = {
  value: JotformSubmissionManagerFilterState;
  onChange: (next: JotformSubmissionManagerFilterState) => void;
  selection: JotformSubmissionManagerSelection;
  nav: {
    stack: NavCrumb<JotformSubmissionManagerSelection>[];
    push: (c: NavCrumb<JotformSubmissionManagerSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<JotformSubmissionManagerSelection>[]) => void;
  };
};

const EMPTY_FILTER_STATE: JotformSubmissionManagerFilterState = {
  managerFormId: "",
  managerSubmissionId: "",
  managerGrantId: "",
  managerCustomerId: "",
  managerEnrollmentId: "",
  managerCwId: "",
  managerHmisId: "",
  managerFormAlias: "",
};

function filterManagerSubmissions(
  rows: Array<Record<string, unknown>>,
  filters: JotformSubmissionManagerFilterState
) {
  const submissionQuery = String(filters.managerSubmissionId || "").trim().toLowerCase();
  const aliasQuery = String(filters.managerFormAlias || "").trim().toLowerCase();
  const grantQuery = String(filters.managerGrantId || "").trim().toLowerCase();
  const customerQuery = String(filters.managerCustomerId || "").trim().toLowerCase();
  const enrollmentQuery = String(filters.managerEnrollmentId || "").trim().toLowerCase();
  const cwQuery = String(filters.managerCwId || "").trim().toLowerCase();
  const hmisQuery = String(filters.managerHmisId || "").trim().toLowerCase();

  return rows.filter((row) => {
    const submissionPass =
      !submissionQuery ||
      `${String(row?.submissionId || "")} ${String(row?.id || "")}`.toLowerCase().includes(submissionQuery);
    const aliasPass =
      !aliasQuery ||
      `${String(row?.formAlias || "")} ${String(row?.formTitle || "")} ${String(row?.formId || "")}`
        .toLowerCase()
        .includes(aliasQuery);
    const grantPass = !grantQuery || String(row?.grantId || "").toLowerCase().includes(grantQuery);
    const customerPass = !customerQuery || String(row?.customerId || "").toLowerCase().includes(customerQuery);
    const enrollmentPass = !enrollmentQuery || String(row?.enrollmentId || "").toLowerCase().includes(enrollmentQuery);
    const cwPass = !cwQuery || String(row?.cwId || "").toLowerCase().includes(cwQuery);
    const hmisPass = !hmisQuery || String(row?.hmisId || "").toLowerCase().includes(hmisQuery);
    return submissionPass && aliasPass && grantPass && customerPass && enrollmentPass && cwPass && hmisPass;
  });
}

function SubmissionManagerControls({
  value,
  onChange,
  showActions,
}: {
  value: JotformSubmissionManagerFilterState;
  onChange: (next: JotformSubmissionManagerFilterState) => void;
  showActions: boolean;
}) {
  const { grantNameById, customerNameById } = useDashboardSharedData();
  const { data: jotformForms = [] } = useJotformForms({ limit: 200 }, { enabled: true });
  const { data: allManagerSubmissions = [] } = useJotformSubmissions({ limit: 200 }, { enabled: true });
  const { data: liveManagerSubmissions = [] } = useJotformApiSubmissions(
    value.managerFormId ? { formId: value.managerFormId, limit: 200 } : undefined,
    { enabled: !!value.managerFormId, staleTime: 30_000 }
  );
  const syncSelection = useSyncJotformSelection();
  const linkSubmission = useLinkJotformSubmission();
  const storedBySubmissionId = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const raw of allManagerSubmissions as Array<Record<string, unknown>>) {
      const submissionId = String(raw?.submissionId || raw?.id || "");
      if (submissionId) map.set(submissionId, raw);
    }
    return map;
  }, [allManagerSubmissions]);
  const managerSubmissions = React.useMemo(() => {
    const baseRows = value.managerFormId
      ? (liveManagerSubmissions as Array<Record<string, unknown>>).map((row) => {
          const submissionId = String(row?.submissionId || row?.id || "");
          const stored = storedBySubmissionId.get(submissionId) || {};
          return { ...row, ...stored, submissionId: submissionId || String(stored?.submissionId || stored?.id || "") };
        })
      : (allManagerSubmissions as Array<Record<string, unknown>>);
    return filterManagerSubmissions(baseRows, value);
  }, [allManagerSubmissions, liveManagerSubmissions, storedBySubmissionId, value]);

  const setField = (field: keyof JotformSubmissionManagerFilterState, nextValue: string) =>
    onChange({ ...value, [field]: nextValue });

  const onSyncSelectedForm = async () => {
    if (!value.managerFormId) return;
    await syncSelection.mutateAsync({ mode: "formIds", formIds: [value.managerFormId], limit: 300, maxPages: 5 });
  };

  const onLinkSubmission = async () => {
    if (!value.managerSubmissionId) return;
    await linkSubmission.mutateAsync({
      submissionId: value.managerSubmissionId,
      ...(value.managerGrantId ? { grantId: value.managerGrantId } : {}),
      ...(value.managerCustomerId ? { customerId: value.managerCustomerId } : {}),
      ...(value.managerEnrollmentId ? { enrollmentId: value.managerEnrollmentId } : {}),
      ...(value.managerCwId ? { cwId: value.managerCwId } : {}),
      ...(value.managerHmisId ? { hmisId: value.managerHmisId } : {}),
      ...(value.managerFormAlias ? { formAlias: value.managerFormAlias } : {}),
    });
  };

  return (
    <>
      <select className="select min-w-[220px]" value={value.managerFormId} onChange={(e) => setField("managerFormId", e.currentTarget.value)}>
        <option value="">Select form</option>
        {(jotformForms as any[]).map((f) => (
          <option key={String(f?.id || "")} value={String(f?.id || "")}>
            {String(f?.title || f?.alias || f?.id || "-")}
          </option>
        ))}
      </select>
      <input className="input min-w-[160px]" placeholder="Form Alias" value={value.managerFormAlias} onChange={(e) => setField("managerFormAlias", e.currentTarget.value)} />
      <input className="input min-w-[160px]" placeholder="Submission ID" value={value.managerSubmissionId} onChange={(e) => setField("managerSubmissionId", e.currentTarget.value)} />
      <input className="input min-w-[140px]" placeholder="Grant ID" value={value.managerGrantId} onChange={(e) => setField("managerGrantId", e.currentTarget.value)} />
      <input className="input min-w-[140px]" placeholder="Customer ID" value={value.managerCustomerId} onChange={(e) => setField("managerCustomerId", e.currentTarget.value)} />
      <input className="input min-w-[140px]" placeholder="Enrollment ID" value={value.managerEnrollmentId} onChange={(e) => setField("managerEnrollmentId", e.currentTarget.value)} />
      <input className="input min-w-[120px]" placeholder="CW ID" value={value.managerCwId} onChange={(e) => setField("managerCwId", e.currentTarget.value)} />
      <input className="input min-w-[120px]" placeholder="HMIS ID" value={value.managerHmisId} onChange={(e) => setField("managerHmisId", e.currentTarget.value)} />
      {showActions ? (
        <>
          <button className="btn" onClick={() => void onSyncSelectedForm()} disabled={!value.managerFormId || syncSelection.isPending}>
            Sync Selected Form
          </button>
          <button className="btn" onClick={() => void onLinkSubmission()} disabled={!value.managerSubmissionId || linkSubmission.isPending}>
            Link Submission
          </button>
          <SmartExportButton
            allRows={allManagerSubmissions as any[]}
            activeRows={managerSubmissions as any[]}
            filenameBase="jotform-submission-manager"
            columns={[
              { key: "submission", label: "Submission", value: (s: any) => String(s?.submissionId || s?.id || "-") },
              { key: "form", label: "Form", value: (s: any) => String(s?.formTitle || s?.formAlias || s?.formId || "-") },
              { key: "grant", label: "Grant", value: (s: any) => grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-") },
              { key: "customer", label: "Customer", value: (s: any) => customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-") },
              { key: "enrollment", label: "Enrollment", value: (s: any) => String(s?.enrollmentId || "-") },
            ]}
          />
        </>
      ) : null}
    </>
  );
}

export const JotformSubmissionManagerTopbar: DashboardToolDefinition<
  JotformSubmissionManagerFilterState,
  JotformSubmissionManagerSelection
>["ToolTopbar"] = ({ value, onChange }: JotformSubmissionManagerTopbarProps) => (
  <SubmissionManagerControls value={value} onChange={onChange} showActions />
);

export function JotformSubmissionManagerTool(props: JotformSubmissionManagerToolProps = {}) {
  const [localFilterState, setLocalFilterState] = React.useState<JotformSubmissionManagerFilterState>(EMPTY_FILTER_STATE);
  const filterState = props.filterState ?? localFilterState;
  const setFilterState = props.onFilterChange ?? setLocalFilterState;
  const { grantNameById, customerNameById, sharedDataLoading, sharedDataError } = useDashboardSharedData();
  const { data: jotformForms = [], isLoading: formsLoading } = useJotformForms({ limit: 200 }, { enabled: true });
  const { data: allManagerSubmissions = [], isLoading: submissionsLoading, isError: submissionsError } = useJotformSubmissions(
    { limit: 200 },
    { enabled: true }
  );
  const { data: liveManagerSubmissions = [], isLoading: liveLoading, isError: liveError } = useJotformApiSubmissions(
    filterState.managerFormId ? { formId: filterState.managerFormId, limit: 200 } : undefined,
    { enabled: !!filterState.managerFormId, staleTime: 30_000 }
  );
  const storedBySubmissionId = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const raw of allManagerSubmissions as Array<Record<string, unknown>>) {
      const submissionId = String(raw?.submissionId || raw?.id || "");
      if (submissionId) map.set(submissionId, raw);
    }
    return map;
  }, [allManagerSubmissions]);
  const managerSubmissions = React.useMemo(() => {
    const baseRows = filterState.managerFormId
      ? (liveManagerSubmissions as Array<Record<string, unknown>>).map((row) => {
          const submissionId = String(row?.submissionId || row?.id || "");
          const stored = storedBySubmissionId.get(submissionId) || {};
          return { ...row, ...stored, submissionId: submissionId || String(stored?.submissionId || stored?.id || "") };
        })
      : (allManagerSubmissions as Array<Record<string, unknown>>);
    return filterManagerSubmissions(baseRows, filterState);
  }, [allManagerSubmissions, filterState, liveManagerSubmissions, storedBySubmissionId]);
  const loading = sharedDataLoading || formsLoading || submissionsLoading || liveLoading;
  const error = sharedDataError || submissionsError || liveError;
  const syncSelection = useSyncJotformSelection();
  const linkSubmission = useLinkJotformSubmission();

  const onSyncSelectedForm = async () => {
    if (!filterState.managerFormId) return;
    await syncSelection.mutateAsync({ mode: "formIds", formIds: [filterState.managerFormId], limit: 300, maxPages: 5 });
  };

  const onLinkSubmission = async () => {
    if (!filterState.managerSubmissionId) return;
    await linkSubmission.mutateAsync({
      submissionId: filterState.managerSubmissionId,
      ...(filterState.managerGrantId ? { grantId: filterState.managerGrantId } : {}),
      ...(filterState.managerCustomerId ? { customerId: filterState.managerCustomerId } : {}),
      ...(filterState.managerEnrollmentId ? { enrollmentId: filterState.managerEnrollmentId } : {}),
      ...(filterState.managerCwId ? { cwId: filterState.managerCwId } : {}),
      ...(filterState.managerHmisId ? { hmisId: filterState.managerHmisId } : {}),
      ...(filterState.managerFormAlias ? { formAlias: filterState.managerFormAlias } : {}),
    });
  };

  return (
    <ToolCard
      title="Jotform Submission Manager"
      actions={
        props.filterState ? undefined : (
          <>
            <button className="btn" onClick={() => void onSyncSelectedForm()} disabled={!filterState.managerFormId || syncSelection.isPending}>
              Sync Selected Form
            </button>
            <SmartExportButton
              allRows={allManagerSubmissions as any[]}
              activeRows={managerSubmissions as any[]}
              filenameBase="jotform-submission-manager"
              columns={[
                { key: "submission", label: "Submission", value: (s: any) => String(s?.submissionId || s?.id || "-") },
                { key: "form", label: "Form", value: (s: any) => String(s?.formTitle || s?.formAlias || s?.formId || "-") },
                { key: "grant", label: "Grant", value: (s: any) => grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-") },
                { key: "customer", label: "Customer", value: (s: any) => customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-") },
                { key: "enrollment", label: "Enrollment", value: (s: any) => String(s?.enrollmentId || "-") },
              ]}
            />
          </>
        )
      }
    >
      {!props.filterState ? (
        <div className="grid gap-2 md:grid-cols-3">
          <select className="select" value={filterState.managerFormId} onChange={(e) => setFilterState({ ...filterState, managerFormId: e.currentTarget.value })}>
            <option value="">Select form</option>
            {(jotformForms as any[]).map((f) => (
              <option key={String(f?.id || "")} value={String(f?.id || "")}>
                {String(f?.title || f?.alias || f?.id || "-")}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Form Alias" value={filterState.managerFormAlias} onChange={(e) => setFilterState({ ...filterState, managerFormAlias: e.currentTarget.value })} />
          <input className="input" placeholder="Submission ID" value={filterState.managerSubmissionId} onChange={(e) => setFilterState({ ...filterState, managerSubmissionId: e.currentTarget.value })} />
          <input className="input" placeholder="Grant ID" value={filterState.managerGrantId} onChange={(e) => setFilterState({ ...filterState, managerGrantId: e.currentTarget.value })} />
          <input className="input" placeholder="Customer ID" value={filterState.managerCustomerId} onChange={(e) => setFilterState({ ...filterState, managerCustomerId: e.currentTarget.value })} />
          <input className="input" placeholder="Enrollment ID" value={filterState.managerEnrollmentId} onChange={(e) => setFilterState({ ...filterState, managerEnrollmentId: e.currentTarget.value })} />
          <input className="input" placeholder="CW ID" value={filterState.managerCwId} onChange={(e) => setFilterState({ ...filterState, managerCwId: e.currentTarget.value })} />
          <input className="input" placeholder="HMIS ID" value={filterState.managerHmisId} onChange={(e) => setFilterState({ ...filterState, managerHmisId: e.currentTarget.value })} />
          <button className="btn md:col-span-1" onClick={() => void onLinkSubmission()} disabled={!filterState.managerSubmissionId || linkSubmission.isPending}>
            Link Submission
          </button>
        </div>
      ) : null}

      <ToolTable
        headers={["Submission", "Form", "Grant", "Customer", "Enrollment"]}
        rows={
          loading ? (
            <tr>
              <td colSpan={5}>Loading submissions...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={5}>Failed to load submissions.</td>
            </tr>
          ) : (managerSubmissions as any[]).length ? (
            (managerSubmissions as any[]).map((s: any) => (
              <tr
                key={String(s?.id || "")}
                onClick={() =>
                  setFilterState({
                    ...filterState,
                    managerSubmissionId: String(s?.submissionId || s?.id || ""),
                  })
                }
              >
                <td>{String(s?.submissionId || s?.id || "-")}</td>
                <td>{String(s?.formTitle || s?.formAlias || s?.formId || "-")}</td>
                <td>{grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-")}</td>
                <td>{customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-")}</td>
                <td>{String(s?.enrollmentId || "-")}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No submissions loaded for manager.</td>
            </tr>
          )
        }
      />
    </ToolCard>
  );
}
