import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  claimIntakeFlow,
  deleteRemoteIntakeFlow,
  listOrgIntakeFlows,
  type RemoteIntakeFlow,
} from "@/lib/intakeFlowsApi";
import { loadUsers, type FormsUser } from "@/lib/usersApi";
import { useAuth } from "@/hooks/useAuth";
import { importRemoteIntakeSession, removeIntakeProgress, removeIntakeSession, sessionCustomer } from "@/lib/intakeSessions";
import { useCurrentCustomer } from "@/context/CurrentCustomer";
import { intakeTypeLabel, intakeTypesLabel } from "@/lib/formsCatalog";

// Org-wide view of every unfinished intake — who owns it, how far along it
// is, and (compliance/admin only, enforced server-side) a Claim button so a
// stalled referral→intake flow can be picked up without waiting on its owner.

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AllIntakesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setCustomer } = useCurrentCustomer();
  const [flows, setFlows] = useState<RemoteIntakeFlow[] | null | undefined>(undefined); // undefined = loading, null = no access
  const [users, setUsers] = useState<FormsUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listOrgIntakeFlows(), loadUsers()])
      .then(([items, orgUsers]) => {
        setFlows(items);
        setUsers(orgUsers);
      })
      .catch((e: unknown) => setError((e as Error)?.message || "Failed to load active intakes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const userName = useMemo(() => new Map(users.map((u) => [u.uid, u.name])), [users]);

  const active = useMemo(
    () => (flows ?? [])
      .filter((f) => f.session.doneCount < f.session.totalSteps)
      .sort((a, b) => String(a.session.startedAtISO || "").localeCompare(String(b.session.startedAtISO || ""))),
    [flows],
  );

  const claim = async (flow: RemoteIntakeFlow) => {
    const who = flow.session.customerName || "this intake";
    const ownerName = userName.get(flow.ownerUid) || "its current owner";
    if (!window.confirm(`Take over ${who} from ${ownerName}? It will move to your Active Intakes.`)) return;
    setClaiming(flow.id);
    try {
      await claimIntakeFlow(flow.ownerUid, flow.customerId);
      importRemoteIntakeSession(flow.session, flow.progress as unknown as Record<string, unknown>);
      setFlows((current) => (current ?? []).filter((f) => f.id !== flow.id));
      const c = sessionCustomer(flow.session);
      if (c) setCustomer(c);
      navigate("/staff/intake");
    } catch (e) {
      window.alert(`Could not claim this intake: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setClaiming(null);
    }
  };

  const close = async (flow: RemoteIntakeFlow) => {
    const isMine = flow.ownerUid === user?.uid;
    const who = flow.session.customerName || "this intake";
    const ownerNote = isMine ? "" : ` (owned by ${userName.get(flow.ownerUid) || "another staff member"})`;
    if (!window.confirm(`Close and delete ${who}${ownerNote}? This removes the saved progress and cannot be undone.`)) return;
    setClosing(flow.id);
    try {
      await deleteRemoteIntakeFlow(flow.customerId, isMine ? undefined : flow.ownerUid);
      if (isMine) {
        removeIntakeSession(flow.customerId);
        removeIntakeProgress(flow.customerId);
      }
      setFlows((current) => (current ?? []).filter((f) => f.id !== flow.id));
    } catch (e) {
      window.alert(`Could not close this intake: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setClosing(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">All active intakes</h2>
          <p className="text-xs text-slate-500">Every unfinished intake across the org — pick one up if it's stalled.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : flows === undefined ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : flows === null ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">
          This view is limited to compliance and admin staff. Your own in-progress intakes are still listed in the notification bell.
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No unfinished intakes right now.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Intake type</th>
                <th className="px-3 py-2">Steps</th>
                <th className="px-3 py-2">Started by</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {active.map((flow) => {
                const pct = flow.session.totalSteps > 0
                  ? Math.round((flow.session.doneCount / flow.session.totalSteps) * 100)
                  : 0;
                const isMine = flow.ownerUid === user?.uid;
                return (
                  <tr key={flow.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-800">{flow.session.customerName || "No customer linked"}</div>
                      {flow.session.cwId ? <div className="text-[11px] text-slate-400">{flow.session.cwId}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {intakeTypesLabel(flow.session.intakeTypes) || intakeTypeLabel(flow.session.intakeType) || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {flow.session.doneCount}/{flow.session.totalSteps}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {isMine ? <span className="font-semibold text-indigo-600">You</span> : (userName.get(flow.ownerUid) || "Unknown")}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {shortDate(flow.session.startedAtISO)}
                      <div className="text-slate-400">{daysAgo(flow.session.startedAtISO)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {isMine ? (
                          <button
                            type="button"
                            onClick={() => {
                              const c = sessionCustomer(flow.session);
                              if (c) setCustomer(c);
                              navigate("/staff/intake");
                            }}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={claiming === flow.id}
                            onClick={() => void claim(flow)}
                            title="Take over this intake — it moves to your Active Intakes"
                            className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            {claiming === flow.id ? "…" : "Claim"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={closing === flow.id}
                          onClick={() => void close(flow)}
                          title="Close and delete this intake — the saved progress cannot be recovered"
                          className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {closing === flow.id ? "…" : "Close"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
