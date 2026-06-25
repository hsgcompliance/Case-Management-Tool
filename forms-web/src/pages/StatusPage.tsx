import { useParams } from "react-router-dom";
import { useFormSession } from "@/hooks/useFormSession";
import { centsToUsd, monthLabel } from "@/lib/format";
import { FormShell, LoadingState, MessageState, Row, SecondaryButton } from "@/components/ui";
import type { TFormSessionStatus } from "@hdb/contracts";

const STATUS_COPY: Record<TFormSessionStatus, { label: string; tone: string }> = {
  created: { label: "Not started", tone: "bg-slate-100 text-slate-700" },
  opened: { label: "In progress", tone: "bg-blue-100 text-blue-700" },
  submitted: { label: "Submitted", tone: "bg-indigo-100 text-indigo-700" },
  completed: { label: "Complete", tone: "bg-green-100 text-green-700" },
  expired: { label: "Expired", tone: "bg-amber-100 text-amber-700" },
  revoked: { label: "Revoked", tone: "bg-red-100 text-red-700" },
};

export default function StatusPage() {
  const { token } = useParams<{ token: string }>();
  const { loading, session, error, notFound, reload } = useFormSession(token);

  if (loading) return <LoadingState label="Loading status…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Link not found" message="This status link is invalid or has been revoked." />;
  if (error || !session) return <MessageState title="Something went wrong" message={error ?? undefined} onRetry={reload} />;

  const prefill = session.prefill ?? {};
  const status = session.expired ? "expired" : session.status;
  const copy = STATUS_COPY[status];

  return (
    <FormShell title="Checkout status" subtitle={prefill.customerName ?? undefined}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">Status</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${copy.tone}`}>{copy.label}</span>
      </div>

      <div className="rounded-xl border border-slate-200 px-4 py-1">
        <Row label="Customer" value={prefill.customerName ?? "—"} />
        <Row label="Amount" value={centsToUsd(prefill.amountCents)} />
        <Row label="Grant / program" value={prefill.grantName ?? "—"} />
        <Row label="Payment month" value={monthLabel(prefill.paymentMonth)} />
        {session.jotformSubmissionId ? <Row label="Submission" value={session.jotformSubmissionId} /> : null}
      </div>

      <div className="mt-5">
        <SecondaryButton onClick={reload}>Refresh</SecondaryButton>
      </div>
    </FormShell>
  );
}
