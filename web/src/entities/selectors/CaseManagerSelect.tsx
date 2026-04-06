"use client";

import React from "react";
import UserSelect, { type UserOption } from "./UserSelect";

export type CaseManagerOption = {
  uid: string;
  label: string;
  email?: string | null;
  active?: boolean;
};

type Props = {
  value: string | null;
  onChange: (uid: string | null) => void;
  options?: CaseManagerOption[];
  className?: string;
  disabled?: boolean;
  includeAll?: boolean;
  allLabel?: string;
  onlyActive?: boolean;
  limit?: number;
  tourId?: string;
};

export default function CaseManagerSelect({
  value,
  onChange,
  options,
  className = "",
  disabled,
  includeAll = true,
  allLabel = "All case managers",
  onlyActive = true,
  limit = 500,
  tourId,
}: Props) {
  const computedOptions = React.useMemo<UserOption[] | undefined>(() => {
    if (!Array.isArray(options)) return undefined;
    return options.map((o) => ({
      uid: String(o.uid || ""),
      label: String(o.label || o.email || o.uid || ""),
      email: o.email ? String(o.email) : null,
      active: typeof o.active === "boolean" ? o.active : true,
      roles: ["case_manager"],
    }));
  }, [options]);

  return (
    <UserSelect
      value={value}
      onChange={onChange}
      options={computedOptions}
      className={className}
      disabled={disabled}
      includeUnassigned={includeAll}
      placeholderLabel={allLabel}
      onlyActive={onlyActive}
      roleIncludes={["case_manager", "casemanager"]}
      status="all"
      limit={limit}
      tourId={tourId}
    />
  );
}
