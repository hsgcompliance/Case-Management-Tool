"use client";

import React from "react";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import { useGrants } from "@hooks/useGrants";
import { TaskInput } from "@entities/tasks/TaskInput";
import type { Enrollment } from "@client/enrollments";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";

export function TasksTab({ customerId }: { customerId: string }) {
  const { data: enrollments = [], isLoading } = useCustomerEnrollments(
    customerId
  );
  const { data: grants = [] } = useGrants({ limit: 500 });
  const [selectedEnrollmentId, setSelectedEnrollmentId] = React.useState<string>("");

  const selectedEnrollment = React.useMemo<Enrollment | null>(
    () => enrollments.find((e) => String(e.id || "") === selectedEnrollmentId) || null,
    [enrollments, selectedEnrollmentId],
  );

  const grantStatusById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants as Array<Record<string, unknown>>) {
      const id = String(g.id || "").trim();
      if (!id) continue;
      map.set(id, String(g.status || "").toLowerCase());
    }
    return map;
  }, [grants]);

  const enrollmentClosed = React.useMemo(() => {
    const row = selectedEnrollment;
    if (!row) return false;
    const status = String(row.status || "").toLowerCase();
    if (status === "closed" || status === "deleted") return true;
    if (typeof row.active === "boolean") return !row.active;
    return false;
  }, [selectedEnrollment]);

  const grantClosed = React.useMemo(() => {
    if (!selectedEnrollment) return false;
    const grantId = String(selectedEnrollment.grantId || "");
    const status = grantStatusById.get(grantId) || "";
    return status === "closed" || status === "deleted";
  }, [grantStatusById, selectedEnrollment]);

  const rowReadOnly = enrollmentClosed || grantClosed;

  React.useEffect(() => {
    if (!enrollments.length) {
      setSelectedEnrollmentId("");
      return;
    }
    setSelectedEnrollmentId((prev) => prev || String(enrollments[0]?.id || ""));
  }, [enrollments]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-medium text-slate-800">Customer Task Input</div>
        {isLoading ? (
          <div className="mt-2 text-sm text-slate-600">Loading enrollments...</div>
        ) : enrollments.length === 0 ? (
          <div className="mt-2 text-sm text-slate-600">No active enrollments for this customer.</div>
        ) : (
          <label className="block mt-2 text-sm">
            <div className="text-xs text-slate-600">Enrollment</div>
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.currentTarget.value)}
            >
              {enrollments.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {formatEnrollmentLabel(row)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <TaskInput enrollmentId={selectedEnrollmentId || null} readOnly={rowReadOnly} />
    </div>
  );
}

export default TasksTab;
