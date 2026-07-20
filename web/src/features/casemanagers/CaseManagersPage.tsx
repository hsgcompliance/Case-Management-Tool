"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import PageHeader from "@entities/Page/PageHeader";
import RefreshButton from "@entities/ui/RefreshButton";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import { useUsers } from "@hooks/useUsers";
import { useInboxWorkloadList } from "@hooks/useInbox";
import { useAdminEnrollmentsData } from "@entities/Page/dashboardStyle/hooks/useAdminEnrollmentsData";
import { qk } from "@hooks/queryKeys";
import { isCaseManagerLike } from "@lib/roles";
import { fmtCurrencyUSD } from "@lib/formatters";
import { MetricStrip } from "@entities/metrics/strip/MetricStrip";
import CaseManagerAccordion from "./components/CaseManagerAccordion";
import { buildCaseManagerReport, emptyCaseManagerReportStats } from "./components/caseManagerReportModel";
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
  customerId?: string;
  clientId?: string;
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
  const reportData = useAdminEnrollmentsData();

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

  const caseManagerReport = React.useMemo(
    () => buildCaseManagerReport({
      caseManagerIds: allCaseManagers.map((cm) => String(cm.uid || "")),
      customers: reportData.customers as Array<Record<string, unknown>>,
      enrollments: reportData.enrollments as Array<Record<string, unknown>>,
      month: monthKey,
    }),
    [allCaseManagers, reportData.customers, reportData.enrollments, monthKey]
  );

  // Tasks remain available as a secondary workload signal.
  const monthStats = React.useMemo(() => {
    const items = (workloadQ.data || []) as WorkloadStatItem[];
    const tasksByCm = new Map<string, number>();
    const tasksByCmAndCustomer = new Map<string, Map<string, number>>();

    for (const item of items) {
      const status = String(item.status || "").toLowerCase();
      if (status !== "open") continue;

      const assignedUid = String(item.assignedToUid || item.cmUid || "");
      if (assignedUid) tasksByCm.set(assignedUid, (tasksByCm.get(assignedUid) || 0) + 1);
      const customerId = String(item.customerId || item.clientId || "");
      if (assignedUid && customerId) {
        const byCustomer = tasksByCmAndCustomer.get(assignedUid) || new Map<string, number>();
        byCustomer.set(customerId, (byCustomer.get(customerId) || 0) + 1);
        tasksByCmAndCustomer.set(assignedUid, byCustomer);
      }
    }

    return { tasksByCm, tasksByCmAndCustomer };
  }, [workloadQ.data]);

  const visibleTotals = React.useMemo(() => {
    return caseManagers.reduce((totals, cm) => {
      const stats = caseManagerReport.statsByUid.get(String(cm.uid)) || emptyCaseManagerReportStats();
      totals.activeCaseload += stats.activeCaseload;
      totals.newCustomersThisMonth += stats.newCustomersThisMonth;
      totals.changedCustomersThisMonth += stats.changedCustomersThisMonth;
      totals.totalAllocation += stats.totalAllocation;
      totals.openTasks += monthStats.tasksByCm.get(String(cm.uid)) || 0;
      return totals;
    }, { activeCaseload: 0, newCustomersThisMonth: 0, changedCustomersThisMonth: 0, totalAllocation: 0, openTasks: 0 });
  }, [caseManagers, caseManagerReport.statsByUid, monthStats.tasksByCm]);

  const caseManagerOptions = React.useMemo(
    () =>
      allCaseManagers.map((u) => ({
        uid: String(u.uid),
        email: "email" in u && u.email ? String(u.email) : null,
        label: cmLabel(u),
      })),
    [allCaseManagers]
  );

  const isLoading = usersQ.isLoading || reportData.sharedDataLoading;

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
            id: "active-caseload",
            label: "Active Caseload",
            value: visibleTotals.activeCaseload,
            subtext: `${caseManagers.length} case manager${caseManagers.length === 1 ? "" : "s"}`,
            metricId: "my-customers",
          },
          {
            id: "new-customers",
            label: "New on Load",
            value: visibleTotals.newCustomersThisMonth,
            subtext: `${visibleTotals.changedCustomersThisMonth} customers changed in ${monthKey}`,
            metricId: "grant-unique-clients",
          },
          {
            id: "customer-allocation",
            label: "Customer Allocation",
            value: fmtCurrencyUSD(visibleTotals.totalAllocation),
            subtext: "Assigned or scheduled active-enrollment total",
            metricId: "system-spend",
          },
          {
            id: "open-tasks",
            label: "Open Tasks",
            value: visibleTotals.openTasks,
            subtext: "Secondary workload signal for this month",
            metricId: "open-tasks",
          },
        ]}
        className="pt-1"
        gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      />

      {reportData.sharedDataError ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Customer or enrollment data could not be loaded.
        </div>
      ) : reportData.isTruncated.customers || reportData.isTruncated.enrollments ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Caseload totals may be incomplete because the organization exceeds the report display limit.
        </div>
      ) : null}

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
              customers={caseManagerReport.customersByUid.get(String(cm.uid)) || []}
              enrollmentsByCustomerId={caseManagerReport.enrollmentsByCustomerId}
              stats={caseManagerReport.statsByUid.get(String(cm.uid)) || emptyCaseManagerReportStats()}
              taskCount={monthStats.tasksByCm.get(String(cm.uid))}
              openTasksByCustomerId={monthStats.tasksByCmAndCustomer.get(String(cm.uid)) || new Map()}
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
