"use client";
import React from "react";
import { Modal } from "@entities/ui/Modal";

type TaskMode = "viewer" | "workflow";

type Props = {
  isOpen: boolean;
  onSelect: (mode: TaskMode) => Promise<void>;
  saving?: boolean;
};

const MODES: { value: TaskMode; label: string; description: string }[] = [
  {
    value: "viewer",
    label: "Viewer",
    description:
      "Browse tasks and monitor progress. Ideal if your primary role is oversight and reporting.",
  },
  {
    value: "workflow",
    label: "Workflow",
    description:
      "Actively work through tasks step by step. Ideal for case managers completing assignments.",
  },
];

export function TaskModeSelectModal({ isOpen, onSelect, saving }: Props) {
  const [selected, setSelected] = React.useState<TaskMode | null>(null);

  const handleConfirm = async () => {
    if (!selected || saving) return;
    await onSelect(selected);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Choose your task experience"
      disableOverlayClose
      disableEscClose
      widthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="btn btn-sm"
            onClick={handleConfirm}
            disabled={!selected || saving}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Select how you want to work with tasks. You can change this later in Settings.
      </p>
      <div className="flex flex-col gap-3">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setSelected(mode.value)}
            disabled={saving}
            className={`w-full rounded-xl border-2 p-4 text-left transition ${
              selected === mode.value
                ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-800"
                : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            }`}
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100">{mode.label}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{mode.description}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
