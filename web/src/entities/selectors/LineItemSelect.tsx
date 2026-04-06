"use client";

import React from "react";
import { useGrant } from "@hooks/useGrants";
import { EntitySelect } from "./shared";

type GrantLineItemLite = {
  id?: string;
  label?: string | null;
  amount?: number | null;
  locked?: boolean | null;
};

type Props = {
  grantId?: string | null;
  value: string | null;
  onChange: (lineItemId: string | null) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  placeholderLabel?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  fallbackLineItemIds?: string[];
  includeLocked?: boolean;
  tourId?: string;
};

function money(v: number): string {
  return Number(v || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function LineItemSelect({
  grantId,
  value,
  onChange,
  disabled,
  className = "",
  inputClassName = "",
  placeholderLabel = "-- Select line item --",
  allowEmpty = false,
  emptyLabel = "-- None --",
  fallbackLineItemIds = [],
  includeLocked = false,
  tourId,
}: Props) {
  const grantQ = useGrant(grantId || undefined, { enabled: !!grantId });
  const currentValue = String(value || "").trim();

  const options = React.useMemo(() => {
    const fromGrant = Array.isArray((grantQ.data as { budget?: { lineItems?: unknown[] } } | null)?.budget?.lineItems)
      ? (((grantQ.data as { budget?: { lineItems?: unknown[] } }).budget?.lineItems || []) as GrantLineItemLite[])
      : [];

    const seen = new Set<string>();
    const out: Array<{ value: string; label: string; disabled?: boolean }> = [];

    for (const li of fromGrant) {
      const id = String(li?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const locked = li?.locked === true;
      if (locked && !includeLocked) continue;
      const labelBase = String(li?.label || id);
      const amt = Number(li?.amount || 0);
      out.push({
        value: id,
        label: `${labelBase} (${id})${Number.isFinite(amt) ? ` - ${money(amt)}` : ""}${locked ? " [locked]" : ""}`,
        disabled: locked,
      });
    }

    for (const idRaw of fallbackLineItemIds) {
      const id = String(idRaw || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ value: id, label: id });
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [fallbackLineItemIds, grantQ.data, includeLocked]);

  const hasCurrent = !!currentValue && options.some((o) => o.value === currentValue);
  const finalOptions = React.useMemo(() => {
    if (!currentValue || hasCurrent) return options;
    return [{ value: currentValue, label: `${currentValue} (current)` }, ...options];
  }, [currentValue, hasCurrent, options]);

  const isDisabled = Boolean(disabled || (!!grantId && grantQ.isLoading));
  const placeholder = grantId
    ? grantQ.isLoading
      ? "Loading line items..."
      : finalOptions.length
        ? placeholderLabel
        : "No line items found"
    : (fallbackLineItemIds.length ? placeholderLabel : "Select grant first");

  return (
    <EntitySelect
      tourId={tourId}
      value={currentValue}
      onChange={onChange}
      disabled={isDisabled}
      fullWidth
      className={className}
      inputClassName={inputClassName}
      placeholderOption={allowEmpty ? emptyLabel : placeholder}
      placeholderDisabled={!allowEmpty}
      options={finalOptions}
    />
  );
}
