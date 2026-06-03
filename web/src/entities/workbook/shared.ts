// Shared helpers for workbook section renderers (ProgressNotes/, HousingPlan/, Budget/).

import type { tss as TssNS } from "@hdb/contracts";

/** Display string for an extracted cell, preferring the formatted displayValue. */
export function cellText(row: TssNS.TssExtractedRow, fieldId: string | undefined): string {
  if (!fieldId) return "";
  const cell = row.values[fieldId];
  return cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
}

export type NoteFieldRoles = {
  dateId?: string;
  startId?: string;
  endId?: string;
  tierId?: string;
  summaryId?: string;
  responseId?: string;
  locationId?: string;
};

/**
 * Identify the semantic roles of a notes entity's fields from the config, so
 * renderers and the calendar-push mapping don't hardcode field ids (adapts to
 * payer vs non-payer column sets).
 */
export function noteFieldRoles(fields: readonly TssNS.TssSmartHeaderConfig[]): NoteFieldRoles {
  const byId = (pred: (f: TssNS.TssSmartHeaderConfig) => boolean) => fields.find(pred)?.id;
  const summaryId = byId((f) => f.id === "summary") ?? byId((f) => f.dataType === "longText");
  return {
    dateId:    byId((f) => f.dataType === "date"),
    startId:   byId((f) => f.dataType === "time" && /start/i.test(f.id)),
    endId:     byId((f) => f.dataType === "time" && /end/i.test(f.id)),
    tierId:    byId((f) => f.optionSourceId === "serviceTier" || /tier/i.test(f.id)),
    summaryId,
    responseId: byId((f) => /response|progress/i.test(f.id) && f.id !== summaryId),
    locationId: byId((f) => f.optionSourceId === "appointmentLocation" || /location/i.test(f.id)),
  };
}
