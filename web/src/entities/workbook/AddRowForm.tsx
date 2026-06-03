"use client";

// Add-row form for a writable dataTable workbook entity (Slice A: progress notes).
// Its own entity: collects field values per the resolved config, then appends a
// new row via the strict server-OAuth backend. Explicit Save (no autosave).
// On success the parent refetches and the new entry loads in as a table row.

import React from "react";
import api from "@client/api";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import type { tss as TssNS } from "@hdb/contracts";

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

/** Fields a user can fill: skip computed and write-disabled (formula) fields. */
function writableFields(cfgEntity: TssNS.TssDisplayEntityConfig): TssNS.TssSmartHeaderConfig[] {
  return (cfgEntity.fields ?? []).filter(
    (f) => f.dataType !== "computed" && f.write?.enabled !== false,
  );
}

function optionsFor(
  field: TssNS.TssSmartHeaderConfig,
  config: TssNS.TssWorksheetConfig,
): string[] {
  if (!field.optionSourceId) return [];
  const list = config.dropdownLists?.[field.optionSourceId] as { values?: string[] } | undefined;
  return Array.isArray(list?.values) ? list!.values : [];
}

function FieldInput({
  field,
  value,
  options,
  onChange,
  disabled,
}: {
  field: TssNS.TssSmartHeaderConfig;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const label = field.display?.label ?? field.expected;
  const common = "input w-full text-sm";

  let control: React.ReactNode;
  if (field.dataType === "select" && options.length) {
    control = (
      <select className={`select w-full text-sm`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (field.dataType === "longText") {
    control = <textarea className={`${common} min-h-[64px]`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.dataType === "date") {
    control = <input type="date" className={common} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.dataType === "time") {
    control = <input type="time" className={common} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = <input type="text" className={common} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <label className={`field block ${field.display?.multiline ? "sm:col-span-2" : ""}`}>
      <span className="label text-xs">{label}{field.required ? <span className="text-red-500"> *</span> : null}</span>
      {control}
    </label>
  );
}

export function AddRowForm({
  customerId,
  entityId,
  cfgEntity,
  config,
  onSaved,
  onCancel,
}: {
  customerId: string;
  entityId: string;
  cfgEntity: TssNS.TssDisplayEntityConfig;
  config: TssNS.TssWorksheetConfig;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const fields = React.useMemo(() => writableFields(cfgEntity), [cfgEntity]);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setField = (id: string, v: string) => setValues((cur) => ({ ...cur, [id]: v }));

  const missingRequired = fields.some((f) => f.required && !String(values[f.id] || "").trim());

  const save = async () => {
    if (missingRequired) { setError("Fill in the required fields."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        const v = String(values[f.id] ?? "").trim();
        if (v) payload[f.id] = v;
      }
      const resp = (await (api as any).postWith(
        "appendCustomerWorkbookRow",
        { customerId, entityId, values: payload },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (resp?.ok) {
        toast("Added to the sheet.", { type: "success" });
        setValues({});
        onSaved();
      } else {
        setError(String(resp?.error || "Could not save."));
      }
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      setError(String(body?.error || (e as Error)?.message || "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-700">New entry</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldInput
            key={f.id}
            field={f}
            value={values[f.id] ?? ""}
            options={optionsFor(f, config)}
            onChange={(v) => setField(f.id, v)}
            disabled={saving}
          />
        ))}
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()} disabled={saving || missingRequired}>
          {saving ? "Saving…" : "Save to sheet"}
        </button>
      </div>
    </div>
  );
}
