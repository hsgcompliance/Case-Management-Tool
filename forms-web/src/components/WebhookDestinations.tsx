import { useEffect, useState } from "react";
import { getWebhookDestinations, type WebhookDestination } from "@/lib/webhookConfigApi";

function CopyRow({ d }: { d: WebhookDestination }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-slate-700">{d.label}</div>
        <div className="truncate font-mono text-[11px] text-slate-400">{d.url}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function WebhookDestinations() {
  const [items, setItems] = useState<WebhookDestination[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getWebhookDestinations().then((out) => setItems(out.destinations)).catch(() => setItems([]));
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-600"
      >
        <span>Webhook destinations (paste into Jotform)</span>
        <span className="text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-slate-200 p-3">
          {items == null ? (
            <div className="text-xs text-slate-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-slate-400">No destinations available.</div>
          ) : (
            items.map((d) => <CopyRow key={d.kind} d={d} />)
          )}
          <p className="text-[11px] text-slate-400">
            One receiver handles all forms; the <span className="font-mono">kind</span> param just tags submissions for routing.
          </p>
        </div>
      ) : null}
    </div>
  );
}
