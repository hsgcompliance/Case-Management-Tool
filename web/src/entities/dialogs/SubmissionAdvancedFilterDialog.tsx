"use client";

import React from "react";

export type SubmissionAdvancedFilters = {
  vendor: string;
  purchaser: string;
  startDate: string;
  endDate: string;
  purpose: string;
  projectOption: string;
  projectRaw: string;
};

export const EMPTY_SUBMISSION_ADVANCED_FILTERS: SubmissionAdvancedFilters = {
  vendor: "",
  purchaser: "",
  startDate: "",
  endDate: "",
  purpose: "",
  projectOption: "",
  projectRaw: "",
};

type Props = {
  open: boolean;
  filters: SubmissionAdvancedFilters;
  projectOptions: string[];
  onChange: (filters: SubmissionAdvancedFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

export function SubmissionAdvancedFilterDialog({
  open,
  filters,
  projectOptions,
  onChange,
  onClear,
  onClose,
}: Props) {
  if (!open) return null;

  const patch = (next: Partial<SubmissionAdvancedFilters>) => onChange({ ...filters, ...next });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Advanced Submission Filters</div>
          <button type="button" className="btn btn-xs btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Vendor</label>
            <input className="input" value={filters.vendor} onChange={(e) => patch({ vendor: e.currentTarget.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Purchaser</label>
            <input className="input" value={filters.purchaser} onChange={(e) => patch({ purchaser: e.currentTarget.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Start Date</label>
            <input className="input" type="date" value={filters.startDate} onChange={(e) => patch({ startDate: e.currentTarget.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">End Date</label>
            <input className="input" type="date" value={filters.endDate} onChange={(e) => patch({ endDate: e.currentTarget.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Purpose</label>
            <input className="input" value={filters.purpose} onChange={(e) => patch({ purpose: e.currentTarget.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Project / Program Dropdown</label>
            <select className="select w-full" value={filters.projectOption} onChange={(e) => patch({ projectOption: e.currentTarget.value })}>
              <option value="">Any project/program</option>
              {projectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500">Project / Program Raw Search</label>
            <input className="input" value={filters.projectRaw} onChange={(e) => patch({ projectRaw: e.currentTarget.value })} />
          </div>
          <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Project/program filters search billed to, project, program operations for, supportive service program, purpose, transaction fields, and raw answers.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>Clear Filters</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}

export default SubmissionAdvancedFilterDialog;
