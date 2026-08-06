import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listWebhookEvents, type WebhookEventItem } from "@/lib/webhookEventsApi";
import {
  clearIntakeSessions,
  listIntakeSessions,
  onIntakeSessionsChange,
  removeIntakeSession,
  importRemoteIntakeSession,
  readIntakeProgress,
  removeIntakeProgress,
  sessionCustomer,
  type IntakeSession,
} from "@/lib/intakeSessions";
import {
  claimIntakeFlow,
  deleteRemoteIntakeFlow,
  listOrgIntakeFlows,
  listRemoteIntakeFlows,
  transferIntakeFlow,
  type IntakeFlowProgress,
  type RemoteIntakeFlow,
} from "@/lib/intakeFlowsApi";
import { complianceFirst, loadUsers, type FormsUser } from "@/lib/usersApi";
import { useAuth } from "@/hooks/useAuth";
import { intakeTypeLabel, intakeTypesLabel } from "@/lib/formsCatalog";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { useCatalog } from "@/hooks/useCatalog";

// Header notification bell. Two sections:
//   • Active intakes — my in-progress intake sessions (local cache backed by
//     resumable server flows; removing an item clears both queue projections).
//   • Watched submissions — forms flagged "Notify on submit" (Forms admin),
//     last 7 days, with quick links into the Jotform inbox.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_MS = 5 * 60_000;

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SubmitNotifications() {
  const { user } = useAuth();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const { setCustomer } = useCurrentCustomer();
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<FormsUser[]>([]);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [transferring, setTransferring] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [clearingAll, setClearingAll] = useState(false);
  // Compliance/admin only (null = no access): other staff's unfinished intakes.
  const [orgFlows, setOrgFlows] = useState<RemoteIntakeFlow[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const notifyForms = useMemo(
    () => new Map(catalog.filter((f) => f.notifyOnSubmit).map((f) => [f.id, f.title])),
    [catalog]
  );

  useEffect(() => {
    const refresh = () => setSessions(listIntakeSessions());
    refresh();
    void Promise.all([listRemoteIntakeFlows(), loadUsers()]).then(([flows, orgUsers]) => {
      for (const flow of flows) {
        // "Sent by" attribution: prefer the stored name; resolve legacy
        // uid-only transfers against the org user list.
        const transferredByName = flow.transferredByName
          ?? (flow.transferredByUid ? orgUsers.find((u) => u.uid === flow.transferredByUid)?.name ?? null : null);
        importRemoteIntakeSession({ ...flow.session, transferredByName }, flow.progress);
      }
      setSessions(listIntakeSessions());
      setUsers(orgUsers.filter((candidate) => candidate.uid !== user?.uid));
    }).catch(() => {});
    // Backend 403s for non-compliance/admin → null → section stays hidden.
    void listOrgIntakeFlows().then((flows) => {
      setOrgFlows(flows === null ? null : flows.filter((f) => f.ownerUid !== user?.uid && f.session.doneCount < f.session.totalSteps));
    });
    return onIntakeSessionsChange(refresh);
  }, [user?.uid]);

  const claimFlow = async (flow: RemoteIntakeFlow) => {
    const who = flow.session.customerName || "this intake";
    const owner = users.find((candidate) => candidate.uid === flow.ownerUid);
    if (!window.confirm(`Take over ${who} from ${owner?.name || "its current owner"}? It will move to your Active Intakes.`)) return;
    setClaiming(flow.id);
    try {
      await claimIntakeFlow(flow.ownerUid, flow.customerId);
      importRemoteIntakeSession(flow.session, flow.progress as unknown as Record<string, unknown>);
      setOrgFlows((current) => (current ?? []).filter((f) => f.id !== flow.id));
      setSessions(listIntakeSessions());
    } catch (error) {
      window.alert(`Could not claim this intake: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setClaiming(null);
    }
  };

  const sendIntake = async (session: IntakeSession) => {
    const key = session.customerId || "";
    const targetUid = transferTargets[key];
    if (!session.customerId || !targetUid) return;
    const target = users.find((candidate) => candidate.uid === targetUid);
    if (!window.confirm(`Send ${session.customerName || "this intake"}'s saved workflow to ${target?.name || "the selected user"}? It will leave your Active Intakes.`)) return;
    setTransferring(key);
    try {
      const raw = readIntakeProgress(session.customerId);
      const progress: IntakeFlowProgress = {
        done: (raw.done as Record<string, boolean>) || {},
        checks: (raw.checks as Record<string, number[]>) || {},
        ...(raw.tssVariant === "payer" || raw.tssVariant === "nonpayer" ? { tssVariant: raw.tssVariant } : {}),
        ...(Array.isArray(raw.intakeTypes) ? { intakeTypes: raw.intakeTypes.map(String) } : {}),
      };
      await transferIntakeFlow(targetUid, session, progress);
      removeIntakeSession(session.customerId);
      removeIntakeProgress(session.customerId);
    } catch (error) {
      window.alert(`Could not send workflow: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setTransferring(null);
    }
  };

  const removeSession = async (session: IntakeSession) => {
    const key = session.customerId || "no-customer";
    setRemoving((current) => new Set(current).add(key));
    try {
      if (session.customerId) await deleteRemoteIntakeFlow(session.customerId);
      removeIntakeSession(session.customerId);
    } catch (error) {
      window.alert(`Could not remove intake from the queue: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setRemoving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const clearAllSessions = async () => {
    if (!window.confirm("Clear ALL intake sessions from this list? Step progress is kept.")) return;
    setClearingAll(true);
    try {
      await Promise.all(
        sessions
          .map((session) => session.customerId)
          .filter((customerId): customerId is string => !!customerId)
          .map(deleteRemoteIntakeFlow),
      );
      clearIntakeSessions();
    } catch (error) {
      window.alert(`Could not clear every intake: ${error instanceof Error ? error.message : "unknown error"}`);
      void listRemoteIntakeFlows().then((flows) => {
        clearIntakeSessions();
        for (const flow of flows) importRemoteIntakeSession(flow.session, flow.progress);
      }).catch(() => {});
    } finally {
      setClearingAll(false);
    }
  };

  const incompleteIntakes = useMemo(
    () => sessions.filter((s) => s.doneCount < s.totalSteps).length,
    [sessions]
  );

  const resumeIntake = (s: IntakeSession) => {
    const c = sessionCustomer(s);
    if (c) setCustomer(c);
    setOpen(false);
    navigate("/staff/intake");
  };

  useEffect(() => {
    const load = () => { listWebhookEvents(100).then(setEvents).catch(() => {}); };
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return events.filter((e) => {
      if (!notifyForms.has(e.formId) || !e.receivedAtISO) return false;
      const t = new Date(e.receivedAtISO).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [events, notifyForms]);

  const inboxFormIds = useMemo(() => [...new Set(items.map((i) => i.formId))], [items]);

  const badgeCount = items.length + incompleteIntakes;

  if (notifyForms.size === 0 && sessions.length === 0 && !orgFlows?.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Active intakes + watched form submissions"
        className="relative rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
      >
        🔔
        {badgeCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Active intakes{incompleteIntakes ? ` (${incompleteIntakes})` : ""}
            </span>
            {sessions.length > 0 ? (
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => void clearAllSessions()}
                className="text-[10px] font-semibold text-slate-400 hover:text-rose-600"
              >
                {clearingAll ? "Clearing…" : "Clear all"}
              </button>
            ) : null}
          </div>
          <div className="max-h-56 overflow-y-auto border-b border-slate-100">
            {sessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No intake sessions yet — progress on the Intake tab lands here.
              </div>
            ) : (
              sessions.map((s) => {
                const complete = s.doneCount >= s.totalSteps;
                return (
                  <div
                    key={s.customerId ?? "no-customer"}
                    className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-indigo-50/50"
                  >
                    <button type="button" onClick={() => resumeIntake(s)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                          {s.customerName || "No customer linked yet"}
                          {s.cwId ? <span className="font-normal text-slate-400"> · {s.cwId}</span> : null}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-semibold ${
                            complete ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {complete ? "✓ complete" : `${s.doneCount}/${s.totalSteps} steps`}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {s.transferredByName ? (
                          <span className="font-semibold text-indigo-500">Sent by {s.transferredByName} · </span>
                        ) : null}
                        {intakeTypesLabel(s.intakeTypes) || intakeTypeLabel(s.intakeType) || "Intake"} · {shortDate(s.updatedAtISO)} · resume →
                      </div>
                    </button>
                    {s.customerId && users.length ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <select
                          aria-label={`Send ${s.customerName || "intake"} to user`}
                          value={transferTargets[s.customerId] || ""}
                          onChange={(event) => {
                            const targetUserId = event.currentTarget.value;
                            setTransferTargets((current) => ({ ...current, [s.customerId!]: targetUserId }));
                          }}
                          className="max-w-24 rounded border border-slate-200 bg-white px-1 py-1 text-[10px] text-slate-600"
                        >
                          <option value="">Send to...</option>
                          {(() => {
                            const { compliance, others } = complianceFirst(users);
                            return (
                              <>
                                {compliance.length ? (
                                  <optgroup label="Compliance">
                                    {compliance.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.name}</option>)}
                                  </optgroup>
                                ) : null}
                                {compliance.length ? (
                                  <optgroup label="All staff">
                                    {others.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.name}</option>)}
                                  </optgroup>
                                ) : (
                                  others.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.name}</option>)
                                )}
                              </>
                            );
                          })()}
                        </select>
                        <button
                          type="button"
                          disabled={!transferTargets[s.customerId] || transferring === s.customerId}
                          onClick={() => void sendIntake(s)}
                          className="rounded bg-indigo-600 px-1.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
                        >
                          {transferring === s.customerId ? "..." : "Send"}
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={removing.has(s.customerId || "no-customer")}
                      onClick={() => void removeSession(s)}
                      title="Remove from active intakes everywhere (keeps local step progress)"
                      className="shrink-0 rounded px-1 text-xs font-bold text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                    >
                      {removing.has(s.customerId || "no-customer") ? "…" : "✕"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {orgFlows?.length ? (
            <>
              <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Org intakes in progress ({orgFlows.length})
              </div>
              <div className="max-h-44 overflow-y-auto border-b border-slate-100">
                {orgFlows.map((flow) => {
                  const owner = users.find((candidate) => candidate.uid === flow.ownerUid);
                  return (
                    <div key={flow.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {flow.session.customerName || "No customer linked"}
                          <span className="font-normal text-slate-400"> · {flow.session.doneCount}/{flow.session.totalSteps}</span>
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          with {owner?.name || "unknown"} · {shortDate(flow.updatedAtISO)}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={claiming === flow.id}
                        onClick={() => void claimFlow(flow)}
                        title="Take over this intake — it moves to your Active Intakes"
                        className="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {claiming === flow.id ? "…" : "Claim"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Watched submissions · last 7 days
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No submissions in the last 7 days
                {notifyForms.size ? ` for ${[...notifyForms.values()].join(", ")}` : ""}.
              </div>
            ) : (
              items.map((it) => (
                <a
                  key={it.id}
                  href={
                    it.submissionId
                      ? `https://www.jotform.com/inbox/${it.formId}/${it.submissionId}`
                      : `https://www.jotform.com/inbox/${it.formId}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border-b border-slate-50 px-3 py-2 last:border-0 hover:bg-indigo-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                      {it.submitterName || "(no name)"}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{shortDate(it.receivedAtISO)}</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {notifyForms.get(it.formId)} · open in Jotform inbox ↗
                  </div>
                </a>
              ))
            )}
          </div>
          {inboxFormIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
              {inboxFormIds.map((id) => (
                <a
                  key={id}
                  href={`https://www.jotform.com/inbox/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  {notifyForms.get(id) || `Form ${id}`} inbox ↗
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
