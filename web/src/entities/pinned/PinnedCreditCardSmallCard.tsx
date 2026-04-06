"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreditCard } from "@hooks/useCreditCards";
import type { CreditCardEntity } from "@types";

// ─── Types ────────────────────────────────────────────────────────────────────

// Mode cycle: spentRemaining → pendingSubmissions
type CardMode = "spentRemaining" | "pending";

const CARD_MODES: CardMode[] = ["spentRemaining", "pending"];

const MODE_LABELS: Record<CardMode, string> = {
  spentRemaining: "Spent / Remaining",
  pending: "Pending Submissions",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function getCardHealth(usedPct: number): "active" | "warning" | "over" {
  if (usedPct >= 100) return "over";
  if (usedPct >= 80) return "warning";
  return "active";
}

const HEALTH_BAR: Record<string, string> = {
  active: "bg-emerald-400",
  warning: "bg-amber-400",
  over: "bg-rose-500",
};

const HEALTH_LABEL: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  over: "text-rose-500",
};

// ─── Content panels ───────────────────────────────────────────────────────────

function SpentRemainingPanel({ card }: { card: CreditCardEntity }) {
  const limit = Number((card as any).limit ?? 0);
  const spent = Number((card as any).spent ?? 0);
  const remaining = limit > 0 ? Math.max(0, limit - spent) : 0;
  const usedPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const health = getCardHealth(usedPct);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Spent</span>
        <span className={`font-semibold ${HEALTH_LABEL[health]}`}>{fmtUsd(spent)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Remaining</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtUsd(remaining)}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${HEALTH_BAR[health]}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-slate-400">
        {fmtUsd(limit)} limit
      </div>
    </div>
  );
}

function PendingPanel({ card }: { card: CreditCardEntity }) {
  const pending = Number((card as any).pending ?? (card as any).pendingCount ?? 0);
  const pendingAmount = Number((card as any).pendingAmount ?? 0);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Pending submissions</span>
        <span className="font-semibold text-blue-600 dark:text-blue-400">{pending}</span>
      </div>
      {pendingAmount > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Pending amount</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{fmtUsd(pendingAmount)}</span>
        </div>
      )}
      {pending === 0 && (
        <div className="text-xs italic text-slate-400">No pending submissions</div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export interface PinnedCreditCardSmallCardProps {
  creditCardId: string;
  onUnpin?: () => void;
}

export function PinnedCreditCardSmallCard({ creditCardId, onUnpin }: PinnedCreditCardSmallCardProps) {
  const router = useRouter();
  const { data: card, isLoading } = useCreditCard(creditCardId, { enabled: !!creditCardId });
  const [modeIdx, setModeIdx] = useState(0);

  if (isLoading || !card) {
    return (
      <div className="flex h-36 animate-pulse items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
        <span className="text-xs text-slate-400">Loading…</span>
      </div>
    );
  }

  const mode = CARD_MODES[modeIdx % CARD_MODES.length];
  const last4 = String((card as any).last4 || "");
  const name = String((card as any).name || (card as any).code || creditCardId);
  const status = String((card as any).status || "active");

  const limit = Number((card as any).limit ?? 0);
  const spent = Number((card as any).spent ?? 0);
  const usedPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const health = getCardHealth(usedPct);

  const STATUS_CHIP: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    inactive: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    suspended: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };

  const cycleNext = () => setModeIdx((i) => (i + 1) % CARD_MODES.length);

  return (
    <div
      className="relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 cursor-pointer select-none"
      onClick={cycleNext}
      title={`Click to cycle view (${MODE_LABELS[mode]})`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Credit Card
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATUS_CHIP[status] ?? STATUS_CHIP.active}`}>
              {status}
            </span>
            {health === "warning" && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                Near Limit
              </span>
            )}
            {health === "over" && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                Over Limit
              </span>
            )}
          </div>
          <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
            {name}{last4 ? ` ···${last4}` : ""}
          </div>
        </div>
        {onUnpin && (
          <button
            title="Unpin"
            onClick={(e) => { e.stopPropagation(); onUnpin(); }}
            className="shrink-0 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Mode label */}
      <div className="px-3 pb-1">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          {MODE_LABELS[mode]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-3 pb-3 text-sm">
        {mode === "spentRemaining" && <SpentRemainingPanel card={card} />}
        {mode === "pending" && <PendingPanel card={card} />}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {CARD_MODES.map((m, i) => (
            <button
              key={m}
              onClick={(e) => { e.stopPropagation(); setModeIdx(i); }}
              title={MODE_LABELS[m]}
              className={`h-1 rounded-full transition ${
                i === modeIdx % CARD_MODES.length
                  ? "w-4 bg-sky-500"
                  : "w-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/grants`); }}
          className="text-[10px] font-semibold text-sky-500 hover:text-sky-600 dark:text-sky-400"
        >
          View →
        </button>
      </div>
    </div>
  );
}

export default PinnedCreditCardSmallCard;
