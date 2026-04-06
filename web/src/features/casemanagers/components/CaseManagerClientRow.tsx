//web/src/features/casemanagers/components/CaseManagerClientRow.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import { useTasksUpdateStatus } from "@hooks/useTasks";
import { usePaymentsSpend, usePaymentsUpdateCompliance } from "@hooks/usePayments";
import { metricPillClass, populationChipClass, statusChipClass, toneTextClass } from "@lib/colorRegistry";
import type { CustomerRow, EnrollmentRow } from "./model";
import { customerLabel, fmtDOB, populationLabel, toISO10 } from "./model";
import { customerContactRoleForUid } from "@features/customers/contactCaseManagers";

type Props = {
  customer: CustomerRow;
  enrollments: EnrollmentRow[];
  monthKey: string;
  cmName: string;
  cmUid: string;
};

type AssessmentDue = {
  enrollmentId: string;
  taskId: string;
  due: string;
  title: string;
  completed: boolean;
};

type PaymentDue = {
  enrollmentId: string;
  paymentId: string;
  due: string;
  amount: number;
  paid: boolean;
  type: string;
  vendor?: string;
  comment?: string;
  hmis: boolean;
  caseworthy: boolean;
};

function isAssessmentTask(task: Record<string, unknown> | null | undefined): boolean {
  if (!task) return false;
  const bucket = String(task.bucket || "").toLowerCase();
  if (bucket === "assessment") return true;
  const type = String(task.type || "").toLowerCase();
  return type.includes("assessment");
}

export default function CaseManagerClientRow({ customer, enrollments, monthKey, cmName, cmUid }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const taskStatus = useTasksUpdateStatus();
  const spend = usePaymentsSpend();
  const paymentCompliance = usePaymentsUpdateCompliance();

  const [expanded, setExpanded] = React.useState(false);

  const assessments = React.useMemo<AssessmentDue[]>(() => {
    const out: AssessmentDue[] = [];
    for (const e of enrollments) {
      const schedule = Array.isArray(e.taskSchedule) ? e.taskSchedule : [];
      for (const raw of schedule) {
        const task = raw as Record<string, unknown>;
        if (!isAssessmentTask(task)) continue;
        const due = toISO10(task.dueDate);
        if (!due || !due.startsWith(monthKey)) continue;
        out.push({
          enrollmentId: String(e.id),
          taskId: String(task.id || ""),
          due,
          title: String(task.type || "Assessment"),
          completed: Boolean(task.completed),
        });
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }, [enrollments, monthKey]);

  const payments = React.useMemo<PaymentDue[]>(() => {
    const out: PaymentDue[] = [];
    for (const e of enrollments) {
      const list = Array.isArray(e.payments) ? e.payments : [];
      for (const p of list) {
        const row = p as Record<string, unknown>;
        const due = toISO10(row.dueDate || row.date);
        if (!due || !due.startsWith(monthKey)) continue;
        const compliance = (row.compliance || {}) as Record<string, unknown>;
        out.push({
          enrollmentId: String(e.id),
          paymentId: String(row.id || ""),
          due,
          amount: Number(row.amount || 0),
          paid: Boolean(row.paid),
          type: String(row.type || "payment"),
          vendor: typeof row.vendor === "string" ? row.vendor : undefined,
          comment: typeof row.comment === "string" ? row.comment : undefined,
          hmis: compliance.hmisComplete === true,
          caseworthy: compliance.caseworthyComplete === true,
        });
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }, [enrollments, monthKey]);

  const header = React.useMemo(() => {
    const active = enrollments.filter((e) => String(e.status || "").toLowerCase() === "active").length;
    const total = enrollments.length;
    return {
      active,
      total,
      assessDue: assessments.filter((a) => !a.completed).length,
      payDue: payments.filter((p) => !p.paid).length,
    };
  }, [enrollments, assessments, payments]);

  const enrollmentTags = React.useMemo(() => {
    return enrollments.map((e) => {
      const name = String(e.grantName || e.grantId || "Grant");
      const active = String(e.status || "").toLowerCase() === "active" || e.active === true;
      return `${name} (${active ? "active" : "inactive"})`;
    });
  }, [enrollments]);

  async function refreshEnrollmentViews(enrollmentId: string) {
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: qk.enrollments.detail(enrollmentId) }),
      qc.invalidateQueries({ queryKey: qk.enrollments.root }),
      qc.invalidateQueries({ queryKey: qk.payments.byEnrollment(enrollmentId) }),
    ]);
  }

  async function onToggleAssessment(a: AssessmentDue, next: boolean) {
    await taskStatus.mutateAsync({
      enrollmentId: a.enrollmentId,
      taskId: a.taskId,
      action: next ? "complete" : "reopen",
      reason: next ? undefined : "Reopened in Case Managers",
    });
    await refreshEnrollmentViews(a.enrollmentId);
  }

  async function onTogglePaid(p: PaymentDue, next: boolean) {
    await spend.mutateAsync({
      body: {
        enrollmentId: p.enrollmentId,
        paymentId: p.paymentId,
        reverse: !next,
      },
    });
    await refreshEnrollmentViews(p.enrollmentId);
  }

  async function onToggleCompliance(
    p: PaymentDue,
    field: "hmisComplete" | "caseworthyComplete",
    next: boolean
  ) {
    await paymentCompliance.mutateAsync({
      enrollmentId: p.enrollmentId,
      paymentId: p.paymentId,
      patch: { [field]: next },
    });
    await refreshEnrollmentViews(p.enrollmentId);
  }

  const fullName = customerLabel(customer);
  const pop = populationLabel(customer.population);
  const status = String(customer.status || "");
  const contactRole = customerContactRoleForUid(customer as Record<string, unknown>, cmUid);

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div
        className="w-full cursor-pointer select-none bg-slate-100 px-3 py-2"
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              {fullName}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                DOB {fmtDOB(customer.dob)}
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {contactRole === "secondary" ? "Secondary" : contactRole === "other" ? "Other Contact" : "Primary"} {cmName || "-"}
              </span>
              {pop ? (
                <span className={["rounded-full border px-2 py-0.5", populationChipClass(pop)].join(" ")}>{pop}</span>
              ) : null}
              {status ? (
                <span className={["rounded-full border px-2 py-0.5", statusChipClass(status)].join(" ")}>{status}</span>
              ) : null}
            </div>
            {enrollmentTags.length ? (
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {enrollmentTags.join(" | ")}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className={["rounded-full border px-2 py-0.5", metricPillClass("assessments-due")].join(" ")}>
                Assess due <b>{header.assessDue}</b>
              </span>
              <span className={["rounded-full border px-2 py-0.5", metricPillClass("payments-due")].join(" ")}>
                Pays due <b>{header.payDue}</b>
              </span>
              <span className={["rounded-full border px-2 py-0.5", metricPillClass("my-enrollments")].join(" ")}>
                Enrollments <b>{header.active}</b>/<b>{header.total}</b>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Open customer modal"
              onClick={() => router.push(`/customers/${customer.id}`)}
            >
              Open
            </button>
            <button className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="grid grid-cols-1 gap-3 bg-white p-3 md:grid-cols-3 dark:bg-slate-900">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Assessments due (this month)</div>
            {assessments.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">None</div>
            ) : (
              <ul className="space-y-1">
                {assessments.map((a) => (
                  <li key={`${a.enrollmentId}_${a.taskId}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gray-900"
                      checked={a.completed}
                      disabled={taskStatus.isPending}
                      onChange={(e) => onToggleAssessment(a, e.currentTarget.checked)}
                    />
                    <span className="truncate">
                      {a.due} - {a.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Payments due (this month)</div>
            {payments.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">None</div>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={`${p.enrollmentId}_${p.paymentId}`} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate">
                        {p.due} - ${p.amount.toFixed(2)} - {p.type}
                        {p.vendor ? ` - vendor: ${p.vendor}` : ""}
                        {p.comment ? ` - ${p.comment}` : ""}
                      </div>
                      <div className="shrink-0 text-xs">
                        <label className="mr-2 inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-gray-900"
                            checked={p.paid}
                            disabled={spend.isPending}
                            onChange={(e) => onTogglePaid(p, e.currentTarget.checked)}
                          />
                          Paid
                        </label>
                        <label className="mr-2 inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-gray-900"
                            checked={p.hmis}
                            disabled={paymentCompliance.isPending}
                            onChange={(e) => onToggleCompliance(p, "hmisComplete", e.currentTarget.checked)}
                          />
                          HMIS
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-gray-900"
                            checked={p.caseworthy}
                            disabled={paymentCompliance.isPending}
                            onChange={(e) =>
                              onToggleCompliance(p, "caseworthyComplete", e.currentTarget.checked)
                            }
                          />
                          CW
                        </label>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Enrollments</div>
            {enrollments.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">-</div>
            ) : (
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                {enrollments.map((e) => {
                  const name = String(e.grantName || e.grantId || "Grant");
                  const active = String(e.status || "").toLowerCase() === "active" || e.active === true;
                  return (
                    <li key={String(e.id)} className="flex items-center justify-between gap-2">
                      <span className="truncate">{name}</span>
                      <span className={active ? toneTextClass("emerald") : toneTextClass("slate")}>
                        {active ? "active" : "inactive"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}
