"use client";

import React from "react";
import type { Enrollment, TCustomerEntity } from "@types";
import { useCustomerEnrollments, usePreloadCustomerEnrollments } from "@hooks/useEnrollments";
import { useTasksForEnrollments, type TasksListItem } from "@hooks/useTasks";
import { currentMonthKey } from "@hooks/useMetrics";
import { populationChipClass, populationTone } from "@lib/colorRegistry";
import { normalizePayments } from "./paymentScheduleUtils";
import { customerContactRoleForUid } from "../contactCaseManagers";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const CARD_TASKS_LIMIT = 1000;

type CustomerCardProps = {
  customer: TCustomerEntity & { id: string };
  viewerUid?: string;
  selected?: boolean;
  selectionMode?: boolean;
  onSelectGesture?: (
    customerId: string,
    gesture: {
      source: "card" | "checkbox";
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
    },
  ) => void;
  onOpen: (customerId: string, options?: { tab?: "tasks" }) => void;
  loading?: boolean;
};

function asTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  const maybeTs = value as { seconds?: number; toDate?: () => Date };
  if (typeof maybeTs.toDate === "function") return maybeTs.toDate().getTime();
  if (typeof maybeTs.seconds === "number") return maybeTs.seconds * 1000;
  return 0;
}

export function isNewCustomer(customer: TCustomerEntity): boolean {
  const createdAt = asTime(customer.createdAt);
  return createdAt > 0 && Date.now() - createdAt < FIVE_DAYS_MS;
}

function isActiveEnrollment(enrollment: Enrollment): boolean {
  const status = String(enrollment.status || "").toLowerCase();
  if (enrollment.deleted === true || status === "deleted") return false;
  if (enrollment.active === true || status === "active") return true;
  return false;
}

function calcAge(dob?: string | null): number | null {
  if (!dob) return null;
  const dobTime = new Date(dob).getTime();
  if (!Number.isFinite(dobTime) || dobTime <= 0) return null;
  return Math.floor((Date.now() - dobTime) / (365.25 * 86400000));
}

function displayName(customer: TCustomerEntity): string {
  return (
    (customer.name && String(customer.name).trim()) ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function isInactiveCustomer(customer: TCustomerEntity): boolean {
  if (typeof customer.active === "boolean") return !customer.active;
  const status = String(customer.status || "").trim().toLowerCase();
  return status === "inactive" || status === "closed" || status === "deleted";
}

function formatDate(value: unknown): string {
  const time = asTime(value);
  if (!time) return "";
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAcuity(score: number | null | undefined): string {
  if (score == null) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function populationLabel(population: unknown): string {
  const text = String(population || "").trim();
  return text || "-";
}

function populationHeaderClass(population: unknown): string {
  switch (populationTone(population)) {
    case "sky":
      return "border-sky-200 bg-sky-100";
    case "emerald":
      return "border-emerald-200 bg-emerald-100";
    case "amber":
      return "border-amber-200 bg-amber-100";
    default:
      return "border-slate-200 bg-slate-100";
  }
}

function sortActiveEnrollments(enrollments: Enrollment[]): Enrollment[] {
  return [...enrollments].sort((a, b) => {
    const bTime = Math.max(asTime(b.updatedAt), asTime(b.startDate), asTime(b.createdAt));
    const aTime = Math.max(asTime(a.updatedAt), asTime(a.startDate), asTime(a.createdAt));
    return bTime - aTime;
  });
}

function sortTasks(tasks: TasksListItem[]): TasksListItem[] {
  return [...tasks].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
}

function formatMonthYear(value: string): string {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  return `${text.slice(5, 7)}/${text.slice(0, 4)}`;
}

function assistanceWindowLabel(enrollment: Enrollment): string | null {
  const payments = normalizePayments(Array.isArray(enrollment.payments) ? enrollment.payments : []);
  const assistancePayments = payments.filter((payment) => payment.type !== "service");
  if (!assistancePayments.length) return null;
  const dates = assistancePayments
    .map((payment) => String(payment.dueDate || "").trim())
    .filter((dueDate) => /^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    .sort();
  if (!dates.length) return null;
  const start = formatMonthYear(dates[0]);
  const end = formatMonthYear(dates[dates.length - 1]);
  if (!start || !end) return null;
  return `${start} - ${end} (Last month of assistance)`;
}

function enrollmentSummaryLabel(enrollment: Enrollment): string {
  return (
    String(enrollment.grantName || "").trim() ||
    String(enrollment.name || "").trim() ||
    "Enrollment"
  );
}

function CustomerTasksList({
  enrollmentIds,
  hasEnrollmentData,
  isLoadingEnrollmentData,
  isRefreshingEnrollmentData,
  muted = false,
  onOpenTasks,
  onLoadEnrollmentData,
}: {
  enrollmentIds: string[];
  hasEnrollmentData: boolean;
  isLoadingEnrollmentData: boolean;
  isRefreshingEnrollmentData: boolean;
  muted?: boolean;
  onOpenTasks: () => void;
  onLoadEnrollmentData: () => void;
}) {
  const month = currentMonthKey();
  const { data: tasks = [], isLoading } = useTasksForEnrollments(enrollmentIds, month, {
    enabled: hasEnrollmentData && enrollmentIds.length > 0,
    limit: CARD_TASKS_LIMIT,
  });

  const openTasks = sortTasks(tasks.filter((task) => task.status === "open"));

  if (!hasEnrollmentData && isLoadingEnrollmentData) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading enrollments...</div>;
  }

  if (!hasEnrollmentData) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={muted ? "text-slate-400" : "text-slate-500"}>Enrollment Data not cached</span>
        <button
          type="button"
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
            muted
              ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
          ].join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            onLoadEnrollmentData();
          }}
          disabled={isRefreshingEnrollmentData || isLoadingEnrollmentData}
          title="Load enrollment data for this customer"
          aria-label="Load enrollment data for this customer"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={["h-3.5 w-3.5", isRefreshingEnrollmentData ? "animate-spin" : ""].join(" ")}
          >
            <path
              d="M16 10a6 6 0 1 1-2.1-4.57"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M16 4.5v4h-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  if (isLoadingEnrollmentData || isRefreshingEnrollmentData) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading enrollments...</div>;
  }

  if (isLoading) {
    return <div className={["text-xs", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>Loading tasks...</div>;
  }

  if (openTasks.length === 0) {
    return <div className={["text-xs italic", muted ? "text-slate-400" : "text-slate-400"].join(" ")}>No tasks due this month</div>;
  }

  return (
    <div className="space-y-2">
      <div className={["text-[11px] font-semibold uppercase tracking-[0.16em]", muted ? "text-slate-400" : "text-slate-500"].join(" ")}>
        Open This Month: {openTasks.length}
      </div>
      <ul className="space-y-1.5">
        {openTasks.slice(0, 5).map((task: TasksListItem) => (
          <li key={task.id}>
            <button
              type="button"
              className={[
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs transition",
                muted
                  ? "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200/70"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
              onClick={(event) => {
                event.stopPropagation();
                onOpenTasks();
              }}
            >
              <div className="min-w-0">
                <div className={["truncate font-medium", muted ? "text-slate-600" : "text-slate-800"].join(" ")}>{task.title}</div>
                <div className={muted ? "text-slate-400" : "text-slate-400"}>Due {formatDate(task.dueDate)}</div>
              </div>
              <span className={[
                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                muted
                  ? "border-slate-200 bg-white text-slate-500"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              ].join(" ")}>
                Open
              </span>
            </button>
          </li>
        ))}
        {openTasks.length > 5 ? <li className="text-xs text-slate-400">+{openTasks.length - 5} more</li> : null}
      </ul>
    </div>
  );
}

const COL_SPAN_CLASSES = ["", "lg:col-span-1", "lg:col-span-2"] as const;
const DRAG_PX_PER_STEP = 140;

function CustomerCardInner({
  customer,
  viewerUid,
  selected = false,
  selectionMode = false,
  onSelectGesture,
  onOpen,
}: CustomerCardProps) {
  const preloadCustomerEnrollments = usePreloadCustomerEnrollments();
  const [colSpan, setColSpan] = React.useState(1);
  const dragRef = React.useRef<{ startX: number; startSpan: number } | null>(null);
  const showEnrollmentSections = colSpan > 1;

  const handleResizeMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = { startX: event.clientX, startSpan: colSpan };

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = Math.round((moveEvent.clientX - dragRef.current.startX) / DRAG_PX_PER_STEP);
        setColSpan(Math.max(1, Math.min(2, dragRef.current.startSpan + delta)));
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [colSpan],
  );

  const age = calcAge((customer as { dob?: string | null }).dob || null);
  const inactiveCustomer = isInactiveCustomer(customer);
  const viewerId = String(viewerUid || "").trim();
  const caseManagerName = String(customer.caseManagerName || customer.caseManagerId || "Unassigned").trim();
  const viewerRelationship = customerContactRoleForUid(customer as Record<string, unknown>, viewerId);
  const isViewerCustomer = !!viewerRelationship;
  const enrollmentsQuery = useCustomerEnrollments(customer.id, {
    enabled: !!customer.id && isViewerCustomer,
  });
  const enrollments = enrollmentsQuery.data || [];
  const hasEnrollmentData = enrollmentsQuery.data !== undefined;
  const isLoadingEnrollmentData = enrollmentsQuery.isLoading || enrollmentsQuery.isFetching;

  const activeEnrollments = sortActiveEnrollments(enrollments.filter(isActiveEnrollment));
  const inactiveEnrollments = enrollments.filter((enrollment) => !isActiveEnrollment(enrollment));
  const activeEnrollmentIds = activeEnrollments.map((enrollment) => enrollment.id);
  const assistanceEnrollments = activeEnrollments
    .map((enrollment) => ({
      id: String(enrollment.id || "").trim(),
      label: enrollmentSummaryLabel(enrollment),
      window: assistanceWindowLabel(enrollment),
    }))
    .filter((entry) => entry.id && entry.window);
  const relationship =
    viewerRelationship === "primary"
      ? {
          label: "My Client",
          className: "border-orange-200 bg-orange-50 text-orange-800",
        }
      : viewerRelationship === "secondary"
        ? {
            label: "Secondary Contact",
            className: "border-emerald-200 bg-emerald-50 text-emerald-800",
          }
        : viewerRelationship === "other"
          ? {
              label: "Other Contact",
              className: "border-violet-200 bg-violet-50 text-violet-800",
            }
          : null;

  return (
    <article
      className={[
        COL_SPAN_CLASSES[colSpan],
        "group relative h-full cursor-pointer overflow-hidden rounded-[24px] border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        inactiveCustomer
          ? "border-slate-200 bg-slate-50/90 text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400"
          : "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
        selected
          ? "border-sky-500 ring-2 ring-sky-200 bg-sky-50/40 shadow-md dark:ring-sky-500/40 dark:bg-sky-950/40"
          : "border-slate-200 dark:border-slate-700",
      ].join(" ")}
      onClick={(event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onSelectGesture?.(customer.id, {
            source: "card",
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });
          return;
        }
        onOpen(customer.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            onSelectGesture?.(customer.id, {
              source: "card",
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
            });
            return;
          }
          onOpen(customer.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        className={[
          "absolute right-4 top-4 z-20 transition-opacity",
          selected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <label
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full border shadow-sm",
            selected
              ? "border-sky-500 bg-sky-600 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-sky-400",
          ].join(" ")}
          title={selected ? "Selected" : "Select customer"}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected}
            readOnly
            onClick={(event) => {
              event.stopPropagation();
              onSelectGesture?.(customer.id, {
                source: "checkbox",
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
              });
            }}
          />
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.125 7.187a1 1 0 0 1-1.42 0L3.29 9.015a1 1 0 1 1 1.414-1.414l4.17 4.17 6.418-6.474a1 1 0 0 1 1.412-.007Z"
              clipRule="evenodd"
            />
          </svg>
        </label>
      </div>

      {relationship ? (
        <div
          className={[
            "mx-4 mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
            inactiveCustomer
              ? "border-slate-200 bg-slate-100 text-slate-500"
              : relationship.className,
          ].join(" ")}
        >
          {relationship.label}
        </div>
      ) : null}

      <div
        className={[
          "mt-3 border-y px-4 py-4",
          inactiveCustomer
            ? "border-slate-200 bg-slate-100/80 text-slate-500 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-400"
            : ["text-slate-950 dark:text-slate-100", populationHeaderClass(customer.population)].join(" "),
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={["text-lg font-bold tracking-tight", inactiveCustomer ? "text-slate-600 dark:text-slate-400" : "text-slate-950 dark:text-slate-50"].join(" ")}>
                {displayName(customer)}
              </span>
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  inactiveCustomer ? "border-slate-200 bg-white text-slate-500" : populationChipClass(customer.population),
                ].join(" ")}
              >
                {populationLabel(customer.population)}
              </span>
              {age != null ? <span className={inactiveCustomer ? "text-sm text-slate-500" : "text-sm text-slate-600"}>{age}y</span> : null}
              {isNewCustomer(customer) ? (
                <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  NEW
                </span>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className={["text-[10px] font-semibold uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-500 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"].join(" ")}>
              Case Manager
            </div>
            <div className={["truncate text-sm font-semibold", inactiveCustomer ? "text-slate-600 dark:text-slate-500" : "text-slate-900 dark:text-slate-200"].join(" ")}>
              {caseManagerName}
            </div>
          </div>
        </div>
        <div className={["mt-1 text-xs font-medium uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-500 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"].join(" ")}>
          CW ID: {customer.cwId ? String(customer.cwId) : "--"}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showEnrollmentSections ? (
            <span className={["rounded-full border px-3 py-1 text-xs font-semibold", inactiveCustomer ? "border-slate-200 bg-white text-slate-500" : "border-sky-300 bg-white text-slate-900"].join(" ")}>
              Enrollments: {hasEnrollmentData ? `${activeEnrollments.length}/${inactiveEnrollments.length}` : "--"}
            </span>
          ) : null}
          <span className={["rounded-full border px-3 py-1 text-xs font-semibold", inactiveCustomer ? "border-slate-200 bg-slate-100 text-slate-500" : "border-amber-200 bg-amber-50 text-amber-800"].join(" ")}>
            Acuity: {formatAcuity(customer.acuityScore as number | null | undefined)}
          </span>
        </div>
        {showEnrollmentSections && hasEnrollmentData && assistanceEnrollments.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {assistanceEnrollments.slice(0, 2).map((entry) => (
              <div
                key={entry.id}
                className={[
                  "rounded-xl border px-3 py-2 text-xs",
                  inactiveCustomer
                    ? "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                ].join(" ")}
              >
                <span className="font-semibold">{entry.label}:</span> {entry.window}
              </div>
            ))}
            {assistanceEnrollments.length > 2 ? (
              <div className={inactiveCustomer ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                +{assistanceEnrollments.length - 2} more assistance window{assistanceEnrollments.length - 2 === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showEnrollmentSections ? (
        <div className="flex h-full flex-col gap-3 px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className={["text-xs font-semibold uppercase tracking-[0.18em]", inactiveCustomer ? "text-slate-400" : "text-slate-500"].join(" ")}>
                Enrollment Tasks
              </div>
              <button
                type="button"
                className={["text-xs font-semibold underline-offset-2 hover:underline", inactiveCustomer ? "text-slate-400 hover:text-slate-500" : "text-slate-500 hover:text-slate-700"].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(customer.id, { tab: "tasks" });
                }}
              >
                Open Tasks
              </button>
            </div>
            <CustomerTasksList
              enrollmentIds={activeEnrollmentIds}
              hasEnrollmentData={hasEnrollmentData}
              isLoadingEnrollmentData={isLoadingEnrollmentData}
              isRefreshingEnrollmentData={preloadCustomerEnrollments.isPending}
              muted={inactiveCustomer}
              onOpenTasks={() => onOpen(customer.id, { tab: "tasks" })}
              onLoadEnrollmentData={() => {
                if (!customer.id) return;
                void preloadCustomerEnrollments.mutateAsync({
                  customerIds: [customer.id],
                  batchSize: 1,
                });
              }}
            />
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-3">
          <div className={["text-xs", inactiveCustomer ? "text-slate-400 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"].join(" ")}>
            Expand card for enrollment info and tasks.
          </div>
        </div>
      )}

      <div className="group absolute bottom-0 right-0" onClick={(event) => event.stopPropagation()}>
        <div
          onMouseDown={handleResizeMouseDown}
          className="hidden h-8 w-8 cursor-col-resize items-end justify-end pb-1.5 pr-1.5 opacity-0 transition-opacity group-hover:opacity-100 lg:flex"
          title={`Width: ${colSpan} col${colSpan > 1 ? "s" : ""} - drag to resize`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-slate-300">
            <path d="M7 0v2H0V0h7zM10 0v10H8V0h2zM7 4v2H0V4h7zM7 8v2H0V8h7z" />
          </svg>
        </div>
        {colSpan > 1 ? (
          <div className="pointer-events-none absolute bottom-2 right-8 hidden text-[9px] font-bold text-slate-400 lg:block">
            {colSpan}x
          </div>
        ) : null}
      </div>
    </article>
  );
}

export const CustomerCard = React.memo(CustomerCardInner);
export default CustomerCard;
