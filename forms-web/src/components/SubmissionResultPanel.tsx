import { AnswerView } from "./AnswerView";
import { ExternalServiceIcon } from "./ui";
import type { JfSubmission } from "@/lib/jotformManagerApi";

export function SubmissionResultPanel({ formId, submission, loading, onSubmitAgain }: {
  formId: string;
  submission: JfSubmission | null;
  loading: boolean;
  onSubmitAgain: () => void;
}) {
  const inboxUrl = submission?.id ? `https://www.jotform.com/inbox/${formId}/${submission.id}` : null;
  return (
    <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-emerald-900">Submission received</div>
          <div className="text-xs text-emerald-700">Review the answers below or start another submission.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSubmitAgain} className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Submit again</button>
          {inboxUrl ? (
            <a href={inboxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
              <ExternalServiceIcon href={inboxUrl} className="h-3.5 w-3.5" />
              Open submission in Inbox
            </a>
          ) : (
            <span title="The submission ID is still syncing" className="cursor-wait rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">Open submission in Inbox</span>
          )}
        </div>
      </div>
      {loading ? <div className="rounded-lg bg-white px-3 py-4 text-center text-xs text-slate-500">Loading submitted answers…</div> : null}
      {submission ? <div className="rounded-lg bg-white p-3"><AnswerView sub={submission} /></div> : null}
      {!loading && !submission ? <div className="rounded-lg bg-white px-3 py-3 text-xs text-slate-500">The submission was detected. Its answers are still syncing; use Inbox once the submission ID becomes available.</div> : null}
    </section>
  );
}
