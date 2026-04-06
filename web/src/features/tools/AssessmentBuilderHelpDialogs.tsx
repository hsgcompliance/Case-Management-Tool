"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";

type HelpKey =
  | "load_existing"
  | "grant_link"
  | "presets"
  | "assessment_builder"
  | "levels"
  | "calculation_fields"
  | "linked_tasks"
  | "save_template";

const HELP_COPY: Record<HelpKey, { title: string; body: string }> = {
  load_existing: {
    title: "Load Existing",
    body: "Loads an existing assessment template into this editor. This is useful when you want to revise questions, rules, tasks, or calculation fields without starting from scratch.",
  },
  grant_link: {
    title: "Grant/Program Link",
    body: "Optionally links this template to a specific grant or program. Linked templates are easier to target in workflows and reporting, but you can leave this unassigned for shared templates.",
  },
  presets: {
    title: "Presets",
    body: "Presets prefill a full template scaffold. Use Blank for a fresh start, Referral for waitlist prioritization, and Acuity for customer acuity scoring.",
  },
  assessment_builder: {
    title: "Assessment Builder",
    body: "This is the core rubric editor. Define questions, answer options, and point values. The selected options generate the score inputs used by calculation fields and task workflows.",
  },
  levels: {
    title: "Levels",
    body: "Levels map score ranges to labels (for example Low, Medium, High). Keep level ranges non-overlapping and complete so every score can resolve to exactly one level.",
  },
  calculation_fields: {
    title: "Calculation Fields",
    body: "Calculation fields are derived outputs from rubric results. For example: total score, rank order, or level label. `key` is the machine name used by automations, `label` is what users see, and `expression` defines how the value is computed.",
  },
  linked_tasks: {
    title: "Tasks Linked To Template",
    body: "Attach operational follow-up tasks that should run with this template. Use these for responsibility handoffs, review cadence, and compliance checkpoints tied to assessment completion.",
  },
  save_template: {
    title: "Save Tool Template",
    body: "Saves this tool configuration to the backend. If this is a new template, it creates one; if it has an ID, it updates the existing version.",
  },
};

export function HelpDialogButton({ helpKey }: { helpKey: HelpKey }) {
  const [open, setOpen] = React.useState(false);
  const copy = HELP_COPY[helpKey];

  return (
    <>
      <button
        type="button"
        aria-label={`Help: ${copy.title}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={copy.title}
        widthClass="max-w-lg"
        footer={
          <button className="btn btn-sm" onClick={() => setOpen(false)}>
            Close
          </button>
        }
      >
        <div className="text-sm text-slate-700 dark:text-slate-200">{copy.body}</div>
      </Modal>
    </>
  );
}
