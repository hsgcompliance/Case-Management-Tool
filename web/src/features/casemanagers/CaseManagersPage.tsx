"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import PageHeader from "@entities/Page/PageHeader";
import RefreshButton from "@entities/ui/RefreshButton";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import { useUsers } from "@hooks/useUsers";
import { useGrants } from "@hooks/useGrants";
import { useInboxWorkloadList } from "@hooks/useInbox";
import { qk } from "@hooks/queryKeys";
import { isCaseManagerLike } from "@lib/roles";
import { MetricStrip } from "@entities/metrics/strip/MetricStrip";
import CaseManagerAccordion from "./components/CaseManagerAccordion";
import {
  cmLabel,
  currentYearMonthKey,
type CaseManagerUser,
} from "./components/model";

type WorkloadStatItem = {
  bucket?: string;
  type?: string;
  status?: string;
  assignedToUid?: string;
  cmUid?: string;
};

function hasCaseManagerRole(u: CaseManagerUser): boolean {
  return isCaseManagerLike(u as { roles?: unknown; topRole?: unknown; role?: unknown });
}

export function CasemanagersPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const meUid = String(profile?.uid || "");
  const monthKey = currentYearMonthKey();
  const [cmFilter, setCmFilter] = React.useState<string | null>(null);

  const usersQ = useUsers({ status: "all", limit: 500 });
  useGrants({ limit: 500 }, { staleTime: 60_000 });

  // Workload list for month stats (replaces bulk customer/enrollment load)
  const workloadQ = useInboxWorkloadList(
    { month: monthKey, includeUnassigned: false, limit: 2000 },
    { staleTime: 60_000 }
  );

  const allCaseManagers = React.useMemo<CaseManagerUser[]>(() => {
    const all = (usersQ.data || []).filter((u) => u?.uid && hasCaseManagerRole(u));
    all.sort((a, b) => cmLabel(a).localeCompare(cmLabel(b)));
    if (!meUid) return all;
    const mine = all.find((u) => String(u.uid) === meUid);
    if (!mine) return all;
    return [mine, ...all.filter((u) => String(u.uid) !== meUid)];
  }, [usersQ.data, meUid]);

  const caseManagers = React.useMemo(() => {
    if (!cmFilter) return allCaseManagers;
    return allCaseManagers.filter((cm) => String(cm.uid) === cmFilter);
  }, [allCaseManagers, cmFilter]);

  // Derive month stats from workload items (no customer docs needed)
  const monthStats = React.useMemo(() => {
    const items = (workloadQ.data || []) as WorkloadStatItem[];
    let assessments = 0;
    let payments = 0;
    const tasksByCm = new Map<string, number>();

    for (const item of items) {
      const bucket = String(item.bucket || item.type || "").toLowerCase();
      const status = String(item.status || "").toLowerCase();
      if (status !== "open") continue;

      const assignedUid = String(item.assignedToUid || item.cmUid || "");
      if (assignedUid) tasksByCm.set(assignedUid, (tasksByCm.get(assignedUid) || 0) + 1);

      if (bucket.includes("assessment")) assessments += 1;
      else if (bucket.includes("pay") || bucket === "payment") payments += 1;
    }

    return { assessments, payments, tasksByCm };
  }, [workloadQ.data]);

  const caseManagerOptions = React.useMemo(
    () =>
      allCaseManagers.map((u) => ({
        uid: String(u.uid),
        email: "email" in u && u.email ? String(u.email) : null,
        label: cmLabel(u),
      })),
    [allCaseManagers]
  );

  const isLoading = usersQ.isLoading;

  const onRefresh = async () => {
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: qk.users.root }),
      qc.invalidateQueries({ queryKey: qk.customers.root }),
      qc.invalidateQueries({ queryKey: qk.enrollments.root }),
      qc.invalidateQueries({ queryKey: qk.grants.root }),
      qc.invalidateQueries({ queryKey: qk.inbox.root }),
      qc.refetchQueries({ queryKey: qk.users.root, type: "active" }),
    ]);
  };

  return (
    <section className="space-y-6" data-tour="casemanagers-page">
      <PageHeader
        tourId="casemanagers-header"
        title="Case Managers"
        subtitle="Track all caseloads at a glance"
        actions={
          <>
            <CaseManagerSelect
              value={cmFilter}
              onChange={(uid) => setCmFilter(uid)}
              options={caseManagerOptions}
              includeAll
              allLabel="All case managers"
              className="min-w-[220px]"
              tourId="casemanagers-filter-cm"
            />
            <RefreshButton
              queryKeys={[qk.users.root, qk.customers.root, qk.enrollments.root, qk.grants.root]}
              label="Refresh"
              onRefresh={onRefresh}
              tourId="casemanagers-refresh"
            />
          </>
        }
      />

      <MetricStrip
        items={[
          {
            id: "case-managers",
            label: "Case Managers",
            value: allCaseManagers.length,
            subtext: "Total active case managers",
            metricId: "case-managers",
          },
          {
            id: "assessments-due",
            label: `Assessments Due (${monthKey})`,
            value: monthStats.assessments,
            subtext: "Open assessment tasks this month",
            metricId: "assessments-due",
          },
          {
            id: "payments-due",
            label: `Payments Due (${monthKey})`,
            value: monthStats.payments,
            subtext: "Open payment tasks this month",
            metricId: "payments-due",
          },
          {
            id: "open-tasks",
            label: "Open Tasks",
            value: ((workloadQ.data || []) as WorkloadStatItem[]).filter((item) => String(item.status || "") === "open").length,
            subtext: "Total open inbox tasks this month",
            metricId: "open-tasks",
          },
        ]}
        className="pt-1"
        gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      />

      {isLoading ? (
        <div className="text-sm text-slate-600" data-tour="casemanagers-loading">
          Loading case manager data...
        </div>
      ) : null}

      {!isLoading ? (
        <div className="space-y-3" data-tour="casemanagers-list">
          {caseManagers.map((cm) => (
            <CaseManagerAccordion
              key={String(cm.uid)}
              user={cm}
              monthKey={monthKey}
              taskCount={monthStats.tasksByCm.get(String(cm.uid))}
              defaultOpen={String(cm.uid) === meUid}
            />
          ))}
          {caseManagers.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600"
              data-tour="casemanagers-empty"
            >
              No case managers found for this filter.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const CaseManagersPage = CasemanagersPage;
export default CasemanagersPage;
