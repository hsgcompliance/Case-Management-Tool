import { useEffect, useState } from "react";
import { listFormsRegistry, updateForm } from "@/lib/formsRegistryApi";
import { mergeWithRegistry, type FormDef, type FormCategory } from "@/lib/formsCatalog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getFormSchema, type FormFieldDef } from "@/lib/formSchemaApi";

const CATEGORIES: FormCategory[] = ["purchases", "intake", "referral", "other"];

function FieldInspector({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<FormFieldDef[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && fields === null && !loading) {
      setLoading(true);
      getFormSchema(formId).then(setFields).catch(() => setFields([])).finally(() => setLoading(false));
    }
  };

  return (
    <div className="mt-1">
      <button type="button" onClick={toggle} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500">
        {open ? "Hide fields" : "Inspect fields"}
      </button>
      {open ? (
        loading ? (
          <div className="mt-1 text-[11px] text-slate-400">Loading schema…</div>
        ) : !fields || fields.length === 0 ? (
          <div className="mt-1 text-[11px] text-slate-400">No fields (or schema unavailable).</div>
        ) : (
          <div className="mt-1 max-h-48 overflow-auto rounded border border-slate-100 bg-slate-50 p-2">
            {fields.map((f) => (
              <div key={f.qid} className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
                <span className="min-w-0 truncate text-slate-700">{f.label || f.name}{f.required ? " *" : ""}</span>
                <span className="shrink-0 font-mono text-slate-400">{f.type.replace("control_", "")}{f.options.length ? `(${f.options.length})` : ""}</span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

const FLAG_DEFS = [
  { key: "customerSendable", label: "Send to customer", hint: "Allow minting one-time customer links (QR / URL)." },
  { key: "notifyOnSubmit", label: "Notify on submit", hint: "Show new submissions in the header notification bell (last 7 days)." },
  { key: "followUpIntake", label: "Follow up with intake flow", hint: "Submitting this form continues into Basic Intake." },
  { key: "buildHousehold", label: "Build household model", hint: "Feed this form's webhooks into the household info sidebar." },
  { key: "showCreditCards", label: "Show credit card spending", hint: "Show the card spend tiles when this form is open." },
] as const;

type FlagKey = (typeof FLAG_DEFS)[number]["key"];

function AdminFormRow({ form, onSaved }: { form: FormDef; onSaved: () => void }) {
  const initialCats = form.categories?.length ? form.categories : [form.category];
  const initialFlags: Record<FlagKey, boolean> = {
    customerSendable: !!form.customerSendable,
    notifyOnSubmit: !!form.notifyOnSubmit,
    followUpIntake: !!form.followUpIntake,
    buildHousehold: !!form.buildHousehold,
    showCreditCards: !!form.showCreditCards,
  };

  const [title, setTitle] = useState(form.title);
  const [cats, setCats] = useState<FormCategory[]>(initialCats);
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>(initialFlags);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty =
    title !== form.title ||
    cats.join(",") !== initialCats.join(",") ||
    FLAG_DEFS.some((f) => flags[f.key] !== initialFlags[f.key]);

  const toggleCat = (c: FormCategory) => {
    setCats((cur) => {
      const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
      return next.length ? next : cur; // at least one category stays selected
    });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await updateForm(form.id, { title: title.trim(), categories: cats, ...flags });
      onSaved();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Save failed (admin only).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Form ${form.id}`}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          {/* Multi-select categories: a form can live on several pages. */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {on ? "✓ " : ""}{c}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-400">form {form.id} · {form.submissions} submissions</div>
          <FieldInspector formId={form.id} />
        </div>

        <div className="w-56 shrink-0 space-y-1">
          {FLAG_DEFS.map((f) => (
            <label key={f.key} title={f.hint} className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={flags[f.key]}
                onChange={(e) => setFlags((cur) => ({ ...cur, [f.key]: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
              />
              {f.label}
            </label>
          ))}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {err ? <div className="mt-1 text-[11px] text-rose-600">{err}</div> : null}
    </div>
  );
}

export default function AdminFormsPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [forms, setForms] = useState<FormDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    listFormsRegistry(true)
      .then((reg) => setForms(mergeWithRegistry(reg)))
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load forms."));
  };

  useEffect(load, []);

  if (adminLoading) return <div className="text-sm text-slate-400">Checking access…</div>;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Admin only. Ask an administrator for access.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-800">Forms admin</h2>
        <p className="text-xs text-slate-500">Set each form's title, which page it appears on, and whether it can be sent to customers.</p>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : !forms ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {forms.map((f) => <AdminFormRow key={f.id} form={f} onSaved={load} />)}
        </div>
      )}
    </div>
  );
}
