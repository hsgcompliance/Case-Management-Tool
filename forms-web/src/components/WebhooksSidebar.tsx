import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listWebhookEventDetails, type WebhookEventDetail } from "@/lib/webhookDetailsApi";
import { getSubmissionLinks, linkSubmission, type SubmissionLink } from "@/lib/submissionLinksApi";
import { extractHousehold, type ExtractedValue, type HouseholdMember, type SlotValue } from "@/lib/householdExtract";
import { formById } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { matchName, type NameMatch } from "@/lib/nameMatch";

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
const POLL_MS = 20_000;

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
}: {
  formIds: string[];
  refreshKey?: number;
}) {
  const { customer } = useCurrentCustomer();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [tab, setTab] = useState<"structured" | "raw">("structured");
  const [events, setEvents] = useState<WebhookEventDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // formId → submissionId → link (loaded lazily per form that has events)
  const [links, setLinks] = useState<Record<string, Record<string, SubmissionLink>>>({});
  const autoLinkTried = useRef(new Set<string>());
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

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
  const resetSession = () => {
    const now = new Date().toISOString();
    try { sessionStorage.setItem(SESSION_KEY, now); } catch { /* ignore */ }
    setSessionStartISO(now);
  };

  const formIdsKey = formIds.join(",");

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  const load = useCallback(() => {
    if (!formIdsKey) return;
    setLoading(true);
    listWebhookEventDetails(formIdsKey.split(","), 60)
      .then((items) => { setEvents(items); setError(null); })
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load webhooks."))
      .finally(() => setLoading(false));
  }, [formIdsKey]);

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

  // Structured extraction from everything submitted this session (the session
  // watermark is the scope — match dots stay purely informational).
  const household = useMemo(
    () => extractHousehold(rows.map((r) => r.ev), (id) => formById(id)?.title || `Form ${id}`),
    [rows]
  );

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
        {rows.length ? (
          <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">{rows.length}</span>
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
              disabled={!rows.length}
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
              onClick={load}
              title="Refresh now"
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
              {t}{t === "raw" && rows.length ? ` (${rows.length})` : ""}
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

              <SlotGroup title="Household" rows={household.household} />
              <SlotGroup title="Housing" rows={household.housing} />

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
                One household model, merged continuously from every form this session (since{" "}
                {shortTime(sessionStartISO) || "start"}). Everything through the workbook step is self-declared;{" "}
                <span className="font-semibold text-emerald-500">✓ doc</span> values come from the Eligibility /
                Rent Determination forms (paystubs, bank statements) and outrank self-declared answers.
                Unmatched fields land above for mapping troubleshooting.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {!rows.length ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Blank session (since {shortTime(sessionStartISO) || "start"}) — webhooks appear here as you submit
                  the intake forms.
                </div>
              ) : (
                rows.map(({ ev, match, link, linkedToCurrent }) => {
                  const isOpen = expanded.has(ev.id);
                  return (
                    <div key={ev.id} className="rounded-lg border border-slate-200">
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
                            {linkedToCurrent ? " · ✓ linked" : link?.customers.length ? ` · linked: ${link.customers.map((c) => c.customerName).join(", ")}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-300">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen ? (
                        <div className="border-t border-slate-100 px-2.5 py-2">
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
