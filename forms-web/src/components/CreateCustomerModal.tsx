import { useEffect, useMemo, useState } from "react";
import {
  loadCustomers,
  createCustomer,
  type FormsCustomer,
  type CreateCustomerResp,
} from "@/lib/customersApi";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentCustomer } from "@/context/CurrentCustomer";

// Super-simple create/link customer flow for intake. Name + DOB + CWID + case
// managers (caller is assumed primary). Live matches against the cached customer
// index double as the "link existing" path; the backend enforces a duplicate
// guard (CWID / name+DOB) as the bomber backstop and builds + links the Google
// Drive folder with the same gdrive functions the web app uses.

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

export function CreateCustomerModal({
  onClose,
  /** Preselect the Medicaid/TSS-payer variant (e.g. from the intake TSS gate). */
  presetMedicaid,
}: {
  onClose: () => void;
  presetMedicaid?: "yes" | "no";
}) {
  const { user } = useAuth();
  const { setCustomer } = useCurrentCustomer();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [cwId, setCwId] = useState("");
  const [cm, setCm] = useState(user?.displayName ?? "");
  const [cm2, setCm2] = useState("");
  const [medicaid, setMedicaid] = useState<"not_sure" | "yes" | "no">(presetMedicaid ?? "not_sure");
  const [buildDrive, setBuildDrive] = useState(true);

  const [all, setAll] = useState<FormsCustomer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);
  const [created, setCreated] = useState<CreateCustomerResp | null>(null);

  useEffect(() => {
    let alive = true;
    loadCustomers().then((rows) => { if (alive) setAll(rows); });
    return () => { alive = false; };
  }, []);

  // Live "already exists?" matches — this is also the link-existing path.
  const matches = useMemo(() => {
    if (!all) return [];
    const f = first.trim().toLowerCase();
    const l = last.trim().toLowerCase();
    const cw = cwId.trim().toLowerCase();
    if (!cw && f.length + l.length < 3) return [];
    return all
      .filter((c) => {
        const n = c.name.toLowerCase();
        if (cw && (c.cwId ?? "").toLowerCase() === cw) return true;
        return !!(f || l) && (!f || n.includes(f)) && (!l || n.includes(l));
      })
      .slice(0, 5);
  }, [all, first, last, cwId]);

  const link = (c: FormsCustomer) => {
    setCustomer(c);
    onClose();
  };

  const submit = async (force = false) => {
    if (!first.trim() || !last.trim()) {
      setError("First and last name are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await createCustomer({
        firstName: first.trim(),
        lastName: last.trim(),
        dob: dob.trim() || undefined,
        cwId: cwId.trim() || undefined,
        caseManagerName: cm.trim() || undefined,
        secondaryCaseManagerName: cm2.trim() || undefined,
        medicaid,
        buildDrive,
        force,
      });
      setCreated(resp);
      setCustomer(resp.customer);
      void loadCustomers(true); // refresh the cached index in the background
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409) {
        setNeedsForce(true);
        setError(
          e.message === "duplicate_cwid"
            ? "A customer with this CWID already exists — link them from the matches below."
            : "A customer with this name + DOB already exists — link them from the matches below."
        );
      } else {
        setError((e as Error)?.message || "Could not create customer.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900">New customer</div>
            <div className="text-xs text-slate-500">Create a customer, or link an existing match.</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <b>{created.customer.name}</b> created and set as the current customer.
            </div>
            {created.drive.built ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Drive folder <b>{created.drive.folderName}</b> built and linked
                {created.drive.workbookLinked ? " (TSS workbook linked)" : ""}.{" "}
                {created.drive.folderUrl ? (
                  <a href={created.drive.folderUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-500">
                    Open folder ↗
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Drive folder was not built ({created.drive.error || created.drive.reason || "skipped"}).
                You can build it later from the web app.
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input label="First name" value={first} onChange={setFirst} autoFocus />
              <Input label="Last name" value={last} onChange={setLast} />
              <Input label="Date of birth" value={dob} onChange={setDob} type="date" />
              <Input label="Caseworthy ID" value={cwId} onChange={setCwId} placeholder="CWID" />
              <Input label="Case manager (primary)" value={cm} onChange={setCm} placeholder="You" />
              <Input label="Secondary case manager" value={cm2} onChange={setCm2} placeholder="Optional" />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={buildDrive} onChange={(e) => setBuildDrive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                Build + link Google Drive folder
              </label>
              {buildDrive ? (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  Medicaid payer?
                  <select
                    value={medicaid}
                    onChange={(e) => setMedicaid(e.target.value as "not_sure" | "yes" | "no")}
                    className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                  >
                    <option value="not_sure">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              ) : null}
            </div>

            {matches.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <div className="mb-1 px-1 text-[11px] font-semibold text-amber-800">
                  Possible existing matches — link instead of creating a duplicate:
                </div>
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => link(c)}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-amber-100"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-800">
                      {c.name}
                      {c.cwId ? <span className="text-slate-400"> · {c.cwId}</span> : null}
                      {c.dob ? <span className="text-slate-400"> · {c.dob}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-indigo-600">Use →</span>
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(false)}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create customer"}
              </button>
              {needsForce ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit(true)}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Create anyway
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
