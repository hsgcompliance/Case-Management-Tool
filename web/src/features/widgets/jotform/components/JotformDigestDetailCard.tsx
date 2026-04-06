import React from "react";
import { DetailCardShell, DetailRow, DetailSection } from "@entities/detail-card/core";
import type { JotformDigestMap } from "@hooks/useJotform";

type Props = {
  submission: Record<string, unknown> | null;
  digestMap: JotformDigestMap | null;
};

function valueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("answer" in obj) return valueText(obj.answer);
    if ("prettyFormat" in obj) return valueText(obj.prettyFormat);
    if ("value" in obj) return valueText(obj.value);
    return Object.values(obj).map(valueText).filter(Boolean).join(" ");
  }
  return "";
}

function answerAt(answers: Record<string, unknown>, key: string): string {
  return valueText(answers?.[key]).trim();
}

export function JotformDigestDetailCard({ submission, digestMap }: Props) {
  if (!submission) return null;
  if (!digestMap) {
    return (
      <DetailCardShell title="Jotform Digest" subtitle="No digest map configured">
        <DetailSection title="Status">
          <DetailRow label="Configured" value="No" />
        </DetailSection>
      </DetailCardShell>
    );
  }

  const answers = ((submission.answers || {}) as Record<string, unknown>) || {};
  const sections = Array.isArray(digestMap.sections) ? [...digestMap.sections].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : [];
  const fields = Array.isArray(digestMap.fields) ? [...digestMap.fields].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : [];
  const unsectioned = fields.filter((f) => !f.sectionId);

  return (
    <DetailCardShell title="Jotform Digest" subtitle={String(digestMap.formTitle || digestMap.formAlias || digestMap.formId || "")}>
      {digestMap.header?.show !== false ? (
        <DetailSection title="Header">
          <DetailRow label="Title" value={String(digestMap.header?.title || "-")} />
          <DetailRow label="Subtitle" value={String(digestMap.header?.subtitle || "-")} />
        </DetailSection>
      ) : null}

      {unsectioned.length ? (
        <DetailSection title="General">
          {unsectioned
            .filter((f) => f.show !== false)
            .map((f) => {
              const answer = answerAt(answers, String(f.key || ""));
              if (!answer && f.hideIfEmpty !== false && digestMap.options?.hideEmptyFields !== false) return null;
              return <DetailRow key={String(f.key)} label={String(f.label || f.key)} value={answer || "-"} />;
            })}
        </DetailSection>
      ) : null}

      {sections
        .filter((s) => s.show !== false)
        .map((s) => {
          const sectionFields = fields.filter((f) => String(f.sectionId || "") === String(s.id || "") && f.show !== false);
          if (!sectionFields.length) return null;
          return (
            <DetailSection key={String(s.id)} title={String(s.label || s.id || "Section")}>
              {sectionFields.map((f) => {
                const answer = answerAt(answers, String(f.key || ""));
                if (!answer && f.hideIfEmpty !== false && digestMap.options?.hideEmptyFields !== false) return null;
                return <DetailRow key={String(f.key)} label={String(f.label || f.key)} value={answer || "-"} />;
              })}
            </DetailSection>
          );
        })}
    </DetailCardShell>
  );
}

export default JotformDigestDetailCard;
