import { useParams } from "react-router-dom";
import { useFormSession } from "@/hooks/useFormSession";
import { AutoFormView } from "@/components/AutoFormView";
import { LoadingState, MessageState } from "@/components/ui";

/** Generic entry point: /render/:workflowId/:token — embeds the configured form. */
export default function RenderPage() {
  const { token } = useParams<{ workflowId: string; token: string }>();
  const { loading, session, error, notFound, reload } = useFormSession(token);

  if (loading) return <LoadingState label="Loading form…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Link not found" message="This link is invalid or has been revoked." />;
  if (error || !session) return <MessageState title="Something went wrong" message={error ?? undefined} onRetry={reload} />;
  if (session.expired) return <MessageState variant="expired" title="Link expired" message="Ask your case manager to send a new link." />;

  return <AutoFormView session={session} token={token!} />;
}
