import { useEffect, useState } from "react";
import { getCreditCardsSummary, type CreditCardSummaryItem } from "@/lib/creditCardsApi";
import { centsToUsd } from "@/lib/format";

function usageTone(pct: number): string {
  if (pct >= 100) return "bg-rose-500";
  if (pct >= 85) return "bg-amber-400";
  return "bg-indigo-500";
}

function Card({ c }: { c: CreditCardSummaryItem }) {
  const pct = Math.min(100, Math.round(c.usagePct));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">
            {c.name}{c.last4 ? <span className="font-normal text-slate-400"> ····{c.last4}</span> : null}
          </div>
          <div className="text-[11px] text-slate-400">{c.entryCount} this month</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-base font-black tabular-nums ${c.remainingCents < 0 ? "text-rose-600" : "text-slate-900"}`}>
            {centsToUsd(c.remainingCents)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">remaining</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Spent {centsToUsd(c.spentCents)}</span>
          <span>{c.monthlyLimitCents > 0 ? `${pct}% of ${centsToUsd(c.monthlyLimitCents)}` : "no limit set"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-2 rounded-full ${usageTone(c.usagePct)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function CreditCardCards() {
  const [items, setItems] = useState<CreditCardSummaryItem[] | null>(null);
  const [month, setMonth] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCreditCardsSummary()
      .then((out) => { if (alive) { setItems(out.items); setMonth(out.month); } })
      .catch((e: unknown) => { if (alive) setError((e as Error)?.message || "Failed to load credit cards."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Card spend unavailable: {error}</div>;
  }
  if (loading && !items) {
    return <div className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">Loading card spend…</div>;
  }
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Credit card spend{month ? ` · ${month}` : ""}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((c) => <Card key={c.id} c={c} />)}
      </div>
    </div>
  );
}
