export type ThemeMode = "light" | "dark" | "system";
export type TextScalePreference = "default" | "large";
export type PageLayoutPreference = {
  activeToolId: string | null;
  pinnedToolIds: string[];
  recency: string[];
};

export type UserSettings = {
  textScale?: TextScalePreference | "text-xs" | "text-sm" | "text-base";
  themeMode?: ThemeMode | string;
  pageLayouts?: Record<string, Partial<PageLayoutPreference> | undefined>;
  [key: string]: unknown;
};

const MAX_PINNED_LAYOUT_ITEMS = 10;

/**
 * Backward-compatible parser for persisted profile settings.
 * Older values stored Tailwind class names (`text-sm`, `text-base`, etc.).
 */
export function parseTextScalePreference(value: unknown): TextScalePreference {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "large" || raw === "text-base") return "large";
  if (raw === "default" || raw === "text-sm" || raw === "text-xs") return "default";
  return "default";
}

/**
 * Render-layer class only. Storage should keep semantic values.
 */
export function textScaleClassName(pref: TextScalePreference): string {
  return pref === "large" ? "text-base" : "text-sm";
}

export function parseThemeMode(value: unknown): ThemeMode {
  const raw = String(value || "system").toLowerCase();
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item || "").trim()).filter(Boolean);
}

export function readUserSettings(input: unknown): UserSettings {
  return input && typeof input === "object" ? ({ ...(input as Record<string, unknown>) } as UserSettings) : {};
}

export function normalizePageLayoutPreference(
  input: Partial<PageLayoutPreference> | null | undefined,
): PageLayoutPreference {
  const pinnedToolIds = Array.from(new Set(asStringArray(input?.pinnedToolIds))).slice(0, MAX_PINNED_LAYOUT_ITEMS);
  const recency = Array.from(
    new Set(asStringArray(input?.recency).filter((toolId) => pinnedToolIds.includes(toolId))),
  );
  for (const toolId of pinnedToolIds) {
    if (!recency.includes(toolId)) recency.push(toolId);
  }
  return {
    activeToolId: input?.activeToolId ? String(input.activeToolId) : null,
    pinnedToolIds,
    recency,
  };
}

export function samePageLayoutPreference(left: PageLayoutPreference, right: PageLayoutPreference): boolean {
  if ((left.activeToolId || null) !== (right.activeToolId || null)) return false;
  if (left.pinnedToolIds.length !== right.pinnedToolIds.length) return false;
  if (left.recency.length !== right.recency.length) return false;
  if (left.pinnedToolIds.some((value, index) => value !== right.pinnedToolIds[index])) return false;
  if (left.recency.some((value, index) => value !== right.recency[index])) return false;
  return true;
}

export function getPageLayoutPreference(settings: unknown, layoutKey = "dashboardPrefs"): PageLayoutPreference | null {
  const normalizedSettings = readUserSettings(settings);
  const pageLayouts = normalizedSettings.pageLayouts;
  const raw = pageLayouts && typeof pageLayouts === "object" ? pageLayouts[layoutKey] : null;
  if (!raw) return null;
  return normalizePageLayoutPreference(raw);
}

export function writePageLayoutPreference(
  settings: unknown,
  layoutKey: string,
  next: PageLayoutPreference,
): UserSettings {
  const normalizedSettings = readUserSettings(settings);
  const pageLayouts =
    normalizedSettings.pageLayouts && typeof normalizedSettings.pageLayouts === "object"
      ? { ...normalizedSettings.pageLayouts }
      : {};
  pageLayouts[layoutKey] = normalizePageLayoutPreference(next);
  return {
    ...normalizedSettings,
    pageLayouts,
  };
}
