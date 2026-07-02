export const MAX_PINNED_BUDGET_GROUPS = 12;

export function parsePinnedBudgetGroupKeys(data: unknown): string[] {
  const value = (data as { grantPrefs?: { pinnedBudgetGroupKeys?: unknown } } | null)?.grantPrefs?.pinnedBudgetGroupKeys;
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((key) => String(key || "").trim()).filter(Boolean))).slice(0, MAX_PINNED_BUDGET_GROUPS);
}

export function sortPinnedBudgetGroups<T extends { key: string }>(groups: T[], pinnedKeys: string[]): T[] {
  const pinned = new Set(pinnedKeys);
  return groups.map((group, index) => ({ group, index })).sort((a, b) => Number(pinned.has(b.group.key)) - Number(pinned.has(a.group.key)) || a.index - b.index).map(({ group }) => group);
}
