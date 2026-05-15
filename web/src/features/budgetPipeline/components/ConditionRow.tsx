"use client";
// web/src/features/budgetPipeline/components/ConditionRow.tsx
import React from "react";
import type { TPipelineCondition } from "@types";
import {
  FIELD_BY_KEY,
  NORMALIZED_FIELDS,
  OPERATORS_BY_TYPE,
  NO_VALUE_OPERATORS,
} from "../fieldDefs";

const selectCls =
  "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";
const inputCls =
  "text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500";

type Props = {
  condition: TPipelineCondition;
  onChange: (updated: TPipelineCondition) => void;
  onRemove: () => void;
};

export function ConditionRow({ condition, onChange, onRemove }: Props) {
  const fieldDef = FIELD_BY_KEY.get(condition.field);
  const type = fieldDef?.type ?? "text";
  const operators = OPERATORS_BY_TYPE[type];
  const needsValue = !NO_VALUE_OPERATORS.has(condition.operator);
  const isMulti = condition.operator === "in" || condition.operator === "not_in";

  function onFieldChange(key: string) {
    const newDef = FIELD_BY_KEY.get(key);
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
        const strVal = Array.isArray(condition.value)
          ? condition.value.join(", ")
          : String(condition.value);
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
      return (
        <select
          className={selectCls}
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        >
          {(fieldDef?.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt || "(empty)"}
            </option>
          ))}
        </select>
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
          className={`${inputCls} w-28`}
          type="text"
          placeholder="YYYY-MM"
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
      );
    }

    // text default
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
    <div className="flex items-center gap-2 py-0.5 flex-wrap">
      {/* Field selector */}
      <select className={selectCls} value={condition.field} onChange={(e) => onFieldChange(e.target.value)}>
        <optgroup label="Normalized fields">
          {NORMALIZED_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </optgroup>
      </select>

      {/* Operator selector */}
      <select className={selectCls} value={condition.operator} onChange={(e) => onOpChange(e.target.value)}>
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {renderValueInput()}

      {/* Remove */}
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
