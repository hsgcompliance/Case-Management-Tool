const toCents = (value: unknown) => Math.round(Number(value || 0) * 100);

export function budgetPreviewActivityDelta(spentDelta = 0, projectionDelta = 0): number {
  return (toCents(spentDelta) + toCents(projectionDelta)) / 100;
}
