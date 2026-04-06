// web/src/features/budget/NewCreditCardModal.tsx
"use client";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@entities/ui/Modal";
import { useUpsertCreditCards } from "@hooks/useCreditCards";
import { toast } from "@lib/toast";
import { qk } from "@hooks/queryKeys";
import { LINE_ITEMS_FORM_IDS } from "@features/widgets/jotform/spendExtractor";

const parseLast4 = (v: unknown) => String(v || "").replace(/\D/g, "").slice(-4);

type Draft = {
  name: string;
  code: string;
  last4: string;
  issuer: string;
  network: string;
  monthlyLimit: string;
  cycleType: "calendar_month" | "statement_cycle";
  statementCloseDay: string;
};

const DEFAULT: Draft = {
  name: "", code: "", last4: "", issuer: "", network: "",
  monthlyLimit: "", cycleType: "calendar_month", statementCloseDay: "",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NewCreditCardModal({ isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const upsert = useUpsertCreditCards();
  const [draft, setDraft] = useState<Draft>(DEFAULT);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setDraft(DEFAULT);
    onClose();
  };

  const handleSubmit = async () => {
    const name = draft.name.trim();
    if (!name) { toast("Card name is required.", { type: "error" }); return; }

    const monthlyLimit = Number(draft.monthlyLimit || 0);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
      toast("Monthly limit must be zero or greater.", { type: "error" }); return;
    }

    const last4 = parseLast4(draft.last4);
    if (draft.last4.trim() && last4.length !== 4) {
      toast("Last 4 must be exactly four digits.", { type: "error" }); return;
    }

    const statementCloseDay =
      draft.cycleType === "statement_cycle" ? Number(draft.statementCloseDay) : null;
    if (
      draft.cycleType === "statement_cycle" &&
      (!Number.isInteger(statementCloseDay) || (statementCloseDay ?? 0) < 1 || (statementCloseDay ?? 0) > 31)
    ) {
      toast("Statement close day must be between 1 and 31.", { type: "error" }); return;
    }

    setSaving(true);
    try {
      await upsert.mutateAsync({
        kind: "credit_card",
        name,
        code: draft.code.trim() || null,
        status: "active",
        issuer: draft.issuer.trim() || null,
        network: draft.network.trim() || null,
        last4: last4 || null,
        cycleType: draft.cycleType,
        statementCloseDay: draft.cycleType === "statement_cycle" ? statementCloseDay : null,
        monthlyLimitCents: Math.round(monthlyLimit * 100),
        matching: {
          aliases: [],
          cardAnswerValues: [],
          formIds: {
            creditCard: String(LINE_ITEMS_FORM_IDS.creditCard),
            invoice: String(LINE_ITEMS_FORM_IDS.invoice),
          },
        },
      } as any);
      toast("Credit card created.", { type: "success" });
      await qc.invalidateQueries({ queryKey: qk.creditCards.root });
      handleClose();
    } catch (e: any) {
      toast(e?.message || "Failed to create card.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Credit Card"
      widthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary btn-sm" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create Card"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Card Name *</div>
          <input
            className="input w-full"
            value={draft.name}
            onChange={(e) => set("name", e.currentTarget.value)}
            placeholder="Housing Card"
            autoFocus
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Code</div>
          <input
            className="input w-full"
            value={draft.code}
            onChange={(e) => set("code", e.currentTarget.value)}
            placeholder="HCARD"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Monthly Limit ($)</div>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input w-full"
            value={draft.monthlyLimit}
            onChange={(e) => set("monthlyLimit", e.currentTarget.value)}
            placeholder="0.00"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Last 4 Digits</div>
          <input
            inputMode="numeric"
            maxLength={4}
            className="input w-full"
            value={draft.last4}
            onChange={(e) => set("last4", e.currentTarget.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Issuer</div>
          <input
            className="input w-full"
            value={draft.issuer}
            onChange={(e) => set("issuer", e.currentTarget.value)}
            placeholder="Chase"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Network</div>
          <input
            className="input w-full"
            value={draft.network}
            onChange={(e) => set("network", e.currentTarget.value)}
            placeholder="Visa"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Cycle Type</div>
          <select
            className="select w-full"
            value={draft.cycleType}
            onChange={(e) =>
              set("cycleType", e.currentTarget.value === "statement_cycle" ? "statement_cycle" : "calendar_month")
            }
          >
            <option value="calendar_month">Calendar Month</option>
            <option value="statement_cycle">Statement Cycle</option>
          </select>
        </label>
        {draft.cycleType === "statement_cycle" && (
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Statement Close Day</div>
            <input
              type="number"
              min="1"
              max="31"
              className="input w-full"
              value={draft.statementCloseDay}
              onChange={(e) => set("statementCloseDay", e.currentTarget.value)}
              placeholder="25"
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
