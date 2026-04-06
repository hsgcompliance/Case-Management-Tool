import React from "react";
import { fmtDateSmartOrDash } from "@lib/formatters";
import { toApiError } from "@client/api";
import { toast } from "@lib/toast";
import {
  useJotformDigest,
  useJotformFormsLite,
  useJotformSubmissionsLite,
  useLinkJotformSubmission,
  useSyncJotformSelection,
  useUpsertJotformDigest,
} from "@hooks/useJotform";
import type { JotformDigestUpsertReq } from "@types";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { JotformDigestDetailCard } from "./components/JotformDigestDetailCard";
import { JotformLineItemsDetailCard } from "./components/JotformLineItemsDetailCard";
import { buildLineItemsDigestTemplate, isLineItemsFormId } from "./lineItemsFormMap";

type DetailViewMode = "custom" | "default" | "raw";

type JotformWorkbenchSubmission = Record<string, unknown> & {
  id?: string;
  submissionId?: string;
  formId?: string;
  formAlias?: string;
  formTitle?: string;
  answers?: Record<string, unknown>;
  updatedAt?: unknown;
  createdAt?: unknown;
  submissionUrl?: string | null;
  editUrl?: string | null;
  pdfUrl?: string | null;
  grantId?: string | null;
  customerId?: string | null;
  enrollmentId?: string | null;
};

function answerPreview(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(answerPreview).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("answer" in obj) return answerPreview(obj.answer);
    if ("prettyFormat" in obj) return answerPreview(obj.prettyFormat);
    if ("value" in obj) return answerPreview(obj.value);
    return Object.values(obj).map(answerPreview).filter(Boolean).join(" ");
  }
  return "";
}

function copyJson(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  return navigator.clipboard.writeText(text);
}

export function JotformWorkbenchTool() {
  const { grantNameById, customerNameById } = useDashboardSharedData();

  const [selectedFormId, setSelectedFormId] = React.useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState("");
  const [formSearch, setFormSearch] = React.useState("");
  const [submissionSearch, setSubmissionSearch] = React.useState("");
  const [detailView, setDetailView] = React.useState<DetailViewMode>("custom");

  const [grantId, setGrantId] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [enrollmentId, setEnrollmentId] = React.useState("");
  const [cwId, setCwId] = React.useState("");
  const [hmisId, setHmisId] = React.useState("");
  const [formAlias, setFormAlias] = React.useState("");

  const formsQ = useJotformFormsLite(
    { search: formSearch || undefined, includeNoSubmissions: true, limit: 500 },
    { enabled: true, staleTime: 300_000 }
  );
  const selectedForm = React.useMemo(
    () => (formsQ.data || []).find((f) => String(f?.id || "") === selectedFormId) || null,
    [formsQ.data, selectedFormId]
  );

  const submissionsQ = useJotformSubmissionsLite(
    selectedFormId ? { formId: selectedFormId, limit: 500 } : undefined,
    { enabled: !!selectedFormId, staleTime: 120_000 }
  );

  const digestQ = useJotformDigest(
    selectedFormId ? { formId: selectedFormId } : undefined,
    { enabled: !!selectedFormId, staleTime: 20_000 }
  );

  const syncSelection = useSyncJotformSelection();
  const linkSubmission = useLinkJotformSubmission();
  const upsertDigest = useUpsertJotformDigest();

  const filteredSubmissions = React.useMemo(() => {
    const q = submissionSearch.trim().toLowerCase();
    const rows = (submissionsQ.data || []) as JotformWorkbenchSubmission[];
    if (!q) return rows;
    return rows.filter((s) => {
      const answerText = answerPreview(s.answers || "").toLowerCase();
      const meta = `${String(s.formTitle || "")} ${String(s.formAlias || "")} ${String(s.submissionId || s.id || "")}`.toLowerCase();
      return answerText.includes(q) || meta.includes(q);
    });
  }, [submissionsQ.data, submissionSearch]);

  const selectedSubmission = React.useMemo(
    () =>
      ((submissionsQ.data || []) as JotformWorkbenchSubmission[]).find(
        (s) => String(s?.submissionId || s?.id || "") === selectedSubmissionId
      ) || null,
    [submissionsQ.data, selectedSubmissionId]
  );

  React.useEffect(() => {
    setSelectedSubmissionId("");
    setSubmissionSearch("");
    setDetailView("custom");
    setGrantId("");
    setCustomerId("");
    setEnrollmentId("");
    setCwId("");
    setHmisId("");
    setFormAlias("");
  }, [selectedFormId]);

  const onSyncSelectedForm = async () => {
    if (!selectedFormId) return;
    try {
      await syncSelection.mutateAsync({ mode: "formIds", formIds: [selectedFormId], limit: 500, maxPages: 10, includeRaw: true });
      toast("Jotform submissions synced for selected form.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const onRefreshForms = async () => {
    try {
      await formsQ.refetch();
      toast("Forms refreshed.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const onRefreshSubmissions = async () => {
    if (!selectedFormId) return;
    try {
      await syncSelection.mutateAsync({
        mode: "formIds",
        formIds: [selectedFormId],
        includeRaw: true,
        limit: 500,
        maxPages: 10,
      });
      await submissionsQ.refetch();
      toast("Submissions pulled from Jotform and refreshed.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const onSaveLineItemsTemplate = async () => {
    const formId = String(selectedForm?.id || selectedFormId || "").trim();
    if (!formId || !isLineItemsFormId(formId)) return;
    const template = buildLineItemsDigestTemplate({
      formId,
      formTitle: String(selectedForm?.title || selectedForm?.id || ""),
      formAlias: String(selectedForm?.alias || ""),
    });
    if (!template) return;
    try {
      await upsertDigest.mutateAsync(template as JotformDigestUpsertReq);
      toast("Line-items digest template saved to DB.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

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
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const answers = (selectedSubmission?.answers || {}) as Record<string, unknown>;
  const sidebarShowsSubmissions = Boolean(selectedSubmission && selectedFormId);

  return (
    <div className="h-[calc(100dvh-160px)] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jotform Dashboard</div>
        <div className="flex items-center gap-2">
          <input
            className="input w-64"
            placeholder={sidebarShowsSubmissions ? "Search submissions..." : "Search forms..."}
            value={sidebarShowsSubmissions ? submissionSearch : formSearch}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (sidebarShowsSubmissions) setSubmissionSearch(value);
              else setFormSearch(value);
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => void onRefreshForms()} disabled={formsQ.isFetching}>
            {formsQ.isFetching ? "Refreshing..." : "Refresh Forms"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void onRefreshSubmissions()}
            disabled={!selectedFormId || submissionsQ.isFetching || syncSelection.isPending}
          >
            {submissionsQ.isFetching || syncSelection.isPending ? "Refreshing..." : "Refresh Submissions (Pull)"}
          </button>
          <button className="btn btn-sm" onClick={() => void onSyncSelectedForm()} disabled={!selectedFormId || syncSelection.isPending}>
            {syncSelection.isPending ? "Syncing..." : "Sync Selected Form"}
          </button>
          {selectedForm && isLineItemsFormId(selectedForm.id) ? (
            <button className="btn btn-ghost btn-sm" onClick={() => void onSaveLineItemsTemplate()} disabled={upsertDigest.isPending}>
              {upsertDigest.isPending ? "Saving..." : digestQ.data ? "Update Line-Items Map Doc" : "Save Line-Items Map Doc"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="h-[calc(100%-41px)] grid grid-cols-[300px_1fr]">
        <aside className="min-w-0 overflow-hidden border-r border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {sidebarShowsSubmissions ? `Submissions (${filteredSubmissions.length})` : `Forms (${(formsQ.data || []).length})`}
          </div>
          <div className="h-full overflow-auto p-2 space-y-1">
            {!sidebarShowsSubmissions
              ? (formsQ.data || []).map((f) => {
                  const active = String(f?.id || "") === selectedFormId;
                  return (
                    <button
                      key={String(f?.id || "")}
                      className={`w-full rounded border px-2 py-2 text-left text-xs ${active ? "border-slate-400 bg-slate-100" : "border-slate-200 hover:bg-slate-50"}`}
                      onClick={() => setSelectedFormId(String(f?.id || ""))}
                    >
                      <div className="font-medium truncate">{String(f?.title || f?.id || "-")}</div>
                      <div className="text-slate-500 truncate">Alias: {String(f?.alias || "-")}</div>
                      <div className="text-slate-500">Submissions: {Number(f?.count || 0)}</div>
                    </button>
                  );
                })
              : filteredSubmissions.map((s) => {
                  const rowId = String(s?.submissionId || s?.id || "");
                  const active = rowId === selectedSubmissionId;
                  return (
                    <button
                      key={rowId}
                      className={`w-full rounded border px-2 py-2 text-left text-xs ${active ? "border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}
                      onClick={() => {
                        setSelectedSubmissionId(rowId);
                        setGrantId(String(s?.grantId || ""));
                        setCustomerId(String(s?.customerId || ""));
                        setEnrollmentId(String(s?.enrollmentId || ""));
                        setFormAlias(String(s?.formAlias || ""));
                      }}
                    >
                      <div className="font-medium truncate">{rowId || "-"}</div>
                      <div className="text-slate-500">Updated: {fmtDateSmartOrDash(s?.updatedAt || s?.createdAt)}</div>
                      <div className="text-slate-500 truncate">{answerPreview(s?.answers || "") || "(No answers)"}</div>
                    </button>
                  );
                })}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden">
          {!selectedForm ? (
            <div className="p-4 text-sm text-slate-500">Select a form from the sidebar to load submissions.</div>
          ) : !selectedSubmission ? (
            <div className="h-full overflow-auto p-3 space-y-3">
              <div className="space-y-1 rounded border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-sm font-semibold">{String(selectedForm.title || selectedForm.id || "-")}</div>
                <div className="text-xs text-slate-600">Alias: {String(selectedForm.alias || "-")}</div>
                <div className="text-xs text-slate-600">
                  Last loaded submissions: {submissionsQ.dataUpdatedAt ? fmtDateSmartOrDash(submissionsQ.dataUpdatedAt) : "-"}
                </div>
                <div className="text-xs text-slate-600">
                  Digest map: {digestQ.isLoading ? "Loading..." : digestQ.data ? "Configured" : "Not configured"}
                </div>
                {!submissionsQ.isLoading && filteredSubmissions.length === 0 && Number(selectedForm.count || 0) > 0 ? (
                  <div className="text-xs text-amber-700">
                    This form shows {Number(selectedForm.count || 0)} submissions in Jotform, but none are in local cache yet. Use Sync Selected Form or Refresh Submissions (Pull).
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800">
                  Submissions ({filteredSubmissions.length})
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="px-2 py-2 text-left">Submission</th>
                        <th className="px-2 py-2 text-left">Updated</th>
                        <th className="px-2 py-2 text-left">Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.length ? (
                        filteredSubmissions.map((s) => {
                          const rowId = String(s?.submissionId || s?.id || "");
                          return (
                            <tr
                              key={rowId}
                              className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                              onClick={() => {
                                setSelectedSubmissionId(rowId);
                                setGrantId(String(s?.grantId || ""));
                                setCustomerId(String(s?.customerId || ""));
                                setEnrollmentId(String(s?.enrollmentId || ""));
                                setFormAlias(String(s?.formAlias || ""));
                                setDetailView("custom");
                              }}
                            >
                              <td className="px-2 py-2 font-mono">{rowId || "-"}</td>
                              <td className="px-2 py-2">{fmtDateSmartOrDash(s?.updatedAt || s?.createdAt)}</td>
                              <td className="px-2 py-2">{answerPreview(s?.answers || "") || "-"}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-2 py-3 text-slate-500" colSpan={3}>No submissions found for current filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  Submission {String(selectedSubmission.submissionId || selectedSubmission.id || "-")}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSubmissionId("")}>Back To List</button>
                  <button className={`btn btn-sm ${detailView === "custom" ? "" : "btn-ghost"}`} onClick={() => setDetailView("custom")}>
                    Custom View
                  </button>
                  <button className={`btn btn-sm ${detailView === "default" ? "" : "btn-ghost"}`} onClick={() => setDetailView("default")}>
                    Default View
                  </button>
                  <button className={`btn btn-sm ${detailView === "raw" ? "" : "btn-ghost"}`} onClick={() => setDetailView("raw")}>
                    Raw View
                  </button>
                </div>
              </div>

              {detailView === "custom" ? (
                <JotformDigestDetailCard submission={selectedSubmission as Record<string, unknown>} digestMap={digestQ.data || null} />
              ) : null}

              {detailView === "default" ? (
                <>
                  <div className="space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-sm font-semibold">Submission Detail</div>
                    <div className="text-xs text-slate-600">Form: {String(selectedSubmission.formTitle || selectedSubmission.formAlias || selectedSubmission.formId || "-")}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedSubmission.submissionUrl ? (
                        <a className="text-sky-700 hover:underline" href={String(selectedSubmission.submissionUrl)} target="_blank" rel="noreferrer">Submission URL</a>
                      ) : null}
                      {selectedSubmission.editUrl ? (
                        <a className="text-sky-700 hover:underline" href={String(selectedSubmission.editUrl)} target="_blank" rel="noreferrer">Edit URL</a>
                      ) : null}
                      {selectedSubmission.pdfUrl ? (
                        <a className="text-sky-700 hover:underline" href={String(selectedSubmission.pdfUrl)} target="_blank" rel="noreferrer">PDF</a>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-sm font-semibold">Link to System Records</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className="input" placeholder="Grant ID" value={grantId} onChange={(e) => setGrantId(e.currentTarget.value)} />
                      <input className="input" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.currentTarget.value)} />
                      <input className="input" placeholder="Enrollment ID" value={enrollmentId} onChange={(e) => setEnrollmentId(e.currentTarget.value)} />
                      <input className="input" placeholder="Form Alias" value={formAlias} onChange={(e) => setFormAlias(e.currentTarget.value)} />
                      <input className="input" placeholder="CW ID" value={cwId} onChange={(e) => setCwId(e.currentTarget.value)} />
                      <input className="input" placeholder="HMIS ID" value={hmisId} onChange={(e) => setHmisId(e.currentTarget.value)} />
                    </div>
                    <button className="btn btn-sm" onClick={() => void onLink()} disabled={linkSubmission.isPending}>
                      {linkSubmission.isPending ? "Saving..." : "Save Link"}
                    </button>
                    <div className="text-xs text-slate-600">
                      Current linked: Grant {grantNameById.get(grantId) || grantId || "-"} | Customer {customerNameById.get(customerId) || customerId || "-"} | Enrollment {enrollmentId || "-"}
                    </div>
                  </div>

                  <JotformLineItemsDetailCard submission={selectedSubmission as Record<string, unknown>} />

                  <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800">Answers</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr className="text-slate-600 dark:text-slate-300">
                            <th className="px-2 py-2 text-left">Key</th>
                            <th className="px-2 py-2 text-left">Question</th>
                            <th className="px-2 py-2 text-left">Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(answers).length ? (
                            Object.entries(answers).map(([key, raw]) => {
                              const entry = raw as Record<string, unknown>;
                              const question = String(entry?.text || entry?.name || key);
                              const value = answerPreview(entry);
                              return (
                                <tr key={key} className="border-t border-slate-200 dark:border-slate-700">
                                  <td className="px-2 py-2 font-mono">{key}</td>
                                  <td className="px-2 py-2">{question}</td>
                                  <td className="px-2 py-2">{value || "-"}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="px-2 py-3 text-slate-500" colSpan={3}>No answers captured.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {detailView === "raw" ? (
                <div className="space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Raw Submission JSON</div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        void copyJson(selectedSubmission)
                          .then(() => toast("Submission JSON copied.", { type: "success" }))
                          .catch(() => toast("Failed to copy JSON.", { type: "error" }));
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="max-h-[65dvh] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950">
                    {JSON.stringify(selectedSubmission, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default JotformWorkbenchTool;
