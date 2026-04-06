"use client";

import React from "react";
import { useCustomerEnrollments, useEnrollmentsList } from "@hooks/useEnrollments";
import { useCustomers } from "@hooks/useCustomers";
import { useGrants } from "@hooks/useGrants";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { asEntityArray, EntitySelect, entitySelectInputClassName, resolveEntityPlaceholder } from "./shared";

type EnrollmentLike = {
  id?: string;
  customerId?: string;
  clientId?: string;
  grantId?: string;
  status?: string;
  startDate?: unknown;
  endDate?: unknown;
};

type Props = {
  value: string | null;
  onChange: (enrollmentId: string | null) => void;
  className?: string;
  disabled?: boolean;

  filterByClientIds?: string[];
  filterByGrantId?: string | null;

  includeUnassigned?: boolean;
  placeholderLabel?: string;
  includeClosed?: boolean;
  limit?: number;
};

function normStatus(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

export default function EnrollmentSelect({
  value,
  onChange,
  className = "",
  disabled,
  filterByClientIds,
  filterByGrantId = null,
  includeUnassigned = true,
  placeholderLabel = "-- Select enrollment --",
  includeClosed = true,
  limit = 500,
}: Props) {
  const clientIds = React.useMemo(
    () => (Array.isArray(filterByClientIds) ? filterByClientIds.filter(Boolean).map(String) : []),
    [filterByClientIds]
  );

  const oneCustomerId = clientIds.length === 1 ? clientIds[0] : null;

  const byCustomerQ = useCustomerEnrollments(oneCustomerId, { enabled: !!oneCustomerId });
  const listQ = useEnrollmentsList(
    {
      limit,
      ...(oneCustomerId ? { customerId: oneCustomerId } : {}),
      ...(filterByGrantId ? { grantId: String(filterByGrantId) } : {}),
    } as any,
    { enabled: !oneCustomerId }
  );

  const rawEnrollments = (oneCustomerId ? byCustomerQ.data : listQ.data) as unknown;
  const enrollments = React.useMemo(() => asEntityArray<EnrollmentLike>(rawEnrollments), [rawEnrollments]);

  const customersQ = useCustomers(
    { limit: 500, active: "all", deleted: "include" },
    { enabled: true }
  );
  const grantsQ = useGrants({ limit: 500 }, { enabled: true });

  const customerNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of asEntityArray<Record<string, unknown>>(customersQ.data)) {
      const id = String(c?.id || "");
      if (!id) continue;
      const full = [String(c?.firstName || "").trim(), String(c?.lastName || "").trim()].filter(Boolean).join(" ");
      const name = String(c?.name || "").trim() || full || id;
      m.set(id, name);
    }
    return m;
  }, [customersQ.data]);

  const grantNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const g of asEntityArray<Record<string, unknown>>(grantsQ.data)) {
      const id = String(g?.id || "");
      if (!id) continue;
      const name = String(g?.name || g?.code || "").trim() || id;
      m.set(id, name);
    }
    return m;
  }, [grantsQ.data]);

  const options = React.useMemo(() => {
    let rows = enrollments.slice();

    if (clientIds.length > 0) {
      const set = new Set(clientIds.map(String));
      rows = rows.filter((r) => set.has(String(r?.customerId || r?.clientId || "")));
    }

    if (filterByGrantId) {
      const gid = String(filterByGrantId);
      rows = rows.filter((r) => String(r?.grantId || "") === gid);
    }

    if (!includeClosed) {
      rows = rows.filter((r) => {
        const s = normStatus(r?.status);
        return s !== "closed" && s !== "deleted";
      });
    }

    rows.sort((a, b) => String(b?.startDate || "").localeCompare(String(a?.startDate || "")));

    return rows
      .map((r) => {
        const id = String(r?.id || "");
        if (!id) return null;
        const customerId = String(r?.customerId || r?.clientId || "");
        const grantId = String(r?.grantId || "");
        const status = normStatus(r?.status) || "active";
        const customerName = customerNameById.get(customerId) || customerId || "Unknown customer";
        const grantName = grantNameById.get(grantId) || grantId || "Unknown grant";
        const enrollmentLabel = formatEnrollmentLabel({
          id,
          grantName,
          grantId,
          startDate: r?.startDate,
        });
        return {
          id,
          label: `${customerName} | ${enrollmentLabel} | ${status}`,
        };
      })
      .filter((x): x is { id: string; label: string } => !!x);
  }, [enrollments, clientIds, filterByGrantId, includeClosed, customerNameById, grantNameById]);

  const loading = byCustomerQ.isLoading || listQ.isLoading || customersQ.isLoading || grantsQ.isLoading;
  const isDisabled = Boolean(disabled || loading);
  const empty = !loading && options.length === 0;
  const placeholder = resolveEntityPlaceholder({
    isLoading: loading,
    isEmpty: empty,
    loadingLabel: "Loading enrollments...",
    emptyLabel: "No enrollments found",
    placeholderLabel,
  });

  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      options={options.map((opt) => ({ value: opt.id, label: opt.label }))}
      placeholderOption={includeUnassigned ? placeholder : undefined}
      disabled={isDisabled}
      fullWidth
      inputClassName={entitySelectInputClassName("min-w-[320px]", className)}
    />
  );
}
