// BEGIN FILE: src/features/customers/tabs/DetailsTab.tsx
"use client";

import React from "react";
import { parseISO10Strict } from "@lib/date";

type AnyRecord = Record<string, any>;
type Status = "active" | "inactive" | "closed" | "deleted";

function asStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function fullName(first: any, last: any) {
  const f = asStr(first).trim();
  const l = asStr(last).trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

function isStatus(s: any): s is Status {
  return ["active", "inactive", "closed", "deleted"].includes(String(s));
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

export function DetailsTab({
  creating = false,
  editing,
  model,
  setModel,
  onToggleEdit,
  onToggleActive,
  statusBusy = false,
}: {
  creating?: boolean;
  editing: boolean;
  model: AnyRecord;
  setModel: (updater: any) => void;
  onToggleEdit?: () => void;
  onToggleActive?: () => void;
  statusBusy?: boolean;
}) {
  const computedName = React.useMemo(
    () => fullName(model?.firstName, model?.lastName),
    [model?.firstName, model?.lastName]
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
      if (nextStatus === "inactive" || nextStatus === "closed") {
        next.active = false;
        if ("deleted" in next) next.deleted = false;
      }
      if (nextStatus === "deleted") {
        next.deleted = true;
        next.active = false;
        next.enrolled = false;
      }
      return next;
    });
  };

  const notesVal = asStr(model?.meta?.notes);
  const statusIsActive = status === "active";
  const statusChipClass = statusIsActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
  const statusChipLabel = statusIsActive ? "Active" : "Inactive";
  const statusChipTitle = statusIsActive ? "Mark inactive" : "Mark active";

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-section space-y-5">
          {/* Header with Age */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900">Customer Details</h4>
              {editing && !computedName ? (
                <p className="text-xs text-amber-700 mt-1">
                  First + Last are required to satisfy the backend-required name field.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
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
              {!creating && onToggleEdit ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleEdit}>
                  {editing ? "Cancel edit" : "Edit"}
                </button>
              ) : null}
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-700">
                <span className="text-slate-500">Age</span>
                <span className="font-medium">{age === null ? "—" : String(age)}</span>
              </div>
            </div>
          </div>

          {/* Line 1: First / Last / Population / DOB */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="field">
              <span className="label">First name</span>
              <input
                className="input"
                disabled={!editing}
                value={asStr(model?.firstName)}
                onChange={(e) => setField("firstName", e.currentTarget.value)}
                placeholder="First"
              />
            </label>

            <label className="field">
              <span className="label">Last name</span>
              <input
                className="input"
                disabled={!editing}
                value={asStr(model?.lastName)}
                onChange={(e) => setField("lastName", e.currentTarget.value)}
                placeholder="Last"
              />
            </label>

            <label className="field">
              <span className="label">Population</span>
              <select
                className="select"
                disabled={!editing}
                value={asStr(model?.population) || ""}
                onChange={(e) => setField("population", e.currentTarget.value || null)}
              >
                <option value="">—</option>
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
                disabled={!editing}
                value={asStr(model?.dob) || ""}
                onChange={(e) => setField("dob", e.currentTarget.value || null)}
              />
            </label>
          </div>

          {/* Line 2: CW/HMIS + Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="field">
              <span className="label">CW ID</span>
              <input
                className="input"
                disabled={!editing}
                value={asStr(model?.cwId)}
                onChange={(e) => setField("cwId", e.currentTarget.value || null)}
                placeholder="(optional)"
              />
            </label>

            <label className="field">
              <span className="label">HMIS ID</span>
              <input
                className="input"
                disabled={!editing}
                value={asStr(model?.hmisId)}
                onChange={(e) => setField("hmisId", e.currentTarget.value || null)}
                placeholder="(optional)"
              />
            </label>

            <label className="field">
              <span className="label">Status</span>
              <select
                className="select"
                disabled={!editing}
                value={status}
                onChange={(e) => onStatusChange(e.currentTarget.value as Status)}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="closed">closed</option>
                <option value="deleted">deleted</option>
              </select>
            </label>
          </div>

          {/* Notes */}
          <div className="pt-2 border-t">
            <label className="field">
              <span className="label">Notes</span>
              <textarea
                className="input"
                rows={7}
                disabled={!editing}
                value={notesVal}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setMeta({ notes: v.trim() ? v : null });
                }}
                placeholder="Internal notes…"
              />
            </label>
          </div>

          {/* Hidden required backend field */}
          <input type="hidden" value={asStr(model?.name)} readOnly />
        </div>
      </div>
    </div>
  );
}

export default DetailsTab;
// END FILE
