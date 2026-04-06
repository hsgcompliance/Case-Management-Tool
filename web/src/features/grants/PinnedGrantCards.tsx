"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { useGrant } from "@hooks/useGrants";
import {
  getPinnedGrantIds,
  togglePinnedGrant,
  MAX_PINNED_GRANTS,
} from "@entities/Page/dashboardStyle/data/pinnedGrants";
import type { TGrant as Grant } from "@types";

// ─── Query helpers ────────────────────────────────────────────────────────────

export const PINNED_GRANT_QK = (uid: string) =>
  ["userExtras", uid, "pinnedGrantIds"] as const;

export function usePinnedGrantIds() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useQuery({
    queryKey: PINNED_GRANT_QK(uid),
    queryFn: () => getPinnedGrantIds(uid),
    enabled: !!uid,
    staleTime: 60_000,
  });
}

export function useTogglePinnedGrant() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => togglePinnedGrant(uid, grantId),
    onSuccess: ({ ids }) => {
      qc.setQueryData(PINNED_GRANT_QK(uid), ids);
    },
  });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function getGrantKind(g: Grant): "grant" | "program" {
  const k = String((g as any)?.kind || "").toLowerCase();
  if (k === "program") return "program";
  if (k === "grant") return "grant";
  return Number((g as any)?.budget?.total ?? 0) <= 0 ? "program" : "grant";
}

function getBudgetLineItems(g: Grant): Array<{
  id?: string;
  label?: string;
  amount: number;
  spent: number;
  projected: number;
  remaining: number;
}> {
  const lineItems: any[] = (g as any)?.budget?.lineItems ?? [];
  return lineItems.map((li: any) => {
    const amount = Number(li?.amount ?? 0);
    const spent = Number(li?.spent ?? 0);
    const projected = Number(li?.projected ?? 0);
    return {
      id: li?.id,
      label: String(li?.label || li?.name || "Line Item"),
      amount,
      spent,
      projected,
      remaining: amount - spent,
    };
  });
}

const POP_COLORS: Record<string, string> = {
  Youth: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Individual: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  Family: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function PopPill({ label, count }: { label: string; count: number }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${POP_COLORS[label] ?? "bg-slate-100 text-slate-500"}`}>
      {label} <span className="opacity-80">{count}</span>
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// ─── Page types ───────────────────────────────────────────────────────────────

type Page =
  | { kind: "enrollment" }
  | { kind: "lineItem"; item: ReturnType<typeof getBudgetLineItems>[number] }
  | { kind: "details"; eligibility: string; description: string };

function buildPages(g: Grant): Page[] {
  const pages: Page[] = [{ kind: "enrollment" }];
  if (getGrantKind(g) === "grant") {
    for (const item of getBudgetLineItems(g)) {
      pages.push({ kind: "lineItem", item });
    }
  }
  const eligibility = String((g as any)?.eligibility || "").trim();
  const description =
    String((g as any)?.description || "").trim() ||
    String((g as any)?.details?.description || "").trim();
  if (eligibility || description) {
    pages.push({ kind: "details", eligibility, description });
  }
  return pages;
}

// ─── Individual card ──────────────────────────────────────────────────────────

function PinnedGrantCard({
  grantId,
  onUnpin,
}: {
  grantId: string;
  onUnpin: () => void;
}) {
  const router = useRouter();
  const { data: grant, isLoading } = useGrant(grantId, { enabled: !!grantId });
  const [pageIdx, setPageIdx] = useState(0);

  if (isLoading || !grant) {
    return (
      <div className="flex h-52 animate-pulse items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
        <span className="text-xs text-slate-400">Loading…</span>
      </div>
    );
  }

  const g = grant as Grant;
  const kind = getGrantKind(g);
  const status = String((g as any)?.status || "draft");
  const pages = buildPages(g);
  const safePage = Math.min(pageIdx, pages.length - 1);
  const currentPage = pages[safePage];

  const metrics = (g as any)?.metrics?.enrollmentCounts;
  const mActive = Number(metrics?.active ?? 0);
  const mInactive = Number(metrics?.inactive ?? 0);
  const pop = (metrics?.population || {}) as Record<string, number>;

  const go = (dir: 1 | -1) =>
    setPageIdx((p) => Math.max(0, Math.min(pages.length - 1, p + dir)));

  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 pt-4 pb-3 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
              {kind === "program" ? "Program" : "Grant"}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
              {status}
            </span>
          </div>
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {String((g as any)?.name || grantId)}
          </h3>
        </div>
        <button
          title="Unpin"
          onClick={onUnpin}
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          ×
        </button>
      </div>

      {/* Page content */}
      <div className="flex-1 px-4 py-3 text-sm">
        {currentPage.kind === "enrollment" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Enrollments</div>
            <div className="flex items-baseline gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{mActive}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Active</div>
              </div>
              {mInactive > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-400">{mInactive}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Inactive</div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <PopPill label="Youth" count={pop.Youth ?? 0} />
              <PopPill label="Individual" count={pop.Individual ?? 0} />
              <PopPill label="Family" count={pop.Family ?? 0} />
            </div>
            {mActive === 0 && mInactive === 0 && (
              <div className="text-xs italic text-slate-400">No enrollments yet</div>
            )}
          </div>
        )}

        {currentPage.kind === "lineItem" && (() => {
          const li = currentPage.item;
          const pct = li.amount > 0 ? Math.min(100, (li.spent / li.amount) * 100) : 0;
          return (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Line Item</div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{li.label}</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Budget</span>
                  <span className="font-medium">{fmtUsd(li.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Spent</span>
                  <span className="text-amber-600 dark:text-amber-400">{fmtUsd(li.spent)}</span>
                </div>
                {li.projected > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projected</span>
                    <span className="text-blue-600 dark:text-blue-400">{fmtUsd(li.projected)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${li.remaining < 0 ? "bg-rose-500" : "bg-amber-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={`text-right text-xs font-bold ${li.remaining < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {fmtUsd(li.remaining)} remaining
              </div>
            </div>
          );
        })()}

        {currentPage.kind === "details" && (
          <div className="space-y-3">
            {currentPage.description && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</div>
                <p className="line-clamp-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {currentPage.description}
                </p>
              </div>
            )}
            {currentPage.eligibility && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Eligibility</div>
                <p className="line-clamp-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {currentPage.eligibility}
                </p>
              </div>
            )}
            {!currentPage.description && !currentPage.eligibility && (
              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center dark:border-slate-700">
                <p className="text-xs text-slate-400">
                  Nothing present — consider adding eligibility or description details for other users.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: page dots + nav + view link */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => go(-1)}
            disabled={safePage === 0}
            className="rounded px-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-200"
          >
            ‹
          </button>
          {pages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPageIdx(i)}
              title={p.kind === "enrollment" ? "Enrollments" : p.kind === "lineItem" ? (p as any).item?.label : "Details"}
              className={`h-1.5 rounded-full transition ${
                i === safePage
                  ? "w-5 bg-sky-500"
                  : p.kind === "lineItem"
                    ? "w-2.5 bg-amber-300 hover:bg-amber-400"
                    : p.kind === "details"
                      ? "w-2.5 bg-violet-300 hover:bg-violet-400"
                      : "w-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
          <button
            onClick={() => go(1)}
            disabled={safePage === pages.length - 1}
            className="rounded px-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-200"
          >
            ›
          </button>
          <span className="ml-1 text-[10px] text-slate-400">{safePage + 1}/{pages.length}</span>
        </div>
        <button
          onClick={() => router.push(`/grants/${grantId}`)}
          className="text-xs font-semibold text-sky-500 hover:text-sky-600 dark:text-sky-400"
        >
          View →
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function PinnedGrantCards() {
  const { data: ids = [], isLoading } = usePinnedGrantIds();
  const toggle = useTogglePinnedGrant();

  if (isLoading || ids.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Pinned Grants
        </span>
        <span className="text-xs text-slate-400">({ids.length}/{MAX_PINNED_GRANTS})</span>
      </div>
      <div className={`grid gap-4 ${ids.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {ids.map((id) => (
          <PinnedGrantCard key={id} grantId={id} onUnpin={() => toggle.mutate(id)} />
        ))}
      </div>
    </section>
  );
}

export default PinnedGrantCards;
