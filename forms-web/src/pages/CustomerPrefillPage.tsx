import { useParams } from "react-router-dom";
import { useFormSession } from "@/hooks/useFormSession";
import { AutoFormView } from "@/components/AutoFormView";
import { LoadingState, MessageState } from "@/components/ui";

export default function CustomerPrefillPage() {
  const { token } = useParams<{ token: string }>();
  const { loading, session, error, notFound, reload } = useFormSession(token);

  if (loading) return <LoadingState label="Loading form…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Form link not found" message="This link is invalid or has been revoked." />;
  if (error || !session) return <MessageState title="Something went wrong" message={error ?? undefined} onRetry={reload} />;
  if (session.expired) return <MessageState variant="expired" title="Form link expired" message="Ask your case manager to send a new link." />;

  return <AutoFormView session={session} token={token!} />;
}
