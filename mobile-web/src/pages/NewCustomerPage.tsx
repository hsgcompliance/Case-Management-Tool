import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useOrgCustomers } from "@/hooks/useCustomers";
import { useGrants, type Grant } from "@/hooks/useGrants";
import { useCreateCustomer } from "@/hooks/useCreateCustomer";
import { useEnrollCustomer } from "@/hooks/useEnrollCustomer";
import { findDuplicates, DUP_WARN_THRESHOLD, type DupMatch, type DupCandidate, type DupTier } from "@/lib/duplicateScore";

type Step = 1 | 2 | 3 | 4;
// "dupe" is an interstitial between step 1 and 2 — not a numbered step
type SubView = "form" | "dupe";
type Population = "Youth" | "Individual" | "Family" | "";

interface EnrollmentDraft {
  grant: Grant;
  startDate: string;
  endDate: string;
}

const TIER_LABEL: Record<DupTier, string> = {
  "exact-cwid":    "CW ID Match",
  "exact-all":     "Exact Match",
  "name-dob-year": "Strong Match",
  "name-only":     "Name Match",
  "last-dob":      "Last + DOB",
  "first-dob":     "First + DOB",
  "dob-only":      "DOB Match",
  "fuzzy-name":    "Similar Name",
};

const TIER_COLOR: Record<DupTier, string> = {
  "exact-cwid":    "bg-red-100 text-red-800",
  "exact-all":     "bg-red-100 text-red-800",
  "name-dob-year": "bg-orange-100 text-orange-800",
  "name-only":     "bg-orange-100 text-orange-800",
  "last-dob":      "bg-amber-100 text-amber-800",
  "first-dob":     "bg-amber-100 text-amber-800",
  "dob-only":      "bg-yellow-100 text-yellow-800",
  "fuzzy-name":    "bg-sky-100 text-sky-800",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDriveFolderId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  const byFolders = s.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolders) return byFolders;
  const byQuery = s.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  if (/^[-\w]{20,}$/.test(s)) return s;
  return null;
}

function formatDob(dob?: string | null): string {
  if (!dob) return "—";
  const parts = dob.slice(0, 10).split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return dob;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ step, total }: { step: Step; total: number }) {
  const labels: Record<Step, string> = {
    1: "Customer basics",
    2: "Case management",
    3: "Programs",
    4: "Drive folder",
  };
  return (
    <div className="mb-5">
      <div className="flex gap-1.5 mb-3">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-indigo-600" : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400 font-medium">Step {step} of {total}</p>
      <h2 className="text-xl font-bold text-slate-900 mt-0.5">{labels[step]}</h2>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors placeholder:text-slate-400";

const selectCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors";

// ─── Dupe check interstitial ──────────────────────────────────────────────────

function DupeMatchRow({ match, onView }: { match: DupMatch<DupCandidate>; onView: (id: string) => void }) {
  const isHigh = match.score >= DUP_WARN_THRESHOLD;
  const name = [match.customer.firstName, match.customer.lastName].filter(Boolean).join(" ") || match.customer.name || "(Unnamed)";
  return (
    <div className={`rounded-2xl border p-3.5 ${isHigh ? "border-orange-200 bg-orange-50" : "border-slate-100 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900">{name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_COLOR[match.tier]}`}>
              {TIER_LABEL[match.tier]} — {match.score}%
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>DOB: {formatDob(match.customer.dob)}</span>
            {match.customer.cwId && <span>CW ID: {match.customer.cwId}</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-400 italic">{match.reasons.join(" · ")}</p>
        </div>
        <button
          type="button"
          onClick={() => onView(match.customer.id)}
          className="flex-shrink-0 text-xs font-semibold text-indigo-600 active:text-indigo-800 px-2 py-1"
        >
          View ↗
        </button>
      </div>
    </div>
  );
}

interface DupeCheckViewProps {
  matches: DupMatch<DupCandidate>[];
  overrideConfirmed: boolean;
  onOverride: () => void;
  onContinue: () => void;
  onBack: () => void;
  onView: (id: string) => void;
}

function DupeCheckView({ matches, overrideConfirmed, onOverride, onContinue, onBack, onView }: DupeCheckViewProps) {
  const hasHigh = matches.some((m) => m.score >= DUP_WARN_THRESHOLD);
  const blocked = hasHigh && !overrideConfirmed;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-100 pt-safe-top flex-shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-900">Possible Duplicates</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className={`rounded-2xl border p-4 mb-4 ${hasHigh ? "border-orange-200 bg-orange-50" : "border-amber-100 bg-amber-50"}`}>
          <p className={`text-sm font-semibold ${hasHigh ? "text-orange-800" : "text-amber-800"}`}>
            {matches.length} potential match{matches.length !== 1 ? "es" : ""} found
          </p>
          <p className={`text-xs mt-1 ${hasHigh ? "text-orange-700" : "text-amber-700"}`}>
            {hasHigh
              ? "One or more records closely match this customer. Review before continuing."
              : "Similar records exist. Review them before continuing."}
          </p>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {matches.map((m) => (
            <DupeMatchRow key={m.customer.id} match={m} onView={onView} />
          ))}
        </div>

        {hasHigh && !overrideConfirmed && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">High similarity detected</p>
            <p className="text-xs text-red-700 mt-1">
              Please confirm you've reviewed the matches above and this is a new, distinct customer.
            </p>
            <button
              type="button"
              onClick={onOverride}
              className="mt-3 w-full rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-700 active:bg-red-100 transition-colors"
            >
              I've reviewed — continue anyway
            </button>
          </div>
        )}

        {overrideConfirmed && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Override confirmed — proceeding as new customer.
          </div>
        )}
      </div>

      <div className="bg-white border-t border-slate-100 px-4 pb-safe-bottom pt-3 flex-shrink-0">
        <button
          type="button"
          disabled={blocked}
          onClick={onContinue}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-40 active:bg-indigo-700 transition-colors"
        >
          {blocked ? "Confirm override above to continue" : "Continue — Create new customer"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NewCustomerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: orgCustomers = [] } = useOrgCustomers(user);
  const { data: grants = [], isLoading: loadingGrants } = useGrants(user);
  const createCustomer = useCreateCustomer(user);
  const enrollCustomer = useEnrollCustomer();

  const knownCMs = useMemo(() => {
    const seen = new Map<string, string>();
    if (user?.uid && user.displayName) seen.set(user.uid, user.displayName);
    for (const c of orgCustomers) {
      if (c.caseManagerId && c.caseManagerName) seen.set(c.caseManagerId, c.caseManagerName);
      if (c.secondaryCaseManagerId && c.secondaryCaseManagerName)
        seen.set(c.secondaryCaseManagerId, c.secondaryCaseManagerName);
    }
    return [...seen.entries()]
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgCustomers, user?.uid, user?.displayName]);

  const [step, setStep] = useState<Step>(1);
  const [subView, setSubView] = useState<SubView>("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Dupe check state
  const [dupeMatches, setDupeMatches] = useState<DupMatch<DupCandidate>[]>([]);
  const [dupeOverride, setDupeOverride] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [cwId, setCwId] = useState("");
  const [hmisId, setHmisId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Step 2
  const [population, setPopulation] = useState<Population>("");
  const [isMeCM, setIsMeCM] = useState(true);
  const [primaryCMId, setPrimaryCMId] = useState(user?.uid ?? "");
  const [secondaryCMId, setSecondaryCMId] = useState("");

  // Step 3
  const [grantSearch, setGrantSearch] = useState("");
  const [drafts, setDrafts] = useState<EnrollmentDraft[]>([]);

  // Step 4
  const [driveUrl, setDriveUrl] = useState("");
  const [enrolledCount, setEnrolledCount] = useState(0);

  const canStep1 = firstName.trim().length > 0 && lastName.trim().length > 0;
  const canStep2 = !!population;
  const canStep3 = drafts.length > 0;
  const driveFolderId = parseDriveFolderId(driveUrl);

  const resolvedCMId = isMeCM ? (user?.uid ?? "") : primaryCMId;
  const resolvedCMName = isMeCM
    ? (user?.displayName ?? "")
    : knownCMs.find((cm) => cm.uid === primaryCMId)?.name ?? "";
  const secondaryCMName = knownCMs.find((cm) => cm.uid === secondaryCMId)?.name ?? "";

  const filteredGrants = useMemo(() => {
    const q = grantSearch.trim().toLowerCase();
    if (!q) return grants;
    return grants.filter((g) => g.name.toLowerCase().includes(q));
  }, [grants, grantSearch]);

  const toggleDraft = useCallback((grant: Grant) => {
    setDrafts((prev) =>
      prev.some((d) => d.grant.id === grant.id)
        ? prev.filter((d) => d.grant.id !== grant.id)
        : [...prev, { grant, startDate: todayISO(), endDate: grant.endDate ?? "" }],
    );
  }, []);

  const updateDraft = useCallback(
    (grantId: string, patch: Partial<Pick<EnrollmentDraft, "startDate" | "endDate">>) => {
      setDrafts((prev) =>
        prev.map((d) => (d.grant.id === grantId ? { ...d, ...patch } : d)),
      );
    },
    [],
  );

  // Advance from step 1 → run dupe check first
  const handleStep1Next = useCallback(() => {
    const matches = findDuplicates(orgCustomers as DupCandidate[], {
      firstName,
      lastName,
      dob,
      cwId,
    });
    if (matches.length === 0) {
      setStep(2);
    } else {
      setDupeMatches(matches);
      setDupeOverride(false);
      setSubView("dupe");
    }
  }, [orgCustomers, firstName, lastName, dob, cwId]);

  const handleDupeContinue = useCallback(() => {
    setSubView("form");
    setStep(2);
  }, []);

  const handleDupeBack = useCallback(() => {
    setSubView("form");
  }, []);

  const executeCreate = useCallback(async (enrollDrafts: EnrollmentDraft[]) => {
    setError(null);
    setSaving(true);
    try {
      const id = await createCustomer.mutateAsync({
        firstName,
        lastName,
        dob: dob || undefined,
        cwId: cwId || undefined,
        hmisId: hmisId || undefined,
        phone: phone || undefined,
        email: email || undefined,
        population: population || undefined,
        caseManagerId: resolvedCMId || undefined,
        caseManagerName: resolvedCMName || undefined,
        secondaryCaseManagerId: secondaryCMId || undefined,
        secondaryCaseManagerName: secondaryCMName || undefined,
      });
      setCreatedId(id);

      const customerName = `${firstName.trim()} ${lastName.trim()}`.trim();
      for (const draft of enrollDrafts) {
        await enrollCustomer.mutateAsync({
          customerId: id,
          customerName,
          grantId: draft.grant.id,
          grantName: draft.grant.name,
          startDate: draft.startDate || todayISO(),
          endDate: draft.endDate || undefined,
          caseManagerId: resolvedCMId || undefined,
          caseManagerName: resolvedCMName || undefined,
        });
      }

      setEnrolledCount(enrollDrafts.length);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    createCustomer, enrollCustomer,
    firstName, lastName, dob, cwId, hmisId, phone, email,
    population, resolvedCMId, resolvedCMName, secondaryCMId, secondaryCMName,
  ]);

  const handleCreate = useCallback(() => executeCreate(drafts), [executeCreate, drafts]);
  const handleSkipPrograms = useCallback(() => executeCreate([]), [executeCreate]);

  const handleFinish = useCallback(async () => {
    const id = createdId;
    if (!id) { navigate("/", { replace: true }); return; }

    if (driveFolderId) {
      try {
        await updateDoc(doc(db, "customers", id), {
          "meta.driveFolderId": driveFolderId,
          "meta.driveFolders": [{ id: driveFolderId, name: "Drive folder", alias: null }],
        });
      } catch {
        // non-fatal
      }
    }

    navigate(`/customers/${id}`, { replace: true });
  }, [createdId, driveFolderId, navigate]);

  // ─── Dupe interstitial ────────────────────────────────────────────────────────

  if (subView === "dupe") {
    return (
      <DupeCheckView
        matches={dupeMatches}
        overrideConfirmed={dupeOverride}
        onOverride={() => setDupeOverride(true)}
        onContinue={handleDupeContinue}
        onBack={handleDupeBack}
        onView={(id) => navigate(`/customers/${id}`)}
      />
    );
  }

  // ─── Step 1 ──────────────────────────────────────────────────────────────────

  const step1Content = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoCapitalize="words" placeholder="Jane" />
        </Field>
        <Field label="Last name" required>
          <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} autoCapitalize="words" placeholder="Doe" />
        </Field>
      </div>
      <Field label="Date of birth">
        <input className={inputCls} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CW ID">
          <input className={inputCls} value={cwId} onChange={(e) => setCwId(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="HMIS ID">
          <input className={inputCls} value={hmisId} onChange={(e) => setHmisId(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Phone">
        <input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Email">
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
      </Field>
    </div>
  );

  // ─── Step 2 ──────────────────────────────────────────────────────────────────

  const step2Content = (
    <div className="flex flex-col gap-5">
      <Field label="Population" required>
        <div className="grid grid-cols-3 gap-2">
          {(["Youth", "Individual", "Family"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPopulation(p)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                population === p
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 active:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-900">Primary case manager</p>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setIsMeCM(true)} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${isMeCM ? "bg-indigo-600 text-white" : "bg-white text-slate-600 active:bg-slate-50"}`}>
            Me
          </button>
          <button type="button" onClick={() => setIsMeCM(false)} className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-slate-200 ${!isMeCM ? "bg-indigo-600 text-white" : "bg-white text-slate-600 active:bg-slate-50"}`}>
            Other
          </button>
        </div>
        {isMeCM ? (
          <p className="text-sm text-slate-500">{user?.displayName ?? user?.email ?? "You"} will be the case manager.</p>
        ) : (
          <select className={selectCls} value={primaryCMId} onChange={(e) => setPrimaryCMId(e.target.value)}>
            <option value="">— Select case manager —</option>
            {knownCMs.map((cm) => <option key={cm.uid} value={cm.uid}>{cm.name}</option>)}
          </select>
        )}
      </div>

      <Field label="Secondary case manager">
        <select className={selectCls} value={secondaryCMId} onChange={(e) => setSecondaryCMId(e.target.value)}>
          <option value="">— None —</option>
          {knownCMs.filter((cm) => cm.uid !== resolvedCMId).map((cm) => (
            <option key={cm.uid} value={cm.uid}>{cm.name}</option>
          ))}
        </select>
      </Field>
    </div>
  );

  // ─── Step 3 ──────────────────────────────────────────────────────────────────

  const grantsSection = filteredGrants.filter((g) => g.kind === "grant");
  const programsSection = filteredGrants.filter((g) => g.kind !== "grant");

  function GrantCard({ grant }: { grant: Grant }) {
    const draft = drafts.find((d) => d.grant.id === grant.id) ?? null;
    const selected = !!draft;
    return (
      <div className={`rounded-2xl border p-3.5 transition-colors ${selected ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-white"}`}>
        <button type="button" className="w-full text-left" onClick={() => toggleDraft(grant)}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">{grant.name}</p>
            <span className={`text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
              {selected ? "Selected" : "Add"}
            </span>
          </div>
          {grant.endDate && <p className="text-xs text-slate-400 mt-0.5">Ends {grant.endDate}</p>}
        </button>
        {draft && (
          <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-indigo-100">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Start date</p>
              <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400" type="date" value={draft.startDate} onChange={(e) => updateDraft(grant.id, { startDate: e.target.value })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">End date</p>
              <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400" type="date" value={draft.endDate} max={grant.endDate ?? undefined} onChange={(e) => updateDraft(grant.id, { endDate: e.target.value })} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const step3Content = (
    <div className="flex flex-col gap-4">
      <input type="search" className={inputCls} placeholder="Search grants and programs…" value={grantSearch} onChange={(e) => setGrantSearch(e.target.value)} />
      {loadingGrants ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          {grantsSection.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Grants</p>
              <div className="flex flex-col gap-2">{grantsSection.map((g) => <GrantCard key={g.id} grant={g} />)}</div>
            </div>
          )}
          {programsSection.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Programs</p>
              <div className="flex flex-col gap-2">{programsSection.map((g) => <GrantCard key={g.id} grant={g} />)}</div>
            </div>
          )}
          {filteredGrants.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No active grants or programs found.</p>
          )}
        </>
      )}
    </div>
  );

  // ─── Step 4 ──────────────────────────────────────────────────────────────────

  const step4Content = (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-green-800">Customer created</p>
          <p className="text-xs text-green-700 mt-0.5">
            {firstName} {lastName}{enrolledCount > 0 ? ` enrolled in ${enrolledCount} program${enrolledCount !== 1 ? "s" : ""}` : " added successfully"}.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-900">Link a Google Drive folder (optional)</p>
        <p className="text-xs text-slate-500">Paste a folder URL or ID. To build a new folder with templates, use the web app.</p>
        <input className={inputCls} value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
        {driveUrl.trim() && !driveFolderId && (
          <p className="text-xs text-red-500">Enter a valid Google Drive folder URL or folder ID.</p>
        )}
        {driveFolderId && (
          <p className="text-xs text-green-600">Folder ID parsed: {driveFolderId.slice(0, 12)}…</p>
        )}
      </div>
    </div>
  );

  // ─── Nav logic ────────────────────────────────────────────────────────────────

  const isLastStep = step === 3;
  const isFinishStep = step === 4;
  const canAdvance = step === 1 ? canStep1 : step === 2 ? canStep2 : step === 3 ? canStep3 : true;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-100 pt-safe-top flex-shrink-0">
        <div className="px-4 pt-3 pb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step > 1 && !isFinishStep ? setStep((step - 1) as Step) : navigate(-1))}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-900">New Customer</h1>
        </div>
      </div>

      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl text-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-900">Creating customer…</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <StepHeader step={step} total={4} />

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && step1Content}
        {step === 2 && step2Content}
        {step === 3 && step3Content}
        {step === 4 && step4Content}
      </div>

      <div className="bg-white border-t border-slate-100 px-4 pb-safe-bottom pt-3 flex gap-3 flex-shrink-0">
        {!isFinishStep && (
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((step - 1) as Step) : navigate(-1))}
            className="flex-none px-5 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50 transition-colors"
          >
            Back
          </button>
        )}

        {isLastStep ? (
          <>
            {!canStep3 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSkipPrograms()}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 active:bg-slate-50 transition-colors"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              disabled={!canStep3 || saving}
              onClick={() => void handleCreate()}
              className="flex-1 py-3 rounded-2xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-40 active:bg-indigo-700 transition-colors"
            >
              Create Customer
            </button>
          </>
        ) : isFinishStep ? (
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700 transition-colors"
          >
            {driveUrl.trim() && !driveFolderId ? "Skip — Go to Customer" : "Go to Customer"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={step === 1 ? handleStep1Next : () => setStep((step + 1) as Step)}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-40 active:bg-indigo-700 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
