import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCurrentCustomer } from "@/context/CurrentCustomer";

type CompletionState = "empty" | "partial" | "complete";

type MemberRow = {
  id: string;
  name: string;
  dob: string;
  relation: string;
  income: string;
};

type BuilderDraft = {
  headOfHousehold: string;
  cwId: string;
  dob: string;
  phone: string;
  email: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  unitAddress: string;
  moveInDate: string;
  monthlyRent: string;
  utilitiesIncluded: string;
  grantProgram: string;
  assistanceStart: string;
  rentAmount: string;
  depositAmount: string;
  arrearsAmount: string;
  utilityAmount: string;
  payee: string;
  notes: string;
  members: MemberRow[];
  docs: Record<string, boolean>;
  updatedAt: string | null;
};

const DOC_ITEMS = [
  "Photo ID",
  "Income documents",
  "Asset documents",
  "Eviction notice",
  "Lease",
  "Landlord verification",
  "Unit eligibility",
  "MOU",
];

function rowId(): string {
  return `member_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyDraft(): BuilderDraft {
  return {
    headOfHousehold: "",
    cwId: "",
    dob: "",
    phone: "",
    email: "",
    landlordName: "",
    landlordEmail: "",
    landlordPhone: "",
    unitAddress: "",
    moveInDate: "",
    monthlyRent: "",
    utilitiesIncluded: "",
    grantProgram: "",
    assistanceStart: "",
    rentAmount: "",
    depositAmount: "",
    arrearsAmount: "",
    utilityAmount: "",
    payee: "",
    notes: "",
    members: [{ id: rowId(), name: "", dob: "", relation: "Head of household", income: "" }],
    docs: {},
    updatedAt: null,
  };
}

function storageKey(customerId: string | null | undefined): string {
  return `hdb:forms:missing-intake-info:${customerId || "no-customer"}`;
}

function loadDraft(key: string): BuilderDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<BuilderDraft>;
    return {
      ...emptyDraft(),
      ...parsed,
      members: Array.isArray(parsed.members) && parsed.members.length ? parsed.members as MemberRow[] : emptyDraft().members,
      docs: parsed.docs && typeof parsed.docs === "object" ? parsed.docs : {},
    };
  } catch {
    return emptyDraft();
  }
}

function completionState(required: Array<string | boolean>, anyFilled: Array<string | boolean>): CompletionState {
  const any = anyFilled.some(Boolean);
  const complete = required.every(Boolean);
  if (!any) return "empty";
  return complete ? "complete" : "partial";
}

function stateClasses(state: CompletionState): string {
  if (state === "complete") return "border-emerald-200 bg-emerald-50/60";
  if (state === "partial") return "border-amber-200 bg-amber-50/70";
  return "border-slate-200 bg-white";
}

function money(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "email" | "tel" | "number";
  placeholder?: string;
}) {
  return (
    <label className="min-w-0 text-sm">
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
      />
    </label>
  );
}

function Section({
  title,
  state,
  children,
}: {
  title: string;
  state: CompletionState;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-3 py-3 transition-colors ${stateClasses(state)}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {state !== "empty" ? (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${state === "complete" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {state}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function summaryLines(draft: BuilderDraft): string[] {
  const amounts = [
    draft.rentAmount ? `Rent: ${money(draft.rentAmount) || draft.rentAmount}` : "",
    draft.depositAmount ? `Deposit: ${money(draft.depositAmount) || draft.depositAmount}` : "",
    draft.arrearsAmount ? `Arrears: ${money(draft.arrearsAmount) || draft.arrearsAmount}` : "",
    draft.utilityAmount ? `Utilities: ${money(draft.utilityAmount) || draft.utilityAmount}` : "",
  ].filter(Boolean);
  const docs = DOC_ITEMS.filter((item) => draft.docs[item]);
  return [
    `Customer: ${draft.headOfHousehold || "not filled"}${draft.cwId ? ` (${draft.cwId})` : ""}`,
    draft.dob ? `DOB: ${draft.dob}` : "",
    draft.phone || draft.email ? `Contact: ${[draft.phone, draft.email].filter(Boolean).join(" / ")}` : "",
    draft.unitAddress ? `Unit: ${draft.unitAddress}` : "",
    draft.landlordName || draft.landlordEmail || draft.landlordPhone
      ? `Landlord: ${[draft.landlordName, draft.landlordEmail, draft.landlordPhone].filter(Boolean).join(" / ")}`
      : "",
    draft.grantProgram ? `Program: ${draft.grantProgram}` : "",
    draft.assistanceStart ? `Assistance start: ${draft.assistanceStart}` : "",
    draft.payee ? `Payee: ${draft.payee}` : "",
    amounts.length ? `Assistance: ${amounts.join(", ")}` : "",
    draft.members.some((m) => m.name.trim())
      ? `Household: ${draft.members.filter((m) => m.name.trim()).map((m) => `${m.name}${m.relation ? ` - ${m.relation}` : ""}`).join("; ")}`
      : "",
    docs.length ? `Documents checked: ${docs.join(", ")}` : "",
    draft.notes ? `Notes: ${draft.notes}` : "",
  ].filter(Boolean);
}

export function MissingIntakeInfoBuilder() {
  const { customer } = useCurrentCustomer();
  const key = storageKey(customer?.id);
  const [draft, setDraft] = useState<BuilderDraft>(() => loadDraft(key));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(loadDraft(key));
    setCopied(false);
  }, [key]);

  useEffect(() => {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* local-only helper */
    }
  }, [draft, key]);

  const identityState = completionState(
    [draft.headOfHousehold, draft.dob],
    [draft.headOfHousehold, draft.cwId, draft.dob, draft.phone, draft.email],
  );
  const housingState = completionState(
    [draft.landlordName, draft.unitAddress, draft.monthlyRent],
    [draft.landlordName, draft.landlordEmail, draft.landlordPhone, draft.unitAddress, draft.moveInDate, draft.monthlyRent],
  );
  const assistanceState = completionState(
    [draft.assistanceStart, draft.payee, draft.rentAmount || draft.depositAmount || draft.arrearsAmount || draft.utilityAmount],
    [draft.grantProgram, draft.assistanceStart, draft.rentAmount, draft.depositAmount, draft.arrearsAmount, draft.utilityAmount, draft.payee],
  );
  const docsState = completionState([DOC_ITEMS.some((item) => draft.docs[item])], DOC_ITEMS.map((item) => draft.docs[item]));
  const summary = useMemo(() => summaryLines(draft), [draft]);

  const update = (patch: Partial<BuilderDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const updateMember = (id: string, patch: Partial<MemberRow>) => {
    setDraft((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  };

  const copySummary = async () => {
    const text = summary.join("\n");
    if (!text) return;
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Missing information builder</div>
          <p className="mt-0.5 text-xs text-slate-500">
            Use this when linked submissions, webhooks, or Jotform answers did not capture enough information.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copySummary}
            disabled={summary.length === 0}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset the missing information draft for this customer?")) setDraft(emptyDraft());
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <Section title="Customer identity" state={identityState}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Head of household" value={draft.headOfHousehold} onChange={(v) => update({ headOfHousehold: v })} placeholder={customer?.name || ""} />
          <Field label="CWID" value={draft.cwId} onChange={(v) => update({ cwId: v })} placeholder={customer?.cwId || ""} />
          <Field label="DOB" type="date" value={draft.dob} onChange={(v) => update({ dob: v })} />
          <Field label="Phone" type="tel" value={draft.phone} onChange={(v) => update({ phone: v })} />
          <Field label="Email" type="email" value={draft.email} onChange={(v) => update({ email: v })} />
        </div>
      </Section>

      <Section title="Household members" state={draft.members.some((m) => m.name.trim()) ? "partial" : "empty"}>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                {["Name", "DOB", "Relation", "Income", ""].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-2 py-1"><input className="w-48 rounded border border-transparent px-1 py-1 outline-none focus:border-indigo-300" value={member.name} onChange={(e) => updateMember(member.id, { name: e.currentTarget.value })} /></td>
                  <td className="px-2 py-1"><input type="date" className="w-36 rounded border border-transparent px-1 py-1 outline-none focus:border-indigo-300" value={member.dob} onChange={(e) => updateMember(member.id, { dob: e.currentTarget.value })} /></td>
                  <td className="px-2 py-1"><input className="w-36 rounded border border-transparent px-1 py-1 outline-none focus:border-indigo-300" value={member.relation} onChange={(e) => updateMember(member.id, { relation: e.currentTarget.value })} /></td>
                  <td className="px-2 py-1"><input className="w-32 rounded border border-transparent px-1 py-1 outline-none focus:border-indigo-300" value={member.income} onChange={(e) => updateMember(member.id, { income: e.currentTarget.value })} /></td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      disabled={draft.members.length === 1}
                      onClick={() => setDraft((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== member.id) }))}
                      className="rounded px-2 py-1 font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setDraft((prev) => ({ ...prev, members: [...prev.members, { id: rowId(), name: "", dob: "", relation: "", income: "" }] }))}
          className="mt-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          + Add member
        </button>
      </Section>

      <Section title="Housing and landlord" state={housingState}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Landlord name" value={draft.landlordName} onChange={(v) => update({ landlordName: v })} />
          <Field label="Landlord email" type="email" value={draft.landlordEmail} onChange={(v) => update({ landlordEmail: v })} />
          <Field label="Landlord phone" type="tel" value={draft.landlordPhone} onChange={(v) => update({ landlordPhone: v })} />
          <Field label="Unit address" value={draft.unitAddress} onChange={(v) => update({ unitAddress: v })} />
          <Field label="Move-in date" type="date" value={draft.moveInDate} onChange={(v) => update({ moveInDate: v })} />
          <Field label="Monthly rent" type="number" value={draft.monthlyRent} onChange={(v) => update({ monthlyRent: v })} />
        </div>
        <label className="mt-3 block text-sm">
          <div className="mb-1 text-xs font-medium text-slate-500">Utilities included / notes</div>
          <input className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" value={draft.utilitiesIncluded} onChange={(e) => update({ utilitiesIncluded: e.currentTarget.value })} />
        </label>
      </Section>

      <Section title="Assistance request" state={assistanceState}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Grant / program" value={draft.grantProgram} onChange={(v) => update({ grantProgram: v })} />
          <Field label="Assistance start" type="date" value={draft.assistanceStart} onChange={(v) => update({ assistanceStart: v })} />
          <Field label="Payee / vendor" value={draft.payee} onChange={(v) => update({ payee: v })} />
          <Field label="Rent amount" type="number" value={draft.rentAmount} onChange={(v) => update({ rentAmount: v })} />
          <Field label="Deposit amount" type="number" value={draft.depositAmount} onChange={(v) => update({ depositAmount: v })} />
          <Field label="Arrears amount" type="number" value={draft.arrearsAmount} onChange={(v) => update({ arrearsAmount: v })} />
          <Field label="Utility amount" type="number" value={draft.utilityAmount} onChange={(v) => update({ utilityAmount: v })} />
        </div>
      </Section>

      <Section title="Documents and notes" state={docsState}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DOC_ITEMS.map((item) => (
            <label key={item} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={draft.docs[item] === true}
                onChange={(e) => setDraft((prev) => ({ ...prev, docs: { ...prev.docs, [item]: e.currentTarget.checked } }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm">
          <div className="mb-1 text-xs font-medium text-slate-500">Notes</div>
          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.currentTarget.value })}
            rows={3}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
        </label>
      </Section>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="mb-2 text-sm font-semibold text-slate-900">Preview</div>
        {summary.length ? (
          <ul className="space-y-1 text-xs text-slate-600">
            {summary.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : (
          <div className="text-xs text-slate-400">No fallback information entered yet.</div>
        )}
      </div>
    </div>
  );
}
