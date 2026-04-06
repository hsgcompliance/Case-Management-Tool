import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import UsersClient from "@client/users";
import { RGSelect, RGToggleGroup } from "@entities/ui/forms/InputComponents";
import { toast } from "@lib/toast";
import { parseTextScalePreference, parseThemeMode, type TextScalePreference, type ThemeMode } from "@lib/userSettings";
import type { TTaskMode } from "@hdb/contracts";

const TEXT_SCALES: ReadonlyArray<{ value: TextScalePreference; label: string }> = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];
const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"] as const;
const TASK_MODES: ReadonlyArray<{ value: TTaskMode; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "workflow", label: "Workflow" },
];

export default function SettingsPage() {
  const { profile, reloadProfile } = useAuth();
  const profileSettings =
    profile && typeof profile.settings === "object" && profile.settings
      ? (profile.settings as { textScale?: string; themeMode?: string })
      : undefined;

  const profileTaskMode: TTaskMode | null =
    ((profile as any)?.extras?.taskMode ?? (profile as any)?.taskMode) ?? null;

  const [textScale, setTextScale] = React.useState<TextScalePreference>(() =>
    parseTextScalePreference(profileSettings?.textScale)
  );
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() =>
    parseThemeMode(profileSettings?.themeMode)
  );
  const [taskMode, setTaskMode] = React.useState<TTaskMode | null>(() => profileTaskMode);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setTextScale(parseTextScalePreference(profileSettings?.textScale));
    setThemeMode(parseThemeMode(profileSettings?.themeMode));
  }, [profileSettings?.textScale, profileSettings?.themeMode]);

  React.useEffect(() => {
    setTaskMode(profileTaskMode);
  }, [profileTaskMode]);

  const onSave = async () => {
    setSaving(true);
    try {
      const baseSettings =
        profile && typeof profile.settings === "object" && profile.settings
          ? (profile.settings as Record<string, unknown>)
          : {};

      await UsersClient.meUpdate({
        settings: {
          ...baseSettings,
          textScale,
          themeMode,
        },
        ...(taskMode != null
          ? { taskMode, taskModeSetAt: new Date().toISOString(), taskModeSetBy: "self" }
          : {}),
      });

      await reloadProfile();
      toast("Settings saved", { type: "success" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save settings", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5" data-tour="settings-page">
      <div data-tour="settings-header">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100" data-tour="settings-title">Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400" data-tour="settings-subtitle">Personalize your display and theme preferences.</p>
      </div>

      <div className="card" data-tour="settings-card">
        <div className="card-section space-y-5" data-tour="settings-card-body">
          <RGToggleGroup
            tourId="settings-theme-mode"
            label="Theme"
            ariaLabel="Theme mode"
            value={themeMode}
            onChange={(next) => setThemeMode(next as ThemeMode)}
            options={THEME_MODES.map((mode) => ({
              value: mode,
              label: mode[0].toUpperCase() + mode.slice(1),
            }))}
            fullWidth
            inputClassName="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
            optionClassName="rounded-lg px-3 py-1.5 text-sm capitalize transition"
            activeOptionClassName="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            inactiveOptionClassName="text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
            className="block"
          />

          <RGSelect
            tourId="settings-text-size"
            label="Text size"
            value={textScale}
            onChange={(next) => setTextScale(parseTextScalePreference(next))}
            helperText="Default matches the current app text size. Large increases body text for readability."
            options={TEXT_SCALES.map((s) => ({ value: s.value, label: s.label }))}
            fullWidth
            className="block"
            inputClassName="select max-w-[220px]"
          />

          <RGToggleGroup
            tourId="settings-task-mode"
            label="Task mode"
            ariaLabel="Task mode"
            value={taskMode ?? ""}
            onChange={(next) => setTaskMode(next as TTaskMode)}
            options={TASK_MODES.map((m) => ({ value: m.value, label: m.label }))}
            fullWidth
            inputClassName="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
            optionClassName="rounded-lg px-3 py-1.5 text-sm capitalize transition"
            activeOptionClassName="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            inactiveOptionClassName="text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
            className="block"
          />

          <div className="flex justify-end" data-tour="settings-actions">
            <button className="btn btn-sm" onClick={onSave} disabled={saving} data-tour="settings-save">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
