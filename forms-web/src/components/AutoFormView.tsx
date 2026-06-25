import { useState } from "react";
import { completeFormSession } from "@/lib/api";
import { jotformUrl } from "@/lib/format";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import type { TFormSessionResolved } from "@hdb/contracts";

/**
 * Auto render mode: embed the linked Jotform form. Falls back to an "open form"
 * link if iframing is not desired/available. Used by customer-prefill and the
 * generic /render route.
 */
export function AutoFormView({
  session,
  token,
  onCompleted,
}: {
  session: TFormSessionResolved;
  token: string;
  onCompleted?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(session.status === "completed");
  const url = jotformUrl(session.jotformFormId);

  async function markComplete() {
    setSubmitting(true);
    try {
      await completeFormSession({ token });
      setDone(true);
      onCompleted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-3 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">HDB Forms</div>
        {session.prefill?.customerName ? (
          <h1 className="mt-1 text-lg font-bold text-slate-900">{session.prefill.customerName}</h1>
        ) : null}
      </div>

      {done ? (
        <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
          Thanks — this form has been marked complete.
        </div>
      ) : null}

      {url ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <iframe title="HDB form" src={url} className="h-[70vh] w-full" />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          No form is configured for this workflow yet.
        </div>
      )}

      <div className="mt-4 space-y-2">
        {url ? <PrimaryButton href={url}>Open form in new tab</PrimaryButton> : null}
        {!done ? (
          <SecondaryButton onClick={markComplete} disabled={submitting}>
            {submitting ? "Saving…" : "I've completed the form"}
          </SecondaryButton>
        ) : null}
      </div>
    </div>
  );
}
