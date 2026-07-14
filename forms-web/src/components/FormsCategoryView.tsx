import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FormDef, IntakeFlowStep } from "@/lib/formsCatalog";
import { setCustomerTssStatus } from "@/lib/customersApi";
import { getCustomerDetail } from "@/lib/customerDetailApi";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { JotformEmbed } from "./JotformEmbed";
import { SendToCustomerModal } from "./SendToCustomerModal";
import { CreateCustomerModal } from "./CreateCustomerModal";
import { WebhooksSidebar } from "./WebhooksSidebar";
import { CreditCardCards } from "./CreditCardCards";
import { CustomerDetailsHeader } from "./CustomerDetailsHeader";
import { ReferencePanel } from "./ReferencePanel";

// ── Flow progress (localStorage, per customer) ─────────────────────────────

type TssVariant = "payer" | "nonpayer";

type FlowProgress = {
  done: Record<string, boolean>;
  /** stepKey → checked checklist item indexes */
  checks: Record<string, number[]>;
  /** TSS gate selection — also presets the folder build + customer doc push. */
  tssVariant?: TssVariant;
};

const EMPTY_PROGRESS: FlowProgress = { done: {}, checks: {} };

function loadProgress(key: string): FlowProgress {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_PROGRESS;
    const p = JSON.parse(raw) as Partial<FlowProgress>;
    return {
      done: p.done ?? {},
      checks: p.checks ?? {},
      ...(p.tssVariant === "payer" || p.tssVariant === "nonpayer" ? { tssVariant: p.tssVariant } : {}),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

type ResolvedStep = IntakeFlowStep & {
  /** Stable key for progress tracking: formId, or a slug of the task title. */
  key: string;
  title: string;
  form: FormDef | null;
};

type View = { kind: "list" } | { kind: "step"; idx: number } | { kind: "form"; form: FormDef };

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
  /** Ordered flow steps (forms + tasks): numbered checklist + next/back nav. */
  flowSteps,
  /** Full catalog for resolving flow form ids outside this tab's category. */
  catalog,
  /** Intake: persistent right-hand Webhooks sidebar (structured + raw). */
  webhooksSidebar = false,
  /** Reference links pinned at the bottom of the flow list. */
  resources,
  /** Jump straight into the first unfinished flow step on mount (e.g. after a referral). */
  autoStart = false,
}: {
  heading: string;
  description?: string;
  forms: FormDef[];
  showCreditCards?: boolean;
  showCustomerHeader?: boolean;
  customerNav?: boolean;
  flowSteps?: IntakeFlowStep[];
  catalog?: FormDef[];
  webhooksSidebar?: boolean;
  resources?: { href: string; label: string }[];
  autoStart?: boolean;
}) {
  const { customer } = useCurrentCustomer();
  const [view, setView] = useState<View>({ kind: "list" });
  const [sendForm, setSendForm] = useState<FormDef | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Resolve flow steps against the full catalog (flow forms may live in other categories).
  const steps = useMemo<ResolvedStep[]>(() => {
    if (!flowSteps?.length) return [];
    const byId = new Map((catalog ?? forms).map((f) => [f.id, f]));
    return flowSteps.map((s) => {
      const form = s.formId ? byId.get(s.formId) ?? null : null;
      const title = s.title ?? form?.title ?? (s.formId ? `Form ${s.formId}` : "Untitled step");
      return { ...s, key: s.formId ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title, form };
    });
  }, [flowSteps, catalog, forms]);

  const flowIds = useMemo(() => new Set(steps.map((s) => s.formId).filter(Boolean)), [steps]);
  const extraForms = useMemo(() => forms.filter((f) => !flowIds.has(f.id)), [forms, flowIds]);

  // Progress is persisted per active customer so the list doubles as a checklist.
  const storageKey = `hdb:forms:intake-progress:${customer?.id ?? "no-customer"}`;
  const [progress, setProgressState] = useState<FlowProgress>(() => loadProgress(storageKey));
  const keyRef = useRef(storageKey);
  useEffect(() => {
    if (keyRef.current === storageKey) return;
    const prevKey = keyRef.current;
    keyRef.current = storageKey;
    const next = loadProgress(storageKey);
    // Intake usually STARTS without a customer (ROIs/disclosures come first).
    // When one gets created/linked mid-flow, carry the anonymous checklist
    // over into their bucket so nothing has to be re-ticked.
    if (prevKey.endsWith(":no-customer") && customer) {
      const anon = loadProgress(prevKey);
      if (Object.keys(anon.done).length || Object.keys(anon.checks).length) {
        const merged: FlowProgress = {
          done: { ...anon.done, ...next.done },
          checks: { ...anon.checks, ...next.checks },
          ...(next.tssVariant ?? anon.tssVariant ? { tssVariant: next.tssVariant ?? anon.tssVariant } : {}),
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(merged));
          localStorage.removeItem(prevKey);
        } catch {
          /* ignore */
        }
        setProgressState(merged);
        return;
      }
    }
    setProgressState(next);
  }, [storageKey, customer]);
  const updateProgress = useCallback(
    (fn: (p: FlowProgress) => FlowProgress) => {
      setProgressState((p) => {
        const next = fn(p);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const setDone = useCallback(
    (stepKey: string, done: boolean) => {
      updateProgress((p) => ({ ...p, done: { ...p.done, [stepKey]: done } }));
    },
    [updateProgress]
  );

  const toggleCheck = (stepKey: string, itemIdx: number) => {
    updateProgress((p) => {
      const cur = new Set(p.checks[stepKey] ?? []);
      if (cur.has(itemIdx)) cur.delete(itemIdx);
      else cur.add(itemIdx);
      return { ...p, checks: { ...p.checks, [stepKey]: [...cur].sort((a, b) => a - b) } };
    });
  };

  const doneCount = steps.filter((s) => progress.done[s.key]).length;
  const firstOpen = steps.findIndex((s) => !progress.done[s.key]);

  // Arriving via a "start intake" link (e.g. a completed referral) jumps
  // straight into the first unfinished step. Once per mount.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current && steps.length) {
      autoStarted.current = true;
      setView({ kind: "step", idx: Math.max(0, firstOpen) });
    }
  }, [autoStart, steps.length, firstOpen]);

  const step = view.kind === "step" ? steps[view.idx] : null;
  const stepKey = step?.key ?? null;

  // Bumped when the embed detects a submit → the Webhooks sidebar refetches
  // right away instead of waiting for its next poll tick.
  const [webhookRefresh, setWebhookRefresh] = useState(0);

  // Stable per-step callback: an inline arrow would re-run JotformEmbed's
  // message-listener effect every parent render and wipe its submitted state.
  const handleSubmitted = useCallback(() => {
    if (stepKey) setDone(stepKey, true);
    setWebhookRefresh((n) => n + 1);
  }, [stepKey, setDone]);

  const resolveHref = (href: string): string =>
    customer ? href.replace("{customerId}", customer.id) : href.replace(/\/\{customerId\}/, "");

  // Customer Drive folder URL (from the customer doc) for "Open customer folder" buttons.
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!customer) {
      setFolderUrl(null);
      return;
    }
    getCustomerDetail(customer.id).then((d) => {
      if (alive) setFolderUrl(d?.driveFolderUrl ?? null);
    });
    return () => { alive = false; };
  }, [customer]);

  // TSS gate selection: persist locally, and push onto the customer doc as soon
  // as one exists (covers select-after-link AND select-before-link via merge).
  const tssVariant = progress.tssVariant ?? null;
  const tssPushed = useRef(new Set<string>());
  useEffect(() => {
    if (!customer || !tssVariant) return;
    const key = `${customer.id}:${tssVariant}`;
    if (tssPushed.current.has(key)) return;
    tssPushed.current.add(key);
    setCustomerTssStatus(customer.id, tssVariant).catch(() => tssPushed.current.delete(key));
  }, [customer, tssVariant]);

  const chooseTssVariant = (v: TssVariant) => {
    updateProgress((p) => ({ ...p, tssVariant: v }));
  };

  // Persisted across list and open views so context (card spend, current
  // customer) stays visible while a form is being filled in the iframe.
  const persistentContext = (
    <>
      {showCustomerHeader ? <CustomerDetailsHeader nav={customerNav} /> : null}
      {showCreditCards ? <CreditCardCards /> : null}
    </>
  );

  const createModal = createOpen ? (
    <CreateCustomerModal
      onClose={() => setCreateOpen(false)}
      // The TSS gate choice presets the folder build variant (payer ↔ Medicaid yes).
      presetMedicaid={tssVariant ? (tssVariant === "payer" ? "yes" : "no") : undefined}
    />
  ) : null;

  // The Webhooks sidebar sits OUTSIDE the view switch so it persists (and keeps
  // its data/scroll) across the list, step, and form views of the flow.
  const flowFormIds = useMemo(() => {
    const ids = new Set(steps.map((s) => s.formId).filter((x): x is string => !!x));
    // "Build household model" forms feed the sidebar too, wherever they live.
    for (const f of catalog ?? forms) if (f.buildHousehold) ids.add(f.id);
    return [...ids];
  }, [steps, catalog, forms]);
  const withSidebar = (node: ReactNode) =>
    webhooksSidebar ? (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">{node}</div>
        <WebhooksSidebar formIds={flowFormIds} refreshKey={webhookRefresh} />
      </div>
    ) : (
      <>{node}</>
    );

  // ── Open flow step ─────────────────────────────────────────────────────
  if (view.kind === "step" && step) {
    const idx = view.idx;
    const prev = idx > 0 ? steps[idx - 1] : null;
    const next = idx < steps.length - 1 ? steps[idx + 1] : null;
    const isDone = !!progress.done[step.key];

    const nav = (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && setView({ kind: "step", idx: idx - 1 })}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Back{prev ? `: ${prev.title}` : ""}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Step {idx + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => setDone(step.key, !isDone)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
              isDone
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {isDone ? "✓ Completed" : "Mark complete"}
          </button>
        </div>
        {next ? (
          <button
            type="button"
            onClick={() => setView({ kind: "step", idx: idx + 1 })}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
              isDone ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            Next: {next.title} →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView({ kind: "list" })}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Finish — return to intake flow ✓
          </button>
        )}
      </div>
    );

    return withSidebar(
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView({ kind: "list" })}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Return to intake flow
        </button>
        {persistentContext}
        <h2 className="text-base font-semibold text-slate-900">
          Step {idx + 1}: {step.title}
          {step.optional ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">optional</span> : null}
        </h2>
        {step.note ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{step.note}</div>
        ) : null}
        {nav}
        {step.customerSetup ? (
          customer ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ <b>{customer.name}</b> is linked as the current customer
              {customer.cwId ? <span className="text-emerald-600"> · {customer.cwId}</span> : null}.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="min-w-0 text-sm text-indigo-900">
                <b>No customer in the database yet?</b> Create them now — the Drive folder gets built and
                linked automatically. Your checklist progress so far carries over.
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                + Create / link customer
              </button>
            </div>
          )
        ) : null}
        {step.checklist?.length || step.links?.length || step.customerFolderLink ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            {step.customerFolderLink ? (
              folderUrl ? (
                <a
                  href={folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Open customer folder (Drive) ↗
                </a>
              ) : (
                <div className="text-xs text-slate-400">
                  {customer
                    ? "No Drive folder linked to this customer yet — build it at the customer-setup step."
                    : "Link a customer to get a direct button to their Drive folder."}
                </div>
              )
            ) : null}
            {step.checklist?.length ? (
              <ul className="space-y-1.5">
                {step.checklist.map((item, i) => {
                  const checked = (progress.checks[step.key] ?? []).includes(i);
                  return (
                    <li key={i}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(step.key, i)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className={checked ? "text-slate-400 line-through" : ""}>{item}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {step.links?.length ? (
              <div className="flex flex-wrap gap-2">
                {step.links.map((l) => (
                  <a
                    key={l.href}
                    href={resolveHref(l.href)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {step.tssGate && !tssVariant ? (
          // Full-page gate: payer vs non-payer decides which form loads (and
          // presets the folder build + customer doc payer status).
          <div className="rounded-xl border border-indigo-200 bg-white px-6 py-10 text-center">
            <div className="text-base font-semibold text-slate-900">Is this customer a TSS payer or non-payer?</div>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Your selection loads the matching form, presets the customer folder build, and is saved onto the
              customer record.
            </p>
            <div className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => chooseTssVariant("payer")}
                className="flex-1 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 text-sm font-bold text-indigo-700 hover:border-indigo-400 hover:bg-indigo-100"
              >
                Payer
                <span className="mt-1 block text-[11px] font-medium text-indigo-400">Medicaid / payer source</span>
              </button>
              <button
                type="button"
                onClick={() => chooseTssVariant("nonpayer")}
                className="flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              >
                Non-payer
                <span className="mt-1 block text-[11px] font-medium text-slate-400">Sliding fee acknowledgement</span>
              </button>
            </div>
          </div>
        ) : step.tssGate || step.form ? (
          <div className="space-y-2">
            {step.tssGate && tssVariant ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-slate-700">
                  TSS variant: <span className={tssVariant === "payer" ? "text-indigo-600" : "text-slate-600"}>{tssVariant === "payer" ? "Payer" : "Non-payer"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => chooseTssVariant(tssVariant === "payer" ? "nonpayer" : "payer")}
                  className="font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Switch to {tssVariant === "payer" ? "Non-payer" : "Payer"}
                </button>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <JotformEmbed
                  formId={
                    step.tssGate
                      ? tssVariant === "payer"
                        ? step.tssGate.payerFormId
                        : step.tssGate.nonpayerFormId
                      : step.form!.id
                  }
                  title={step.title}
                  onSubmitted={handleSubmitted}
                />
              </div>
              {webhooksSidebar ? null : <ReferencePanel className="lg:w-80 lg:shrink-0" />}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDone(step.key, true);
              if (next) setView({ kind: "step", idx: idx + 1 });
              else setView({ kind: "list" });
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Mark complete {next ? "& continue →" : "✓"}
          </button>
        )}
        {nav}
        {createModal}
      </div>
    );
  }

  // ── Open non-flow form ─────────────────────────────────────────────────
  if (view.kind === "form") {
    const f = view.form;
    return withSidebar(
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView({ kind: "list" })}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Back to {heading}
        </button>
        {persistentContext}
        {!showCreditCards && f.showCreditCards ? <CreditCardCards /> : null}
        <h2 className="text-base font-semibold text-slate-900">{f.title}</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <JotformEmbed formId={f.id} title={f.title} />
          </div>
          {webhooksSidebar ? null : <ReferencePanel className="lg:w-80 lg:shrink-0" />}
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────
  return withSidebar(
    <div className="space-y-4">
      {persistentContext}
      <div>
        <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>

      {steps.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">
              Flow steps
              <span className="ml-2 text-xs font-medium text-slate-400">
                {doneCount} of {steps.length} complete{customer ? ` · ${customer.name}` : " · no customer selected"}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {doneCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Reset intake flow progress" + (customer ? ` for ${customer.name}` : "") + "?")) {
                      updateProgress(() => EMPTY_PROGRESS);
                    }
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Reset
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setView({ kind: "step", idx: firstOpen === -1 ? 0 : firstOpen })}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                {doneCount === 0 ? "Start intake flow →" : firstOpen === -1 ? "Review flow →" : `Resume at step ${firstOpen + 1} →`}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={s.key} className="space-y-1.5">
                {s.section ? (
                  <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.section}</div>
                ) : null}
                <StepRow
                  step={s}
                  index={i}
                  done={!!progress.done[s.key]}
                  onOpen={() => setView({ kind: "step", idx: i })}
                  onSend={setSendForm}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {extraForms.length > 0 ? (
        <div className="space-y-2">
          {steps.length > 0 ? <h3 className="text-sm font-semibold text-slate-700">More forms</h3> : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {extraForms.map((f) => (
              <FormRow key={f.id} form={f} onOpen={(form) => setView({ kind: "form", form })} onSend={setSendForm} />
            ))}
          </div>
        </div>
      ) : steps.length === 0 && forms.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No forms in this category yet.
        </div>
      ) : null}

      {resources?.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Resources</h3>
          <div className="flex flex-wrap gap-2">
            {resources.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {r.label} ↗
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {sendForm ? <SendToCustomerModal form={sendForm} onClose={() => setSendForm(null)} /> : null}
      {createModal}
    </div>
  );
}

function StepRow({
  step,
  index,
  done,
  onOpen,
  onSend,
}: {
  step: ResolvedStep;
  index: number;
  done: boolean;
  onOpen: () => void;
  onSend: (f: FormDef) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
        }`}
      >
        {done ? "✓" : index + 1}
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {step.title}
          {step.optional ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 no-underline">optional</span> : null}
        </span>
        <span className="block truncate text-[11px] text-slate-400">
          {step.note ?? (step.form ? `${step.form.submissions} submissions · form ${step.form.id}` : "Task")}
        </span>
      </button>
      {step.form?.customerSendable ? (
        <button
          type="button"
          onClick={() => step.form && onSend(step.form)}
          className="shrink-0 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          Send to customer
        </button>
      ) : null}
      {step.form ? (
        <a
          href={`https://form.jotform.com/${step.form.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the live form in a new tab"
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          New tab ↗
        </a>
      ) : null}
      <button type="button" onClick={onOpen} className="shrink-0 text-xs font-semibold text-indigo-600">
        Open →
      </button>
    </div>
  );
}

function FormRow({
  form: f,
  onOpen,
  onSend,
}: {
  form: FormDef;
  onOpen: (f: FormDef) => void;
  onSend: (f: FormDef) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40">
      <button type="button" onClick={() => onOpen(f)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-slate-900">{f.title}</span>
        <span className="block text-[11px] text-slate-400">{f.submissions} submissions · form {f.id}</span>
      </button>
      {f.customerSendable ? (
        <button
          type="button"
          onClick={() => onSend(f)}
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
      <button type="button" onClick={() => onOpen(f)} className="shrink-0 text-xs font-semibold text-indigo-600">
        Open →
      </button>
    </div>
  );
}
