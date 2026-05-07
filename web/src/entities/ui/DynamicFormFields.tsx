// frontend/src/entities/DynamicFormFields.tsx
"use client";
import React, { useState, useEffect, useCallback } from "react";

export type AnyRecord = Record<string, any>;
export type OnChange = (next: AnyRecord) => void;

// Keys we never render here (reserved / handled elsewhere)
export const META_KEYS = new Set([
  "id",
  "name",
  "status",
  "active",
  "createdAt",
  "updatedAt",
  "budget",
  "archivedBudgets",
  "assessments",
  "startDate",
  "endDate",
]);

// ─── Priority system ─────────────────────────────────────────────────────────

export const PRIORITIES = ["important", "medium", "low", "hidden"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_ORDER: Record<Priority, number> = {
  important: 0,
  medium: 1,
  low: 2,
  hidden: 3,
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; badgeCls: string; rowCls: string; labelCls: string }
> = {
  important: {
    label: "⭐ Important",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-300",
    rowCls: "border-amber-300 bg-amber-50/40",
    labelCls: "text-amber-800",
  },
  medium: {
    label: "● Medium",
    badgeCls: "bg-slate-100 text-slate-600 border-slate-300",
    rowCls: "border-slate-200 bg-white",
    labelCls: "text-slate-700",
  },
  low: {
    label: "○ Low",
    badgeCls: "bg-slate-50 text-slate-400 border-slate-200",
    rowCls: "border-dashed border-slate-200 bg-slate-50",
    labelCls: "text-slate-400",
  },
  hidden: {
    label: "✕ Hidden",
    badgeCls: "bg-red-50 text-red-400 border-red-200",
    rowCls: "border-dashed border-slate-200 bg-slate-50 opacity-60",
    labelCls: "text-slate-400",
  },
};

// ─── Envelope helpers ─────────────────────────────────────────────────────────

/**
 * Normalise any stored value into envelope form.
 * - Already-enveloped (has _priority) → pass through
 * - Plain object → inject _priority
 * - Primitive / array  → { _value, _priority }
 */
export function wrapToEnvelope(v: any, defaultPriority: Priority = "medium"): AnyRecord {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    if (PRIORITIES.includes(v._priority)) return v; // already an envelope
    return { ...v, _priority: defaultPriority };    // plain object → inject meta
  }
  return { _value: v, _priority: defaultPriority };
}

export type EnvelopeRead = {
  rawValue: any;
  priority: Priority;
  /** true = object with _priority injected; false = _value wrapper */
  isObjectEnvelope: boolean;
};

/** Extract display value + priority from an envelope (or legacy plain value). */
export function readEnvelope(v: any): EnvelopeRead {
  if (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    PRIORITIES.includes(v._priority)
  ) {
    const priority = v._priority as Priority;
    if ("_value" in v) {
      return { rawValue: v._value, priority, isObjectEnvelope: false };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _priority, ...rest } = v;
    return { rawValue: rest, priority, isObjectEnvelope: true };
  }
  // Legacy: non-enveloped value
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return { rawValue: v, priority: "medium", isObjectEnvelope: true };
  }
  return { rawValue: v, priority: "medium", isObjectEnvelope: false };
}

function packEnvelope(rawValue: any, priority: Priority, isObjectEnvelope: boolean): AnyRecord {
  if (isObjectEnvelope) {
    return { ...(rawValue ?? {}), _priority: priority };
  }
  return { _value: rawValue, _priority: priority };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const clone = (obj: any) => JSON.parse(JSON.stringify(obj ?? {}));

function toDisplayPairs(obj: AnyRecord, hidden: Set<string>) {
  return Object.entries(obj).filter(([k]) => !META_KEYS.has(k) && !hidden.has(k));
}

// ─── Root Editor ──────────────────────────────────────────────────────────────

export function DynamicFieldsEditor({
  value,
  onChange,
  hiddenKeys,
  nonDeletableKeys,
}: {
  value: AnyRecord;
  onChange: OnChange;
  hiddenKeys?: Iterable<string>;
  nonDeletableKeys?: Iterable<string>;
}) {
  const hidden = new Set(Array.from(hiddenKeys ?? []).map(String));
  const nonDeletable = new Set(Array.from(nonDeletableKeys ?? []).map(String));
  const pairs = toDisplayPairs(value, hidden);

  // Sort by priority for display
  const sortedPairs = [...pairs].sort(([, a], [, b]) => {
    const pa = PRIORITY_ORDER[readEnvelope(a).priority] ?? 1;
    const pb = PRIORITY_ORDER[readEnvelope(b).priority] ?? 1;
    return pa - pb;
  });

  const setField = (k: string, env: AnyRecord) => {
    const next = clone(value);
    next[k] = env;
    onChange(next);
  };

  const deleteField = (k: string) => {
    if (nonDeletable.has(k)) return;
    const next = clone(value);
    delete next[k];
    onChange(next);
  };

  const addField = (k: string, type: string) => {
    const next = clone(value);
    if (!k || k in next || META_KEYS.has(k) || hidden.has(k)) return;
    let env: AnyRecord;
    switch (type) {
      case "number":  env = { _value: null, _priority: "medium" }; break;
      case "boolean": env = { _value: true, _priority: "medium" }; break;
      case "array":   env = { _value: [],   _priority: "medium" }; break;
      case "object":  env = { _priority: "medium" };               break;
      default:        env = { _value: "",   _priority: "medium" }; break;
    }
    next[k] = env;
    onChange(next);
  };

  const renameField = (oldKey: string, newKey: string) => {
    const nk = newKey.trim();
    if (!nk || nk === oldKey || META_KEYS.has(nk) || hidden.has(nk)) return;
    const next = clone(value);
    if (nk in next) return;
    next[nk] = next[oldKey];
    delete next[oldKey];
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-800">Additional Fields</div>
      {pairs.length === 0 && (
        <p className="text-sm text-slate-600">No custom fields yet.</p>
      )}

      {sortedPairs.map(([k, v]) => (
        <FieldRow
          key={k}
          fieldKey={k}
          envelope={v}
          onChange={(env) => setField(k, env)}
          onDelete={() => deleteField(k)}
          canDelete={!nonDeletable.has(k)}
          renameKey={(newKey) => renameField(k, newKey)}
        />
      ))}

      <AddFieldRow onAdd={addField} />
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  fieldKey,
  envelope,
  onChange,
  onDelete,
  canDelete,
  renameKey,
}: {
  fieldKey: string;
  envelope: any;
  onChange: (env: AnyRecord) => void;
  onDelete: () => void;
  canDelete: boolean;
  renameKey: (newKey: string) => void;
}) {
  const [editKey, setEditKey] = useState(fieldKey);
  useEffect(() => setEditKey(fieldKey), [fieldKey]);

  const { rawValue, priority, isObjectEnvelope } = readEnvelope(envelope);
  const pm = PRIORITY_META[priority];

  const handleDelete = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    queueMicrotask(() => onDelete());
  }, [onDelete]);

  const handlePriority = (p: Priority) =>
    onChange(packEnvelope(rawValue, p, isObjectEnvelope));

  const handleValue = (nv: any) =>
    onChange(packEnvelope(nv, priority, isObjectEnvelope));

  return (
    <div className={`rounded-lg border p-3 ${pm.rowCls}`}>
      {/* Header: key name + priority selector + delete */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          className="px-2 py-1 border rounded text-sm w-40 bg-white"
          value={editKey}
          onChange={(e) => setEditKey(e.currentTarget.value)}
          onBlur={() => renameKey(editKey.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              renameKey(editKey.trim());
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        <select
          className={`px-2 py-1 border rounded text-xs font-medium bg-white ${pm.badgeCls}`}
          value={priority}
          onChange={(e) => handlePriority(e.currentTarget.value as Priority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ml-auto text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={handleDelete}
          disabled={!canDelete}
          title={canDelete ? "Delete field" : "Required field"}
        >
          Delete
        </button>
      </div>

      {/* Value editor */}
      {isObjectEnvelope ? (
        <ObjectEnvelopeEditor value={rawValue} onChange={handleValue} />
      ) : Array.isArray(rawValue) ? (
        <ArrayEditor value={rawValue} onChange={handleValue} />
      ) : (
        <PrimitiveEditor value={rawValue} onChange={handleValue} />
      )}
    </div>
  );
}

// ─── Primitive Editor ─────────────────────────────────────────────────────────

function PrimitiveEditor({ value, onChange }: { value: any; onChange: (nv: any) => void }) {
  const [dateBuf, setDateBuf] = useState<string>(value ?? "");
  const [textBuf, setTextBuf] = useState<string>(value ?? "");

  useEffect(() => {
    const next = String(value ?? "");
    if (next !== dateBuf) setDateBuf(next);
    if (next !== textBuf) setTextBuf(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const kind =
    typeof value === "number" || value === null
      ? "number"
      : typeof value === "boolean"
      ? "boolean"
      : typeof value === "string" && /date/i.test(value)
      ? "dateString"
      : "string";

  if (kind === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
        <span className={`font-medium ${value ? "text-emerald-600" : "text-slate-500"}`}>
          {value ? "True" : "False"}
        </span>
      </label>
    );
  }

  if (kind === "number") {
    return (
      <NumberInput
        value={typeof value === "number" && Number.isFinite(value) ? value : null}
        onCommit={onChange}
        placeholder="(number)"
        className="px-2 py-1 border rounded text-sm w-full bg-white"
      />
    );
  }

  if (kind === "dateString") {
    return (
      <div className="flex items-center gap-2">
        <input
          className="px-2 py-1 border rounded text-sm bg-white"
          type="text"
          placeholder="YYYY-MM-DD"
          value={dateBuf}
          onChange={(e) => {
            setDateBuf(e.currentTarget.value);
            onChange(e.currentTarget.value);
          }}
        />
        <input
          className="px-2 py-1 border rounded text-sm bg-white"
          type="date"
          value={dateBuf || ""}
          onChange={(e) => {
            setDateBuf(e.currentTarget.value);
            onChange(e.currentTarget.value);
          }}
        />
      </div>
    );
  }

  // string
  return (
    <input
      className="px-2 py-1 border rounded text-sm w-full bg-white"
      type="text"
      value={textBuf}
      onChange={(e) => {
        setTextBuf(e.currentTarget.value);
        onChange(e.currentTarget.value);
      }}
    />
  );
}

// ─── Array Editor ─────────────────────────────────────────────────────────────

function ArrayEditor({ value, onChange }: { value: any[]; onChange: (nv: any[]) => void }) {
  const arr = value ?? [];
  const update = (idx: number, nv: any) => {
    const next = arr.slice();
    next[idx] = nv;
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = arr.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const firstIsObj =
    arr.length > 0 &&
    arr[0] !== null &&
    typeof arr[0] === "object" &&
    !Array.isArray(arr[0]);

  return (
    <div className="space-y-2">
      {arr.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {item !== null && typeof item === "object" && !Array.isArray(item) ? (
            <div className="flex-1 rounded border border-slate-200 bg-white p-2">
              <ObjectEnvelopeEditor value={item} onChange={(nv) => update(i, nv)} />
            </div>
          ) : (
            <input
              className="px-2 py-1 border rounded text-sm flex-1 bg-white"
              value={String(item ?? "")}
              onChange={(e) => update(i, e.currentTarget.value)}
            />
          )}
          <button
            className="text-sm px-2 py-1 rounded hover:bg-red-50 text-red-500 transition-colors"
            onClick={() => remove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 transition-colors"
          onClick={() => onChange([...arr, ""])}
        >
          + Add item
        </button>
        {(firstIsObj || arr.length === 0) && (
          <button
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 transition-colors"
            onClick={() => onChange([...arr, {}])}
          >
            + Add object item
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Object Envelope Editor ───────────────────────────────────────────────────
// Edits the fields of an object envelope (_priority is managed externally)

function ObjectEnvelopeEditor({
  value,
  onChange,
}: {
  value: Record<string, any>;
  onChange: (nv: Record<string, any>) => void;
}) {
  const entries = Object.entries(value ?? {}).filter(([k]) => k !== "_priority");
  const [newKey, setNewKey] = useState("");

  const update = (k: string, nv: any) => onChange({ ...(value ?? {}), [k]: nv });
  const del = (k: string) => {
    const next = { ...(value ?? {}) };
    delete next[k];
    onChange(next);
  };
  const tryAdd = () => {
    const nk = newKey.trim();
    if (!nk || (value && nk in value)) return;
    onChange({ ...(value ?? {}), [nk]: "" });
    setNewKey("");
  };

  return (
    <div className="space-y-2 text-sm">
      {entries.length === 0 && (
        <p className="text-xs text-slate-400 italic">Empty object — add keys below.</p>
      )}
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <input
            className="px-2 py-1 border rounded text-sm w-36 bg-white shrink-0"
            defaultValue={k}
            onBlur={(e) => {
              const nk = e.currentTarget.value.trim();
              if (!nk || nk === k || (value && nk in value)) return;
              const next = { ...(value ?? {}) };
              next[nk] = next[k];
              delete next[k];
              onChange(next);
            }}
          />
          {typeof v === "boolean" ? (
            <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => update(k, e.currentTarget.checked)}
              />
              {v ? "True" : "False"}
            </label>
          ) : typeof v === "number" ? (
            <NumberInput
              value={Number.isFinite(v) ? v : null}
              onCommit={(nv) => update(k, nv)}
              className="px-2 py-1 border rounded text-sm flex-1 bg-white"
            />
          ) : (
            <input
              className="px-2 py-1 border rounded text-sm flex-1 bg-white"
              value={String(v ?? "")}
              onChange={(e) => update(k, e.currentTarget.value)}
            />
          )}
          <button
            className="text-sm px-2 py-1 rounded hover:bg-red-50 text-red-500 shrink-0 transition-colors"
            onClick={() => del(k)}
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          className="px-2 py-1 border rounded text-sm w-36 bg-white"
          placeholder="New key"
          value={newKey}
          onChange={(e) => setNewKey(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              tryAdd();
            }
          }}
        />
        <button
          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 transition-colors"
          onClick={tryAdd}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({
  value,
  onCommit,
  placeholder,
  className = "px-2 py-1 border rounded text-sm",
  inputMode = "decimal",
  size,
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  step?: number | "any";
  min?: number;
  max?: number;
  inputMode?: "numeric" | "decimal";
  size?: number;
}) {
  const [buf, setBuf] = useState<string>(value == null ? "" : String(value));
  useEffect(() => {
    const next = value == null ? "" : String(value);
    if (next !== buf) setBuf(next);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const parse = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const commit = () => onCommit(parse(buf));

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={className}
      value={buf}
      size={size}
      placeholder={placeholder}
      onChange={(e) => setBuf(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}

// ─── Add Field Row ────────────────────────────────────────────────────────────

function AddFieldRow({ onAdd }: { onAdd: (k: string, type: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("string");

  const submit = () => {
    const nextName = name.trim();
    if (nextName) {
      onAdd(nextName, type);
      setName("");
      setType("string");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
      <span className="text-sm text-slate-600">+ Add field</span>
      <input
        className="px-2 py-1 border rounded text-sm bg-white"
        placeholder="Field name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <select
        className="px-2 py-1 border rounded text-sm bg-white"
        value={type}
        onChange={(e) => setType(e.currentTarget.value)}
      >
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="array">Array</option>
        <option value="object">Object</option>
      </select>
      <button className="text-sm px-2 py-1 rounded border hover:bg-slate-100 transition-colors" onClick={submit}>
        Add
      </button>
    </div>
  );
}
