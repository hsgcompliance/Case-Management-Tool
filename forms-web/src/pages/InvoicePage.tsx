import { useParams } from "react-router-dom";
import { useFormSession } from "@/hooks/useFormSession";
import { AutoFormView } from "@/components/AutoFormView";
import { LoadingState, MessageState } from "@/components/ui";

/** /invoice/:token — embeds the Invoice Requests Jotform for a tokenized session. */
export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { loading, session, error, notFound, reload } = useFormSession(token);

  if (loading) return <LoadingState label="Loading invoice form…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Invoice link not found" message="This link is invalid or has been revoked." />;
  if (error || !session) return <MessageState title="Something went wrong" message={error ?? undefined} onRetry={reload} />;
  if (session.expired) return <MessageState variant="expired" title="Invoice link expired" message="Ask your case manager to send a new link." />;

  return <AutoFormView session={session} token={token!} />;
}
