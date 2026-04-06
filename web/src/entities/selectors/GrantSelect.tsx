"use client";

import React from "react";
import { useGrants } from "@hooks/useGrants";
import type { GrantsListQuery } from "@types";
import { asEntityArray, EntitySelect, entitySelectInputClassName, resolveEntityPlaceholder } from "./shared";

type Props = {
  value: string | null;
  onChange: (grantId: string | null) => void;
  className?: string;
  includeUnassigned?: boolean;
  placeholderLabel?: string;
  disabled?: boolean;
  filters?: GrantsListQuery;
  mode?: "all" | "grant" | "program";
  groupByKind?: boolean;
};

type GrantLite = {
  id?: string;
  name?: string;
  code?: string;
  kind?: string;
  budget?: { total?: number | null } | null;
};

export default function GrantSelect({
  value,
  onChange,
  className = "",
  includeUnassigned = true,
  placeholderLabel = "-- Select grant --",
  disabled,
  filters = { active: true, limit: 500 },
  mode = "all",
  groupByKind = true,
}: Props) {
  const q = useGrants(filters, { enabled: true });

  const grants = React.useMemo(() => {
    const list = asEntityArray<GrantLite>(q.data);
    const sorted = list
      .slice()
      .filter((g) => !!g?.id)
      .sort((a, b) =>
        String(a?.name || a?.code || a?.id).localeCompare(String(b?.name || b?.code || b?.id))
      );

    return sorted.filter((g) => {
      const kind = String(g?.kind || "").toLowerCase();
      const isProgram = kind === "program";
      if (mode === "grant") return !isProgram;
      if (mode === "program") return isProgram;
      return true;
    });
  }, [q.data, mode]);

  const grouped = React.useMemo(() => {
    const grantsOnly: GrantLite[] = [];
    const programsOnly: GrantLite[] = [];
    for (const g of grants) {
      const kind = String(g?.kind || "").toLowerCase();
      if (kind === "program") {
        programsOnly.push(g);
      } else {
        grantsOnly.push(g);
      }
    }
    return { grantsOnly, programsOnly };
  }, [grants]);

  const isDisabled = Boolean(disabled || q.isLoading);
  const noOptions = !q.isLoading && grants.length === 0;
  const placeholder = resolveEntityPlaceholder({
    isLoading: q.isLoading,
    isEmpty: noOptions,
    loadingLabel: "Loading grants...",
    emptyLabel: "No grants found",
    placeholderLabel,
  });

  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      disabled={isDisabled}
      fullWidth
      inputClassName={entitySelectInputClassName("min-w-[220px]", className)}
      placeholderOption={includeUnassigned ? placeholder : undefined}
      placeholderDisabled={false}
      options={
        mode === "all" && groupByKind
          ? [
              ...(grouped.grantsOnly.length > 0
                ? [{
                    label: "Grants",
                    options: grouped.grantsOnly.map((g) => ({
                      value: String(g.id || ""),
                      label: String(g.name || g.code || g.id || ""),
                    })),
                  }]
                : []),
              ...(grouped.programsOnly.length > 0
                ? [{
                    label: "Programs",
                    options: grouped.programsOnly.map((g) => ({
                      value: String(g.id || ""),
                      label: String(g.name || g.code || g.id || ""),
                    })),
                  }]
                : []),
            ]
          : grants.map((g) => ({
              value: String(g.id || ""),
              label: String(g.name || g.code || g.id || ""),
            }))
      }
    />
  );
}
