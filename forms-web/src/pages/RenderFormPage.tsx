import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveRenderForm, submitRenderForm, type ResolvedRenderForm } from "@/lib/renderApi";
import { FieldRenderer } from "@/components/FieldRenderer";
import { FormShell, LoadingState, MessageState } from "@/components/ui";

export default function RenderFormPage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<ResolvedRenderForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    resolveRenderForm(token)
      .then(setForm)
      .catch((e: { status?: number; message?: string }) => {
        if (e?.status === 404) setNotFound(true);
        else setError(e?.message || "Could not load form.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const onChange = (qid: string, v: string) => setValues((c) => ({ ...c, [qid]: v }));
  const onFile = (qid: string, f: File | null) =>
    setFiles((c) => {
      const next = { ...c };
      if (f) next[qid] = f; else delete next[qid];
      return next;
    });

  const submit = async () => {
    if (!form || !token) return;
    const missing = form.fields.find((f) => f.required && !(values[f.qid] || files[f.qid]));
    if (missing) {
      setSubmitErr(`Please complete: ${missing.label || missing.name}`);
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const fd = new FormData();
      for (const [qid, v] of Object.entries(values)) if (v !== "") fd.append(`q_${qid}`, v);
      for (const [qid, file] of Object.entries(files)) fd.append(`f_${qid}`, file);
      await submitRenderForm(token, fd);
      setDone(true);
    } catch (e: unknown) {
      setSubmitErr((e as Error)?.message || "Submit failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading form…" />;
  if (notFound) return <MessageState variant="unauthorized" title="Link not found" message="This link is invalid or has been revoked." />;
  if (error || !form) return <MessageState title="Something went wrong" message={error ?? undefined} />;
  if (form.expired) return <MessageState variant="expired" title="Link expired" message="Ask your case manager for a new link." />;
  if (form.submitted || done) return <MessageState variant="info" title="Submitted — thank you" message="Your response has been received. This link can only be used once." />;

  return (
    <FormShell title={form.title || "Form"} subtitle={form.customerName ? `For ${form.customerName}` : undefined}>
      <div className="space-y-4">
        {form.fields.length === 0 ? (
          <div className="text-sm text-slate-500">This form has no fillable fields online.</div>
        ) : (
          form.fields.map((f) => (
            <FieldRenderer key={f.qid} field={f} value={values[f.qid] || ""} onChange={onChange} onFile={onFile} />
          ))
        )}
        {submitErr ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitErr}</div> : null}
        <button
          type="button"
          disabled={submitting || form.fields.length === 0}
          onClick={() => void submit()}
          className="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <p className="text-center text-[11px] text-slate-400">Secure one-time link. Do not share.</p>
      </div>
    </FormShell>
  );
}
