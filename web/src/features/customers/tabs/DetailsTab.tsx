// BEGIN FILE: src/features/customers/tabs/DetailsTab.tsx
"use client";

import React from "react";
import { parseISO10Strict } from "@lib/date";
import { fmtDateOrDash } from "@lib/formatters";

type AnyRecord = Record<string, any>;
type Status = "active" | "inactive";

function asStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function fullName(first: any, last: any) {
  const f = asStr(first).trim();
  const l = asStr(last).trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

function isStatus(s: any): s is Status {
  return ["active", "inactive"].includes(String(s));
}

function computeAgeYears(dobISO: string): number | null {
  const dob = parseISO10Strict(asStr(dobISO).trim());
  if (!dob) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;

  if (age < 0 || age > 130) return null;
  return age;
}

function display(value: unknown, fallback = "-") {
  const text = asStr(value).trim();
  return text || fallback;
}

function ViewField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 select-text break-words text-sm font-medium text-slate-900">{display(value)}</div>
    </div>
  );
}

export function DetailsTab({
  creating = false,
  editing,
  model,
  setModel,
  onToggleActive,
  onSaveNotes,
  statusBusy = false,
  notesSaving = false,
}: {
  creating?: boolean;
  editing: boolean;
  model: AnyRecord;
  setModel: (updater: any) => void;
  onToggleActive?: () => void;
  onSaveNotes?: (notes: string) => Promise<void>;
  statusBusy?: boolean;
  notesSaving?: boolean;
}) {
  const computedName = React.useMemo(
    () => fullName(model?.firstName, model?.lastName),
    [model?.firstName, model?.lastName],
  );

  React.useEffect(() => {
    if (!editing) return;
    if (!computedName) return;

    setModel((m: AnyRecord) => {
      const cur = asStr(m?.name).trim();
      if (cur === computedName) return m;
      return { ...(m || {}), name: computedName };
    });
  }, [editing, computedName, setModel]);

  const status: Status = React.useMemo(() => {
    const s = asStr(model?.status).toLowerCase();
    return isStatus(s) ? s : "active";
  }, [model?.status]);

  const age = React.useMemo(() => computeAgeYears(asStr(model?.dob)), [model?.dob]);

  const setField = (k: string, v: any) => setModel((m: AnyRecord) => ({ ...(m || {}), [k]: v }));
  const setMeta = (patch: AnyRecord) =>
    setModel((m: AnyRecord) => ({ ...(m || {}), meta: { ...(m?.meta || {}), ...(patch || {}) } }));

  const onStatusChange = (nextStatus: Status) => {
    setModel((m: AnyRecord) => {
      const next: AnyRecord = { ...(m || {}), status: nextStatus };

      if (nextStatus === "active") {
        next.active = true;
        if ("deleted" in next) next.deleted = false;
      }
      if (nextStatus === "inactive") {
        next.active = false;
        if ("deleted" in next) next.deleted = false;
      }
      return next;
    });
  };

  const notesVal = asStr(model?.meta?.notes);
  const [notesDraft, setNotesDraft] = React.useState(notesVal);
  const [notesSaveError, setNotesSaveError] = React.useState<string | null>(null);
  const [notesSaved, setNotesSaved] = React.useState(false);
  const [notesFocused, setNotesFocused] = React.useState(false);
  const lastSavedNotesRef = React.useRef(notesVal.trim() ? notesVal : "");

  React.useEffect(() => {
    if (notesFocused) return;
    const next = notesVal.trim() ? notesVal : "";
    lastSavedNotesRef.current = next;
    setNotesDraft(notesVal);
    setNotesSaveError(null);
    setNotesSaved(false);
  }, [notesFocused, notesVal]);

  const updateNotesModel = (value: string) => {
    setNotesDraft(value);
    setNotesSaved(false);
    setNotesSaveError(null);
    setMeta({ notes: value.trim() ? value : null });
  };

  const saveNotesIfNeeded = async () => {
    if (!onSaveNotes) return;
    const next = notesDraft.trim() ? notesDraft : "";
    const current = lastSavedNotesRef.current;
    if (next === current) return;
    try {
      await onSaveNotes(next);
      lastSavedNotesRef.current = next;
      setNotesSaved(true);
    } catch (e: unknown) {
      setNotesSaveError(e instanceof Error ? e.message : "Notes save failed.");
    }
  };

  const statusIsActive = status === "active";
  const statusChipClass = statusIsActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
  const statusChipLabel = statusIsActive ? "Active" : "Inactive";
  const statusChipTitle = statusIsActive ? "Mark inactive" : "Mark active";
  const detailsTitle = creating ? "New customer details" : "General";

  const editForm = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="field">
          <span className="label">First name</span>
          <input
            className="input"
            value={asStr(model?.firstName)}
            onChange={(e) => setField("firstName", e.currentTarget.value)}
            placeholder="First"
          />
        </label>

        <label className="field">
          <span className="label">Last name</span>
          <input
            className="input"
            value={asStr(model?.lastName)}
            onChange={(e) => setField("lastName", e.currentTarget.value)}
            placeholder="Last"
          />
        </label>

        <label className="field">
          <span className="label">Population</span>
          <select
            className="select"
            value={asStr(model?.population) || ""}
            onChange={(e) => setField("population", e.currentTarget.value || null)}
          >
            <option value="">-</option>
            <option value="Youth">Youth</option>
            <option value="Individual">Individual</option>
            <option value="Family">Family</option>
          </select>
        </label>

        <label className="field">
          <span className="label">DOB</span>
          <input
            className="input"
            type="date"
            value={asStr(model?.dob) || ""}
            onChange={(e) => setField("dob", e.currentTarget.value || null)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="field">
          <span className="label">CW ID</span>
          <input
            className="input"
            value={asStr(model?.cwId)}
            onChange={(e) => setField("cwId", e.currentTarget.value || null)}
            placeholder="(optional)"
          />
        </label>

        <label className="field">
          <span className="label">HMIS ID</span>
          <input
            className="input"
            value={asStr(model?.hmisId)}
            onChange={(e) => setField("hmisId", e.currentTarget.value || null)}
            placeholder="(optional)"
          />
        </label>

        <label className="field">
          <span className="label">Status</span>
          <select
            className="select"
            value={status}
            onChange={(e) => onStatusChange(e.currentTarget.value as Status)}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
      </div>
    </>
  );

  const viewSummary = (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ViewField label="First name" value={model?.firstName} />
        <ViewField label="Last name" value={model?.lastName} />
        <ViewField label="Population" value={model?.population} />
        <ViewField label="DOB" value={fmtDateOrDash(model?.dob)} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ViewField label="CW ID" value={model?.cwId} />
        <ViewField label="HMIS ID" value={model?.hmisId} />
        <ViewField label="Status" value={statusChipLabel} />
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detailsTitle}</h4>
              <div className="mt-1 truncate text-lg font-semibold text-slate-950">
                {computedName || display(model?.name, creating ? "New customer" : "Customer")}
              </div>
              {editing && !computedName ? (
                <p className="mt-1 text-xs text-amber-700">
                  First + Last are required to satisfy the backend-required name field.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className={[
                  "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                  statusChipClass,
                  statusBusy ? "cursor-wait opacity-70" : "",
                ].join(" ")}
                onClick={() => {
                  if (statusBusy) return;
                  if (onToggleActive) {
                    onToggleActive();
                    return;
                  }
                  onStatusChange(statusIsActive ? "inactive" : "active");
                }}
                title={statusChipTitle}
                disabled={statusBusy}
              >
                {statusBusy ? "Updating..." : statusChipLabel}
              </button>
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                <span className="text-slate-500">Age</span>
                <span className="font-medium">{age === null ? "-" : String(age)}</span>
              </div>
            </div>
          </div>

          {editing ? editForm : viewSummary}

          <input type="hidden" value={asStr(model?.name)} readOnly />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
          </div>
          <div className="text-xs text-slate-500">
            {notesSaving ? "Saving..." : notesSaveError ? "Save failed" : notesSaved ? "Saved" : ""}
          </div>
        </div>
        <textarea
          className="input min-h-32 w-full resize-y"
          rows={6}
          disabled={!editing && !onSaveNotes}
          value={notesDraft}
          onChange={(e) => updateNotesModel(e.currentTarget.value)}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => {
            setNotesFocused(false);
            void saveNotesIfNeeded();
          }}
          placeholder="Internal notes..."
        />
        {notesSaveError ? (
          <div className="mt-2 text-xs text-red-600">{notesSaveError}</div>
        ) : null}
      </div>
    </div>
  );
}

export default DetailsTab;
// END FILE
