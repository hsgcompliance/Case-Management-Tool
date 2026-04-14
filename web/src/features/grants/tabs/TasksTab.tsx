// src/features/grants/tabs/TasksTab.tsx
"use client";
import React from "react";
import { TaskBuilder, type TaskTemplateDraft } from "@entities/tasks/TaskBuilder";
import type { TGrant as Grant } from "@types";

// ─── Conditional Task Rule types ─────────────────────────────────────────────

type ConditionalRuleType = "age" | "concurrent_enrollment";
type AgeOperator = ">=" | "<=" | ">" | "<";

export type ConditionalTaskRule = {
  id: string;
  name: string;
  type: ConditionalRuleType;
  // age
  ageOperator?: AgeOperator;
  ageThreshold?: number;
  // concurrent_enrollment
  programName?: string;
  // task definition
  taskName: string;
  taskDescription?: string;
  taskBucket?: string;
  dueOffsetDays?: number | null;
  assignToGroup?: "admin" | "compliance" | "casemanager";
  taskNotes?: string;
};

function newRule(): ConditionalTaskRule {
  return {
    id: `rule_${Date.now().toString(36)}`,
    name: "New Rule",
    type: "age",
    ageOperator: "<",
    ageThreshold: 18,
    taskName: "",
    taskBucket: "task",
    assignToGroup: "casemanager",
    dueOffsetDays: 0,
  };
}

// ─── Single rule editor row ───────────────────────────────────────────────────

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: ConditionalTaskRule;
  onChange: (patch: Partial<ConditionalTaskRule>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-3 bg-white dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 text-sm font-medium"
          placeholder="Rule name (e.g. Under 18 — youth compliance)"
          value={rule.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
        />
        <button
          type="button"
          className="btn btn-ghost btn-xs text-red-500"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>

      {/* Condition type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Condition type</label>
          <select
            className="select select-sm w-full"
            value={rule.type}
            onChange={(e) => onChange({ type: e.currentTarget.value as ConditionalRuleType })}
          >
            <option value="age">Age-based</option>
            <option value="concurrent_enrollment">Concurrent enrollment</option>
          </select>
        </div>

        {rule.type === "age" && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Operator</label>
              <select
                className="select select-sm w-full"
                value={rule.ageOperator ?? ">="}
                onChange={(e) => onChange({ ageOperator: e.currentTarget.value as AgeOperator })}
              >
                <option value="<">{"< (under)"}</option>
                <option value="<=">{"<= (up to)"}</option>
                <option value=">=">{">= (at least)"}</option>
                <option value=">">{">"} (older than)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Age (years)</label>
              <input
                className="input input-sm w-full"
                type="number"
                min={0}
                max={120}
                value={rule.ageThreshold ?? ""}
                onChange={(e) =>
                  onChange({ ageThreshold: e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value) })
                }
              />
            </div>
          </>
        )}

        {rule.type === "concurrent_enrollment" && (
          <div className="col-span-3">
            <label className="block text-xs text-slate-500 mb-1">
              Enrolled in program (name contains)
            </label>
            <input
              className="input input-sm w-full"
              placeholder="e.g. Medicaid, TANF, SNAP…"
              value={rule.programName ?? ""}
              onChange={(e) => onChange({ programName: e.currentTarget.value })}
            />
            <p className="text-xs text-slate-400 mt-0.5">
              Case-insensitive substring match against the enrollment&apos;s grant name.
            </p>
          </div>
        )}
      </div>

      {/* Task definition */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Task name (required)</label>
          <input
            className="input input-sm w-full"
            placeholder="e.g. Youth compliance review"
            value={rule.taskName}
            onChange={(e) => onChange({ taskName: e.currentTarget.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Assigned to</label>
          <select
            className="select select-sm w-full"
            value={rule.assignToGroup ?? "casemanager"}
            onChange={(e) =>
              onChange({ assignToGroup: e.currentTarget.value as ConditionalTaskRule["assignToGroup"] })
            }
          >
            <option value="casemanager">Case Manager</option>
            <option value="compliance">Compliance</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Due offset (days from enroll)</label>
          <input
            className="input input-sm w-full"
            type="number"
            min={0}
            placeholder="0 = enroll date"
            value={rule.dueOffsetDays ?? ""}
            onChange={(e) =>
              onChange({
                dueOffsetDays: e.currentTarget.value === "" ? null : Number(e.currentTarget.value),
              })
            }
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs text-slate-500 mb-1">Notes / description</label>
          <textarea
            className="textarea textarea-sm w-full"
            rows={2}
            placeholder="Optional notes shown on the task"
            value={rule.taskNotes ?? ""}
            onChange={(e) => onChange({ taskNotes: e.currentTarget.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── ConditionalRulesEditor ───────────────────────────────────────────────────

function ConditionalRulesEditor({
  editing,
  rules,
  onChange,
}: {
  editing: boolean;
  rules: ConditionalTaskRule[];
  onChange: (next: ConditionalTaskRule[]) => void;
}) {
  const updateRule = (i: number, patch: Partial<ConditionalTaskRule>) => {
    const next = [...rules];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const removeRule = (i: number) => {
    onChange(rules.filter((_, idx) => idx !== i));
  };

  const addRule = () => onChange([...rules, newRule()]);

  if (!editing && rules.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Conditional Task Rules
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-create tasks when a specific condition is met at enrollment time.
          </div>
        </div>
        {editing && (
          <button type="button" className="btn btn-sm" onClick={addRule}>
            + Add Rule
          </button>
        )}
      </div>

      {rules.length === 0 && editing && (
        <div className="text-xs text-slate-400 italic">
          No conditional rules yet. Add a rule above.
        </div>
      )}

      {rules.map((rule, i) =>
        editing ? (
          <RuleRow key={rule.id} rule={rule} onChange={(p) => updateRule(i, p)} onRemove={() => removeRule(i)} />
        ) : (
          <div
            key={rule.id}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm flex items-start gap-3"
          >
            <span className="text-base">
              {rule.type === "age" ? "🎂" : "🔗"}
            </span>
            <div className="flex-1">
              <div className="font-medium text-slate-800 dark:text-slate-200">{rule.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {rule.type === "age"
                  ? `If age ${rule.ageOperator ?? ">="} ${rule.ageThreshold ?? "?"} years`
                  : `If enrolled in "${rule.programName ?? "?"}"`}
                {" → "}
                <span className="text-slate-700 dark:text-slate-300">{rule.taskName}</span>
                {" "}
                <span className="text-slate-400">
                  ({rule.assignToGroup ?? "casemanager"}, due +{rule.dueOffsetDays ?? 0}d)
                </span>
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ─── TasksTab ─────────────────────────────────────────────────────────────────

export function TasksTab({
  editing,
  model,
  setModel,
  grant,
  onOpenRegen,
  affected,
}: {
  editing: boolean;
  model: Record<string, any>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  grant: Grant | null;
  onOpenRegen: () => void;
  affected: ReadonlyArray<{ clientName: string; startDate: string | null; enrollmentId: string }>;
}) {
  const taskDefs = React.useMemo(() => {
    if (Array.isArray((model as Record<string, unknown>).tasks)) {
      return ((model as Record<string, unknown>).tasks || []) as TaskTemplateDraft[];
    }
    if (Array.isArray((model as Record<string, unknown>).assessments)) {
      return ((model as Record<string, unknown>).assessments || []) as TaskTemplateDraft[];
    }
    return [];
  }, [model]);

  const setTaskDefs = (next: TaskTemplateDraft[]) => {
    setModel((prev) => ({ ...prev, tasks: next }));
  };

  const conditionalRules: ConditionalTaskRule[] = Array.isArray(
    (model as Record<string, unknown>).conditionalTaskRules,
  )
    ? ((model as Record<string, unknown>).conditionalTaskRules as ConditionalTaskRule[])
    : [];

  const setConditionalRules = (next: ConditionalTaskRule[]) => {
    setModel((prev) => ({ ...prev, conditionalTaskRules: next }));
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Description banner */}
      {!editing && (
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">About Tasks</div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Task definitions set the standard work schedule for clients enrolled in this program. When a customer is enrolled,
            these definitions are used to generate a personal task schedule with due dates and assignments. Conditional rules
            can trigger additional tasks based on client attributes like age or concurrent enrollment.
            Use <strong>Regenerate for enrolled customers</strong> to apply template changes to existing enrollments.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {editing ? "Build managed task definitions for this grant." : "Task definitions for this program."}
        </div>
        {!editing && grant?.id && affected.length > 0 && (
          <button className="btn btn-sm" onClick={onOpenRegen}>
            Regenerate for enrolled customers
          </button>
        )}
        {!editing && grant?.id && affected.length === 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">No active enrollments for this grant.</span>
        )}
      </div>

      <TaskBuilder editing={editing} value={taskDefs} onChange={setTaskDefs} />

      <ConditionalRulesEditor
        editing={editing}
        rules={conditionalRules}
        onChange={setConditionalRules}
      />

      {editing && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          After saving changes, use <b>Regenerate for enrolled customers</b> to update existing enrollments. New enrollments will inherit these task definitions automatically.
        </div>
      )}
    </div>
  );
}
