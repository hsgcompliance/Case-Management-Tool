"use client";

import React from "react";
import type { TGrant } from "@types";
import { usePatchGrants } from "@hooks/useGrants";
import { useCycleRolloverPreview, useCycleRolloverRun, useLinkedProgramsReconcile } from "@hooks/useEnrollments";
import { fmtCurrencyUSD } from "@lib/formatters";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";

type GrantRow = TGrant & { id?: string };

export function GrantLinkingAdminPanel({ grant, grants }: { grant: GrantRow; grants: GrantRow[] }) {
  const grantId = String(grant.id || "");
  const cycle = (grant as any)?.linking?.cycle || {};
  const rules = Array.isArray((grant as any)?.linking?.enrollmentRules) ? (grant as any).linking.enrollmentRules : [];
  const [previousGrantId, setPreviousGrantId] = React.useState(String(cycle.previousGrantId || ""));
  const [nextGrantId, setNextGrantId] = React.useState(String(cycle.nextGrantId || ""));
  const [programTargetId, setProgramTargetId] = React.useState(String(rules[0]?.targetGrantId || ""));
  const [cutoverDate, setCutoverDate] = React.useState("");
  const patchGrant = usePatchGrants();
  const previewMutation = useCycleRolloverPreview();
  const runMutation = useCycleRolloverRun();
  const reconcileMutation = useLinkedProgramsReconcile();
  const [reconcilePreview, setReconcilePreview] = React.useState<any>(null);
  const preview = previewMutation.data as any;
  const options = React.useMemo(() => grants
    .filter((row) => String(row.id || "") && String(row.id || "") !== grantId && row.status !== "deleted")
    .slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [grants, grantId]);

  const save = async () => {
    try {
      await patchGrant.mutateAsync({ id: grantId, patch: { linking: {
        cycle: { previousGrantId: previousGrantId || null, nextGrantId: nextGrantId || null },
        enrollmentRules: programTargetId ? [{ targetGrantId: programTargetId, onEnroll: "ensureActive", onAllSourcesClosed: "flagShouldUnenroll" }] : [],
      } } } as any);
      toast("Grant links saved.", { type: "success" });
    } catch (error) { toast(toApiError(error).error || "Failed to save links.", { type: "error" }); }
  };

  const loadPreview = async () => {
    try {
      const result = await previewMutation.mutateAsync({ grantId, ...(cutoverDate ? { cutoverDate } : {}) });
      if (!cutoverDate && (result as any)?.cutoverDate) setCutoverDate(String((result as any).cutoverDate));
    } catch (error) { toast(toApiError(error).error || "Unable to preview rollover.", { type: "error" }); }
  };

  const run = async () => {
    const ids = (preview?.items || []).filter((item: any) => item.eligible).map((item: any) => String(item.enrollmentId));
    if (!ids.length || !window.confirm(`Roll over ${ids.length} eligible enrollment${ids.length === 1 ? "" : "s"}?`)) return;
    try {
      const result = await runMutation.mutateAsync({ grantId, cutoverDate: String(preview.cutoverDate), enrollmentIds: ids, confirm: "ROLLOVER" });
      const failures = ((result as any)?.results || []).filter((row: any) => !row.ok).length;
      toast(failures ? `Rollover finished with ${failures} failure${failures === 1 ? "" : "s"}.` : "New-cycle rollover completed.", { type: failures ? "warning" : "success" });
      await loadPreview();
    } catch (error) { toast(toApiError(error).error || "Rollover failed.", { type: "error" }); }
  };

  const reconcile = async (dryRun: boolean) => {
    try {
      const result = await reconcileMutation.mutateAsync({ grantIds: [grantId], dryRun });
      setReconcilePreview(result);
      toast(dryRun ? "Linked enrollment audit completed." : "Linked enrollments reconciled.", { type: "success" });
    } catch (error) { toast(toApiError(error).error || "Linked enrollment reconciliation failed.", { type: "error" }); }
  };

  const select = (label: string, value: string, setValue: (value: string) => void) => (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <select className="input w-full" value={value} onChange={(event) => setValue(event.currentTarget.value)}>
        <option value="">None</option>
        {options.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name || row.id)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <div><div className="font-semibold">Grant Linking and New Cycle</div><div className="text-xs text-slate-500">Explicit ID-based cycle and linked-program automation.</div></div>
      <div className="grid gap-3 md:grid-cols-3">
        {select("Previous cycle", previousGrantId, setPreviousGrantId)}
        {select("Next cycle", nextGrantId, setNextGrantId)}
        {select("Ensure linked enrollment in", programTargetId, setProgramTargetId)}
      </div>
      <div className="flex justify-end"><button className="btn btn-sm" type="button" disabled={patchGrant.isPending} onClick={() => void save()}>{patchGrant.isPending ? "Saving..." : "Save Links"}</button></div>
      {programTargetId ? <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-200 pt-3 text-xs dark:border-sky-900">
        <span>{reconcilePreview?.ok ? `${reconcilePreview.sourceEnrollments} sources · ${reconcilePreview.missingTargets} missing · ${reconcilePreview.duplicateTargets} duplicate` : "Audit existing customers before applying linked-enrollment automation."}</span>
        <span className="flex gap-2"><button className="btn-secondary btn-sm" type="button" disabled={reconcileMutation.isPending} onClick={() => void reconcile(true)}>Dry-run Audit</button><button className="btn btn-sm" type="button" disabled={reconcileMutation.isPending || !reconcilePreview?.dryRun} onClick={() => void reconcile(false)}>Apply Reconciliation</button></span>
      </div> : null}
      {nextGrantId ? <div className="space-y-3 border-t border-sky-200 pt-4 dark:border-sky-900">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium text-slate-600"><span>Cutover date</span><input className="input" type="date" value={cutoverDate} onChange={(event) => setCutoverDate(event.currentTarget.value)} /></label>
          <button className="btn-secondary btn-sm" type="button" disabled={previewMutation.isPending} onClick={() => void loadPreview()}>{previewMutation.isPending ? "Loading..." : "Preview New Cycle"}</button>
        </div>
        {preview?.ok ? <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-sm font-semibold">{preview.items.filter((item: any) => item.eligible).length} eligible / {preview.items.length} reviewed</div>
          <div className="text-xs text-slate-500">Source closes {preview.sourceCloseDate}; destination begins {preview.cutoverDate}.</div>
          {[...(preview.blockers || []), ...(preview.warnings || [])].map((message: string) => <div key={message} className="text-xs text-amber-700">{message.replaceAll("_", " ")}</div>)}
          <div className="max-h-64 overflow-auto rounded border border-slate-100">{(Array.isArray(preview.items) ? preview.items : []).map((item: any) => <div key={item.enrollmentId} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-0">
            <div><div className="font-medium">{item.customerName || item.customerId}</div><div className="text-slate-500">{item.futureUnpaidPayments} future payments · {item.futureOpenReminders} reminders · {fmtCurrencyUSD(item.calculatedAllocation)}</div>{[...(item.blockers || []), ...(item.warnings || [])].map((message: string) => <div key={message} className="text-amber-700">{message.replaceAll("_", " ")}</div>)}</div>
            <span className={item.eligible ? "text-emerald-700" : "text-slate-400"}>{item.eligible ? "Ready" : "Skipped"}</span>
          </div>)}</div>
          <div className="flex justify-end"><button className="btn btn-sm" type="button" disabled={runMutation.isPending || preview.blockers.length > 0 || !preview.items.some((item: any) => item.eligible)} onClick={() => void run()}>{runMutation.isPending ? "Rolling over..." : "Run New-Cycle Rollover"}</button></div>
        </div> : null}
      </div> : null}
    </div>
  );
}
