"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import {
  getPinnedItems,
  togglePinnedItem,
  MAX_PINNED_ITEMS,
  type PinnedItemRef,
} from "@entities/Page/dashboardStyle/data/pinnedItems";
import { PinnedGrantSmallCard } from "./PinnedGrantSmallCard";
import { PinnedCreditCardSmallCard } from "./PinnedCreditCardSmallCard";

// ─── Query key ────────────────────────────────────────────────────────────────

export const PINNED_ITEMS_QK = (uid: string) =>
  ["userExtras", uid, "pinnedItems"] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePinnedItems() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useQuery({
    queryKey: PINNED_ITEMS_QK(uid),
    queryFn: () => getPinnedItems(uid),
    enabled: !!uid,
    staleTime: 60_000,
  });
}

export function useTogglePinnedItem() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ref: PinnedItemRef) => togglePinnedItem(uid, ref),
    onSuccess: ({ items }) => {
      qc.setQueryData(PINNED_ITEMS_QK(uid), items);
    },
  });
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function PinnedItemsSection() {
  const { data: items = [], isLoading } = usePinnedItems();
  const toggle = useTogglePinnedItem();

  if (isLoading || items.length === 0) return null;

  const grants = items.filter((x) => x.type === "grant");
  const creditCards = items.filter((x) => x.type === "creditCard");
  // jotform pins reserved for future use

  return (
    <div className="space-y-4 px-3 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Pinned
        </span>
        <span className="text-xs text-slate-400">({items.length}/{MAX_PINNED_ITEMS})</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {grants.map((ref) => (
          <PinnedGrantSmallCard
            key={`grant:${ref.id}`}
            grantId={ref.id}
            onUnpin={() => toggle.mutate(ref)}
          />
        ))}
        {creditCards.map((ref) => (
          <PinnedCreditCardSmallCard
            key={`creditCard:${ref.id}`}
            creditCardId={ref.id}
            onUnpin={() => toggle.mutate(ref)}
          />
        ))}
      </div>
    </div>
  );
}

export default PinnedItemsSection;
