import React from "react";
import { DetailCardShell, DetailRow, DetailSection } from "@entities/detail-card/core";
import { buildLineItemsCardData } from "../lineItemsFormMap";

type Props = {
  submission: Record<string, unknown> | null;
};

export function JotformLineItemsDetailCard({ submission }: Props) {
  if (!submission) return null;
  const card = buildLineItemsCardData(submission);
  if (!card) return null;

  return (
    <DetailCardShell title="Line Items Map" subtitle={card.title}>
      <DetailSection title="Summary">
        {card.rows.map((row) => (
          <DetailRow key={`${row.label}:${row.value}`} label={row.label} value={row.value || "-"} />
        ))}
      </DetailSection>

      {card.blocks.map((block) => (
        <DetailSection key={block.title} title={block.title}>
          {block.rows.map((row) => (
            <DetailRow key={`${block.title}:${row.label}`} label={row.label} value={row.value || "-"} />
          ))}
        </DetailSection>
      ))}
    </DetailCardShell>
  );
}

export default JotformLineItemsDetailCard;
