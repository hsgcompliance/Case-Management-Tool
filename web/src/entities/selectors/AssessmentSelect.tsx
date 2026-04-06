"use client";

import React from "react";
import { useAssessmentTemplates } from "@hooks/useAssessments";
import type { AssessmentTemplatesListReq } from "@types";
import { asEntityArray, EntitySelect, entitySelectInputClassName, resolveEntityPlaceholder } from "./shared";

type TemplateLite = {
  id?: string;
  title?: string;
  kind?: string;
  scope?: string;
  locked?: boolean;
};

type Props = {
  value: string | null;
  onChange: (templateId: string | null) => void;
  className?: string;
  disabled?: boolean;
  includeUnassigned?: boolean;
  placeholderLabel?: string;
  filters?: AssessmentTemplatesListReq;
  groupByKind?: boolean;
  includeLocked?: boolean;
};

export default function AssessmentSelect({
  value,
  onChange,
  className = "",
  disabled,
  includeUnassigned = true,
  placeholderLabel = "-- Select assessment template --",
  filters = { includeLocked: true },
  groupByKind = true,
  includeLocked = true,
}: Props) {
  // Always fetch with includeLocked:true so we have the full set; the
  // includeLocked prop then controls client-side visibility.
  const q = useAssessmentTemplates(
    { ...filters, includeLocked: true },
    { staleTime: 10_000 }
  );

  const list = React.useMemo(() => {
    return asEntityArray<TemplateLite>(q.data)
      .filter((t) => !!t?.id)
      .filter((t) => (includeLocked ? true : t?.locked !== true))
      .sort((a, b) => String(a?.title || a?.id).localeCompare(String(b?.title || b?.id)));
  }, [q.data, includeLocked]);

  const grouped = React.useMemo(() => {
    const byKind = new Map<string, TemplateLite[]>();
    for (const row of list) {
      const kind = String(row.kind || "custom");
      const arr = byKind.get(kind) || [];
      arr.push(row);
      byKind.set(kind, arr);
    }
    return Array.from(byKind.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  const isDisabled = Boolean(disabled || q.isLoading);
  const empty = !q.isLoading && list.length === 0;
  const placeholder = resolveEntityPlaceholder({
    isLoading: q.isLoading,
    isEmpty: empty,
    loadingLabel: "Loading templates...",
    emptyLabel: "No templates found",
    placeholderLabel,
  });

  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      disabled={isDisabled}
      fullWidth
      inputClassName={entitySelectInputClassName("min-w-[260px]", className)}
      placeholderOption={includeUnassigned ? placeholder : undefined}
      placeholderDisabled={false}
      options={
        groupByKind
          ? grouped.map(([kind, items]) => ({
              label: kind,
              options: items.map((t) => ({
                value: String(t.id || ""),
                label:
                  `${String(t.title || t.id)} (${String(t.scope || "enrollment")})` +
                  (t.locked ? " [locked]" : ""),
              })),
            }))
          : list.map((t) => ({
              value: String(t.id || ""),
              label:
                `${String(t.title || t.id)} (${String(t.kind || "custom")}/${String(t.scope || "enrollment")})` +
                (t.locked ? " [locked]" : ""),
            }))
      }
    />
  );
}
