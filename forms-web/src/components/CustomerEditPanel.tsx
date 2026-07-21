import { useEffect, useState } from "react";
import type { CustomerDetail } from "@/lib/customerDetailApi";
import type { FormsCustomer } from "@/lib/customersApi";
import { updateFormsCustomer } from "@/lib/customersApi";
import { loadUsers, type FormsUser } from "@/lib/usersApi";

type Props = {
  customer: FormsCustomer;
  detail: CustomerDetail | null;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
};

const inputClass = "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function CustomerEditPanel({ customer, detail, onCancel, onSaved }: Props) {
  const [users, setUsers] = useState<FormsUser[]>([]);
  const [name, setName] = useState(detail?.name || customer.name);
  const [cwId, setCwId] = useState(detail?.cwId || customer.cwId || "");
  const [caseManagerId, setCaseManagerId] = useState(detail?.caseManagerId || customer.caseManagerId || "");
  const [population, setPopulation] = useState(detail?.population || "");
  const [status, setStatus] = useState<"active" | "inactive">(detail?.status === "inactive" ? "inactive" : "active");
  const [tier, setTier] = useState(detail?.tier == null ? "" : String(detail.tier));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadUsers().then(setUsers); }, []);

  const save = async () => {
    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateFormsCustomer(customer.id, {
        name: name.trim(),
        cwId: cwId.trim() || null,
        caseManagerId: caseManagerId || null,
        population: (population || null) as "Youth" | "Individual" | "Family" | null,
        status,
        tier: tier ? Number(tier) as 1 | 2 | 3 : null,
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-indigo-100 bg-white px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">Name
          <input value={name} onChange={(event) => setName(event.currentTarget.value)} className={inputClass} autoFocus />
        </label>
        <label className="text-xs font-semibold text-slate-600">CWID
          <input value={cwId} onChange={(event) => setCwId(event.currentTarget.value)} className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Case manager
          <select value={caseManagerId} onChange={(event) => setCaseManagerId(event.currentTarget.value)} className={inputClass}>
            <option value="">No case manager</option>
            {users.map((user) => <option key={user.uid} value={user.uid}>{user.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Population
          <select value={population} onChange={(event) => setPopulation(event.currentTarget.value)} className={inputClass}>
            <option value="">No population</option>
            <option value="Youth">Youth</option>
            <option value="Individual">Individual</option>
            <option value="Family">Family</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Status
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value as "active" | "inactive")} className={inputClass}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Tier
          <select value={tier} onChange={(event) => setTier(event.currentTarget.value)} className={inputClass}>
            <option value="">No tier</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </label>
      </div>
      {error ? <div className="mt-2 text-xs font-medium text-rose-700">Could not save: {error}</div> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={() => void save()} disabled={busy || !name.trim()} className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40">
          {busy ? "Saving…" : "Save customer"}
        </button>
      </div>
    </div>
  );
}
