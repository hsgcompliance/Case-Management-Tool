"use client";

import React from "react";
import api from "@client/api";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import type { tss as TssNS } from "@hdb/contracts";

type BudgetCell = { value?: unknown; displayValue?: string | null };
type BudgetItem = { id: string; label: string; rowKey: string; amount?: BudgetCell; editable?: boolean };
type BudgetSection = {
  id: string;
  label: string;
  items?: BudgetItem[];
  subsections?: BudgetSection[];
  total?: { label: string; rowKey: string; amount?: BudgetCell };
  rollsInto?: string;
};
type BudgetSummary = { id: string; label: string; rowKey: string; amount?: BudgetCell };
type BudgetPayload = { sections?: BudgetSection[]; summaryRows?: BudgetSummary[] };

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

function displayAmount(cell?: BudgetCell): string {
  return String(cell?.displayValue ?? cell?.value ?? "").trim();
}

function flattenItems(sections: BudgetSection[] = []): BudgetItem[] {
  const out: BudgetItem[] = [];
  for (const section of sections) {
    out.push(...(section.items ?? []));
    out.push(...flattenItems(section.subsections ?? []));
  }
  return out.filter((item) => item.editable !== false && item.rowKey);
}

function SectionView({ section }: { section: BudgetSection }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</div>
      {[...(section.items ?? [])].map((item) => (
        <div key={item.id} className="grid grid-cols-[1fr_8rem] gap-3 border-b border-slate-100 py-1 text-sm">
          <span className="min-w-0 truncate text-slate-700" title={item.label}>{item.label || "Untitled item"}</span>
          <span className="text-right font-medium text-slate-900">{displayAmount(item.amount) || "-"}</span>
        </div>
      ))}
      {(section.subsections ?? []).map((sub) => (
        <div key={sub.id} className="mt-2 border-l border-slate-200 pl-3">
          <SectionView section={sub} />
        </div>
      ))}
      {section.total ? (
        <div className="grid grid-cols-[1fr_8rem] gap-3 pt-1 text-sm font-semibold text-slate-900">
          <span>{section.total.label}</span>
          <span className="text-right">{displayAmount(section.total.amount) || "-"}</span>
        </div>
      ) : null}
    </div>
  );
}

export function BudgetTable({
  customerId,
  entity,
  onSaved,
}: {
  customerId: string;
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
  onSaved: () => void;
}) {
  const budget = (entity.budget ?? {}) as BudgetPayload;
  const sections = budget.sections ?? [];
  const summaryRows = budget.summaryRows ?? [];
  const editableItems = React.useMemo(() => flattenItems(sections), [sections]);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of editableItems) next[item.rowKey] = displayAmount(item.amount);
    setValues(next);
  }, [editableItems]);

  const save = async () => {
    const changed = editableItems
      .map((item) => ({
        rowKey: item.rowKey,
        amount: String(values[item.rowKey] ?? "").trim(),
        expectedLabel: item.label,
        original: displayAmount(item.amount),
      }))
      .filter((item) => item.amount !== item.original);
    if (!changed.length) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const resp = (await (api as any).postWith(
        "patchCustomerWorkbookBudget",
        { customerId, items: changed.map(({ rowKey, amount, expectedLabel }) => ({ rowKey, amount, expectedLabel })) },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (!resp?.ok) {
        toast(String(resp?.error || "Could not save budget."), { type: "error" });
        return;
      }
      toast("Budget saved.", { type: "success" });
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string; manualActionRequired?: boolean } } })?.meta?.response;
      const msg = body?.manualActionRequired
        ? "The budget changed since this page loaded. Open the workbook and make this change manually."
        : String(body?.error || (e as Error)?.message || "Could not save budget.");
      toast(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)} disabled={!editableItems.length}>
          Edit budget
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((section) => <SectionView key={section.id} section={section} />)}
      </div>
      {summaryRows.length ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {summaryRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_8rem] gap-3 py-1 text-sm font-semibold">
              <span>{row.label}</span>
              <span className="text-right">{displayAmount(row.amount) || "-"}</span>
            </div>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Edit Budget</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={saving}>Close</button>
            </div>
            <div className="grid gap-x-4 gap-y-2 overflow-auto p-4 sm:grid-cols-2">
              {editableItems.map((item) => (
                <label key={item.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700" title={item.label}>{item.label || "Untitled item"}</span>
                  <input
                    className="input w-full text-right text-sm"
                    value={values[item.rowKey] ?? ""}
                    onChange={(e) => setValues((cur) => ({ ...cur, [item.rowKey]: e.currentTarget.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving..." : "Save budget"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
