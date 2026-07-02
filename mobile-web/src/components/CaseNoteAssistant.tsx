import { useEffect, useState } from "react";
import type { TCaseNoteAction, TGenerateCaseNoteSuggestionReq } from "@hdb/contracts";
import { recordCaseNoteSuggestionDecision, useGenerateCaseNoteSuggestion } from "@/hooks/useCaseNoteAssistant";

const ACTIONS: Array<{ value: TCaseNoteAction; label: string }> = [
  { value: "improve", label: "Improve" }, { value: "grammar_only", label: "Grammar Only" },
  { value: "shorten", label: "Make Shorter" }, { value: "compliance_review", label: "Compliance Review" },
  { value: "interview_draft", label: "Interview Mode Draft" },
];
type Fields = NonNullable<TGenerateCaseNoteSuggestionReq["interviewFields"]>;
const EMPTY: Fields = { clientResponse: "", caseManagerAction: "", barrier: "", progress: "", nextStep: "" };

export function CaseNoteAssistant({ customerId, draft, visitLengthMinutes, contactType, clientLabel, staffLabel, onAccept }: { customerId: string; draft: string; visitLengthMinutes: number | null; contactType?: string | null; clientLabel: string; staffLabel: string; onAccept: (text: string) => void }) {
  // AI source/suggestion state is intentionally memory-only. Do not persist it
  // to browser storage, analytics, logs, or Firestore from this component.
  const mutation = useGenerateCaseNoteSuggestion();
  const [open, setOpen] = useState(false); const [action, setAction] = useState<TCaseNoteAction>("improve");
  const [suggestion, setSuggestion] = useState(""); const [missing, setMissing] = useState<string[]>([]); const [tips, setTips] = useState<string[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null); const [editable, setEditable] = useState(false); const [fields, setFields] = useState<Fields>(EMPTY);
  const clearResult = () => { setSuggestion(""); setMissing([]); setTips([]); setEditable(false); };
  useEffect(() => { clearResult(); }, [draft, customerId]);
  const interview = action === "interview_draft";
  const hasResult = !!suggestion || missing.length > 0 || tips.length > 0;
  async function generate() {
    try {
      const result = await mutation.mutateAsync({ customerId, sessionId: null, mode: interview ? "interview" : "freeform", action, program: null, serviceType: null, contactType: contactType ?? null, visitLengthMinutes, draft: interview ? null : draft, clientLabel, staffLabel, interviewFields: interview ? fields : null });
      if (requestId) void recordCaseNoteSuggestionDecision(requestId, false);
      setSuggestion(result.suggestion); setMissing(result.missingOrUnclear ?? []); setTips(result.complianceSuggestions ?? []); setRequestId(result.requestId); setEditable(false);
    } catch {
      // mutation.error renders the safe backend message below; swallowing here
      // just prevents an unhandled promise rejection.
    }
  }
  // Open without a draft is allowed: Interview Mode builds a note from
  // structured answers when nothing has been typed yet.
  if (!open) return <button type="button" onClick={() => { setOpen(true); if (!draft.trim()) setAction("interview_draft"); }} className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">AI Case Note Assistant <span className="font-normal">Beta</span></button>;
  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">AI Case Note Assistant <span className="text-xs font-medium text-indigo-600">Beta</span></h2><p className="text-xs text-slate-500 mt-1">Suggestions may be inaccurate. Review before accepting.</p></div><button type="button" onClick={() => { if (requestId) void recordCaseNoteSuggestionDecision(requestId, false); setOpen(false); }} className="text-sm text-slate-500">Dismiss</button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{ACTIONS.map((item) => <button type="button" key={item.value} onClick={() => { setAction(item.value); clearResult(); }} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${action === item.value ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600"}`}>{item.label}</button>)}</div>
      {interview ? <div className="space-y-2">{([
        ["clientResponse", "Client quote / response"], ["caseManagerAction", "Case manager action"], ["barrier", "Barrier or need"], ["progress", "Progress or update"], ["nextStep", "Next step"],
      ] as const).map(([key, label]) => <label key={key} className="block text-xs font-semibold text-slate-600">{label}<textarea rows={2} value={fields[key] ?? ""} onChange={(e) => setFields((cur) => ({ ...cur, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-400" /></label>)}</div> : null}
      {!hasResult ? <button type="button" onClick={() => void generate()} disabled={mutation.isPending || (!interview && !draft.trim()) || (interview && !Object.values(fields).some((v) => String(v ?? "").trim()))} className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40">{mutation.isPending ? "Generating…" : "Generate Suggested Revision"}</button> : <>
        {suggestion ? <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Original Draft</p><div className="min-h-32 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{interview ? Object.values(fields).filter(Boolean).join("\n") : draft}</div></div><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested Revision</p>{editable ? <textarea rows={8} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} className="w-full rounded-xl border border-indigo-200 p-3 text-sm outline-none focus:border-indigo-500" /> : <div className="min-h-32 whitespace-pre-wrap rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-sm text-slate-800">{suggestion}</div>}</div></div> : null}
        {missing.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">Missing or Unclear</p><ul className="space-y-1">{missing.map((item, idx) => <li key={idx} className="flex gap-2 text-sm text-amber-900"><span aria-hidden>•</span><span>{item}</span></li>)}</ul></div> : null}
        {tips.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions</p><ul className="space-y-1">{tips.map((item, idx) => <li key={idx} className="flex gap-2 text-sm text-slate-700"><span aria-hidden>•</span><span>{item}</span></li>)}</ul></div> : null}
        <div className="grid grid-cols-2 gap-2">{suggestion ? <button type="button" onClick={() => { if (requestId) void recordCaseNoteSuggestionDecision(requestId, true); onAccept(suggestion); setOpen(false); }} className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white">Accept Suggestion</button> : null}<button type="button" onClick={() => { if (requestId) void recordCaseNoteSuggestionDecision(requestId, false); setOpen(false); }} className={`rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 ${suggestion ? "" : "col-span-2"}`}>{suggestion ? "Keep Original" : "Close"}</button>{suggestion ? <button type="button" onClick={() => setEditable((v) => !v)} className="rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600">{editable ? "Preview Edit" : "Edit Suggestion"}</button> : null}<button type="button" onClick={() => void generate()} disabled={mutation.isPending} className={`rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 ${suggestion ? "" : "col-span-2"}`}>{mutation.isPending ? "Generating…" : "Regenerate"}</button></div>
      </>}
      {mutation.error ? <p className="text-xs text-red-600">{mutation.error instanceof Error ? mutation.error.message : "Could not generate suggestion. Please try again."}</p> : null}
    </section>
  );
}
