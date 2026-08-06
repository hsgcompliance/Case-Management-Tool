const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

export function extractedQueueDate(value: unknown): string | null {
  const match = String(value ?? "").trim().match(ISO_DATE_RE);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Credit-card and invoice extraction stores the business transaction date in
 * `createdAt`. Queue date queries use `dueDate`, so new/re-extracted rows must
 * mirror that date there while preserving any existing operator override.
 */
export function paymentQueueDueDateForUpsert(
  source: unknown,
  existingDueDate: unknown,
  extractedCreatedAt: unknown,
): string | null {
  const existing = String(existingDueDate ?? "").trim();
  if (existing) return existing;

  const normalizedSource = String(source ?? "").trim().toLowerCase();
  if (normalizedSource !== "credit-card" && normalizedSource !== "invoice") return null;
  return extractedQueueDate(extractedCreatedAt);
}
