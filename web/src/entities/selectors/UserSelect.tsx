"use client";

import React from "react";
import { useUsers, type CompositeUser } from "@hooks/useUsers";
import { hasAnyRole, normalizeRoles, topRoleNormalized } from "@lib/roles";
import { EntitySelect, entitySelectInputClassName, resolveEntityPlaceholder } from "./shared";

export type UserOption = {
  uid: string;
  label: string;
  email?: string | null;
  active?: boolean;
  roles?: string[];
};

type Props = {
  value: string | null;
  onChange: (uid: string | null) => void;
  className?: string;
  disabled?: boolean;
  options?: UserOption[];
  includeUnassigned?: boolean;
  placeholderLabel?: string;
  onlyActive?: boolean;
  roleIncludes?: string[];
  status?: "all" | "active" | "inactive";
  limit?: number;
  tourId?: string;
};
export type UserSelectProps = Props;

function includesRole(user: UserOption, roleIncludes: string[]): boolean {
  if (!roleIncludes.length) return true;
  return hasAnyRole(user.roles, roleIncludes);
}

export default function UserSelect({
  value,
  onChange,
  className = "",
  disabled,
  options,
  includeUnassigned = true,
  placeholderLabel = "-- Select user --",
  onlyActive = true,
  roleIncludes = [],
  status = "all",
  limit = 500,
  tourId,
}: Props) {
  const usersQ = useUsers({ status, limit });

  const opts = React.useMemo(() => {
    const base: UserOption[] = Array.isArray(options)
        ? options
        : ((usersQ.data || []) as CompositeUser[]).map((u) => {
          const roles = normalizeRoles(u.roles);
          const topRole = topRoleNormalized(u);
          return {
            uid: String(u.uid),
            label: String(u.displayName || u.email || u.uid),
            email: u.email ? String(u.email) : null,
            active: u.active !== false && u.disabled !== true,
            roles: topRole ? [...roles, topRole] : roles,
          };
        });

    return base
      .filter((u) => !!u.uid)
      .filter((u) => (onlyActive ? u.active !== false : true))
      .filter((u) => includesRole(u, roleIncludes))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  }, [options, usersQ.data, onlyActive, roleIncludes]);

  const isLoading = !options && usersQ.isLoading;
  const isDisabled = Boolean(disabled || isLoading);
  const empty = !isLoading && opts.length === 0;
  const placeholder = resolveEntityPlaceholder({
    isLoading,
    isEmpty: empty,
    loadingLabel: "Loading users...",
    emptyLabel: "No users found",
    placeholderLabel,
  });

  return (
    <EntitySelect
      tourId={tourId}
      value={value}
      onChange={onChange}
      options={opts.map((u) => ({
        value: u.uid,
        label: `${u.label}${u.email ? ` (${u.email})` : ""}`,
      }))}
      placeholderOption={includeUnassigned ? placeholder : undefined}
      placeholderDisabled={!includeUnassigned}
      disabled={isDisabled}
      fullWidth
      inputClassName={entitySelectInputClassName("min-w-[240px]", className)}
    />
  );
}
