"use client";

import React from "react";
import { useCreditCards } from "@hooks/useCreditCards";
import type { CreditCardsListReq } from "@types";
import { asEntityArray, EntitySelect, entitySelectInputClassName, resolveEntityPlaceholder } from "./shared";

type Props = {
  value: string | null;
  onChange: (creditCardId: string | null) => void;
  className?: string;
  inputClassName?: string;
  includeUnassigned?: boolean;
  placeholderLabel?: string;
  disabled?: boolean;
  filters?: Partial<CreditCardsListReq>;
  groupByStatus?: boolean;
};

type CreditCardLite = {
  id?: string;
  name?: string;
  code?: string | null;
  last4?: string | null;
  status?: string | null;
};

function cardLabel(card: CreditCardLite) {
  const parts = [String(card?.name || card?.id || "").trim()];
  const code = String(card?.code || "").trim();
  const last4 = String(card?.last4 || "").replace(/\D/g, "").slice(-4);
  if (code) parts.push(code);
  if (last4) parts.push(`**** ${last4}`);
  return parts.filter(Boolean).join(" - ");
}

export default function CreditCardSelect({
  value,
  onChange,
  className = "",
  inputClassName = "",
  includeUnassigned = true,
  placeholderLabel = "-- Select credit card --",
  disabled,
  filters = { active: true, limit: 200 },
  groupByStatus = true,
}: Props) {
  const q = useCreditCards(filters, { enabled: true, staleTime: 30_000 });

  const cards = React.useMemo(() => {
    const list = asEntityArray<CreditCardLite>(q.data);
    return list
      .slice()
      .filter((card) => !!String(card?.id || "").trim())
      .sort((a, b) => cardLabel(a).localeCompare(cardLabel(b)));
  }, [q.data]);

  const grouped = React.useMemo(() => {
    const active: CreditCardLite[] = [];
    const inactive: CreditCardLite[] = [];
    for (const card of cards) {
      const status = String(card?.status || "").toLowerCase();
      if (!status || status === "active" || status === "draft") active.push(card);
      else inactive.push(card);
    }
    return { active, inactive };
  }, [cards]);

  const isDisabled = Boolean(disabled || q.isLoading);
  const noOptions = !q.isLoading && cards.length === 0;
  const placeholder = resolveEntityPlaceholder({
    isLoading: q.isLoading,
    isEmpty: noOptions,
    loadingLabel: "Loading credit cards...",
    emptyLabel: "No credit cards found",
    placeholderLabel,
  });

  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      disabled={isDisabled}
      fullWidth
      className={className}
      inputClassName={entitySelectInputClassName("min-w-[220px]", inputClassName)}
      placeholderOption={includeUnassigned ? placeholder : undefined}
      placeholderDisabled={false}
      options={
        groupByStatus
          ? [
              ...(grouped.active.length
                ? [{
                    label: "Active",
                    options: grouped.active.map((card) => ({
                      value: String(card.id || ""),
                      label: cardLabel(card),
                    })),
                  }]
                : []),
              ...(grouped.inactive.length
                ? [{
                    label: "Closed / Other",
                    options: grouped.inactive.map((card) => ({
                      value: String(card.id || ""),
                      label: cardLabel(card),
                    })),
                  }]
                : []),
            ]
          : cards.map((card) => ({
              value: String(card.id || ""),
              label: cardLabel(card),
            }))
      }
    />
  );
}
