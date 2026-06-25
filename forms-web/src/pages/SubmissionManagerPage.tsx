import { useEffect, useMemo, useRef, useState } from "react";
import { listForms, listSubmissions, cloneSubmission, type JfForm, type JfSubmission } from "@/lib/jotformManagerApi";
import { getSubmissionLinks, type SubmissionLink } from "@/lib/submissionLinksApi";
import { getSubmissionLabel } from "@/lib/submissionLabel";
import { AnswerView } from "@/components/AnswerView";
import { CustomerLinkButton } from "@/components/CustomerLinkButton";

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function shortId(id: string): string {
  return id.length > 6 ? id.slice(-6) : id;
}

function FormPicker({ forms, value, onChange }: { forms: JfForm[]; value: JfForm | null; onChange: (f: JfForm) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (ql ? forms.filter((f) => f.title.toLowerCase().includes(ql)) : forms).slice(0, 50);
  }, [forms, q]);
  return (
    <div ref={ref} className="relative min-w-0 flex-1 basis-[480px]">
      <input
        value={open ? q : value?.title ?? q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQ(""); }}
        placeholder="Select a form…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? <div className="px-3 py-2 text-xs text-slate-400">No forms.</div> :
            matches.map((f) => (
              <button key={f.id} type="button" onClick={() => { onChange(f); setOpen(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-indigo-50">
                <span className="truncate text-sm text-slate-800">{f.title}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{f.count}</span>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SubmissionManagerPage() {
  const [forms, setForms] = useState<JfForm[]>([]);
  const [form, setForm] = useState<JfForm | null>(null);
  const [subs, setSubs] = useState<JfSubmission[]>([]);
  const [sel, setSel] = useState<JfSubmission | null>(null);
  const [links, setLinks] = useState<Record<string, SubmissionLink>>({});
  const [search, setSearch] = useState("");
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    listForms().then(setForms).catch((e: unknown) => setError((e as Error)?.message || "Failed to load forms.")).finally(() => setLoadingForms(false));
  }, []);

  useEffect(() => {
    if (!form) return;
    setSel(null);
    setSubs([]);
    setLinks({});
    setLoadingSubs(true);
    setError(null);
    listSubmissions(form.id)
      .then(setSubs)
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load submissions."))
      .finally(() => setLoadingSubs(false));
    getSubmissionLinks(form.id).then(setLinks).catch(() => setLinks({}));
  }, [form]);

  const filtered = useMemo(() => {
    const ql = search.trim().toLowerCase();
    if (!ql) return subs;
    return subs.filter((s) => JSON.stringify(s.answers || {}).toLowerCase().includes(ql));
  }, [subs, search]);

  const editClone = async () => {
    if (!form || !sel) return;
    setCloning(true);
    try {
      const { editUrl } = await cloneSubmission(form.id, sel.id);
      window.open(editUrl, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Clone failed.");
    } finally {
      setCloning(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-800">Submission manager</h2>
        <p className="text-xs text-slate-500">Pick a form, search its submissions, view + edit-a-clone.</p>
      </div>

      {loadingForms ? (
        <div className="text-sm text-slate-400">Loading forms…</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <FormPicker forms={forms} value={form} onChange={setForm} />
          {form ? (
            <>
              <a
                href={`https://form.jotform.com/${form.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Submit a form ↗
              </a>
              <a
                href={`https://www.jotform.com/build/${form.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Edit form ↗
              </a>
            </>
          ) : null}
        </div>
      )}

      {error ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {form ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,340px)_1fr]">
          {/* list */}
          <div className="rounded-xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${subs.length} submissions…`}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div className="max-h-[65vh] overflow-auto p-2">
              {loadingSubs ? (
                <div className="px-2 py-6 text-center text-sm text-slate-400">Loading submissions…</div>
              ) : filtered.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-slate-400">No submissions.</div>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map((s) => {
                    const active = sel?.id === s.id;
                    const label = getSubmissionLabel(s) || `Submission ${shortId(s.id)}`;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSel(s)}
                          className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
                            <span className="block truncate text-[11px] text-slate-400">{fmtDate(s.created_at)}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">#{shortId(s.id)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* detail */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            {sel ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{getSubmissionLabel(sel) || `Submission ${shortId(sel.id)}`}</div>
                    <div className="text-[11px] text-slate-400">{form.title} · {fmtDate(sel.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CustomerLinkButton
                      formId={form.id}
                      submissionId={sel.id}
                      recommendName={getSubmissionLabel(sel)}
                      linked={links[sel.id]}
                      onLinked={(l) => setLinks((prev) => ({ ...prev, [sel.id]: l }))}
                    />
                    <a
                      href={`https://www.jotform.com/inbox/${form.id}/${sel.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Open in inbox ↗
                    </a>
                    <button type="button" disabled={cloning} onClick={() => void editClone()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {cloning ? "Cloning…" : "Edit a clone"}
                    </button>
                  </div>
                </div>
                <AnswerView sub={sel} />
              </>
            ) : (
              <div className="py-10 text-center text-sm text-slate-400">Select a submission.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
