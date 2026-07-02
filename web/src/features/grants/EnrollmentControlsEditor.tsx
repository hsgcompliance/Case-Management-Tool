"use client";

import React from "react";
import type { TGrantComplianceConfig } from "@types";

export const LEGACY_COMPLIANCE_CONFIG: TGrantComplianceConfig = {
  preset: "hmisCaseworthy",
  active: [
    { key: "caseworthyEntryComplete", label: "CW Entry", field: "compliance.caseworthyEntryComplete", type: "boolean" },
    { key: "hmisEntryComplete", label: "HMIS Entry", field: "compliance.hmisEntryComplete", type: "boolean" },
  ],
  inactive: [
    { key: "caseworthyExitComplete", label: "CW Exit", field: "compliance.caseworthyExitComplete", type: "boolean" },
    { key: "hmisExitComplete", label: "HMIS Exit", field: "compliance.hmisExitComplete", type: "boolean" },
  ],
};

export const NO_COMPLIANCE_CONFIG: TGrantComplianceConfig = {
  preset: "none",
  active: [],
  inactive: [],
};

type ComplianceControl = NonNullable<TGrantComplianceConfig["active"]>[number];

function controlsFrom(config: TGrantComplianceConfig | null | undefined) {
  const resolved = config ?? LEGACY_COMPLIANCE_CONFIG;
  return {
    active: Array.isArray(resolved.active) ? resolved.active : [],
    inactive: Array.isArray(resolved.inactive) ? resolved.inactive : [],
  };
}

function controlKey(control: ComplianceControl) {
  return String(control.field || control.key || "").trim();
}

function addControl(
  config: TGrantComplianceConfig | null | undefined,
  control: ComplianceControl,
  placement: "active" | "inactive",
): TGrantComplianceConfig {
  const current = controlsFrom(config);
  const active = [...current.active];
  const inactive = [...current.inactive];
  const target = placement === "inactive" ? inactive : active;
  if (!target.some((entry) => controlKey(entry) === controlKey(control))) target.push(control);
  return { preset: "custom", active, inactive };
}

function removeControl(config: TGrantComplianceConfig | null | undefined, target: ComplianceControl): TGrantComplianceConfig {
  const current = controlsFrom(config);
  const key = controlKey(target);
  const active = current.active.filter((control) => controlKey(control) !== key);
  const inactive = current.inactive.filter((control) => controlKey(control) !== key);
  return { preset: active.length + inactive.length ? "custom" : "none", active, inactive };
}

function addCustomControl(
  config: TGrantComplianceConfig | null | undefined,
  label: string,
  placement: "active" | "inactive",
): TGrantComplianceConfig {
  const cleanLabel = label.trim();
  if (!cleanLabel) return config ?? LEGACY_COMPLIANCE_CONFIG;
  const key = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `custom_${Date.now().toString(36)}`;
  return addControl(
    config,
    { key, label: cleanLabel, field: `compliance.${key}`, type: "boolean" },
    placement,
  );
}

export function EnrollmentControlsSummary({ value }: { value?: TGrantComplianceConfig | null }) {
  const controls = controlsFrom(value);
  if (!controls.active.length && !controls.inactive.length) {
    return <span className="text-sm text-slate-500">No enrollment controls configured.</span>;
  }
  return (
    <div className="space-y-2">
      {([
        ["Open enrollment", controls.active],
        ["Closed enrollment", controls.inactive],
      ] as const).map(([label, rows]) => rows.length ? (
        <div key={label} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">{label}</span>
          {rows.map((control) => (
            <span key={controlKey(control)} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {String(control.label || control.key)}
            </span>
          ))}
        </div>
      ) : null)}
    </div>
  );
}

export function EnrollmentControlsEditor({
  value,
  onChange,
}: {
  value?: TGrantComplianceConfig | null;
  onChange: (next: TGrantComplianceConfig) => void;
}) {
  const [customLabel, setCustomLabel] = React.useState("");
  const [placement, setPlacement] = React.useState<"active" | "inactive">("active");
  const controls = controlsFrom(value);
  const commitCustom = () => {
    if (!customLabel.trim()) return;
    onChange(addCustomControl(value, customLabel, placement));
    setCustomLabel("");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Enrollment controls</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Choose which compliance actions staff see while an enrollment is open or closed.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(NO_COMPLIANCE_CONFIG)}>Clear all</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input h-8 w-56 text-xs"
          value={customLabel}
          placeholder="Control label"
          onChange={(event) => setCustomLabel(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitCustom();
            }
          }}
        />
        <select
          className="select h-8 text-xs"
          value={placement}
          onChange={(event) => setPlacement(event.currentTarget.value as "active" | "inactive")}
        >
          <option value="active">Open enrollment</option>
          <option value="inactive">Closed enrollment</option>
        </select>
        <button type="button" className="btn btn-secondary btn-xs" onClick={commitCustom}>Add custom</button>
      </div>

      <div className="mt-4">
        <EnrollmentControlsSummary value={value} />
      </div>
      {controls.active.length || controls.inactive.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[...controls.active, ...controls.inactive].map((control) => (
            <button
              key={controlKey(control)}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              title="Remove enrollment control"
              onClick={() => onChange(removeControl(value, control))}
            >
              Remove {String(control.label || control.key)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
