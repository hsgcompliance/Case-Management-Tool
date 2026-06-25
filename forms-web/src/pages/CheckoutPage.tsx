import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormSession } from "@/hooks/useFormSession";
import { completeFormSession } from "@/lib/api";
import { centsToUsd, jotformUrl, monthLabel } from "@/lib/format";
import { FormShell, LoadingState, MessageState, PrimaryButton, Row, SecondaryButton } from "@/components/ui";
import type { TFormPrefillSnapshot } from "@hdb/contracts";

function SpendBlock({ prefill }: { prefill: TFormPrefillSnapshot }) {
  const spend = prefill.currentMonthCardSpendCents;
  const limit = prefill.monthlyLimitCents;
  if (spend == null) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Current-month card spend is unavailable for this card.
      </div>
    );
  }
  const pct = limit && limit > 0 ? Math.min(100, Math.round((spend / limit) * 100)) : null;
  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-indigo-900">This month on {prefill.cardName || "card"}</span>
        <span className="text-base font-bold text-indigo-900">{centsToUsd(spend)}</span>
      </div>
      {limit && limit > 0 ? (
        <>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
            <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-indigo-700">
            {centsToUsd(spend)} of {centsToUsd(limit)} monthly limit
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function CheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { loading, session, error, notFound, reload } = useFormSession(token);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingState label="Loading checkout…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Checkout link not found" message="This link is invalid or has been revoked." />;
  if (error || !session) return <MessageState title="Something went wrong" message={error ?? undefined} onRetry={reload} />;
  if (session.expired) return <MessageState variant="expired" title="Checkout link expired" message="Ask your case manager to send a new checkout link." />;

  const prefill = session.prefill ?? {};
  const formUrl = jotformUrl(session.jotformFormId);
  const done = session.status === "completed";

  async function markComplete() {
    if (!token) return;
    setSubmitting(true);
    try {
      await completeFormSession({ token });
      navigate(`/status/${token}`);
    } catch {
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormShell title="Credit card checkout" subtitle={prefill.customerName ?? undefined}>
      {done ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          This checkout has been marked complete.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 px-4 py-1">
        <Row label="Customer" value={prefill.customerName ?? "—"} />
        <Row label="Amount" value={centsToUsd(prefill.amountCents)} />
        <Row label="Grant / program" value={prefill.grantName ?? "—"} />
        <Row label="Payment month" value={monthLabel(prefill.paymentMonth)} />
        <Row label="Vendor / payee" value={prefill.vendor ?? "—"} />
        <Row label="Checkout status" value={done ? "Complete" : (prefill.checkoutStatus ?? "Pending")} />
      </div>

      <SpendBlock prefill={prefill} />

      <div className="mt-5 space-y-2">
        {formUrl ? <PrimaryButton href={formUrl}>Open checkout form</PrimaryButton> : null}
        {!done ? (
          <SecondaryButton onClick={markComplete} disabled={submitting}>
            {submitting ? "Saving…" : "I've completed the form"}
          </SecondaryButton>
        ) : (
          <SecondaryButton onClick={() => navigate(`/status/${token}`)}>View status</SecondaryButton>
        )}
      </div>

      {!formUrl ? (
        <p className="mt-3 text-center text-xs text-slate-400">No form is configured for this workflow yet.</p>
      ) : null}
    </FormShell>
  );
}
