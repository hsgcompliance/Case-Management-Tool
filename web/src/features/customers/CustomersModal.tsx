// src/features/customers/CustomersModal.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@entities/ui/Modal";
import { useCustomer, useSetCustomerActive, useUpsertCustomers } from "@hooks/useCustomers";
import { qk } from "@hooks/queryKeys";
import type { CustomersUpsertReq } from "@types";

import {
  DetailsTab,
  EnrollmentsTab,
  CaseManagementTab,
  AssessmentsTab,
  TasksTab,
  PaymentsTab,
  CustomerFilesTab,
} from "./tabs";
import NewCustomerFlow from "./NewCustomerFlow";

type TabKey =
  | "details"
  | "enrollments"
  | "case"
  | "assessments"
  | "tasks"
  | "payments"
  | "files";

function readRequestedTab(searchParams: ReturnType<typeof useSearchParams>): TabKey {
  const raw = String(searchParams?.get("tab") || "").trim().toLowerCase();
  if (
    raw === "details" ||
    raw === "enrollments" ||
    raw === "case" ||
    raw === "assessments" ||
    raw === "tasks" ||
    raw === "payments" ||
    raw === "files"
  ) {
    return raw;
  }
  return "details";
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? {}));
}

function stripServerManagedForWrite(input: Record<string, unknown>) {
  const next = clone(input);
  delete next.createdAt;
  delete next.updatedAt;
  delete next.deleted;
  delete next.orgId;
  return next;
}

// Stable stringify so “dirty” isn’t fooled by key order
function stable(v: unknown): unknown {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(stable);
  if (typeof v === "object") {
    return Object.keys(v)
      .sort()
      .reduce((acc: Record<string, unknown>, k) => {
        acc[k] = stable((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}
function stableStringify(v: unknown) {
  return JSON.stringify(stable(v));
}

function isReservedRouteId(value: unknown): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
}

function applyActiveState(model: Record<string, unknown>, active: boolean) {
  const next = { ...(model || {}) };
  next.active = active;
  next.status = active ? "active" : "inactive";
  if ("deleted" in next) next.deleted = false;
  return next;
}

function isCustomerActive(model: Record<string, unknown>, detail: unknown) {
  const source = (model && Object.keys(model).length ? model : detail || {}) as Record<string, unknown>;
  if (typeof source.active === "boolean") return source.active;
  return String(source.status || "active").trim().toLowerCase() === "active";
}

export function CustomersModal(props: { customerId: string | null; onClose?: () => void; pageMode?: boolean }) {
  const { customerId, onClose: onCloseProp, pageMode = false } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const customerIdStr = String(customerId || "").trim();
  const creating = !customerIdStr || customerIdStr === "new" || customerIdStr === "(.)new";
  const requestedTab = React.useMemo(() => readRequestedTab(searchParams), [searchParams]);

  const onClose = onCloseProp ?? (() => router.back());

  const { data: detail, isFetching: loadingDetail } = useCustomer(
    !creating ? customerId! : undefined,
    {
    enabled: !creating,
    staleTime: 30_000,
    }
  );

  const [tab, setTab] = React.useState<TabKey>(requestedTab);
  const [editing, setEditing] = React.useState<boolean>(creating);
  const [error, setError] = React.useState<string | null>(null);

  const [model, setModel] = React.useState<Record<string, unknown>>(() =>
    creating ? { status: "active" } : {}
  );

  // Route transitions can reuse this component instance (ex: [id] -> new in workspace modal).
  // Reset editor state so "new customer" always starts blank/in edit mode.
  React.useEffect(() => {
    setTab(requestedTab);
    setError(null);
    setEditing(creating);
    setModel(creating ? { status: "active" } : {});
  }, [customerId, creating, requestedTab]);

  React.useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  // Initialize model once detail is available (but don't stomp on edits)
  React.useEffect(() => {
    if (creating) return;
    if (!loadingDetail && detail && !editing) {
      setModel(clone(detail));
    }
  }, [creating, loadingDetail, detail, editing]);

  React.useEffect(() => {
    if (creating) return;
    if (!loadingDetail && detail && Object.keys(model).length === 0) {
      setModel(clone(detail));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, loadingDetail, detail]);

  const upsert = useUpsertCustomers();
  const setCustomerActive = useSetCustomerActive();
  const saving = upsert.isPending;

  const resetToServer = () => {
    if (creating) setModel({ status: "active" });
    else if (detail) setModel(clone(detail));
  };

  const onToggleEdit = () => {
    setError(null);
    setEditing((prev) => {
      const next = !prev;
      if (!next) resetToServer(); // turning edit OFF => restore
      return next;
    });
  };

  const onToggleActive = async () => {
    const nextActive = !isCustomerActive(model, detail);
    setError(null);
    setModel((prev) => applyActiveState(prev as Record<string, unknown>, nextActive));

    if (creating || !customerIdStr) return;

    try {
      await setCustomerActive.mutateAsync({ id: customerIdStr, active: nextActive });
    } catch (e: unknown) {
      if (detail) setModel(clone(detail));
      setError(e instanceof Error ? e.message : "Status update failed. Please try again.");
    }
  };

  const onSave = async () => {
    setError(null);
    try {
      const safeName =
        (model?.name && String(model.name).trim()) ||
        [model?.firstName, model?.lastName].filter(Boolean).join(" ").trim() ||
        "Unnamed";

      const base = stripServerManagedForWrite({
        ...(model as Record<string, unknown>),
        name: safeName,
      });
      if (creating && "id" in (base as Record<string, unknown>)) {
        delete (base as Record<string, unknown>).id;
      }

      const row = {
        ...base,
        enrolled: Boolean((base as { enrolled?: unknown })?.enrolled),
        ...(creating ? {} : { id: customerId! }),
      };
      if (isReservedRouteId((row as Record<string, unknown>).id)) {
        delete (row as Record<string, unknown>).id;
      }
      const payload: CustomersUpsertReq = [row];
      const resp = await upsert.mutateAsync(payload);
      const createdId =
        creating && resp && typeof resp === "object" && Array.isArray((resp as { ids?: unknown[] }).ids)
          ? String(((resp as { ids?: unknown[] }).ids || [])[0] || "").trim()
          : "";

      if (creating && createdId) {
        // Suspenders: ensure detail cache is keyed by the new real ID before routing.
        qc.setQueryData(qk.customers.detail(createdId), (prev: unknown) =>
          prev && typeof prev === "object"
            ? { ...(row as Record<string, unknown>), ...(prev as Record<string, unknown>), id: createdId }
            : { ...(row as Record<string, unknown>), id: createdId }
        );
        router.push(`/customers/${createdId}`);
        return;
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed. Please try again.");
    }
  };

  const titleName =
    (typeof model?.fullName === "string" && model.fullName.trim()) ||
    (model?.firstName || model?.lastName
      ? [model.firstName, model.lastName].filter(Boolean).join(" ").trim()
      : "") ||
    customerId ||
    "Customer";

  const tabs: Array<[TabKey, string]> = [
    ["details", "Details"],
    ["enrollments", "Enrollments"],
    ["case", "Case Management"],
    ["assessments", "Assessments"],
    ["tasks", "Tasks"],
    ["payments", "Payment Schedules"],
    ["files", "Files"],
  ];

  const hasRecord = !!customerId && customerId !== "new";
  const canSave =
    tab === "details" &&
    (creating || editing) &&
    !saving &&
    !(customerId && loadingDetail);

  const baseline = creating ? { status: "active" } : detail ? detail : {};
  const dirty =
    tab === "details" &&
    (creating || editing) &&
    stableStringify(model) !== stableStringify(baseline);

  const onBeforeClose = async () => {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  };

  const modalTitle = (
    <div className="min-w-0">
      <div className="text-base font-semibold truncate">
        {creating ? "New Customer" : titleName}
      </div>
      {customerId ? (
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{customerId}</div>
      ) : null}
    </div>
  );

  const modalFooter = (
    <>
      <div className="mr-auto">
        {/* optional: you can put status/active chips here later */}
      </div>

      <button
        className="btn btn-secondary btn-sm"
        onClick={onClose}
      >
        Close
      </button>

      <button
        className="btn btn-sm"
        disabled={!canSave}
        onClick={onSave}
        data-tour="customer-detail-save-btn"
        title={!canSave && tab !== "details" ? "Save is only on Details tab" : undefined}
      >
        {saving ? "Saving…" : creating ? "Create" : "Save"}
      </button>
    </>
  );

  const content = (
    <div className="space-y-4" data-tour="customer-modal">
      {pageMode && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-500">
                  {creating ? "New Customer" : "Customer"}
                </span>
                <span className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  {String(model?.status || detail?.status || "active")}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {creating ? "New Customer" : titleName}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Use Edit to update details, then save changes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm"
                disabled={!canSave}
                onClick={onSave}
                title={!canSave && tab !== "details" ? "Save is only on Details tab" : undefined}
              >
                {saving ? "Saving..." : creating ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Tabs header */}
        <div className="tabs" data-tour="customer-tabs">
          {tabs.map(([key, label]) => {
            const disabled = key !== "details" && !hasRecord;
            const active = tab === key;

            return (
              <button
                key={key}
                disabled={disabled}
                className={["tab", active ? "tab-active" : "", disabled ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
                onClick={() => !disabled && setTab(key)}
                title={disabled ? "Save the customer first" : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        {customerId && loadingDetail ? (
          <div className="text-sm text-slate-600 dark:text-slate-400">Loading…</div>
        ) : (
          <div className="mt-2">
            {tab === "details" && (
              <DetailsTab
                creating={creating}
                editing={editing}
                model={model}
                setModel={setModel}
                onToggleEdit={!creating ? onToggleEdit : undefined}
                onToggleActive={onToggleActive}
                statusBusy={setCustomerActive.isPending}
              />
            )}
            {tab === "enrollments" && hasRecord && <EnrollmentsTab customerId={customerId!} />}
            {tab === "case" && hasRecord && <CaseManagementTab customerId={customerId!} />}
            {tab === "assessments" && hasRecord && <AssessmentsTab customerId={customerId!} />}
            {tab === "tasks" && hasRecord && <TasksTab customerId={customerId!} />}
            {tab === "payments" && hasRecord && <PaymentsTab customerId={customerId!} />}
            {tab === "files" && hasRecord && <CustomerFilesTab customerId={customerId!} />}
          </div>
        )}
      </div>
    </div>
  );

  if (creating) {
    const createContent = <NewCustomerFlow onClose={onClose} />;

    if (pageMode) {
      return createContent;
    }

    return (
      <Modal
        isOpen={true}
        title="New Customer"
        onClose={onClose}
        widthClass="max-w-6xl"
        footer={<div />}
        disableOverlayClose={false}
      >
        {createContent}
      </Modal>
    );
  }

  if (pageMode) {
    return content;
  }

  return (
    <Modal
      isOpen={true}
      title={modalTitle}
      onClose={onClose}
      onBeforeClose={onBeforeClose}
      widthClass="max-w-5xl"
      footer={modalFooter}
      disableOverlayClose={false}
    >
      {content}
    </Modal>
  );
}

export default CustomersModal;
