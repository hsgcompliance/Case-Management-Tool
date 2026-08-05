"use client";

import {toast} from "@lib/toast";
import {useGrantDigestSubscription} from "@hooks/useGrantDigestSubscription";

export function GrantDigestSubscribeButton({grantId, compact = false}: {grantId?: string; compact?: boolean}) {
  const subscription = useGrantDigestSubscription(grantId);
  const pending = subscription.busy || subscription.loading;
  const label = pending ? "Updating subscription" : subscription.subscribed ? "Subscribed" : "Subscribe";

  return (
    <button
      type="button"
      className={[
        "inline-flex items-center rounded-md border border-transparent font-medium transition-colors",
        "text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600",
        subscription.subscribed ? "bg-slate-100/70 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300" : "",
        compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
      ].join(" ")}
      disabled={!subscription.canSubscribe || pending}
      aria-pressed={subscription.subscribed}
      aria-busy={pending}
      aria-label={`${label} to this grant's monthly digest`}
      title="Manage this grant's monthly digest subscription"
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
      <span aria-hidden="true">{subscription.subscribed ? "✓ " : "+ "}</span>
      <span>{pending ? "Updating…" : subscription.subscribed ? "Subscribed" : "Subscribe"}</span>
    </button>
  );
}
