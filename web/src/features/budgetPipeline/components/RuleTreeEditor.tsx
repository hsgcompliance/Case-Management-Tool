"use client";

import React from "react";
import type { TPipelineCondition, TPipelineRuleNode } from "@types";
import { ConditionRow } from "./ConditionRow";
import {
  NORMALIZED_FIELDS,
  OPERATORS_BY_TYPE,
  type PipelineFieldDef,
  type PipelineFieldType,
} from "../fieldDefs";

const MAX_DEPTH = 3;

function newId() {
  return crypto.randomUUID();
}

function defaultOperator(type: PipelineFieldType) {
  return OPERATORS_BY_TYPE[type][0].value;
}

function newCondition(fieldDefs: PipelineFieldDef[]): TPipelineRuleNode {
  const field = fieldDefs[0] ?? NORMALIZED_FIELDS[0];
  const condition: TPipelineCondition = {
    id: newId(),
    field: field.key,
    operator: defaultOperator(field.type),
    value: "",
  };
  return { id: condition.id, type: "condition", condition };
}

function newGroup(logic: "AND" | "OR", fieldDefs: PipelineFieldDef[]): TPipelineRuleNode {
  return {
    id: newId(),
    type: "group",
    logic,
    children: [newCondition(fieldDefs)],
  };
}

type Props = {
  title: string;
  description: string;
  root: TPipelineRuleNode;
  tone: "include" | "exclude";
  formTitle: string;
  formFields: PipelineFieldDef[];
  onChange: (root: TPipelineRuleNode) => void;
};

export function RuleTreeEditor({ title, description, root, tone, formTitle, formFields, onChange }: Props) {
  const allFields = React.useMemo(() => [...NORMALIZED_FIELDS, ...formFields], [formFields]);

  function updateNode(targetId: string, updater: (node: TPipelineRuleNode) => TPipelineRuleNode) {
    const visit = (node: TPipelineRuleNode): TPipelineRuleNode => {
      if (node.id === targetId) return updater(node);
      if (node.type !== "group") return node;
      return { ...node, children: node.children.map(visit) };
    };
    onChange(visit(root));
  }

  function removeChild(parentId: string, childId: string) {
    updateNode(parentId, (node) => {
      if (node.type !== "group") return node;
      return { ...node, children: node.children.filter((child) => child.id !== childId) };
    });
  }

  function addChild(parentId: string, child: TPipelineRuleNode) {
    updateNode(parentId, (node) => {
      if (node.type !== "group") return node;
      return { ...node, children: [...node.children, child] };
    });
  }

  function renderNode(node: TPipelineRuleNode, parentId: string | null, depth: number) {
    if (node.type === "condition") {
      return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <ConditionRow
            condition={node.condition}
            formTitle={formTitle}
            formFields={formFields}
            onChange={(condition) => updateNode(node.id, () => ({ ...node, condition }))}
            onRemove={() => {
              if (parentId) removeChild(parentId, node.id);
            }}
          />
        </div>
      );
    }

    return (
      <div
        className={[
          "rounded-xl border p-3",
          depth === 1
            ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        ].join(" ")}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {depth === 1 ? "Root group" : "Nested group"}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              onClick={() => updateNode(node.id, () => ({ ...node, logic: node.logic === "AND" ? "OR" : "AND" }))}
              title="Toggle group logic"
            >
              {node.logic}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {node.logic === "AND" ? "all children must match" : "any child can match"}
            </span>
          </div>
          {parentId ? (
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400"
              onClick={() => removeChild(parentId, node.id)}
            >
              Remove group
            </button>
          ) : null}
        </div>

        {node.children.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 py-5 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            No rules in this group.
          </div>
        ) : (
          <div className="space-y-2">
            {node.children.map((child, idx) => (
              <React.Fragment key={child.id}>
                {idx > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {node.logic}
                    </span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                ) : null}
                {renderNode(child, node.id, depth + 1)}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={() => addChild(node.id, newCondition(allFields))}
          >
            + Add condition
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            disabled={depth >= MAX_DEPTH}
            onClick={() => addChild(node.id, newGroup("AND", allFields))}
            title={depth >= MAX_DEPTH ? "Maximum nesting depth reached" : undefined}
          >
            + Add condition group
          </button>
        </div>
      </div>
    );
  }

  const tag =
    tone === "include"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${tag}`}>{tone.toUpperCase()}</span>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {renderNode(root, null, 1)}
    </section>
  );
}
