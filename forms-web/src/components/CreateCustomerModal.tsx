import { useEffect, useMemo, useState } from "react";
import {
  loadCustomers,
  createCustomer,
  type FormsCustomer,
  type CreateCustomerResp,
} from "@/lib/customersApi";
import { loadUsers, type FormsUser } from "@/lib/usersApi";
import { listWebhookEventDetails } from "@/lib/webhookDetailsApi";
import { extractHousehold } from "@/lib/householdExtract";
import { INTAKE_FLOW, formById } from "@/lib/formsCatalog";
import { ApiError } from "@/lib/api";
import {
  linkIndexedFolder,
  loadDriveReadinessInputs,
  matchingFolders,
  type DriveFolderIndexEntry,
} from "@/lib/driveReadinessApi";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { ExternalServiceIcon } from "./ui";

// Super-simple create/link customer flow for intake. Name + DOB + CWID + case
// managers (dropdowns from the org user list; caller preselected as primary).
// Live matches against the cached customer index double as the "link existing"
// path; the backend enforces a duplicate guard (CWID / name+DOB) and builds +
// links the Google Drive folder with the same gdrive functions the web app
// uses. Name / DOB / CWID prefill from this session's intake webhooks.

const SESSION_KEY = "hdb:forms:webhooks-session-start";

function sessionStartISO(): string {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (v) return v;
  } catch { /* ignore */ }
  // Sidebar not mounted yet this tab — fall back to a recent window.
  return new Date(Date.now() - 4 * 3600_000).toISOString();
}

/** Normalize assorted DOB formats to the date input's YYYY-MM-DD. */
function toISODate(v: string): string | null {
  const s = v.trim();
  const pad = (x: string) => x.padStart(2, "0");
  const mdy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (mdy) return `${mdy[3]}-${pad(mdy[1])}-${pad(mdy[2])}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(String(d.getMonth() + 1))}-${pad(String(d.getDate()))}`;
}

/** "Last, First" or "First [Middle] Last" → { first, last }. */
function splitName(full: string): { first: string; last: string } | null {
  const s = full.trim().replace(/\s{2,}/g, " ");
  if (!s) return null;
  if (s.includes(",")) {
    const [last, first] = s.split(",").map((x) => x.trim());
    if (first && last) return { first, last };
  }
  const parts = s.split(" ");
  if (parts.length < 2) return null;
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus = false,
  hint = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Highlight as prefilled-from-webhooks. */
  hint?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        {hint ? <span className="ml-1 normal-case text-indigo-400">· from webhooks</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
          hint ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"
        }`}
      />
    </label>
  );
}

function CmSelect({
  label,
  users,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  users: FormsUser[];
  value: string; // uid, or "" for none
  onChange: (uid: string) => void;
  allowNone?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
      >
        {allowNone ? <option value="">— None —</option> : null}
        {users.map((u) => (
          <option key={u.uid} value={u.uid}>{u.name}</option>
        ))}
      </select>
    </label>
  );
}

type ContactRow = { uid: string; role: string };

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
  const [medicaid, setMedicaid] = useState<"not_sure" | "yes" | "no">(presetMedicaid ?? "not_sure");
  const [buildDrive, setBuildDrive] = useState(true);

  // CM selects — dropdowns when the org user list loads; free-text fallback otherwise.
  const [users, setUsers] = useState<FormsUser[] | null>(null);
  const [cmUid, setCmUid] = useState("");
  const [cm2Uid, setCm2Uid] = useState("");
  const [cmText, setCmText] = useState(user?.displayName ?? "");
  const [cm2Text, setCm2Text] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const [all, setAll] = useState<FormsCustomer[] | null>(null);
  const [indexedFolders, setIndexedFolders] = useState<DriveFolderIndexEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);
  const [created, setCreated] = useState<CreateCustomerResp | null>(null);
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadCustomers().then((rows) => { if (alive) setAll(rows); });
    loadUsers().then((rows) => {
      if (!alive) return;
      setUsers(rows);
      // Preselect the signed-in user as primary CM.
      if (rows.length && user?.email) {
        const me = rows.find((u) => (u.email ?? "").toLowerCase() === user.email!.toLowerCase());
        if (me) setCmUid((cur) => cur || me.uid);
      }
    });
    loadDriveReadinessInputs()
      .then((inputs) => { if (alive) setIndexedFolders(inputs.folders); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill name / DOB / CWID from this session's intake webhooks — only into
  // fields the user hasn't touched yet.
  useEffect(() => {
    let alive = true;
    const flowIds = INTAKE_FLOW.map((s) => s.formId).filter((x): x is string => !!x);
    const start = sessionStartISO();
    listWebhookEventDetails(flowIds, 60, { sinceISO: start })
      .then((events) => {
        if (!alive) return;
        const session = events.filter((e) => (e.receivedAtISO || "") >= start);
        if (!session.length) return;
        const hh = extractHousehold(session, (id) => formById(id)?.title || `Form ${id}`);
        const slot = (k: string) => hh.slots.find((s) => s.key === k)?.found?.value ?? "";
        const marks = new Set<string>();

        const name = splitName(slot("hohName"));
        setFirst((cur) => (cur || !name ? cur : (marks.add("first"), name.first)));
        setLast((cur) => (cur || !name ? cur : (marks.add("last"), name.last)));

        const isoDob = slot("dob") ? toISODate(slot("dob")) : null;
        setDob((cur) => (cur || !isoDob ? cur : (marks.add("dob"), isoDob)));

        const cw = slot("cwId");
        setCwId((cur) => (cur || !cw ? cur : (marks.add("cwId"), cw)));

        if (marks.size) setPrefilled(marks);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const usersById = useMemo(() => new Map((users ?? []).map((u) => [u.uid, u])), [users]);
  const hasUserList = !!users?.length;

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

  const folderMatches = useMemo(() => {
    if (!first.trim() || !last.trim()) return [];
    const draft: FormsCustomer = {
      id: "",
      name: `${first.trim()} ${last.trim()}`,
      caseManagerName: null,
      cwId: cwId.trim() || null,
      dob: dob.trim() || null,
    };
    return matchingFolders(draft, null, indexedFolders);
  }, [dob, first, indexedFolders, last, cwId]);
  const indexedFolder = folderMatches[0] ?? null;

  const link = (c: FormsCustomer) => {
    setCustomer(c);
    onClose();
  };

  const addContact = () => setContacts((cur) => (cur.length >= 3 ? cur : [...cur, { uid: "", role: "" }]));
  const setContact = (i: number, patch: Partial<ContactRow>) =>
    setContacts((cur) => cur.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeContact = (i: number) => setContacts((cur) => cur.filter((_, idx) => idx !== i));

  const submit = async (force = false) => {
    if (!first.trim() || !last.trim()) {
      setError("First and last name are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const primary = usersById.get(cmUid);
      const secondary = usersById.get(cm2Uid);
      const reuseIndexedFolder = buildDrive ? indexedFolder : null;
      const resp = await createCustomer({
        firstName: first.trim(),
        lastName: last.trim(),
        dob: dob.trim() || undefined,
        cwId: cwId.trim() || undefined,
        caseManagerName: hasUserList ? primary?.name : cmText.trim() || undefined,
        caseManagerId: hasUserList ? primary?.uid : undefined,
        secondaryCaseManagerName: hasUserList ? secondary?.name : cm2Text.trim() || undefined,
        secondaryCaseManagerId: hasUserList ? secondary?.uid : undefined,
        otherContacts: contacts
          .filter((c) => c.uid && c.uid !== cmUid && c.uid !== cm2Uid)
          .map((c) => ({
            uid: c.uid,
            name: usersById.get(c.uid)?.name,
            role: c.role.trim() || undefined,
          })),
        medicaid,
        buildDrive: buildDrive && !reuseIndexedFolder,
        force,
      });
      if (reuseIndexedFolder) {
        const variant = medicaid === "yes" ? "payer" : "nonpayer";
        try {
          await linkIndexedFolder(resp.customer.id, reuseIndexedFolder, variant);
          resp.drive = {
            built: true,
            reused: true,
            folderUrl: reuseIndexedFolder.url,
            folderName: reuseIndexedFolder.name,
            workbookLinked: !!reuseIndexedFolder.tssWorkbookId,
          };
        } catch (linkError) {
          resp.drive = {
            built: false,
            reused: true,
            folderUrl: reuseIndexedFolder.url,
            folderName: reuseIndexedFolder.name,
            linkError: (linkError as Error)?.message || "folder_link_failed",
          };
        }
      }
      setCreated(resp);
      setCustomer(resp.customer);
      void loadCustomers(true); // refresh the cached index in the background
      void loadDriveReadinessInputs(true);
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
                Drive folder <b>{created.drive.folderName}</b> {created.drive.reused ? "reused from the organization index" : "built"}
                {created.drive.linkError ? " (linking failed — fix from the web app)" : " and linked"}
                {created.drive.workbookLinked ? " (TSS workbook linked)" : ""}.{" "}
                {created.drive.folderUrl ? (
                  <a href={created.drive.folderUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ExternalServiceIcon href={created.drive.folderUrl} />
                      Open folder
                    </span>
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
              <Input label="First name" value={first} onChange={setFirst} autoFocus hint={prefilled.has("first")} />
              <Input label="Last name" value={last} onChange={setLast} hint={prefilled.has("last")} />
              <Input label="Date of birth" value={dob} onChange={setDob} type="date" hint={prefilled.has("dob")} />
              <Input label="Caseworthy ID" value={cwId} onChange={setCwId} placeholder="CWID" hint={prefilled.has("cwId")} />
              {hasUserList ? (
                <>
                  <CmSelect label="Case manager (primary)" users={users!} value={cmUid} onChange={setCmUid} allowNone />
                  <CmSelect label="Secondary case manager" users={users!} value={cm2Uid} onChange={setCm2Uid} allowNone />
                </>
              ) : (
                <>
                  <Input label="Case manager (primary)" value={cmText} onChange={setCmText} placeholder="You" />
                  <Input label="Secondary case manager" value={cm2Text} onChange={setCm2Text} placeholder="Optional" />
                </>
              )}
            </div>

            {hasUserList ? (
              <div className="space-y-1.5">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={c.uid}
                      onChange={(e) => setContact(i, { uid: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— Select contact —</option>
                      {users!.map((u) => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                    <input
                      value={c.role}
                      onChange={(e) => setContact(i, { role: e.target.value })}
                      placeholder="Role (optional)"
                      className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <button type="button" onClick={() => removeContact(i)} className="text-slate-300 hover:text-rose-500">✕</button>
                  </div>
                ))}
                {contacts.length < 3 ? (
                  <button type="button" onClick={addContact} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                    + Add other contact
                  </button>
                ) : null}
              </div>
            ) : null}

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

            {buildDrive && folderMatches.length ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <b>Existing Drive folder found:</b> {indexedFolder?.name}.
                Creating the customer will reuse and link this indexed folder
                {indexedFolder?.tssWorkbookId ? " and its TSS workbook" : ""}, avoiding a duplicate.
                {folderMatches.length > 1 ? ` ${folderMatches.length} matching folders were found; the first active match will be used.` : ""}
              </div>
            ) : null}

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
