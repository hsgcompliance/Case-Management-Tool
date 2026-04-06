import React from "react";
import { useJotformApiSubmissions, useJotformFormsLite } from "@hooks/useJotform";
import { fmtDateSmartOrDash } from "@lib/formatters";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import type { DashboardToolDefinition, NavCrumb } from "@entities/Page/dashboardStyle/types";

export type LiveJotformSubmissionsFilterState = {
  liveAlias: string;
};

type LiveJotformSubmissionsSelection = null;

type LiveJotformSubmissionsToolProps = {
  filterState?: LiveJotformSubmissionsFilterState;
  onFilterChange?: (next: LiveJotformSubmissionsFilterState) => void;
};

type LiveJotformSubmissionsTopbarProps = {
  value: LiveJotformSubmissionsFilterState;
  onChange: (next: LiveJotformSubmissionsFilterState) => void;
  selection: LiveJotformSubmissionsSelection;
  nav: {
    stack: NavCrumb<LiveJotformSubmissionsSelection>[];
    push: (c: NavCrumb<LiveJotformSubmissionsSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<LiveJotformSubmissionsSelection>[]) => void;
  };
};

function findLiveForm(
  forms: Array<Record<string, unknown>>,
  aliasOrId: string
): Record<string, unknown> | null {
  const q = String(aliasOrId || "").trim().toLowerCase();
  if (!q) return null;

  const exact = forms.find((form) => {
    const id = String(form?.id || "").trim().toLowerCase();
    const alias = String(form?.alias || "").trim().toLowerCase();
    const title = String(form?.title || "").trim().toLowerCase();
    return id === q || alias === q || title === q;
  });
  if (exact) return exact;

  const fuzzy = forms.filter((form) => {
    const hay = [
      String(form?.id || ""),
      String(form?.alias || ""),
      String(form?.title || ""),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return fuzzy.length === 1 ? fuzzy[0] : null;
}

export const LiveJotformSubmissionsTopbar: DashboardToolDefinition<
  LiveJotformSubmissionsFilterState,
  LiveJotformSubmissionsSelection
>["ToolTopbar"] = ({ value, onChange }: LiveJotformSubmissionsTopbarProps) => {
  const { grantNameById, customerNameById } = useDashboardSharedData();
  const { data: forms = [] } = useJotformFormsLite(
    { includeNoSubmissions: true, limit: 500 },
    { enabled: true, staleTime: 300_000 }
  );
  const selectedForm = React.useMemo(
    () => findLiveForm(forms as Array<Record<string, unknown>>, value.liveAlias),
    [forms, value.liveAlias]
  );
  const selectedFormId = String(selectedForm?.id || "");
  const { data: liveSubmissions = [] } = useJotformApiSubmissions(
    selectedFormId ? { formId: selectedFormId, limit: 200 } : undefined,
    { enabled: !!selectedFormId, staleTime: 30_000 }
  );

  return (
    <>
      <input
        className="input w-[220px]"
        placeholder="Form alias, title, or ID"
        value={value.liveAlias}
        onChange={(e) => onChange({ liveAlias: e.currentTarget.value })}
      />
      <SmartExportButton
        allRows={liveSubmissions as any[]}
        activeRows={liveSubmissions as any[]}
        filenameBase="jotform-live-submissions"
        columns={[
          { key: "form", label: "Form", value: (s: any) => String(s?.formTitle || s?.formAlias || s?.formId || "-") },
          { key: "submission", label: "Submission", value: (s: any) => String(s?.submissionId || s?.id || "-") },
          { key: "grant", label: "Linked Grant", value: (s: any) => grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-") },
          { key: "customer", label: "Linked Customer", value: (s: any) => customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-") },
          { key: "updated", label: "Updated", value: (s: any) => String(s?.updatedAt || "") },
        ]}
      />
    </>
  );
};

export function LiveJotformSubmissionsTool(props: LiveJotformSubmissionsToolProps = {}) {
  const [localFilterState, setLocalFilterState] = React.useState<LiveJotformSubmissionsFilterState>({ liveAlias: "" });
  const filterState = props.filterState ?? localFilterState;
  const setFilterState = props.onFilterChange ?? setLocalFilterState;
  const { grantNameById, customerNameById, sharedDataLoading, sharedDataError } = useDashboardSharedData();
  const { data: forms = [], isLoading: formsLoading, isError: formsError } = useJotformFormsLite(
    { includeNoSubmissions: true, limit: 500 },
    { enabled: true, staleTime: 300_000 }
  );
  const selectedForm = React.useMemo(
    () => findLiveForm(forms as Array<Record<string, unknown>>, filterState.liveAlias),
    [forms, filterState.liveAlias]
  );
  const selectedFormId = String(selectedForm?.id || "");
  const { data: liveSubmissions = [], isLoading: liveLoading, isError: liveError } = useJotformApiSubmissions(
    selectedFormId ? { formId: selectedFormId, limit: 200 } : undefined,
    { enabled: !!selectedFormId, staleTime: 30_000 }
  );
  const liveSubPagination = usePagination(liveSubmissions as any[], 50);
  const loading = sharedDataLoading || formsLoading || liveLoading;
  const error = sharedDataError || formsError || liveError;
  const hasAlias = !!String(filterState.liveAlias || "").trim();

  return (
    <ToolCard
      title="Live Jotform Submissions"
      actions={
        props.filterState ? undefined : (
          <>
            <input
              className="input w-[220px]"
              placeholder="Form alias, title, or ID"
              value={filterState.liveAlias}
              onChange={(e) => setFilterState({ liveAlias: e.currentTarget.value })}
            />
            <SmartExportButton
              allRows={liveSubmissions as any[]}
              activeRows={liveSubmissions as any[]}
              filenameBase="jotform-live-submissions"
              columns={[
                { key: "form", label: "Form", value: (s: any) => String(s?.formTitle || s?.formAlias || s?.formId || "-") },
                { key: "submission", label: "Submission", value: (s: any) => String(s?.submissionId || s?.id || "-") },
                { key: "grant", label: "Linked Grant", value: (s: any) => grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-") },
                { key: "customer", label: "Linked Customer", value: (s: any) => customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-") },
                { key: "updated", label: "Updated", value: (s: any) => String(s?.updatedAt || "") },
              ]}
            />
          </>
        )
      }
    >
      <ToolTable
        headers={["Form", "Submission", "Linked Grant", "Linked Customer", "Updated"]}
        rows={
          loading ? (
            <tr>
              <td colSpan={5}>Loading submissions...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={5}>Failed to load submissions.</td>
            </tr>
          ) : !hasAlias ? (
            <tr>
              <td colSpan={5}>Enter a form alias, title, or ID to load live submissions from Jotform.</td>
            </tr>
          ) : !selectedFormId ? (
            <tr>
              <td colSpan={5}>No single form matched that search. Refine it or use the Jotform Dashboard form picker.</td>
            </tr>
          ) : liveSubPagination.pageRows.length ? (
            liveSubPagination.pageRows.map((s: any) => (
              <tr key={String(s?.id || "")}>
                <td>{String(s?.formTitle || s?.formAlias || s?.formId || "-")}</td>
                <td>{String(s?.submissionId || s?.id || "-")}</td>
                <td>{grantNameById.get(String(s?.grantId || "")) || String(s?.grantId || "-")}</td>
                <td>{customerNameById.get(String(s?.customerId || "")) || String(s?.customerId || "-")}</td>
                <td>{fmtDateSmartOrDash(s?.updatedAt)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No submissions returned by Jotform for {String(selectedForm?.title || selectedFormId)}.</td>
            </tr>
          )
        }
      />
      <Pagination page={liveSubPagination.page} pageCount={liveSubPagination.pageCount} setPage={liveSubPagination.setPage} />
    </ToolCard>
  );
}
