import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCatalog } from "@/hooks/useCatalog";
import { JotformEmbed } from "@/components/JotformEmbed";
import { CreditCardCards } from "@/components/CreditCardCards";
import { formInCategory, type FormDef } from "@/lib/formsCatalog";

// Referrals tab: the common referral forms, embedded. Completing a referral
// that starts a case (Bridging Home, Homelessness Prevention screening) pipes
// straight into the Basic Intake flow.

const PINNED_ORDER = [
  "251346523348053", // Referral to Rental Assistance (Homelessness)
  "253555227407155", // Bridging Home Referral
  "250021786346152", // Referral to Homelessness Prevention Screening
  "260766127603053", // Referral to Family Shelter
  "260345071136045", // Referral to TSS
];

/**
 * Referrals whose submission auto-starts Basic Intake. Defaults — the admin
 * "Follow up with intake flow" checkbox (followUpIntake) extends this at runtime.
 */
const PIPE_TO_INTAKE_DEFAULTS = [
  "251346523348053", // Referral to Rental Assistance
  "253555227407155", // Bridging Home Referral
  "250021786346152", // Referral to Homelessness Prevention Screening (eviction prevention)
  "260345071136045", // Referral to TSS
];

export default function ReferralsPage() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const timer = useRef<number | null>(null);

  const forms = useMemo(() => {
    // Pinned forms resolve by id from the FULL catalog so an admin rename or
    // re-categorization never knocks them off this page.
    const byId = new Map(catalog.map((f) => [f.id, f]));
    const pinned = new Set(PINNED_ORDER);
    return [
      ...PINNED_ORDER.map((id) => byId.get(id)).filter((f): f is FormDef => !!f),
      ...catalog.filter((f) => formInCategory(f, "referral") && !pinned.has(f.id)),
    ];
  }, [catalog]);

  // Hardcoded defaults ∪ the admin "Follow up with intake flow" flag.
  const pipeToIntake = useMemo(() => {
    const s = new Set(PIPE_TO_INTAKE_DEFAULTS);
    for (const f of catalog) {
      if (f.followUpIntake === true) s.add(f.id);
      else if (f.followUpIntake === false) s.delete(f.id); // admin explicitly off
    }
    return s;
  }, [catalog]);

  // ?open=formId (landing page "Open") auto-opens that referral embedded.
  const [params] = useSearchParams();
  const openParam = params.get("open");
  const autoOpened = useRef(false);
  useEffect(() => {
    if (openParam && !autoOpened.current && forms.length) {
      const f = forms.find((x) => x.id === openParam);
      if (f) {
        autoOpened.current = true;
        setSelected(f);
      }
    }
  }, [openParam, forms]);

  const selectedId = selected?.id ?? null;
  const pipesToIntake = !!selectedId && pipeToIntake.has(selectedId);

  // New form opened: clear the submitted banner + any pending auto-navigation.
  useEffect(() => {
    setSubmitted(false);
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, [selectedId]);
  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const startIntake = useCallback(() => navigate("/staff/intake?start=basic"), [navigate]);

  const onSubmittedCb = useCallback(() => {
    setSubmitted(true);
    if (selectedId && pipeToIntake.has(selectedId) && timer.current == null) {
      timer.current = window.setTimeout(() => navigate("/staff/intake?start=basic"), 2500);
    }
  }, [selectedId, navigate, pipeToIntake]);

  if (selected) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Back to referrals
        </button>
        <h2 className="text-base font-semibold text-slate-900">{selected.title}</h2>
        {pipesToIntake && !submitted ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Submitting this referral continues into the Basic Intake flow automatically.
          </div>
        ) : null}
        {submitted && pipesToIntake ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>✓ Referral submitted — starting Basic Intake…</span>
            <button
              type="button"
              onClick={startIntake}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Start Basic Intake now →
            </button>
          </div>
        ) : null}
        {selected.showCreditCards ? <CreditCardCards /> : null}
        <JotformEmbed formId={selected.id} title={selected.title} onSubmitted={onSubmittedCb} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Referrals</h2>
        <p className="text-sm text-slate-500">
          Bridging Home and Homelessness Prevention referrals continue into Basic Intake after submission.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {forms.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <button type="button" onClick={() => setSelected(f)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {f.title}
                {pipeToIntake.has(f.id) ? (
                  <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">→ intake</span>
                ) : null}
              </span>
              <span className="block text-[11px] text-slate-400">{f.submissions} submissions · form {f.id}</span>
            </button>
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
    </div>
  );
}
