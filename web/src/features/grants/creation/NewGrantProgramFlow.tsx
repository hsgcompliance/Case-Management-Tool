"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toApiError } from "@client/api";
import { TaskBuilder, type TaskTemplateDraft } from "@entities/tasks/TaskBuilder";
import FullPageModal from "@entities/ui/FullPageModal";
import { useFetchGrantById, useGrants, useUpsertGrants } from "@hooks/useGrants";
import { toast } from "@lib/toast";
import { fmtCurrencyUSD } from "@lib/formatters";
import { getGrantFinancialCapabilities } from "@hdb/contracts";
import type { TGrant as Grant } from "@types";
import {
  applyTssPreset,
  buildGrantProgramPayload,
  copyGrantProgramToDraft,
  createInitialGrantProgramDraft,
  DEFAULT_ELIGIBILITY,
  DEFAULT_LEVEL_OF_ASSISTANCE,
  FINANCIAL_CONFIG_PRESETS,
  type FlowInvoiceOption,
  type FlowLineItem,
  type GrantProgramFinancialModel,
  type GrantProgramFlowDraft,
  type GrantProgramLifecycle,
} from "./grantProgramFlowModel";

type FlowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type Props = {
  initialCreateData?: Partial<Grant>;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

const FLOW_STEPS: Array<{ step: FlowStep; label: string }> = [
  { step: 1, label: "Start" },
  { step: 2, label: "Config" },
  { step: 3, label: "Services" },
  { step: 4, label: "Budget" },
  { step: 5, label: "Tasks" },
  { step: 6, label: "Display" },
  { step: 7, label: "Review" },
];

const LINE_ITEM_TYPES = [
  { id: "rental-assistance", label: "Rental Assistance" },
  { id: "program-spending", label: "Program Spending" },
  { id: "customer-support-service", label: "Customer Support Service" },
];

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function financialModelLabel(model: GrantProgramFinancialModel) {
  if (model === "budgeted") return "Budgeted spend-down";
  if (model === "billable") return "Billable ledger";
  return "Service only";
}

function lifecycleLabel(kind: GrantProgramLifecycle) {
  return kind === "program" ? "Ongoing Program" : "Funding Grant";
}

function nextLineItem(): FlowLineItem {
  return {
    id: `li_${Date.now().toString(36)}`,
    label: "New Line Item",
    amount: 0,
    type: null,
    perCustomerCap: null,
    capEnabled: false,
  };
}

function optionClass(active: boolean) {
  return [
    "rounded-xl border px-4 py-3 text-left transition",
    active
      ? "border-sky-300 bg-sky-50 text-slate-950 shadow-sm"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
  ].join(" ");
}

function StepFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-sky-600">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextListEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const rows = value.length ? value : [""];
  const commit = (next: string[]) => onChange(next.map((item) => item.trim()).filter(Boolean));
  return (
    <div className="space-y-2">
      {rows.map((item, index) => (
        <div key={`${index}:${item}`} className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className="input"
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = rows.slice();
              next[index] = e.currentTarget.value;
              onChange(next);
            }}
            onBlur={() => commit(rows)}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => commit(rows.filter((_, i) => i !== index))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...rows, ""])}>
        Add Row
      </button>
    </div>
  );
}

function KeyValueEditor({
  value,
  defaults,
  onChange,
}: {
  value: Record<string, string>;
  defaults: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const source = Object.keys(value).length ? value : defaults;
  const rows = Object.entries(source);
  const commit = (next: Record<string, string>) => {
    const cleaned: Record<string, string> = {};
    for (const [key, raw] of Object.entries(next)) {
      const k = key.trim();
      if (k) cleaned[k] = String(raw ?? "").trim();
    }
    onChange(cleaned);
  };
  return (
    <div className="space-y-2">
      {rows.map(([key, val]) => (
        <div key={key} className="grid gap-2 md:grid-cols-[minmax(180px,240px)_1fr_auto]">
          <input
            className="input"
            defaultValue={key}
            onBlur={(e) => {
              const nextKey = e.currentTarget.value.trim();
              if (!nextKey || nextKey === key) return;
              const next = { ...source };
              next[nextKey] = next[key] || "";
              delete next[key];
              commit(next);
            }}
          />
          <input className="input" value={val} onChange={(e) => commit({ ...source, [key]: e.currentTarget.value })} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            const next = { ...source };
            delete next[key];
            commit(next);
          }}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => commit({ ...source, [`Item ${rows.length + 1}`]: "" })}>
        Add Row
      </button>
    </div>
  );
}

function InvoiceOptionsEditor({
  title,
  options,
  codeLabel,
  onChange,
}: {
  title: string;
  options: FlowInvoiceOption[];
  codeLabel: "Code" | "Example";
  onChange: (next: FlowInvoiceOption[]) => void;
}) {
  const patch = (id: string, nextPatch: Partial<FlowInvoiceOption>) =>
    onChange(options.map((row) => (row.id === id ? { ...row, ...nextPatch } : row)));
  const add = () => {
    const id = `custom_${Date.now().toString(36)}`;
    onChange([...options, { id, label: "Other", enabled: true, custom: true }]);
  };
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <button type="button" className="btn btn-secondary btn-xs" onClick={add}>Add Other</button>
      </div>
      {options.map((row) => (
        <div key={row.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[auto_minmax(160px,1fr)_minmax(160px,260px)_auto]">
          <input type="checkbox" className="mt-2 h-4 w-4 accent-sky-600" checked={row.enabled === true} onChange={(e) => patch(row.id, { enabled: e.currentTarget.checked })} />
          <input className="input h-9" value={row.label} readOnly={!row.custom} onChange={(e) => patch(row.id, { label: e.currentTarget.value })} />
          <input
            className="input h-9"
            value={codeLabel === "Code" ? row.code || "" : row.template || ""}
            placeholder={codeLabel}
            onChange={(e) => patch(row.id, codeLabel === "Code" ? { code: e.currentTarget.value } : { template: e.currentTarget.value })}
          />
          {row.custom ? (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(options.filter((item) => item.id !== row.id))}>
              Remove
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</div>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function NewGrantProgramFlow({ initialCreateData, onClose, onCreated }: Props) {
  const router = useRouter();
  const upsert = useUpsertGrants();
  const fetchGrantById = useFetchGrantById();
  const { data: activeGrants = [] } = useGrants({ active: true, limit: 500 }, { staleTime: 60_000 });
  const { data: inactiveGrants = [] } = useGrants({ active: false, limit: 500 }, { staleTime: 60_000 });
  const allGrants = React.useMemo(() => [...(activeGrants as Grant[]), ...(inactiveGrants as Grant[])], [activeGrants, inactiveGrants]);
  const [step, setStep] = React.useState<FlowStep>(1);
  const [draft, setDraft] = React.useState<GrantProgramFlowDraft>(() =>
    createInitialGrantProgramDraft({ status: "draft", startDate: isoToday(), ...(initialCreateData || {}) }),
  );
  const [copying, setCopying] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const payload = React.useMemo(() => buildGrantProgramPayload(draft), [draft]);
  const capabilities = React.useMemo(() => getGrantFinancialCapabilities(payload), [payload]);
  const missingName = draft.name.trim().length === 0;
  const missingStartDate = draft.startDate.trim().length === 0;
  const canSave = !missingName && !missingStartDate;
  const canContinue = step !== 1 || canSave;

  const setFinancialModel = (model: GrantProgramFinancialModel) => {
    setDraft((prev) => ({
      ...prev,
      financialModel: model,
      allocationEnabled: model === "billable" ? true : model === "serviceOnly" ? false : prev.allocationEnabled,
      authorizationMonths: model === "billable" && !prev.authorizationMonths ? "12" : prev.authorizationMonths,
    }));
  };

  const updateLineItem = (index: number, patch: Partial<FlowLineItem>) => {
    setDraft((prev) => {
      const lineItems = prev.lineItems.slice();
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...prev, lineItems };
    });
  };

  const onCopy = async (grantId: string) => {
    if (!grantId) return;
    setCopying(true);
    try {
      const source = await fetchGrantById(grantId);
      if (!source) return;
      setDraft((prev) => copyGrantProgramToDraft(source as Record<string, unknown>, prev));
      toast("Grant/program copied into the builder.", { type: "success" });
    } catch (error) {
      toast(toApiError(error).error, { type: "error" });
    } finally {
      setCopying(false);
    }
  };

  const onSubmit = async () => {
    if (!canSave) {
      toast("Name and start date are required.", { type: "error" });
      return;
    }
    setSaving(true);
    try {
      const resp = await upsert.mutateAsync(payload as any);
      const id = Array.isArray((resp as { ids?: unknown[] })?.ids)
        ? String(((resp as { ids?: unknown[] }).ids || [])[0] || "")
        : "";
      toast("Grant/program created.", { type: "success" });
      if (id && onCreated) onCreated(id);
      else if (id) router.replace(`/grants/${encodeURIComponent(id)}`);
      else onClose();
    } catch (error) {
      toast(toApiError(error).error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const content = step === 1 ? (
    <StepFrame
      eyebrow="Page 1"
      title="Start the grant or program"
      description="Lifecycle identity and financial behavior are separate. Choose what the record is, then choose how money and activity should behave."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="field">
              <span className="label">Copy from existing</span>
              <select
                className="select"
                disabled={copying}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  void onCopy(value);
                }}
              >
                <option value="">Start blank</option>
                {allGrants.map((grant) => (
                  <option key={String(grant.id)} value={String(grant.id)}>
                    {String(grant.name || grant.id)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field md:col-span-2">
              <span className="label">Grant / program name</span>
              <input
                className={["input", missingName ? "border-red-300 bg-red-50/40" : ""].join(" ")}
                value={draft.name}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, name: value }));
                }}
              />
              {missingName ? <span className="text-xs text-red-700">Name is required before you can continue.</span> : null}
            </label>
            <label className="field">
              <span className="label">Start date</span>
              <input
                className={["input", missingStartDate ? "border-red-300 bg-red-50/40" : ""].join(" ")}
                type="date"
                value={draft.startDate}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, startDate: value }));
                }}
              />
              {missingStartDate ? <span className="text-xs text-red-700">Start date is required before you can continue.</span> : null}
            </label>
            {draft.kind === "grant" ? (
              <label className="field">
                <span className="label">Close / end date encouraged</span>
                <input
                  className="input"
                  type="date"
                  min={draft.startDate || undefined}
                  value={draft.endDate}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setDraft((prev) => ({ ...prev, endDate: value }));
                  }}
                />
              </label>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" className={optionClass(draft.kind === "grant")} onClick={() => setDraft((prev) => ({ ...prev, kind: "grant" }))}>
              <div className="text-sm font-semibold">Funding Grant</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">A funding cycle with an expected start and close date. This does not decide budget behavior by itself.</div>
            </button>
            <button type="button" className={optionClass(draft.kind === "program")} onClick={() => setDraft((prev) => ({ ...prev, kind: "program" }))}>
              <div className="text-sm font-semibold">Ongoing Program</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">A service container that may continue across funding cycles. It can still be billable or budgeted.</div>
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(["budgeted", "billable", "serviceOnly"] as GrantProgramFinancialModel[]).map((model) => (
              <button key={model} type="button" className={optionClass(draft.financialModel === model)} onClick={() => setFinancialModel(model)}>
                <div className="text-sm font-semibold">{financialModelLabel(model)}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                  {model === "budgeted"
                    ? "Line-item amounts are real spend-down budget allocations."
                    : model === "billable"
                      ? "Line items are billing/allocation categories, not hard budget caps."
                      : "No financial ledger, billing, allocation, or budget workspace."}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-semibold">TSS preset</div>
          <p className="text-xs leading-5">Applies an ongoing billable program setup with allocation tracking and a one-year authorization window.</p>
          <button type="button" className="btn btn-sm w-full" onClick={() => setDraft((prev) => applyTssPreset(prev))}>
            Apply TSS Billable Program
          </button>
        </div>
      </div>
      {draft.kind === "grant" && !draft.endDate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Funding grants usually need a close date for reporting and enrollment caps. You can still create this draft without one.
        </div>
      ) : null}
    </StepFrame>
  ) : step === 2 ? (
    <StepFrame
      eyebrow="Page 2"
      title="Details and configuration"
      description="Set lifecycle dates, assistance windows, and allocation tracking. Allocation can be used with billable programs without creating a spend-down budget."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="label">End date</span>
          <input
            className="input"
            type="date"
            min={draft.startDate || undefined}
            value={draft.endDate}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({ ...prev, endDate: value }));
            }}
          />
        </label>
        <label className="field">
          <span className="label">Duration label</span>
          <input
            className="input"
            value={draft.duration}
            placeholder="1 Year"
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({ ...prev, duration: value }));
            }}
          />
        </label>
        <label className="field">
          <span className="label">Max length of assistance</span>
          <input
            className="input"
            value={draft.lengthOfAssistance}
            placeholder="Up to 24 months"
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({ ...prev, lengthOfAssistance: value }));
            }}
          />
        </label>
        <label className="field">
          <span className="label">Authorization months</span>
          <input
            className="input"
            type="number"
            min={1}
            max={120}
            value={draft.authorizationMonths}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({ ...prev, authorizationMonths: value }));
            }}
          />
        </label>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 md:col-span-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-sky-600"
              checked={draft.allocationEnabled}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setDraft((prev) => ({ ...prev, allocationEnabled: checked }));
              }}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-950">Customer allocation tracking</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">Tracks per-customer usage and caps. In billable mode this supports billing/allocation reporting without treating line-item amounts as remaining budget.</span>
            </span>
          </label>
          {draft.allocationEnabled ? (
            <label className="field mt-4 max-w-sm">
              <span className="label">Optional grant-level cap per customer</span>
              <input
                className="input"
                type="number"
                min={0}
                value={draft.perCustomerCap}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, perCustomerCap: value }));
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
    </StepFrame>
  ) : step === 3 ? (
    <StepFrame
      eyebrow="Page 3"
      title="Descriptions and services"
      description="Capture the staff-facing service definition, eligibility rules, and prioritization or assistance levels."
    >
      <div className="space-y-5">
        <label className="field">
          <span className="label">Description</span>
          <textarea
            className="input min-h-28"
            value={draft.description}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({ ...prev, description: value }));
            }}
          />
        </label>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-900">Services offered</div>
          <TextListEditor value={draft.servicesOffered} placeholder="Rental assistance, case management..." onChange={(servicesOffered) => setDraft((prev) => ({ ...prev, servicesOffered }))} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-900">Eligibility criteria</div>
          <KeyValueEditor value={draft.eligibility} defaults={DEFAULT_ELIGIBILITY} onChange={(eligibility) => setDraft((prev) => ({ ...prev, eligibility }))} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-900">Assistance / prioritization levels</div>
          <KeyValueEditor value={draft.levelOfAssistance} defaults={DEFAULT_LEVEL_OF_ASSISTANCE} onChange={(levelOfAssistance) => setDraft((prev) => ({ ...prev, levelOfAssistance }))} />
        </div>
      </div>
    </StepFrame>
  ) : step === 4 ? (
    <StepFrame
      eyebrow="Page 4"
      title="Line items and budget"
      description="Budgeted records use amounts as spend-down allocations. Billable records use line items as billing and allocation categories."
    >
      {draft.financialModel === "serviceOnly" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Service-only records skip budget, billing, allocation, and ledger setup.</div>
      ) : (
        <div className="space-y-5">
          {draft.financialModel === "budgeted" ? (
            <label className="field max-w-xs">
              <span className="label">Total budget</span>
              <input
                className="input"
                type="number"
                min={0}
                value={draft.budgetTotal}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, budgetTotal: value }));
                }}
              />
            </label>
          ) : (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Billable line items are categories. Amounts are saved as zero in this create flow so they are not treated as hard caps.</div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Line items</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft((prev) => ({ ...prev, lineItems: [...prev.lineItems, nextLineItem()] }))}>Add Line Item</button>
            </div>
            {draft.lineItems.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No line items yet.</div> : null}
            {draft.lineItems.map((item, index) => (
              <div key={item.id || index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_220px_160px_auto]">
                <input
                  className="input"
                  value={item.label}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateLineItem(index, { label: value });
                  }}
                />
                <select
                  className="select"
                  value={item.type?.id || ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    const hit = LINE_ITEM_TYPES.find((type) => type.id === value);
                    updateLineItem(index, { type: hit || null });
                  }}
                >
                  <option value="">No category</option>
                  {LINE_ITEM_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
                <input
                  className="input"
                  type="number"
                  min={0}
                  disabled={draft.financialModel === "billable"}
                  value={draft.financialModel === "billable" ? 0 : item.amount}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateLineItem(index, { amount: toNumber(value) });
                  }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }))}>Remove</button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              <span className="label">Functional group</span>
              <input
                className="input"
                value={draft.invoicing.functionalGroup}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, functionalGroup: value } }));
                }}
              />
            </label>
            <label className="field">
              <span className="label">Grant code</span>
              <input
                className="input"
                value={draft.invoicing.grantCode}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, grantCode: value } }));
                }}
              />
            </label>
            <label className="field">
              <span className="label">FE / program code</span>
              <input
                className="input"
                value={draft.invoicing.programCode}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, programCode: value } }));
                }}
              />
            </label>
            <label className="field">
              <span className="label">HMIS code</span>
              <input
                className="input"
                value={draft.invoicing.hmisCode}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, hmisCode: value } }));
                }}
              />
            </label>
          </div>
          <InvoiceOptionsEditor title="Allowed expense categories" codeLabel="Code" options={draft.invoicing.expenseCategories} onChange={(expenseCategories) => setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, expenseCategories } }))} />
          <InvoiceOptionsEditor title="Description examples" codeLabel="Example" options={draft.invoicing.descriptionTemplates} onChange={(descriptionTemplates) => setDraft((prev) => ({ ...prev, invoicing: { ...prev.invoicing, descriptionTemplates } }))} />
        </div>
      )}
    </StepFrame>
  ) : step === 5 ? (
    <StepFrame
      eyebrow="Page 5"
      title="Tasks and assessments"
      description="Task definitions are saved on the grant/program. Assessment templates are still created from the existing Assessments tab after this record exists."
    >
      <TaskBuilder
        editing
        value={draft.tasks as TaskTemplateDraft[]}
        onChange={(tasks) => setDraft((prev) => ({ ...prev, tasks: tasks as Array<Record<string, unknown>> }))}
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Assessment templates are linked after save from the grant/program workspace. This create flow intentionally does not create linked templates in v1.
      </div>
    </StepFrame>
  ) : step === 6 ? (
    <StepFrame
      eyebrow="Page 6"
      title="Display and digest"
      description="Pins control visibility in digest and filtering surfaces. Billing-mode programs should use reference/activity language, not budget remaining language."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["digest", "Budget digest"],
          ["rentalAssistance", "Rental assistance digest"],
          ["invoice", "Invoice filter"],
          ["important", "Important display"],
        ].map(([key, label]) => (
          <label key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-sky-600"
                checked={Boolean((draft.pins as any)[key])}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setDraft((prev) => ({ ...prev, pins: { ...prev.pins, [key]: checked } }));
                }}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {key === "digest" ? "Spend-down budget digest inclusion." : key === "invoice" ? "Surfaces this record as an invoice workflow filter." : key === "important" ? "Adds a visual priority badge." : "Includes this assistance group in rental assistance digest surfaces."}
                </span>
              </span>
            </span>
          </label>
        ))}
        {draft.pins.invoice ? (
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="field">
              <span className="label">Invoice pin label</span>
              <input
                className="input"
                value={draft.pins.invoiceLabel}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, pins: { ...prev.pins, invoiceLabel: value } }));
                }}
              />
            </label>
            <label className="field">
              <span className="label">Invoice pin note</span>
              <input
                className="input"
                value={draft.pins.invoiceNote}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((prev) => ({ ...prev, pins: { ...prev.pins, invoiceNote: value } }));
                }}
              />
            </label>
          </div>
        ) : null}
      </div>
    </StepFrame>
  ) : (
    <StepFrame
      eyebrow="Page 7"
      title="Final review"
      description="Review the document shape before creating it. This is a structured summary of the payload, not a raw JSON view."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewBlock title="Identity">
          <div className="font-semibold text-slate-950">{draft.name || "Untitled"}</div>
          <div>{lifecycleLabel(draft.kind)} / {financialModelLabel(draft.financialModel)}</div>
          <div>Start {draft.startDate || "-"} / End {draft.endDate || "-"}</div>
        </ReviewBlock>
        <ReviewBlock title="Financial behavior">
          <div>Budget: {capabilities.budgetEnabled ? "enabled" : "off"}</div>
          <div>Billing: {capabilities.billingEnabled ? "enabled" : "off"}</div>
          <div>Ledger mode: {capabilities.ledgerMode}</div>
          <div>Line-item amount semantics: {capabilities.drawsDownBudget ? "spend-down allocation" : "not a hard cap"}</div>
        </ReviewBlock>
        <ReviewBlock title="Line items">
          {draft.lineItems.length ? draft.lineItems.map((item) => (
            <div key={item.id || item.label} className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
              <span>{item.label}</span>
              <span>{draft.financialModel === "budgeted" ? fmtCurrencyUSD(toNumber(item.amount)) : "category"}</span>
            </div>
          )) : "No line items"}
        </ReviewBlock>
        <ReviewBlock title="Services">
          <div>{draft.servicesOffered.length} service row(s)</div>
          <div>{Object.keys(draft.eligibility).length || Object.keys(DEFAULT_ELIGIBILITY).length} eligibility row(s)</div>
          <div>{Object.keys(draft.levelOfAssistance).length || Object.keys(DEFAULT_LEVEL_OF_ASSISTANCE).length} assistance level row(s)</div>
        </ReviewBlock>
        <ReviewBlock title="Tasks and display">
          <div>{draft.tasks.length} task definition(s)</div>
          <div>Pins: {Object.entries(draft.pins).filter(([, value]) => value === true).map(([key]) => key).join(", ") || "none"}</div>
        </ReviewBlock>
        <ReviewBlock title="Invoice metadata">
          <div>Functional group: {draft.invoicing.functionalGroup || "-"}</div>
          <div>Grant code: {draft.invoicing.grantCode || "-"}</div>
          <div>FE/program code: {draft.invoicing.programCode || "-"}</div>
          <div>HMIS code: {draft.invoicing.hmisCode || "-"}</div>
        </ReviewBlock>
      </div>
    </StepFrame>
  );

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Grant/program builder</div>
            <div className="mt-1 text-lg font-bold text-slate-950">{draft.name || "New grant/program"}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {FLOW_STEPS.map((item) => (
              <button
                key={item.step}
                type="button"
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                  item.step === step ? "bg-slate-950 text-white" : item.step < step ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                ].join(" ")}
                onClick={() => setStep(item.step)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">{content}</div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <div className="flex items-center gap-2">
          {step === 1 && !canSave ? (
            <span className="hidden text-xs font-medium text-red-700 sm:inline">Complete name and start date to continue.</span>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" disabled={step === 1} onClick={() => setStep((prev) => Math.max(1, prev - 1) as FlowStep)}>Back</button>
          {step < 7 ? (
            <button type="button" className="btn btn-sm" disabled={!canContinue} onClick={() => setStep((prev) => Math.min(7, prev + 1) as FlowStep)}>Continue</button>
          ) : (
            <button type="button" className="btn btn-sm" disabled={!canSave || saving} onClick={() => void onSubmit()}>
              {saving ? "Creating..." : "Create Grant/Program"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewGrantProgramWorkspaceModal(props: Props) {
  const label = props.initialCreateData?.kind === "program" ? "New Program" : "New Grant";
  return (
    <FullPageModal
      isOpen
      onClose={props.onClose}
      hideSidebar
      leftPane={null}
      topBar={
        <div className="workspace-breadcrumb">
          <button type="button" className="workspace-breadcrumb-back" onClick={props.onClose}>
            &larr; Budget
          </button>
          <span className="workspace-breadcrumb-sep">/</span>
          <span className="workspace-breadcrumb-current">{label}</span>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto p-6 md:p-8">
          <NewGrantProgramFlow {...props} />
        </div>
      }
      disableOverlayClose={false}
    />
  );
}
