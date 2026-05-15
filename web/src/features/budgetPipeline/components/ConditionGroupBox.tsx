"use client";
// web/src/features/budgetPipeline/components/ConditionGroupBox.tsx
import React from "react";
import type { TPipelineConditionGroup, TPipelineCondition } from "@types";
import { ConditionRow } from "./ConditionRow";
import { NORMALIZED_FIELDS, defaultOperatorForField } from "../fieldDefs";

function newCondition(): TPipelineCondition {
  const field = NORMALIZED_FIELDS[0].key;
  return {
    id: crypto.randomUUID(),
    field,
    operator: defaultOperatorForField(field),
    value: "",
  };
}

type Props = {
  group: TPipelineConditionGroup;
  isExclude?: boolean;
  onChange: (updated: TPipelineConditionGroup) => void;
  onRemove: () => void;
};

export function ConditionGroupBox({ group, isExclude = false, onChange, onRemove }: Props) {
  const accentColor = isExclude
    ? "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30"
    : "border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20";
  const tagColor = isExclude
    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
    : "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300";

  function updateCondition(idx: number, updated: TPipelineCondition) {
    const conditions = group.conditions.map((c, i) => (i === idx ? updated : c));
    onChange({ ...group, conditions });
  }

  function removeCondition(idx: number) {
    const conditions = group.conditions.filter((_, i) => i !== idx);
    onChange({ ...group, conditions });
  }

  function addCondition() {
    onChange({ ...group, conditions: [...group.conditions, newCondition()] });
  }

  function toggleLogic() {
    onChange({ ...group, logic: group.logic === "AND" ? "OR" : "AND" });
  }

  const condConnector = group.logic === "AND"
    ? "text-xs font-semibold text-slate-400 dark:text-slate-500 select-none"
    : "text-xs font-semibold text-violet-400 dark:text-violet-500 select-none";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${accentColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${tagColor}`}>
            {isExclude ? "EXCLUDE" : "INCLUDE"}
          </span>
          <button
            type="button"
            onClick={toggleLogic}
            className="text-xs font-semibold border border-slate-300 dark:border-slate-600 rounded px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Toggle AND/OR logic"
          >
            {group.logic}
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {group.logic === "AND" ? "all must match" : "any can match"}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          Remove group
        </button>
      </div>

      {/* Conditions */}
      {group.conditions.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic px-1">
          No conditions — click a field in the sidebar or "+ Add condition" below.
        </p>
      )}
      {group.conditions.map((cond, idx) => (
        <div key={cond.id} className="flex items-center gap-2">
          {idx > 0 && (
            <span className={`w-8 text-right shrink-0 ${condConnector}`}>{group.logic}</span>
          )}
          {idx > 0 && <div className="flex-1" />}
          <div className={idx > 0 ? "flex items-center gap-2 w-full" : "w-full"}>
            <ConditionRow
              condition={cond}
              onChange={(updated) => updateCondition(idx, updated)}
              onRemove={() => removeCondition(idx)}
            />
          </div>
        </div>
      ))}

      {/* Add condition */}
      <button
        type="button"
        onClick={addCondition}
        className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        + Add condition
      </button>
    </div>
  );
}
