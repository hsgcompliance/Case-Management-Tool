// web/src/entities/selectors/roleSelect.tsx
//must update to match tags vs role: casemanager = tag, user = role.
"use client";
import React from "react";
import { EntitySelect } from "./shared";

type Props = {
  value: string | null;
  onChange: (role: string | null) => void;
  className?: string;
};

export default function RoleSelect({ value, onChange, className = "" }: Props) {
  // Simple stub; plug in your real roles later.
  const roles = ["admin", "user", "case_manager"];

  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      options={roles.map((r) => ({ value: r, label: r }))}
      placeholderOption="Select role"
      className={className}
    />
  );
}

