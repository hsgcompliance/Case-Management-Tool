import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listWebhookEventDetails, type WebhookEventDetail } from "@/lib/webhookDetailsApi";
import { getSubmissionLinks, linkSubmission, type SubmissionLink } from "@/lib/submissionLinksApi";
import { extractHousehold, type ExtractedValue, type HouseholdMember, type SlotValue } from "@/lib/householdExtract";
import type { IntakeWebhookSnapshot } from "@/lib/intakeWebhookSnapshot";
import { formById } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { matchName, type NameMatch } from "@/lib/nameMatch";
import {
  cacheLinkedSubmission,
  getCustomerDetail,
  subscribeCustomerDetail,
  type CustomerDetail,
  type LinkedSubmission,
} from "@/lib/customerDetailApi";
import { getSubmission, type JfSubmission } from "@/lib/jotformManagerApi";
import { AnswerView } from "./AnswerView";

// Right-hand "Webhooks" sidebar for the intake flow. Two tabs:
//   Structured — ONE continuously-merged household model built across every
//                form submitted this session (never per-form snapshots):
//                Household + Housing groups, then a card per member with
//                their own demographic / income / asset groups. Values from
//                the document-based forms (Eligibility / Rent Determination)
//                carry a ✓ doc badge and outrank self-declared answers.
//   Raw        — expandable flattened webhooks per completed form.
// Collapsible to a thin rail; persists across list/step views (it's mounted at
// the FormsCategoryView layout level). Exact-name-matching submissions are
// auto-linked to the current customer's integrations.

const COLLAPSE_KEY = "hdb:forms:webhooks-sidebar-collapsed";
const SESSION_KEY = "hdb:forms:webhooks-session-start";
const ANCHOR_KEY = "hdb:forms:webhooks-anchor";
const INCLUDE_KEY = "hdb:forms:webhooks-include";
const EXCLUDE_KEY = "hdb:forms:webhooks-exclude";
const POLL_MS = 20_000;

// ── concurrent-intake guard ─────────────────────────────────────────────────
// Two staff running intakes at once share the org-wide webhook stream, so the
// household model must be ANCHORED to one identity: the linked customer, a
// manual pick, or the first named form of the session (usually the citizenship
// self-dec). Only events where some name-ish field fuzzy-matches the anchor
// join the model; the rest are listed as excluded with one-click overrides.

/** Name-carrying labels that describe OTHER people — never anchor evidence. */
const OTHER_PEOPLE_LABEL =
  /landlord|employer|referr|designated|counselor|staff|agency|case ?manager|contact person|business|company/i;

/** Best fuzzy match between the anchor and ANY name-ish field on the event. */
function eventAnchorMatch(ev: WebhookEventDetail, anchor: string): NameMatch {
  let best: NameMatch = matchName(ev.submitterName, anchor);
  if (best === "exact") return best;
  for (const f of ev.fields) {
    if (!/name/i.test(f.label) || OTHER_PEOPLE_LABEL.test(f.label)) continue;
    const m = matchName(f.value, anchor);
    if (m === "exact") return "exact";
    if (m === "partial" && best === "none") best = "partial";
  }
  return best;
}

function loadSessionSet(key: string): Set<string> {
  try {
    const arr = JSON.parse(sessionStorage.getItem(key) || "[]") as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSessionSet(key: string, set: Set<string>): void {
  try { sessionStorage.setItem(key, JSON.stringify([...set])); } catch { /* ignore */ }
}

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text, small = false }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }).catch(() => {});
      }}
      className={`shrink-0 rounded border border-slate-200 bg-white font-semibold text-slate-400 hover:bg-slate-50 hover:text-indigo-600 ${
        small ? "px-1 text-[10px] leading-4" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}

function MatchDot({ match }: { match: NameMatch }) {
  const cls = match === "exact" ? "bg-emerald-500" : match === "partial" ? "bg-amber-400" : "bg-slate-300";
  const title = match === "exact" ? "Matches current customer" : match === "partial" ? "Partial name match" : "Different / unknown name";
  return <span title={title} className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function DocBadge() {
  return (
    <span
      title="Document-verified (Eligibility / Rent Determination)"
      className="inline-flex shrink-0 items-center rounded bg-emerald-100 px-1 text-[9px] font-bold uppercase text-emerald-700"
    >
      ✓ doc
    </span>
  );
}

function ValueRow({ label, found }: { label: string; found: ExtractedValue | null }) {
  return (
    <div className="border-b border-slate-100 py-1.5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
          {label}
          {found?.verified ? <DocBadge /> : null}
        </span>
        {found ? <CopyButton text={found.value} small /> : null}
      </div>
      {found ? (
        <>
          <div className="whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{found.value}</div>
          <div className="truncate text-[10px] text-slate-300">{found.sourceFormTitle}</div>
        </>
      ) : (
        <div className="text-sm text-slate-300">—</div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
  );
}

/** A group of slot rows (Household / Housing). */
function SlotGroup({ title, rows }: { title: string; rows: SlotValue[] }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {rows.map((s) => (
        <ValueRow key={s.key} label={s.label} found={s.found} />
      ))}
    </div>
  );
}

/** Copy chip for one name part: [First ⧉]-style. */
function NameCopy({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()} name: ${text}`}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }).catch(() => {});
      }}
      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
    >
      {label} {copied ? "✓" : "⧉"}
    </button>
  );
}

/** Compact labelled value inside a member card group. */
function MiniRow({ label, found, suffix }: { label: string; found: ExtractedValue | null; suffix?: string }) {
  if (!found) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{label} </span>
        {found.verified ? <DocBadge /> : null}
        <div className="whitespace-pre-wrap break-words text-xs font-medium text-slate-800" title={found.sourceFormTitle}>
          {found.value}
          {suffix ? <span className="font-normal text-slate-400"> {suffix}</span> : null}
        </div>
      </div>
      <CopyButton text={found.value} small />
    </div>
  );
}

function MemberGroupTitle({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">{children}</div>;
}

/** One household member: name copies + demographic / contact / income / asset groups. */
function MemberCard({ m }: { m: HouseholdMember }) {
  const hasDemo = m.dob || m.gender || m.citizenship || m.disabling || m.disabilityTypes;
  return (
    <div className={`rounded-lg border p-2 ${m.isHoH ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200"}`}>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900" title={m.nameProv.sourceFormTitle}>
          {m.name.full}
        </span>
        {m.isHoH ? (
          <span className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">HoH</span>
        ) : null}
        {m.relationship && !/^self$/i.test(m.relationship.value) ? (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {m.relationship.value}
          </span>
        ) : null}
      </div>

      {/* First / Last / Full — each separately copyable */}
      <div className="mt-1 flex flex-wrap gap-1">
        <NameCopy label="First" text={m.name.first} />
        <NameCopy label="Last" text={m.name.last} />
        <NameCopy label="Full" text={m.name.full} />
      </div>

      {hasDemo ? (
        <>
          <MemberGroupTitle>Demographics</MemberGroupTitle>
          <MiniRow label="DOB" found={m.dob} suffix={m.age != null ? `· age ${m.age}` : undefined} />
          <MiniRow label="Gender" found={m.gender} />
          <MiniRow label="Citizenship" found={m.citizenship} />
          <MiniRow label="Disabling condition" found={m.disabling} />
          <MiniRow label="Disability types" found={m.disabilityTypes} />
        </>
      ) : null}

      {m.phone || m.email ? (
        <>
          <MemberGroupTitle>Contact</MemberGroupTitle>
          <MiniRow label="Phone" found={m.phone} />
          <MiniRow label="Email" found={m.email} />
        </>
      ) : null}

      {m.incomes.length ? (
        <>
          <MemberGroupTitle>Income</MemberGroupTitle>
          {m.incomes.map((inc) => (
            <MiniRow
              key={inc.source.value.toLowerCase()}
              label="Source"
              found={inc.source}
              suffix={inc.amountMonthly ? `— ${inc.amountMonthly.value}/mo` : undefined}
            />
          ))}
        </>
      ) : null}

      {m.assets.length ? (
        <>
          <MemberGroupTitle>Assets / accounts</MemberGroupTitle>
          {m.assets.map((a) => (
            <MiniRow key={a.value.toLowerCase()} label="Account" found={a} />
          ))}
        </>
      ) : null}
    </div>
  );
}

export function WebhooksSidebar({
  formIds,
  /** Bump to trigger near-term refreshes (e.g. when the embed detects a submit). */
  refreshKey = 0,
  onSnapshot,
}: {
  formIds: string[];
  refreshKey?: number;
  onSnapshot?: (snapshot: IntakeWebhookSnapshot) => void;
}) {
  const { customer } = useCurrentCustomer();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [tab, setTab] = useState<"structured" | "raw">("structured");
  const [events, setEvents] = useState<WebhookEventDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const loadScopeRef = useRef("");
  const requestIdRef = useRef(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // formId → submissionId → link (loaded lazily per form that has events)
  const [links, setLinks] = useState<Record<string, Record<string, SubmissionLink>>>({});
  const autoLinkTried = useRef(new Set<string>());
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [expandedLinked, setExpandedLinked] = useState<Set<string>>(new Set());
  const [linkedDetails, setLinkedDetails] = useState<Record<string, JfSubmission>>({});
  const [linkedDetailLoading, setLinkedDetailLoading] = useState<Set<string>>(new Set());
  const [linkedDetailErrors, setLinkedDetailErrors] = useState<Record<string, string>>({});

  // The sidebar starts blank each browser-tab session and builds out from the
  // forms submitted DURING it (older webhook traffic stays hidden). Survives
  // reloads in the same tab; "New session" resets the watermark to now.
  const [sessionStartISO, setSessionStartISO] = useState<string>(() => {
    try {
      let v = sessionStorage.getItem(SESSION_KEY);
      if (!v) {
        v = new Date().toISOString();
        sessionStorage.setItem(SESSION_KEY, v);
      }
      return v;
    } catch {
      return new Date().toISOString();
    }
  });
  // Anchor overrides (all session-scoped; wiped by "New session").
  const [manualAnchor, setManualAnchor] = useState<string | null>(() => {
    try { return sessionStorage.getItem(ANCHOR_KEY); } catch { return null; }
  });
  const [manualInc, setManualInc] = useState<Set<string>>(() => loadSessionSet(INCLUDE_KEY));
  const [manualExc, setManualExc] = useState<Set<string>>(() => loadSessionSet(EXCLUDE_KEY));
  const [showExcluded, setShowExcluded] = useState(false);
  const previousCustomerId = useRef(customer?.id ?? "");

  useEffect(() => {
    const customerId = customer?.id ?? "";
    if (previousCustomerId.current === customerId) return;
    previousCustomerId.current = customerId;
    // Keep the session webhook cache, but remove the previous customer's view
    // state and overrides so their rows cannot leak into the active model.
    setExpanded(new Set());
    setExpandedLinked(new Set());
    setShowExcluded(false);
    setManualInc(new Set());
    setManualExc(new Set());
    try {
      sessionStorage.removeItem(INCLUDE_KEY);
      sessionStorage.removeItem(EXCLUDE_KEY);
    } catch {
      /* ignore */
    }
  }, [customer?.id]);

  useEffect(() => {
    if (!customer) {
      setCustomerDetail(null);
      return;
    }
    let alive = true;
    setCustomerDetail(null);
    const unsubscribe = subscribeCustomerDetail(customer.id, (next) => {
      if (alive) setCustomerDetail(next);
    });
    // Customer switches always reconcile against the canonical linked list;
    // subsequent sidebar work remains cache-backed and optimistic.
    void getCustomerDetail(customer.id, true).then((next) => {
      if (alive) setCustomerDetail(next);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [customer?.id]);

  const setAnchorManually = (name: string | null) => {
    try {
      if (name) sessionStorage.setItem(ANCHOR_KEY, name);
      else sessionStorage.removeItem(ANCHOR_KEY);
    } catch { /* ignore */ }
    setManualAnchor(name);
  };

  const resetSession = () => {
    const now = new Date().toISOString();
    try {
      sessionStorage.setItem(SESSION_KEY, now);
      sessionStorage.removeItem(ANCHOR_KEY);
      sessionStorage.removeItem(INCLUDE_KEY);
      sessionStorage.removeItem(EXCLUDE_KEY);
    } catch { /* ignore */ }
    setSessionStartISO(now);
    setManualAnchor(null);
    setManualInc(new Set());
    setManualExc(new Set());
  };

  const formIdsKey = formIds.join(",");
  const loadScope = `${formIdsKey}|${sessionStartISO}`;

  useEffect(() => {
    loadScopeRef.current = loadScope;
    cursorRef.current = null;
    loadingRef.current = false;
    requestIdRef.current += 1;
    setEvents(null);
  }, [loadScope]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  const load = useCallback(() => {
    if (!formIdsKey || loadingRef.current) return;
    const requestedScope = loadScope;
    const afterISO = cursorRef.current;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadingRef.current = true;
    setLoading(true);
    listWebhookEventDetails(formIdsKey.split(","), 60, {
      sinceISO: afterISO ? undefined : sessionStartISO,
      afterISO: afterISO ?? undefined,
    })
      .then((items) => {
        if (loadScopeRef.current !== requestedScope) return;
        setEvents((current) => {
          const byId = new Map((current ?? []).map((event) => [event.id, event]));
          for (const item of items) byId.set(item.id, item);
          return [...byId.values()].sort((a, b) =>
            String(b.createdAtISO || b.receivedAtISO || "").localeCompare(
              String(a.createdAtISO || a.receivedAtISO || ""),
            ),
          );
        });
        const newestCursor = items.reduce<string | null>((latest, item) => {
          const candidate = item.createdAtISO;
          return candidate && (!latest || candidate > latest) ? candidate : latest;
        }, cursorRef.current);
        cursorRef.current = newestCursor;
        setError(null);
      })
      .catch((e: unknown) => {
        if (loadScopeRef.current === requestedScope) {
          setError((e as Error)?.message || "Failed to load webhooks.");
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          loadingRef.current = false;
          if (loadScopeRef.current === requestedScope) setLoading(false);
        }
      });
  }, [formIdsKey, loadScope, sessionStartISO]);

  // Poll while expanded so the sidebar grows as forms come in.
  useEffect(() => {
    if (collapsed) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [collapsed, load]);

  // Submission just detected in the embed: refetch soon (twice — the Jotform
  // webhook + API pull needs a few seconds to land in Firestore).
  useEffect(() => {
    if (!refreshKey) return;
    const t1 = setTimeout(load, 2_500);
    const t2 = setTimeout(load, 9_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [refreshKey, load]);

  // Load link state for every form that has events (linked badges + auto-link).
  useEffect(() => {
    const ids = [...new Set((events ?? []).map((e) => e.formId))].filter((id) => !(id in links));
    if (!ids.length) return;
    let alive = true;
    Promise.all(ids.map((id) => getSubmissionLinks(id).then((l) => [id, l] as const).catch(() => [id, {}] as const)))
      .then((pairs) => {
        if (!alive) return;
        setLinks((cur) => {
          const next = { ...cur };
          for (const [id, l] of pairs) next[id] = l;
          return next;
        });
      });
    return () => { alive = false; };
  }, [events, links]);

  const rows = useMemo(() => {
    return (events ?? [])
      .filter((ev) => (ev.receivedAtISO || "") >= sessionStartISO)
      .map((ev) => {
        const match: NameMatch = customer ? matchName(ev.submitterName, customer.name) : "none";
        const link = links[ev.formId]?.[ev.submissionId];
        const linkedToCurrent = !!customer && !!link?.customers.some((c) => c.customerId === customer.id);
        return { ev, match, link, linkedToCurrent };
      });
  }, [events, customer, links, sessionStartISO]);

  // The model anchor: linked customer > manual pick > first named form this
  // session. rows are newest-first, so the chronological first is the last row.
  const firstNamed = useMemo(
    () => [...rows].reverse().find((r) => r.ev.submitterName.trim()),
    [rows]
  );
  const anchor = customer?.name ?? manualAnchor ?? firstNamed?.ev.submitterName ?? null;
  const anchorSource = customer
    ? "current customer"
    : manualAnchor
      ? "manual pick"
      : firstNamed
        ? "first form this session"
        : null;

  // Partition: an event joins the household model when a name-ish field fuzzy-
  // matches the anchor (or staff manually included it). Everything stays
  // visible in Raw; excluded events are listed for one-click override.
  const anchored = useMemo(() => {
    return rows.map((r) => {
      const anchorMatch: NameMatch | null = anchor ? eventAnchorMatch(r.ev, anchor) : null;
      const inModel = !anchor
        ? true
        : manualExc.has(r.ev.id)
          ? false
          : manualInc.has(r.ev.id)
            ? true
            : anchorMatch !== "none";
      return { ...r, anchorMatch, inModel };
    });
  }, [rows, anchor, manualInc, manualExc]);
  const visibleRows = useMemo(
    () => customer
      ? anchored.filter((r) => r.linkedToCurrent || r.anchorMatch !== "none")
      : anchored,
    [anchored, customer],
  );
  const modelRows = useMemo(() => visibleRows.filter((r) => r.inModel), [visibleRows]);
  const excludedRows = useMemo(() => visibleRows.filter((r) => !r.inModel), [visibleRows]);

  const toggleInModel = (evId: string, currentlyIn: boolean) => {
    setManualInc((cur) => {
      const next = new Set(cur);
      if (currentlyIn) next.delete(evId);
      else next.add(evId);
      saveSessionSet(INCLUDE_KEY, next);
      return next;
    });
    setManualExc((cur) => {
      const next = new Set(cur);
      if (currentlyIn) next.add(evId);
      else next.delete(evId);
      saveSessionSet(EXCLUDE_KEY, next);
      return next;
    });
  };

  const doLink = useCallback(
    async (ev: WebhookEventDetail) => {
      if (!customer) return;
      setLinkingId(ev.id);
      try {
        await linkSubmission({
          formId: ev.formId,
          formName: formById(ev.formId)?.title || `Form ${ev.formId}`,
          submissionId: ev.submissionId,
          customerId: customer.id,
          customerName: customer.name,
          cwId: customer.cwId,
        });
        setLinks((cur) => {
          const forForm = { ...(cur[ev.formId] ?? {}) };
          const existing = forForm[ev.submissionId]?.customers ?? [];
          forForm[ev.submissionId] = {
            submissionId: ev.submissionId,
            customers: [...existing, { customerId: customer.id, customerName: customer.name, cwId: customer.cwId }],
          };
          return { ...cur, [ev.formId]: forForm };
        });
        const linkedAt = new Date().toISOString();
        cacheLinkedSubmission(customer.id, {
          formId: ev.formId,
          formName: formById(ev.formId)?.title || `Form ${ev.formId}`,
          submissionId: ev.submissionId,
          alias: null,
          cwId: customer.cwId,
          linkedAt,
          linkedBy: null,
        });
      } finally {
        setLinkingId(null);
      }
    },
    [customer]
  );

  // D) Auto-link: exact-name-matching submissions attach to the current
  // customer's integrations as they arrive (once per submission per session).
  useEffect(() => {
    if (!customer) return;
    for (const { ev, match, linkedToCurrent } of rows) {
      if (match !== "exact" || linkedToCurrent || !ev.submissionId) continue;
      if (!(ev.formId in links)) continue; // wait until link state is known
      const key = `${customer.id}:${ev.submissionId}`;
      if (autoLinkTried.current.has(key)) continue;
      autoLinkTried.current.add(key);
      doLink(ev).catch(() => {}); // best-effort; the manual Link button remains
    }
  }, [rows, customer, links, doLink]);

  // Structured extraction from the ANCHORED events only — concurrent intakes
  // by other staff stay out of this household model.
  const household = useMemo(
    () => extractHousehold(modelRows.map((r) => r.ev), (id) => formById(id)?.title || `Form ${id}`),
    [modelRows]
  );

  const linkedSubmissions = useMemo(
    () => [...(customerDetail?.linkedSubmissions ?? [])].sort(
      (a, b) => (b.linkedAt || "").localeCompare(a.linkedAt || ""),
    ),
    [customerDetail],
  );

  const loadLinkedSubmission = useCallback(async (linked: LinkedSubmission, force = false) => {
    if (!force && linkedDetails[linked.submissionId]) return;
    setLinkedDetailLoading((current) => new Set(current).add(linked.submissionId));
    setLinkedDetailErrors((current) => {
      const next = { ...current };
      delete next[linked.submissionId];
      return next;
    });
    try {
      const submission = await getSubmission(linked.submissionId);
      setLinkedDetails((current) => ({ ...current, [linked.submissionId]: submission }));
    } catch (error) {
      setLinkedDetailErrors((current) => ({
        ...current,
        [linked.submissionId]: error instanceof Error ? error.message : "Could not load submission.",
      }));
    } finally {
      setLinkedDetailLoading((current) => {
        const next = new Set(current);
        next.delete(linked.submissionId);
        return next;
      });
    }
  }, [linkedDetails]);

  const toggleLinkedSubmission = (linked: LinkedSubmission) => {
    const opening = !expandedLinked.has(linked.submissionId);
    setExpandedLinked((current) => {
      const next = new Set(current);
      if (opening) next.add(linked.submissionId);
      else next.delete(linked.submissionId);
      return next;
    });
    if (opening) void loadLinkedSubmission(linked);
  };

  const refreshAll = () => {
    load();
    if (customer) void getCustomerDetail(customer.id, true);
    for (const linked of linkedSubmissions) {
      if (expandedLinked.has(linked.submissionId)) void loadLinkedSubmission(linked, true);
    }
  };

  useEffect(() => {
    onSnapshot?.({
      household,
      submissions: modelRows.map(({ ev, linkedToCurrent }) => ({
        formId: ev.formId,
        formTitle: formById(ev.formId)?.title || `Form ${ev.formId}`,
        submissionId: ev.submissionId,
        receivedAtISO: ev.receivedAtISO,
        linkedToCurrent,
      })),
    });
  }, [household, modelRows, onSnapshot]);

  const copyAll = () => {
    const lines: string[] = [];
    const pushSlots = (title: string, rows: SlotValue[]) => {
      const found = rows.filter((s) => s.found);
      if (!found.length) return;
      lines.push(title);
      for (const s of found) lines.push(`  ${s.label}: ${s.found!.value}${s.found!.verified ? " [doc-verified]" : ""}`);
    };
    pushSlots("Household", household.household);
    pushSlots("Housing", household.housing);
    if (household.members.length) {
      lines.push("Members");
      for (const m of household.members) {
        const bits = [
          m.isHoH ? "HoH" : null,
          m.relationship?.value ?? null,
          m.dob ? `DOB ${m.dob.value}${m.age != null ? ` (${m.age})` : ""}` : null,
          m.gender?.value ?? null,
          m.disabling ? `Disabling: ${m.disabling.value}${m.disabilityTypes ? ` (${m.disabilityTypes.value})` : ""}` : null,
          m.phone?.value ?? null,
          m.email?.value ?? null,
        ].filter(Boolean);
        lines.push(`  - ${m.name.full}${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
        for (const inc of m.incomes) {
          lines.push(`      Income: ${inc.source.value}${inc.amountMonthly ? ` ${inc.amountMonthly.value}/mo` : ""}${inc.source.verified ? " [doc-verified]" : ""}`);
        }
        for (const a of m.assets) lines.push(`      Asset: ${a.value}${a.verified ? " [doc-verified]" : ""}`);
      }
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  };

  // Full-session export: the NORMALIZED household picture next to every RAW
  // submitted field, with the normalizer key(s) each field mapped to (or none).
  // Form/submission ids ride along so the session can be rebuilt from Jotform.
  // This is today's mapping-debug tool AND the shape of the household package
  // we ultimately want to persist (normalized values + ids, not raw payloads).
  const exportSession = () => {
    const val = (v: ExtractedValue | null) =>
      v
        ? {
            value: v.value,
            sourceFormId: v.sourceFormId,
            sourceFormTitle: v.sourceFormTitle,
            receivedAtISO: v.receivedAtISO,
            verified: v.verified,
          }
        : null;
    const slotObj = (rows: SlotValue[]) => Object.fromEntries(rows.map((s) => [s.key, val(s.found)]));
    const data = {
      kind: "hdb-intake-webhooks-session",
      exportedAtISO: new Date().toISOString(),
      sessionStartISO,
      customer: customer ? { id: customer.id, name: customer.name, cwId: customer.cwId } : null,
      anchor: anchor ? { name: anchor, source: anchorSource } : null,
      normalized: {
        household: slotObj(household.household),
        housing: slotObj(household.housing),
        headOfHousehold: slotObj(household.slots),
        members: household.members.map((m) => ({
          name: m.name, // { full, first, last }
          isHoH: m.isHoH,
          demographics: {
            relationship: val(m.relationship),
            dob: val(m.dob),
            age: m.age,
            gender: val(m.gender),
            citizenship: val(m.citizenship),
            disabling: val(m.disabling),
            disabilityTypes: val(m.disabilityTypes),
          },
          contact: { phone: val(m.phone), email: val(m.email) },
          income: m.incomes.map((i) => ({ source: val(i.source), amountMonthly: val(i.amountMonthly) })),
          assets: m.assets.map((a) => val(a)),
        })),
      },
      unmatched: household.unmatched,
      submissions: household.trace.map((t) => ({
        formId: t.formId,
        formTitle: t.formTitle,
        submissionId: t.submissionId,
        submitterName: t.submitterName,
        receivedAtISO: t.receivedAtISO,
        linkedCustomers: links[t.formId]?.[t.submissionId]?.customers ?? [],
        // Raw fields as displayed, each tagged with the normalized slot(s) it fed.
        fields: t.fields,
      })),
      // Session events that did NOT match the anchor (other people's intakes).
      excludedSubmissions: excludedRows.map((r) => ({
        formId: r.ev.formId,
        formTitle: formById(r.ev.formId)?.title || `Form ${r.ev.formId}`,
        submissionId: r.ev.submissionId,
        submitterName: r.ev.submitterName,
        receivedAtISO: r.ev.receivedAtISO,
        anchorMatch: r.anchorMatch,
        fields: r.ev.fields,
      })),
    };
    const who = (customer?.name || "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intake-webhooks-${who}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        title="Open the Webhooks sidebar"
        className="sticky top-3 flex shrink-0 flex-col items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-1.5 py-3 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
      >
        <span className="text-sm">⟨</span>
        <span className="text-[11px] font-semibold [writing-mode:vertical-rl]">Webhooks</span>
        {visibleRows.length ? (
          <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">{visibleRows.length}</span>
        ) : null}
      </button>
    );
  }

  return (
    <aside className="sticky top-3 w-full shrink-0 self-start lg:w-80 xl:w-96">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Webhooks</span>
            {loading ? <span className="text-[10px] text-slate-300">refreshing…</span> : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={exportSession}
              disabled={!visibleRows.length}
              title="Export this session as JSON — normalized values, raw fields with their mappings, and form/submission ids"
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40"
            >
              Export ⭳
            </button>
            <button
              type="button"
              onClick={resetSession}
              title={`Start a blank session (currently since ${shortTime(sessionStartISO) || "start"})`}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              New session
            </button>
            <button
              type="button"
              onClick={refreshAll}
              title="Refresh webhooks, linked submissions, and any expanded submission details"
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              ⟩
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-100">
          {(["structured", "raw"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 border-b-2 px-3 py-1.5 text-xs font-semibold capitalize ${
                tab === t ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}{t === "raw" && visibleRows.length ? ` (${visibleRows.length})` : ""}
            </button>
          ))}
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-3">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
          ) : tab === "structured" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Household model</SectionTitle>
                <button
                  type="button"
                  onClick={copyAll}
                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Copy all
                </button>
              </div>

              {anchor ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600">
                  Anchored to <b className="text-slate-800">{anchor}</b>{" "}
                  <span className="text-slate-400">· {anchorSource}</span>
                  {manualAnchor && !customer ? (
                    <button
                      type="button"
                      onClick={() => setAnchorManually(null)}
                      title="Clear the manual anchor"
                      className="ml-1 font-semibold text-slate-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  ) : null}
                  {excludedRows.length ? (
                    <>
                      {" "}·{" "}
                      <button
                        type="button"
                        onClick={() => setShowExcluded((v) => !v)}
                        className="font-semibold text-amber-600 hover:text-amber-700"
                      >
                        {excludedRows.length} other submission{excludedRows.length === 1 ? "" : "s"} excluded ▾
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {showExcluded && excludedRows.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Not in this household model
                  </div>
                  {excludedRows.map((r) => (
                    <div key={r.ev.id} className="flex items-center gap-2 border-b border-amber-100 py-1.5 last:border-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {r.ev.submitterName || "(no name)"}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {formById(r.ev.formId)?.title || `Form ${r.ev.formId}`} · {shortTime(r.ev.receivedAtISO)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleInModel(r.ev.id, false)}
                        title="Include this submission in the household model anyway"
                        className="shrink-0 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        Include
                      </button>
                      {!customer && r.ev.submitterName ? (
                        <button
                          type="button"
                          onClick={() => setAnchorManually(r.ev.submitterName)}
                          title="Rebuild the model around this person instead"
                          className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          Anchor
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div>
                <SectionTitle>Members ({household.members.length})</SectionTitle>
                {household.members.length ? (
                  <div className="mt-1.5 space-y-2">
                    {household.members.map((m) => (
                      <MemberCard key={m.name.full.toLowerCase()} m={m} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-300">—</div>
                )}
              </div>

              <div>
                <SectionTitle>Linked submissions ({linkedSubmissions.length})</SectionTitle>
                {linkedSubmissions.length ? (
                  <div className="mt-1.5 space-y-1.5">
                    {linkedSubmissions.map((linked) => {
                      const isOpen = expandedLinked.has(linked.submissionId);
                      const detail = linkedDetails[linked.submissionId];
                      const isLoading = linkedDetailLoading.has(linked.submissionId);
                      const detailError = linkedDetailErrors[linked.submissionId];
                      const title = linked.alias || linked.formName || formById(linked.formId)?.title || `Form ${linked.formId}`;
                      return (
                        <div key={linked.submissionId} className="rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleLinkedSubmission(linked)}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-indigo-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-800">{title}</span>
                              <span className="block truncate text-[10px] text-slate-400">
                                #{linked.submissionId.slice(-8)}
                                {linked.linkedAt ? ` · linked ${linked.linkedAt.slice(0, 10)}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {isLoading ? "loading…" : isOpen ? "▲" : "▼"}
                            </span>
                          </button>
                          {isOpen ? (
                            <div className="border-t border-slate-100 p-2.5">
                              <div className="mb-2 flex justify-end">
                                <a
                                  href={`https://www.jotform.com/inbox/${encodeURIComponent(linked.formId)}/${encodeURIComponent(linked.submissionId)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                                >
                                  Open in Jotform Inbox ↗
                                </a>
                              </div>
                              {detailError ? (
                                <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                                  {detailError}
                                </div>
                              ) : detail ? (
                                <AnswerView sub={detail} />
                              ) : (
                                <div className="py-3 text-center text-xs text-slate-400">Loading submission…</div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-300">No submissions linked to this customer yet.</div>
                )}
              </div>

              <SlotGroup title="Household" rows={household.household} />
              <SlotGroup title="Housing" rows={household.housing} />

              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnmatched((v) => !v)}
                  className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                >
                  <span>Unmatched fields ({household.unmatched.length})</span>
                  <span>{showUnmatched ? "▲" : "▼"}</span>
                </button>
                {showUnmatched ? (
                  household.unmatched.length ? (
                    <div className="mt-1">
                      {household.unmatched.map((u, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 border-b border-slate-50 py-1 last:border-0">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">
                              {u.label} <span className="normal-case text-slate-300">· {u.sourceFormTitle}</span>
                            </div>
                            <div className="whitespace-pre-wrap break-words text-xs text-slate-700">{u.value}</div>
                          </div>
                          <CopyButton text={u.value} small />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-300">Every submitted field matched a structured slot.</p>
                  )
                ) : null}
              </div>

              <p className="text-[10px] leading-relaxed text-slate-300">
                One household model, merged continuously from the forms this session (since{" "}
                {shortTime(sessionStartISO) || "start"}) that name-match the anchor — concurrent intakes by other
                staff are excluded automatically (override above or in Raw). Everything through the workbook step
                is self-declared; <span className="font-semibold text-emerald-500">✓ doc</span> values come from
                the Eligibility / Rent Determination forms (paystubs, bank statements) and outrank self-declared
                answers. Unmatched fields land above for mapping troubleshooting.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {!visibleRows.length ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {customer
                    ? `No cached webhooks match ${customer.name}. Linked submissions remain available in Structured.`
                    : `Blank session (since ${shortTime(sessionStartISO) || "start"}) — webhooks appear here as you submit the intake forms.`}
                </div>
              ) : (
                visibleRows.map(({ ev, match, link, linkedToCurrent, inModel }) => {
                  const isOpen = expanded.has(ev.id);
                  return (
                    <div key={ev.id} className={`rounded-lg border ${inModel ? "border-slate-200" : "border-amber-200 bg-amber-50/40"}`}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((cur) => {
                            const next = new Set(cur);
                            if (next.has(ev.id)) next.delete(ev.id);
                            else next.add(ev.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
                      >
                        {customer ? <MatchDot match={match} /> : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {formById(ev.formId)?.title || `Form ${ev.formId}`}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {ev.submitterName || "(no name)"} · {shortTime(ev.receivedAtISO)}
                            {!inModel ? " · ✕ not in model" : ""}
                            {linkedToCurrent ? " · ✓ linked" : link?.customers.length ? ` · linked: ${link.customers.map((c) => c.customerName).join(", ")}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-300">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen ? (
                        <div className="border-t border-slate-100 px-2.5 py-2">
                          {anchor ? (
                            <button
                              type="button"
                              onClick={() => toggleInModel(ev.id, inModel)}
                              className={`mb-2 w-full rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                inModel
                                  ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              }`}
                            >
                              {inModel ? "Remove from household model" : "Include in household model"}
                            </button>
                          ) : null}
                          {customer && !linkedToCurrent ? (
                            <button
                              type="button"
                              disabled={linkingId === ev.id}
                              onClick={() => { doLink(ev).catch(() => {}); }}
                              className="mb-2 w-full rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              {linkingId === ev.id ? "Linking…" : `Link to ${customer.name}`}
                            </button>
                          ) : null}
                          {ev.fields.length ? (
                            <div>
                              {ev.fields.map((f, i) => (
                                <div key={i} className="flex items-start justify-between gap-2 border-b border-slate-50 py-1 last:border-0">
                                  <div className="min-w-0">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{f.label}</div>
                                    <div className="whitespace-pre-wrap break-words text-xs text-slate-700">{f.value}</div>
                                  </div>
                                  <CopyButton text={f.value} small />
                                </div>
                              ))}
                            </div>
                          ) : ev.pretty ? (
                            <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-600">{ev.pretty}</pre>
                          ) : (
                            <div className="text-xs text-slate-400">No parsed fields.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
