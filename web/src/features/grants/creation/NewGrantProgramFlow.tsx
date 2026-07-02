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
import { EnrollmentControlsEditor, EnrollmentControlsSummary } from "../EnrollmentControlsEditor";
import {
  buildGrantProgramPayload,
  copyLineItemInvoicing,
  copyGrantProgramToDraft,
  createInitialGrantProgramDraft,
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
  { step: 4, label: "Financial" },
  { step: 5, label: "Tasks" },
  { step: 6, label: "Display" },
  { step: 7, label: "Review" },
];

const LINE_ITEM_TYPES = [
  { id: "rental-assistance", label: "Rental Assistance" },
  { id: "program-spending", label: "Program Spending" },
  { id: "customer-support-service", label: "Customer Support Service" },
];

const RENTAL_ASSISTANCE_TAG = "rental-assistance";

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

function financialStepLabel(model: GrantProgramFinancialModel) {
  if (model === "budgeted") return "Budget";
  if (model === "billable") return "Billing";
  return "No finance";
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
    invoicing: { functionalGroup: "", grantCode: "", programCode: "", hmisCode: "", expenseCategories: [], descriptionTemplates: [] },
  };
}

function toCurrency(value: number) {
  return fmtCurrencyUSD(Number.isFinite(value) ? value : 0);
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
        <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
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
      if (k) cleaned[k] = String(raw ?? "");
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
  const allGrants = React.useMemo(() => {
    const byId = new Map<string, Grant>();
    for (const grant of [...(activeGrants as Grant[]), ...(inactiveGrants as Grant[])]) {
      const id = String(grant?.id || "").trim();
      if (id) byId.set(id, grant);
    }
    return Array.from(byId.values());
  }, [activeGrants, inactiveGrants]);
  const [step, setStep] = React.useState<FlowStep>(1);
  const [draft, setDraft] = React.useState<GrantProgramFlowDraft>(() =>
    createInitialGrantProgramDraft({ status: "active", startDate: isoToday(), ...(initialCreateData || {}) }),
  );
  const [showDescriptionSection, setShowDescriptionSection] = React.useState(() => true);
  const [showServicesSection, setShowServicesSection] = React.useState(() => true);
  const [showEligibilitySection, setShowEligibilitySection] = React.useState(() => true);
  const [showAssistanceSection, setShowAssistanceSection] = React.useState(() => true);
  const [copying, setCopying] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState("");

  const rentalTagged = draft.tags.some((t) => t.toLowerCase() === RENTAL_ASSISTANCE_TAG);
  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    setDraft((prev) =>
      prev.tags.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : { ...prev, tags: [...prev.tags, t] },
    );
    setTagDraft("");
  };
  const removeTag = (tag: string) =>
    setDraft((prev) => ({ ...prev, tags: prev.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) }));
  const toggleRental = (on: boolean) =>
    setDraft((prev) => {
      const base = prev.tags.filter((t) => t.toLowerCase() !== RENTAL_ASSISTANCE_TAG);
      return { ...prev, tags: on ? [...base, RENTAL_ASSISTANCE_TAG] : base };
    });

  const payload = React.useMemo(() => buildGrantProgramPayload(draft), [draft]);
  const capabilities = React.useMemo(() => getGrantFinancialCapabilities(payload), [payload]);
  const missingName = draft.name.trim().length === 0;
  const canSave = !missingName;
  const canContinue = step !== 1 || canSave;

  const setFinancialModel = (model: GrantProgramFinancialModel) => {
    setDraft((prev) => ({
      ...prev,
      financialModel: model,
      allocationEnabled: model === "billable" ? true : model === "serviceOnly" ? false : prev.allocationEnabled,
      budgetTotal: model === "serviceOnly" ? "" : prev.budgetTotal,
      lineItems: model === "serviceOnly" ? [] : prev.lineItems,
    }));
  };

  const updateLineItem = (index: number, patch: Partial<FlowLineItem>) => {
    setDraft((prev) => {
      if (!prev.lineItems[index]) return prev;
      const lineItems = prev.lineItems.slice();
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...prev, lineItems };
    });
  };
  const copyPreviousLineItemInvoicing = (index: number) => {
    if (index < 1) return;
    setDraft((prev) => {
      if (!prev.lineItems[index] || !prev.lineItems[index - 1]) return prev;
      const lineItems = prev.lineItems.slice();
      lineItems[index] = {
        ...lineItems[index],
        invoicing: copyLineItemInvoicing(lineItems[index - 1]),
      };
      return { ...prev, lineItems };
    });
  };

  const onCopy = async (grantId: string) => {
    if (!grantId) return;
    setCopying(true);
    try {
      const source = await fetchGrantById(grantId);
      if (!source) return;
      setDraft((current) => {
        const copied = copyGrantProgramToDraft(source as Record<string, unknown>, current);
        setShowDescriptionSection(!!copied.description);
        setShowServicesSection(Array.isArray(copied.servicesOffered) && copied.servicesOffered.length > 0);
        setShowEligibilitySection(!!copied.eligibility && Object.keys(copied.eligibility).length > 0);
        setShowAssistanceSection(!!copied.levelOfAssistance && Object.keys(copied.levelOfAssistance).length > 0);
        return copied;
      });
      toast("Grant/program copied into the builder.", { type: "success" });
    } catch (error) {
      toast(toApiError(error).error, { type: "error" });
    } finally {
      setCopying(false);
    }
  };

  const onSubmit = async () => {
    if (!canSave) {
      toast("Name is required.", { type: "error" });
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
      description="Set the record name, lifecycle, and finance model before adding operational details."
    >
      <div className="space-y-5">
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
              className="input"
              type="date"
              value={draft.startDate}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((prev) => ({ ...prev, startDate: value }));
              }}
            />
            <span className="text-xs text-slate-500">Optional. Leave blank when the cycle dates are not known yet.</span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Lifecycle</div>
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
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Budget Model</div>
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
      </div>
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
          <span className="label">Previous cycle</span>
          <select className="select" value={draft.previousGrantId} onChange={(e) => setDraft((prev) => ({ ...prev, previousGrantId: e.currentTarget.value }))}>
            <option value="">None</option>
            {allGrants.map((grant) => <option key={String(grant.id)} value={String(grant.id)}>{String(grant.name || grant.id)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Next cycle</span>
          <select className="select" value={draft.nextGrantId} onChange={(e) => setDraft((prev) => ({ ...prev, nextGrantId: e.currentTarget.value }))}>
            <option value="">None</option>
            {allGrants.map((grant) => <option key={String(grant.id)} value={String(grant.id)}>{String(grant.name || grant.id)}</option>)}
          </select>
        </label>
        <div className="field md:col-span-2">
          <span className="label">Linked enrollment requirement</span>
          <div className="grid gap-2 md:grid-cols-[140px_1fr]">
            <select className="select" value={draft.linkedEnrollmentOperator} onChange={(e) => {
              const value = e.currentTarget.value as "all" | "any";
              setDraft((prev) => ({ ...prev, linkedEnrollmentOperator: value }));
            }}>
              <option value="all">All selected</option>
              <option value="any">Any selected</option>
            </select>
            <select className="select min-h-28" multiple value={draft.linkedEnrollmentGrantIds} onChange={(e) => {
              const values = Array.from(e.currentTarget.selectedOptions, (option) => option.value);
              setDraft((prev) => ({ ...prev, linkedEnrollmentGrantIds: values }));
            }}>
              {allGrants.map((grant) => <option key={String(grant.id)} value={String(grant.id)}>{String(grant.name || grant.id)}</option>)}
            </select>
          </div>
          <span className="text-xs text-slate-500">Used to surface warnings only. Hold Ctrl/Cmd to select multiple enrollments.</span>
        </div>
        <label className="field">
          <span className="label">Duration label</span>
          <input
            className="input"
            value={draft.duration}
            placeholder={draft.kind === "program" ? "" : "1 Year"}
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
            type="number"
            min={1}
            max={240}
            step={1}
            value={draft.maxAssistanceMonths}
            placeholder="18"
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((prev) => ({
                ...prev,
                maxAssistanceMonths: value,
                lengthOfAssistance: value ? `${value} months` : "",
              }));
            }}
          />
        </label>
        <label className="field">
          <span className="label">Default authorization window</span>
          <input
            className="input"
            type="number"
            min={1}
            max={120}
            step={1}
            value={draft.authorizationMonths}
            placeholder="No default"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraft((prev) => ({ ...prev, authorizationMonths: value }));
            }}
          />
          <span className="text-xs text-slate-500">Months used to suggest the end date for each new enrollment.</span>
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
        <div className="md:col-span-2">
          <EnrollmentControlsEditor
            value={draft.complianceConfig}
            onChange={(complianceConfig) => setDraft((prev) => ({ ...prev, complianceConfig }))}
          />
        </div>
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Tags</div>
          <div className="mt-1 text-xs text-slate-500">Free-form labels for grouping and reporting.</div>
          <div className="mt-3 space-y-3">
            {draft.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {t}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => removeTag(t)}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No tags yet.</div>
            )}
            <div className="flex gap-2">
              <input
                className="input h-9 flex-1"
                placeholder="Add a tag and press Enter"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addTag}>
                Add
              </button>
            </div>
            {draft.kind === "grant" ? (
              <label className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-2.5 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={rentalTagged}
                  onChange={(e) => toggleRental(e.currentTarget.checked)}
                />
                <span className="text-xs font-semibold text-emerald-900">Rental Assistance</span>
                <span className="text-xs text-emerald-800/75">Budget grouping and reporting</span>
              </label>
            ) : null}
          </div>
        </div>
      </div>
      {draft.kind === "grant" && !draft.endDate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Funding grants usually need a close date for reporting and enrollment caps. You can still create this draft without one.
        </div>
      ) : null}
    </StepFrame>
  ) : step === 3 ? (
    <StepFrame
      eyebrow="Page 3"
      title="Descriptions and services"
      description="Capture the staff-facing service definition, eligibility rules, and prioritization or assistance levels."
    >
      <div className="space-y-5">
        {showDescriptionSection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Description</div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
                setDraft((prev) => ({ ...prev, description: "" }));
                setShowDescriptionSection(false);
              }}>Remove section</button>
            </div>
            <textarea
              className="input min-h-28"
              value={draft.description}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((prev) => ({ ...prev, description: value }));
              }}
            />
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDescriptionSection(true)}>Add Description</button>
        )}
        {showServicesSection ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">Services offered</div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
              setDraft((prev) => ({ ...prev, servicesOffered: [] }));
              setShowServicesSection(false);
            }}>Remove section</button>
          </div>
          <TextListEditor value={draft.servicesOffered} placeholder="Rental assistance, case management..." onChange={(servicesOffered) => setDraft((prev) => ({ ...prev, servicesOffered }))} />
        </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
            setDraft((prev) => ({ ...prev, servicesOffered: prev.servicesOffered.length ? prev.servicesOffered : [""] }));
            setShowServicesSection(true);
          }}>Add Services</button>
        )}
        {showEligibilitySection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Eligibility criteria</div>
              <button type="button" className="btn btn-ghost btn-xs text-red-600" onClick={() => {
                setDraft((prev) => ({ ...prev, eligibility: {} }));
                setShowEligibilitySection(false);
              }}>Delete field</button>
            </div>
            <KeyValueEditor value={draft.eligibility} defaults={{}} onChange={(eligibility) => setDraft((prev) => ({ ...prev, eligibility }))} />
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEligibilitySection(true)}>Add Eligibility Criteria</button>
        )}
        {showAssistanceSection ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Assistance / prioritization levels</div>
              <button type="button" className="btn btn-ghost btn-xs text-red-600" onClick={() => {
                setDraft((prev) => ({ ...prev, levelOfAssistance: {} }));
                setShowAssistanceSection(false);
              }}>Delete field</button>
            </div>
            <KeyValueEditor value={draft.levelOfAssistance} defaults={{}} onChange={(levelOfAssistance) => setDraft((prev) => ({ ...prev, levelOfAssistance }))} />
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAssistanceSection(true)}>Add Assistance Levels</button>
        )}
      </div>
    </StepFrame>
  ) : step === 4 ? (
    <StepFrame
      eyebrow="Page 4"
      title={draft.financialModel === "budgeted" ? "Budget and line items" : draft.financialModel === "billable" ? "Billing categories and ledger setup" : "Service-only setup"}
      description={draft.financialModel === "budgeted" ? "Line-item amounts are spend-down allocations and drive remaining budget math." : draft.financialModel === "billable" ? "Line items are billing and allocation categories. Amounts are optional references, not hard caps." : "Service-only records do not use budget, billing, allocation, or ledger setup."}
    >
      {draft.financialModel === "serviceOnly" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Service-only records skip budget, billing, allocation, and ledger setup.</div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{draft.financialModel === "budgeted" ? "Total Budget" : "Reference Total"}</div>
              {draft.financialModel === "budgeted" ? (
                <input
                  className="input mt-2"
                  type="number"
                  min={0}
                  value={draft.budgetTotal}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setDraft((prev) => ({ ...prev, budgetTotal: value }));
                  }}
                />
              ) : (
                <div className="mt-2 text-2xl font-bold text-slate-900">{toCurrency(0)}</div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Line Items</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{draft.lineItems.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Amount Semantics</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {draft.financialModel === "budgeted" ? "Spend-down allocation" : "Billing category"}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Line items</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft((prev) => ({ ...prev, lineItems: [...prev.lineItems, nextLineItem()] }))}>Add Line Item</button>
            </div>
            {draft.lineItems.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No line items yet.</div> : null}
            {draft.lineItems.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 text-left font-semibold">Name</th>
                      <th className="py-2 text-left font-semibold">Category</th>
                      <th className="py-2 text-right font-semibold">{draft.financialModel === "budgeted" ? "Budget" : "Reference"}</th>
                      <th className="py-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draft.lineItems.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="py-2 pr-3">
                          <input
                            className="input h-9"
                            value={item.label}
                            onChange={(e) => {
                              const value = e.currentTarget.value;
                              updateLineItem(index, { label: value });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className="select h-9"
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
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <input
                            className="input h-9 w-32 text-right"
                            type="number"
                            min={0}
                            disabled={draft.financialModel === "billable"}
                            value={draft.financialModel === "billable" ? 0 : item.amount}
                            onChange={(e) => {
                              const value = e.currentTarget.value;
                              updateLineItem(index, { amount: toNumber(value) });
                            }}
                          />
                        </td>
                        <td className="py-2 text-right">
                          {index > 0 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyPreviousLineItemInvoicing(index)}>Copy invoice config</button> : null}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }))}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {draft.lineItems.map((item, index) => (
              <div key={`invoice-${item.id || index}`} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{item.label || `Line item ${index + 1}`} invoicing</div>
                  {index > 0 ? <button type="button" className="btn btn-secondary btn-xs" onClick={() => copyPreviousLineItemInvoicing(index)}>Copy from previous</button> : null}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  {([ ["functionalGroup", "Functional group"], ["grantCode", "Grant code"], ["programCode", "FE / program code"], ["hmisCode", "HMIS code"] ] as const).map(([key, label]) => (
                    <label className="field" key={key}><span className="label">{label}</span><input className="input" value={item.invoicing[key]} onChange={(e) => updateLineItem(index, { invoicing: { ...item.invoicing, [key]: e.currentTarget.value } })} /></label>
                  ))}
                </div>
                <InvoiceOptionsEditor title="Allowed expense categories" codeLabel="Code" options={item.invoicing.expenseCategories} onChange={(expenseCategories) => updateLineItem(index, { invoicing: { ...item.invoicing, expenseCategories } })} />
                <InvoiceOptionsEditor title="Description examples" codeLabel="Example" options={item.invoicing.descriptionTemplates} onChange={(descriptionTemplates) => updateLineItem(index, { invoicing: { ...item.invoicing, descriptionTemplates } })} />
              </div>
            ))}
          </div>

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
          <div>{Object.keys(draft.eligibility).length} eligibility row(s)</div>
          <div>{Object.keys(draft.levelOfAssistance).length} assistance level row(s)</div>
        </ReviewBlock>
        <ReviewBlock title="Enrollment configuration">
          <div className="mb-2">Default authorization: {draft.authorizationMonths ? `${draft.authorizationMonths} months` : "none"}</div>
          <EnrollmentControlsSummary value={draft.complianceConfig} />
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
                {item.step === 4 ? financialStepLabel(draft.financialModel) : item.label}
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
