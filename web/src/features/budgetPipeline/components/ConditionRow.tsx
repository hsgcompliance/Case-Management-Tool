"use client";
// web/src/features/budgetPipeline/components/ConditionRow.tsx
import React from "react";
import type { TPipelineCondition } from "@types";
import {
  OPERATORS_BY_TYPE,
  NO_VALUE_OPERATORS,
  type PipelineFieldDef,
} from "../fieldDefs";

const selectCls =
  "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";
const inputCls =
  "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";

type Props = {
  condition: TPipelineCondition;
  fieldDefs: PipelineFieldDef[];
  onChange: (updated: TPipelineCondition) => void;
  onRemove: () => void;
};

export function ConditionRow({ condition, fieldDefs, onChange, onRemove }: Props) {
  const fieldByKey = React.useMemo(
    () => new Map(fieldDefs.map((f) => [f.key, f])),
    [fieldDefs],
  );
  const fieldDef = fieldByKey.get(condition.field);
  const type = fieldDef?.type ?? "text";
  const typeLabel =
    fieldDef?.typeLabel ??
    (type === "select"
      ? "Dropdown"
      : type === "date"
        ? "Date"
        : type === "number"
          ? "Number"
          : type === "boolean"
            ? "Boolean"
            : "Text");
  const operators = OPERATORS_BY_TYPE[type];
  const needsValue = !NO_VALUE_OPERATORS.has(condition.operator);
  const isMulti = condition.operator === "in" || condition.operator === "not_in";
  const hasOptions = (fieldDef?.options?.length ?? 0) > 0;
  const usesOptionSelect =
    type === "select" &&
    hasOptions &&
    (condition.operator === "equals" || condition.operator === "not_equals");
  const fieldSelectLabel = fieldDef?.label ?? condition.field;
  const fieldHelp = fieldDef?.description ?? (
    condition.field.startsWith("tx:")
      ? "Live transaction field inferred from the current form schema."
      : "Normalized payment queue field."
  );

  function onFieldChange(key: string) {
    const newDef = fieldByKey.get(key);
    const newType = newDef?.type ?? "text";
    const newOp = OPERATORS_BY_TYPE[newType][0].value;
    onChange({ ...condition, field: key, operator: newOp, value: "" });
  }

  function onOpChange(op: string) {
    const newOp = op as TPipelineCondition["operator"];
    onChange({ ...condition, operator: newOp, value: "" });
  }

  function renderValueInput() {
    if (!needsValue) return null;

    if (type === "boolean") return null;

    if (type === "select") {
      if (isMulti) {
        const values = new Set(Array.isArray(condition.value) ? condition.value.map(String) : []);
        const options = fieldDef?.options ?? [];
        if (options.length > 0) {
          return (
            <div className="flex max-w-md flex-wrap gap-1.5">
              {options.map((opt) => (
                <label
                  key={opt}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="accent-sky-500"
                    checked={values.has(opt)}
                    onChange={(e) => {
                      const next = new Set(values);
                      if (e.currentTarget.checked) next.add(opt);
                      else next.delete(opt);
                      onChange({ ...condition, value: Array.from(next) });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          );
        }
        const strVal = Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value);
        return (
          <input
            className={`${inputCls} w-40`}
            type="text"
            placeholder="val1, val2"
            value={strVal}
            onChange={(e) =>
              onChange({
                ...condition,
                value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        );
      }
      if (usesOptionSelect) {
        return (
          <select
            className={selectCls}
            value={String(condition.value)}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          >
            {["", ...(fieldDef?.options ?? [])].map((opt) => (
              <option key={opt} value={opt}>
                {opt || "(empty)"}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          className={`${inputCls} w-44`}
          type="text"
          placeholder="value"
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
      );
    }

    if (type === "number") {
      return (
        <input
          className={`${inputCls} w-24`}
          type="number"
          value={condition.value === "" ? "" : Number(condition.value)}
          onChange={(e) =>
            onChange({ ...condition, value: e.target.value === "" ? "" : Number(e.target.value) })
          }
        />
      );
    }

    if (type === "date") {
      return (
        <input
          className={`${inputCls} w-36`}
          type="date"
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
      );
    }

    return (
      <input
        className={`${inputCls} w-44`}
        type="text"
        placeholder="value"
        value={String(condition.value)}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 flex-wrap">
      <select
        className={`${selectCls} min-w-0 w-full max-w-[22rem]`}
        title={`${fieldSelectLabel}: ${fieldHelp}`}
        value={condition.field}
        onChange={(e) => onFieldChange(e.target.value)}
      >
        {!fieldDef ? (
          <optgroup label="Unavailable field">
            <option value={condition.field}>{condition.field}</option>
          </optgroup>
        ) : null}
        <optgroup label="Normalized fields">
          {fieldDefs.map((f) => (
            <option key={f.key} value={f.key} title={f.description}>
              {f.label}
            </option>
          ))}
        </optgroup>
      </select>

      <select
        className={selectCls}
        value={condition.operator}
        onChange={(e) => onOpChange(e.target.value)}
        title="Positive matches require an answered field. Negative matches pass when the field is empty."
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {renderValueInput()}

      {fieldDef ? (
        <span className="text-xs whitespace-nowrap text-slate-500 dark:text-slate-400" title={fieldHelp}>
          Field type: {typeLabel}
          {fieldDef.options?.length ? ` · ${fieldDef.options.length} live options` : ""}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 px-1 text-lg leading-none transition-colors"
        title="Remove condition"
      >
        ×
      </button>
    </div>
  );
}
