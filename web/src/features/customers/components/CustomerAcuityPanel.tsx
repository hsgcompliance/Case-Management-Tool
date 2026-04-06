"use client";

import React from "react";
import { useCustomer, usePatchCustomers } from "@hooks/useCustomers";
import { fmtDateSmartOrDash } from "@lib/formatters";

type AcuityBand = "low" | "moderate" | "high";

function bandFromScore(score: number): AcuityBand {
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
}

function scoreValue(customer: any): number | null {
  const raw = customer?.acuity?.score ?? customer?.acuityScore;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function CustomerAcuityPanel({ customerId }: { customerId: string }) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();

  const currentScore = scoreValue(customer);
  const [scoreInput, setScoreInput] = React.useState<string>(currentScore == null ? "" : String(currentScore));
  const [notes, setNotes] = React.useState<string>(String((customer as any)?.acuity?.notes || ""));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setScoreInput(currentScore == null ? "" : String(currentScore));
    setNotes(String((customer as any)?.acuity?.notes || ""));
  }, [currentScore, (customer as any)?.acuity?.notes]);

  const parsedScore = scoreInput.trim() === "" ? null : Number(scoreInput);
  const validScore =
    parsedScore === null || (Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 100);
  const band = parsedScore == null || !Number.isFinite(parsedScore) ? null : bandFromScore(parsedScore);

  const onSave = async () => {
    if (!validScore) {
      setError("Score must be a number between 0 and 100.");
      return;
    }
    setError(null);
    const nextScore = parsedScore;
    const level = nextScore == null ? null : bandFromScore(nextScore);
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: {
        acuityScore: nextScore,
        acuityLevel: level,
        acuity: {
          score: nextScore,
          level,
          notes: notes.trim() || null,
          updatedAt: new Date().toISOString(),
        },
      },
    } as any);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Current Score</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {currentScore == null ? "-" : currentScore.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Current Band</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {currentScore == null ? "-" : bandFromScore(currentScore)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Last Updated</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {fmtDateSmartOrDash((customer as any)?.acuity?.updatedAt || (customer as any)?.updatedAt)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Update Acuity</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="field">
            <span className="label">Score (0 - 100)</span>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.currentTarget.value)}
            />
          </label>
          <label className="field">
            <span className="label">Derived Band</span>
            <input className="input" value={band || "-"} readOnly />
          </label>
        </div>

        <label className="field mt-3">
          <span className="label">Notes</span>
          <textarea
            className="input"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            placeholder="Optional context for this score"
          />
        </label>

        {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}

        <div className="mt-3 flex items-center justify-end">
          <button
            className="btn btn-sm"
            onClick={() => void onSave()}
            disabled={patchCustomer.isPending || !validScore}
          >
            {patchCustomer.isPending ? "Saving..." : "Save acuity"}
          </button>
        </div>
      </div>
    </div>
  );
}
