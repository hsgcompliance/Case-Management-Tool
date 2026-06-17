"use client";

export type RegexExtractionField =
  | "staffPrefix"
  | "paymentType"
  | "customerName"
  | "vendor"
  | "serviceMonth"
  | "memo";

export type RegexExtractionPattern = {
  id: string;
  label: string;
  pattern: string;
  flags?: string;
};

export type RegexExtractionResult = {
  patternId: string;
  patternLabel: string;
  fields: Partial<Record<RegexExtractionField, string>>;
};

export const DEFAULT_FE_REFERENCE_PATTERNS: RegexExtractionPattern[] = [
  {
    id: "staff-type-vendor-month",
    label: "Staff + type + vendor + month",
    pattern: "^(?<staffPrefix>[A-Z]\\.\\s*[^\\s]+)\\s+(?<paymentType>.*?)(?:-|\\s{2,})(?<vendor>.*?)-(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
  {
    id: "staff-type-customer-month",
    label: "Staff + type + customer + month",
    pattern: "^(?<staffPrefix>[A-Z]\\.\\s*[^\\s]+)\\s+(?<paymentType>.*?)-(?<customerName>.*?)-(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
  {
    id: "loose-final-month",
    label: "Loose final month signal",
    pattern: "^(?<memo>.*?)(?:-|\\s)(?<serviceMonth>[A-Z]{3}\\d{2})$",
    flags: "i",
  },
];

export function parseFinancialEdgeReference(
  reference: unknown,
  patterns: RegexExtractionPattern[] = DEFAULT_FE_REFERENCE_PATTERNS,
): RegexExtractionResult | null {
  const value = String(reference ?? "").trim();
  if (!value) return null;
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.pattern, pattern.flags || "");
      const match = regex.exec(value);
      if (!match?.groups) continue;
      const fields = Object.fromEntries(
        Object.entries(match.groups)
          .map(([key, raw]) => [key, String(raw ?? "").trim()] as const)
          .filter(([, raw]) => raw),
      ) as Partial<Record<RegexExtractionField, string>>;
      if (Object.keys(fields).length) return { patternId: pattern.id, patternLabel: pattern.label, fields };
    } catch {
      continue;
    }
  }
  return null;
}

export function likelyBetterTool(profileId: string, currentTool: "enrollment" | "payment" | "identity") {
  if (profileId === "financial_edge_project_activity" && currentTool !== "payment") {
    return "This looks like a Financial Edge Project Activity Report. It is better supported in Payment Reconciliation.";
  }
  if ((profileId === "coordinated_entry_by_name_list" || profileId === "hmis_service_payment_report") && currentTool === "payment") {
    return "This looks like an HMIS enrollment/service report. Review whether Enrollment Reconciliation is the better first pass.";
  }
  return "";
}
