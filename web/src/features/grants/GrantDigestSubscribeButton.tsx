"use client";

import {toast} from "@lib/toast";
import {useGrantDigestSubscription} from "@hooks/useGrantDigestSubscription";

export function GrantDigestSubscribeButton({grantId, compact = false}: {grantId?: string; compact?: boolean}) {
  const subscription = useGrantDigestSubscription(grantId);

  return (
    <button
      type="button"
      className={compact ? "btn btn-ghost btn-xs" : "btn btn-ghost btn-sm"}
      disabled={!subscription.canSubscribe || subscription.busy || subscription.loading}
      onClick={async (event) => {
        event.stopPropagation();
        const next = !subscription.subscribed;
        try {
          await subscription.setSubscribed(next);
          toast(next ? "Subscribed to this grant's monthly digest." : "Unsubscribed from this grant's digest.", {type: "success"});
        } catch (error) {
          toast(error instanceof Error ? error.message : "Could not update digest subscription.", {type: "error"});
        }
      }}
    >
      {subscription.busy || subscription.loading ? "..." : subscription.subscribed ? "Subscribed" : "Subscribe"}
    </button>
  );
}
