import { useState } from "react";
import type { Enrollment, EnrollmentCompliance } from "@/hooks/useCustomerEnrollments";

const COMPLIANCE_FIELDS: { key: keyof EnrollmentCompliance; label: string }[] = [
  { key: "caseworthyEntryComplete", label: "Caseworthy Entry" },
  { key: "caseworthyExitComplete", label: "Caseworthy Exit" },
  { key: "hmisEntryComplete", label: "HMIS Entry" },
  { key: "hmisExitComplete", label: "HMIS Exit" },
];

export interface ProgramEditPatch {
  startDate?: string | null;
  endDate?: string | null;
  compliance?: EnrollmentCompliance;
}

export function ProgramEditSheet({
  enrollment,
  onClose,
  onSave,
  saving,
}: {
  enrollment: Enrollment;
  onClose: () => void;
  onSave: (patch: ProgramEditPatch) => void;
  saving: boolean;
}) {
  const [startDate, setStartDate] = useState(enrollment.startDate ?? "");
  const [endDate, setEndDate] = useState(enrollment.endDate ?? "");
  const [compliance, setCompliance] = useState<EnrollmentCompliance>(enrollment.compliance ?? {});

  const label =
    (enrollment.grantName && enrollment.grantName.trim()) ||
    (enrollment.name && enrollment.name.trim()) ||
    "Program";

  const toggle = (key: keyof EnrollmentCompliance) =>
    setCompliance((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = () =>
    onSave({
      startDate: startDate || null,
      endDate: endDate || null,
      compliance,
    });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-2 pb-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-snug flex-1 truncate">{label}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Compliance</label>
            <div className="grid grid-cols-2 gap-2">
              {COMPLIANCE_FIELDS.map((f) => {
                const done = !!compliance[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggle(f.key)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                      done ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {f.label}
                    <span className="block text-[11px] font-normal opacity-70">{done ? "Complete" : "Pending"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
