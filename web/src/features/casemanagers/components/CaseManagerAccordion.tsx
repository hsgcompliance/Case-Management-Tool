// CaseManagerAccordion.tsx
"use client";

import React from "react";
import { useCmContactCustomers } from "@hooks/useCustomers";
import { useEnrollmentsList } from "@hooks/useEnrollments";
import { metricPillClass } from "@lib/colorRegistry";
import type { CaseManagerUser, CustomerRow, EnrollmentRow } from "./model";
import { cmLabel } from "./model";
import CaseManagerPanel from "./CaseManagerPanel";

type Props = {
  user: CaseManagerUser;
  monthKey: string;
  taskCount?: number;
  defaultOpen?: boolean;
};

export function CaseManagerAccordion({ user, monthKey, taskCount, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const cmUid = String(user.uid || "");

  const cmCustomersQ = useCmContactCustomers(cmUid, { enabled: isOpen });

  const enrollmentsQ = useEnrollmentsList(
    { limit: 500 },
    { enabled: isOpen }
  );

  const enrollmentsByCustomerId = React.useMemo(() => {
    const cmCustomerIds = new Set((cmCustomersQ.data || []).map((c) => String(c.id)));
    const map = new Map<string, EnrollmentRow[]>();
    for (const row of (enrollmentsQ.data || []) as EnrollmentRow[]) {
      const customerId = String((row as any).customerId || "");
      if (!customerId || !cmCustomerIds.has(customerId)) continue;
      if (!map.has(customerId)) map.set(customerId, []);
      map.get(customerId)!.push(row);
    }
    return map;
  }, [cmCustomersQ.data, enrollmentsQ.data]);

  const isLoading = isOpen && (cmCustomersQ.isLoading || enrollmentsQ.isLoading);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-900">{cmLabel(user)}</span>
          {typeof taskCount === "number" && (
            <span className={["inline-flex items-center rounded-full border px-2 py-0.5 text-xs", metricPillClass("open-tasks")].join(" ")}>
              {taskCount} tasks
            </span>
          )}
          {isLoading && (
            <span className="text-xs text-slate-400">Loading…</span>
          )}
        </div>
        <span className="text-slate-400 text-sm">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && !isLoading && (
        <div className="border-t border-slate-100">
          <CaseManagerPanel
            user={user}
            customers={(cmCustomersQ.data || []) as CustomerRow[]}
            enrollmentsByCustomerId={enrollmentsByCustomerId}
            monthKey={monthKey}
            defaultOpen
          />
        </div>
      )}
    </div>
  );
}

export default CaseManagerAccordion;
