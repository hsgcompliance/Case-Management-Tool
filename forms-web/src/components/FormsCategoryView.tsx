import { useState } from "react";
import type { FormDef } from "@/lib/formsCatalog";
import { JotformEmbed } from "./JotformEmbed";
import { SendToCustomerModal } from "./SendToCustomerModal";
import { CreditCardCards } from "./CreditCardCards";
import { CustomerDetailsHeader } from "./CustomerDetailsHeader";
import { ReferencePanel } from "./ReferencePanel";

export function FormsCategoryView({
  heading,
  description,
  forms,
  /** Purchases: keep the credit-card spend cards in view (list AND open-form). */
  showCreditCards = false,
  /** Intake / All forms: show the current-customer details header. */
  showCustomerHeader = false,
  /** Intake: enable prev/next nav through the customer index in the header. */
  customerNav = false,
}: {
  heading: string;
  description?: string;
  forms: FormDef[];
  showCreditCards?: boolean;
  showCustomerHeader?: boolean;
  customerNav?: boolean;
}) {
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [sendForm, setSendForm] = useState<FormDef | null>(null);

  // Persisted across both list and open-form views so the context (card spend,
  // current customer) stays visible while a form is being filled in the iframe.
  const persistentContext = (
    <>
      {showCustomerHeader ? <CustomerDetailsHeader nav={customerNav} /> : null}
      {showCreditCards ? <CreditCardCards /> : null}
    </>
  );

  if (selected) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Back to {heading}
        </button>
        {persistentContext}
        <h2 className="text-base font-semibold text-slate-900">{selected.title}</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <JotformEmbed formId={selected.id} title={selected.title} debug />
          </div>
          <ReferencePanel className="lg:w-80 lg:shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {persistentContext}
      <div>
        <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {forms.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No forms in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {forms.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <button type="button" onClick={() => setSelected(f)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-slate-900">{f.title}</span>
                <span className="block text-[11px] text-slate-400">{f.submissions} submissions · form {f.id}</span>
              </button>
              {f.customerSendable ? (
                <button
                  type="button"
                  onClick={() => setSendForm(f)}
                  className="shrink-0 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  Send to customer
                </button>
              ) : null}
              <a
                href={`https://form.jotform.com/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the live form in a new tab"
                className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                New tab ↗
              </a>
              <button type="button" onClick={() => setSelected(f)} className="shrink-0 text-xs font-semibold text-indigo-600">
                Open →
              </button>
            </div>
          ))}
        </div>
      )}

      {sendForm ? <SendToCustomerModal form={sendForm} onClose={() => setSendForm(null)} /> : null}
    </div>
  );
}
