"use client";

import React from "react";
import UserSelect from "@entities/selectors/UserSelect";
import { RGSelect } from "@entities/ui/forms/InputComponents";

export type TaskReassignTarget =
  | { kind: "compliance" }
  | { kind: "admin" }
  | { kind: "cm"; cmUid: string | null };

type Props = {
  value: TaskReassignTarget;
  onChange: (next: TaskReassignTarget) => void;
  disabled?: boolean;
  tourId?: string;
};

export default function TaskReassignSelect({ value, onChange, disabled, tourId }: Props) {
  return (
    <div className="space-y-2" data-tour={tourId}>
      <RGSelect
        tourId={tourId ? `${tourId}-kind` : undefined}
        label="Assign To"
        value={value.kind}
        onChange={(nextValue) => {
          const next = nextValue as "compliance" | "admin" | "cm";
          if (next === "cm") onChange({ kind: "cm", cmUid: value.kind === "cm" ? value.cmUid : null });
          else onChange({ kind: next });
        }}
        options={[
          { value: "compliance", label: "Compliance Queue" },
          { value: "admin", label: "Admin Queue" },
          { value: "cm", label: "Case Manager" },
        ]}
        fullWidth
        className="w-full"
        disabled={disabled}
      />

      {value.kind === "cm" && (
        <UserSelect
          tourId={tourId ? `${tourId}-cm-user` : undefined}
          value={value.cmUid || null}
          onChange={(uid) => onChange({ kind: "cm", cmUid: uid })}
          includeUnassigned={false}
          className="w-full min-w-0"
          disabled={disabled}
        />
      )}
    </div>
  );
}
