"use client";
// web/src/features/budgetPipeline/components/FieldSidebar.tsx
import React, { useState } from "react";
import { NORMALIZED_FIELDS, type PipelineFieldDef } from "../fieldDefs";

const LOGIC_BUTTONS = [
  { label: "+ Add condition",       action: "add_condition"       },
  { label: "+ Add AND group",       action: "add_and_group"       },
  { label: "+ Add OR group",        action: "add_or_group"        },
  { label: "+ Add exclusion",       action: "add_exclusion"       },
  { label: "+ Add amount condition",action: "add_amount_condition"},
  { label: "+ Add date condition",  action: "add_date_condition"  },
];

// Known raw Jotform field IDs for the two spending forms
const RAW_JOTFORM_FIELDS: PipelineFieldDef[] = [
  { key: "raw:19",  label: "CC — Expense Date",    type: "date",   rawFieldId: "19" },
  { key: "raw:3",   label: "CC — Merchant",        type: "text",   rawFieldId: "3"  },
  { key: "raw:4",   label: "CC — Amount",          type: "number", rawFieldId: "4"  },
  { key: "raw:5",   label: "CC — Card",            type: "text",   rawFieldId: "5"  },
  { key: "raw:6",   label: "CC — Purpose",         type: "text",   rawFieldId: "6"  },
  { key: "raw:7",   label: "CC — Expense Type",    type: "text",   rawFieldId: "7"  },
  { key: "raw:20",  label: "CC — Card Bucket",     type: "select", rawFieldId: "20", options: ["Youth", "Housing", "MAD"] },
  { key: "raw:101", label: "Inv — Service Type",   type: "text",   rawFieldId: "101"},
  { key: "raw:102", label: "Inv — Payment Method", type: "text",   rawFieldId: "102"},
  { key: "raw:103", label: "Inv — Amount",         type: "number", rawFieldId: "103"},
  { key: "raw:104", label: "Inv — Descriptor",     type: "text",   rawFieldId: "104"},
];

type Props = {
  onAction: (action: string) => void;
  onAddField: (fieldKey: string) => void;
};

export function FieldSidebar({ onAction, onAddField }: Props) {
  const [logicOpen, setLogicOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const sectionBtn =
    "flex w-full items-center justify-between py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors";
  const fieldBtn =
    "w-full text-left px-2 py-1 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors truncate";
  const logicBtn =
    "w-full text-left px-2 py-1 text-sm text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors";

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Logic section */}
        <div>
          <button type="button" className={sectionBtn} onClick={() => setLogicOpen((v) => !v)}>
            <span>Logic</span>
            <span>{logicOpen ? "▲" : "▼"}</span>
          </button>
          {logicOpen && (
            <div className="space-y-0.5 mt-1">
              {LOGIC_BUTTONS.map((btn) => (
                <button
                  key={btn.action}
                  type="button"
                  className={logicBtn}
                  onClick={() => onAction(btn.action)}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        {/* Form Fields section */}
        <div>
          <button type="button" className={sectionBtn} onClick={() => setFieldsOpen((v) => !v)}>
            <span>Form Fields</span>
            <span>{fieldsOpen ? "▲" : "▼"}</span>
          </button>
          {fieldsOpen && (
            <div className="space-y-0.5 mt-1">
              {NORMALIZED_FIELDS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={fieldBtn}
                  onClick={() => onAddField(f.key)}
                  title={f.sampleValues ? `e.g. ${f.sampleValues.join(", ")}` : undefined}
                >
                  <span className="text-slate-400 dark:text-slate-500 mr-1 text-xs">
                    {f.type === "number" ? "#" : f.type === "boolean" ? "✓" : f.type === "select" ? "≡" : "T"}
                  </span>
                  {f.label}
                </button>
              ))}

              {/* Advanced: raw Jotform field IDs */}
              <div className="mt-2">
                <button
                  type="button"
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 w-full text-left px-2 py-1"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? "▲" : "▶"} Advanced (raw field IDs)
                </button>
                {advancedOpen && (
                  <div className="mt-0.5 space-y-0.5 border-l-2 border-slate-300 dark:border-slate-600 ml-2 pl-2">
                    {RAW_JOTFORM_FIELDS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`${fieldBtn} text-xs`}
                        onClick={() => onAddField(f.key)}
                      >
                        <span className="text-slate-400 mr-1">⚙</span>
                        {f.label}
                      </button>
                    ))}
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-2 pt-1">
                      Type a custom ID: <code className="text-xs">raw:fieldId</code>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
