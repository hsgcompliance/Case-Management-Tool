"use client";

// entities/payments/FormSessionLauncherButton.tsx
// Main-app launcher for the separate Forms surface. Mints a tokenized form
// session for a given workflow + context and surfaces the render link
// (open / copy) so a case manager can hand it off or scan it.
//
// Boring + self-contained: one authed call (createFormSession), then a small
// inline panel. No broad data is sent — only the context ids.

import React from "react";
import FormSessions from "@client/formSessions";
import { toApiError } from "@client/api";
import { toast } from "@lib/toast";
import type { TFormWorkflowId } from "@hdb/contracts";

type Props = {
  workflowId?: TFormWorkflowId;
  paymentQueueId?: string | null;
  customerId?: string | null;
  grantId?: string | null;
  creditCardId?: string | null;
  disabled?: boolean;
  className?: string;
  label?: string;
};

const DEFAULT_LABELS: Partial<Record<TFormWorkflowId, string>> = {
  "credit-card-checkout": "Open Checkout Form",
  "invoice-request": "Open Invoice Form",
  "customer-prefill": "Open Customer Form",
  "credit-card-status": "Open Status Form",
};

export default function FormSessionLauncherButton({
  workflowId = "credit-card-checkout",
  paymentQueueId,
  customerId,
  grantId,
  creditCardId,
  disabled,
  className,
  label,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [renderUrl, setRenderUrl] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const buttonLabel = label ?? DEFAULT_LABELS[workflowId] ?? "Open Form";

  const create = async () => {
    setBusy(true);
    try {
      const res = await FormSessions.create({
        workflowId,
        source: "main_app",
        paymentQueueId: paymentQueueId ?? null,
        customerId: customerId ?? null,
        grantId: grantId ?? null,
        creditCardId: creditCardId ?? null,
      });
      if (!res?.renderUrl) throw new Error("No render URL returned.");
      setRenderUrl(res.renderUrl);
      setExpiresAt(res.expiresAt ?? null);
      // Open immediately for the common "do it now" case; the panel keeps the
      // link available for copy / re-open.
      window.open(res.renderUrl, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      toast(toApiError(e, "Could not start form.").error, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!renderUrl) return;
    try {
      await navigator.clipboard.writeText(renderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed.", { type: "error" });
    }
  };

  if (renderUrl) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
          Form link ready
        </div>
        <div className="break-all rounded border border-sky-100 bg-white px-2 py-1 text-xs text-slate-600">
          {renderUrl}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn btn-sm btn-primary"
            href={renderUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </a>
          <button type="button" className="btn btn-sm btn-ghost border border-sky-200" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost border border-slate-200"
            disabled={busy}
            onClick={() => void create()}
          >
            New link
          </button>
        </div>
        {expiresAt ? (
          <div className="text-[11px] text-slate-500">
            Expires {new Date(expiresAt).toLocaleString()}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className ?? "btn btn-sm btn-ghost w-full justify-center border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 py-2.5"}
      disabled={busy || disabled}
      onClick={() => void create()}
      title="Creates a secure, tokenized link in the Forms app for this item."
    >
      {busy ? "Starting…" : buttonLabel}
    </button>
  );
}
