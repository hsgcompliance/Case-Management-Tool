import React from "react";
import { useCmContactCustomers } from "@hooks/useCustomers";
import { useEnrollmentsList } from "@hooks/useEnrollments";
import type { CompositeUser } from "@hooks/useUsers";
import { fullNameFromCustomer } from "@widgets/utils";
import { useDashboardSharedData } from "./useDashboardSharedData";
import { contactCaseManagerIdsForCustomer, customerContactRoleForUid } from "@features/customers/contactCaseManagers";

function readFinite(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type BaseLoadEntry = {
  caseManagerName: string;
  customers: number;
  enrollments: number;
  acuitySum: number;
  acuityCount: number;
};

/**
 * Admin caseload data hook — zero Firestore reads in summary view (metrics-based),
 * targeted server-side reads in detail view (real CM uid selected).
 *
 * Summary view: selectedUid is empty or starts with "queue:"
 * Detail view:  selectedUid is a real CM uid
 */
export function useAdminCaseloadData(opts: {
  selectedUid: string;
  usersData: CompositeUser[];
}): {
  baseLoadByUid: Map<string, BaseLoadEntry>;
  customerNameById: Map<string, string>;
  enrollmentsByCustomer: Map<string, number>;
  customers: any[];
  isMetricsFallback: boolean;
  isLoading: boolean;
} {
  const { selectedUid, usersData } = opts;
  const isDetailView = !!selectedUid && !selectedUid.startsWith("queue:");
  const {
    customers: sharedCustomers,
    enrollmentsByCustomer: sharedEnrollmentsByCustomer,
    sharedDataLoading,
  } = useDashboardSharedData();

  // Only fires in detail view
  const cmCustomersQ = useCmContactCustomers(selectedUid, { enabled: isDetailView });
  const enrollmentsQ = useEnrollmentsList({ limit: 500 }, { enabled: isDetailView });

  const customers = React.useMemo<Array<Record<string, unknown>>>(() => {
    if (!isDetailView) return [];
    return (cmCustomersQ.data || []) as Array<Record<string, unknown>>;
  }, [isDetailView, cmCustomersQ.data]);

  const customerNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) {
      const id = String(c.id || "");
      if (!id) continue;
      m.set(id, fullNameFromCustomer(c));
    }
    return m;
  }, [customers]);

  const enrollmentsByCustomer = React.useMemo(() => {
    const m = new Map<string, number>();
    if (!isDetailView) return m;
    const customerIds = new Set(customers.map((c) => String(c.id || "")));
    for (const e of (enrollmentsQ.data || []) as Array<Record<string, unknown>>) {
      const customerId = String(e.customerId || e.clientId || "");
      if (!customerId || !customerIds.has(customerId)) continue;
      m.set(customerId, (m.get(customerId) || 0) + 1);
    }
    return m;
  }, [isDetailView, customers, enrollmentsQ.data]);

  const baseLoadByUid = React.useMemo(() => {
    const m = new Map<string, BaseLoadEntry>();

    if (!isDetailView) {
      // Summary mode: compute from shared dashboard customer/enrollment caches.
      for (const u of usersData) {
        const uid = String(u.uid || "");
        if (!uid) continue;
        m.set(uid, {
          caseManagerName: String(u.displayName || u.email || uid),
          customers: 0,
          enrollments: 0,
          acuitySum: 0,
          acuityCount: 0,
        });
      }
      for (const c of sharedCustomers as Array<Record<string, unknown>>) {
        const contacts = contactCaseManagerIdsForCustomer(c);
        if (!contacts.length) continue;

        for (const uid of contacts) {
          const cur = m.get(uid) || {
            caseManagerName: uid,
            customers: 0,
            enrollments: 0,
            acuitySum: 0,
            acuityCount: 0,
          };
          cur.customers += 1;
          cur.enrollments += sharedEnrollmentsByCustomer.get(String(c.id || "")) || 0;
          const score = readFinite(((c.acuity as any)?.score) ?? c.acuityScore);
          if (score !== null) {
            const role = customerContactRoleForUid(c, uid);
            if (role === "secondary") {
              cur.acuitySum += score * 0.5;
              cur.acuityCount += 0.5;
            } else if (role === "primary") {
              cur.acuitySum += score;
              cur.acuityCount += 1;
            }
          }
          m.set(uid, cur);
        }
      }
    } else {
      // Detail mode: build from this CM's real customers
      for (const c of customers) {
        const id = selectedUid;
        const cur = m.get(id) || {
          caseManagerName: String(c.caseManagerName || selectedUid),
          customers: 0,
          enrollments: 0,
          acuitySum: 0,
          acuityCount: 0,
        };
        cur.customers += 1;
        cur.enrollments += enrollmentsByCustomer.get(String(c.id || "")) || 0;
        const score = readFinite(
          ((c.acuity as any)?.score) ?? c.acuityScore
        );
        if (score !== null) {
          const role = customerContactRoleForUid(c, selectedUid);
          if (role === "secondary") {
            cur.acuitySum += score * 0.5;
            cur.acuityCount += 0.5;
          } else if (role === "primary") {
            cur.acuitySum += score;
            cur.acuityCount += 1;
          }
        }
        m.set(id, cur);
      }
    }

    return m;
  }, [
    isDetailView,
    usersData,
    sharedCustomers,
    sharedEnrollmentsByCustomer,
    customers,
    enrollmentsByCustomer,
    selectedUid,
  ]);

  const isLoading = isDetailView
    ? (cmCustomersQ.isLoading || enrollmentsQ.isLoading)
    : sharedDataLoading;

  return {
    baseLoadByUid,
    customerNameById,
    enrollmentsByCustomer,
    customers: customers as any[],
    isMetricsFallback: false,
    isLoading,
  };
}
