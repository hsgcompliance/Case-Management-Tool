const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * Global release gate for the existing dark theme.
 *
 * The default is intentionally off while the Project 5 visual audit blockers
 * remain. This gate only controls presentation; persisted user preferences are
 * retained so a later deployment can re-enable the theme without migration.
 */
export function isDarkModeFeatureEnabled(
  value: unknown = process.env.NEXT_PUBLIC_ENABLE_DARK_MODE,
): boolean {
  return ENABLED_VALUES.has(String(value ?? "").trim().toLowerCase());
}
