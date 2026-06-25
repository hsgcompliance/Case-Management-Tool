import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { FormDef } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { createRenderLink } from "@/lib/renderApi";

export function SendToCustomerModal({ form, onClose }: { form: FormDef; onClose: () => void }) {
  const { customer } = useCurrentCustomer();
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const mint = () => {
    setBusy(true);
    setError(null);
    createRenderLink(form.id, customer?.id ?? null)
      .then((r) => { setUrl(r.renderUrl); setExpiresAt(r.expiresAt); })
      .catch((e: unknown) => setError((e as Error)?.message || "Could not create link."))
      .finally(() => setBusy(false));
  };

  useEffect(() => { if (customer) mint(); /* eslint-disable-next-line */ }, []);

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900">Send to customer</div>
            <div className="text-xs text-slate-500">{form.title}</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {!customer ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Select a customer in the search bar first.
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            <button type="button" onClick={mint} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Retry</button>
          </div>
        ) : busy && !url ? (
          <div className="py-6 text-center text-sm text-slate-400">Creating secure link…</div>
        ) : url ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">One-time link for <b>{customer.name}</b>. Scan or copy.</div>
            <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-3">
              <QRCodeSVG value={url} size={168} />
            </div>
            <div className="break-all rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500">{url}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{copied ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={mint} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">New</button>
            </div>
            {expiresAt ? <div className="text-center text-[11px] text-slate-400">Expires {new Date(expiresAt).toLocaleDateString()}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
