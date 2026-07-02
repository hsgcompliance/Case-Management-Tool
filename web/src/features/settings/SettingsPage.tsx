import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import api from "@client/api";
import type { GoogleIntegrationMode, GoogleIntegrationService } from "@client/googleIntegrations";
import UsersClient from "@client/users";
import { RGSelect, RGToggleGroup } from "@entities/ui/forms/InputComponents";
import {
  useGoogleIntegrationConnect,
  useGoogleIntegrationDisconnect,
  useGoogleIntegrationStatuses,
  useGoogleIntegrationScopes,
} from "@hooks/useGoogleIntegrations";
import { toast } from "@lib/toast";
import {
  clearGoogleDriveAccessToken,
  getGoogleDriveAccessToken,
  getGoogleDriveTokenPersistence,
  setGoogleDriveTokenPersistence,
} from "@lib/googleDriveAccessToken";
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
const INTEGRATION_MODES: ReadonlyArray<{ value: GoogleIntegrationMode; label: string }> = [
  { value: "permanent", label: "Permanent login" },
  { value: "temporary", label: "Temporary login" },
  { value: "off", label: "Off" },
];

function integrationModeFromSettings(
  settings: Record<string, unknown> | undefined,
  service: GoogleIntegrationService,
): GoogleIntegrationMode {
  const raw = (settings?.googleIntegrationModes as Record<string, unknown> | undefined)?.[service];
  return raw === "permanent" || raw === "temporary" || raw === "off" ? raw : "off";
}

function serviceMeta(profile: Record<string, unknown> | null, service: GoogleIntegrationService) {
  const extras = profile?.extras as Record<string, unknown> | undefined;
  const integrations = extras?.integrations as Record<string, unknown> | undefined;
  return integrations?.[service] as Record<string, unknown> | undefined;
}

function statusMeta(status: unknown): Record<string, unknown> | undefined {
  if (!status || typeof status !== "object") return undefined;
  const row = status as Record<string, unknown>;
  return row.ok === true ? row : undefined;
}

function IntegrationToggle({
  title,
  service,
  mode,
  meta,
  onModeChange,
  onConnect,
  onConnectTemporary,
  onDisconnect,
  onClearTemporary,
  busy,
  hasTemporaryDriveToken,
}: {
  title: string;
  service: GoogleIntegrationService;
  mode: GoogleIntegrationMode;
  meta: Record<string, unknown> | undefined;
  onModeChange: (mode: GoogleIntegrationMode) => void;
  onConnect: () => void;
  onConnectTemporary: () => void;
  onDisconnect: () => void;
  onClearTemporary: () => void;
  busy: boolean;
  hasTemporaryDriveToken: boolean;
}) {
  const connected = meta?.permissionStatus === "connected" || meta?.connected === true;
  const email = typeof meta?.googleEmail === "string" ? meta.googleEmail : "";
  const tokenPresent = service === "googleDrive" && hasTemporaryDriveToken;
  const isCalendar = service === "googleCalendar";
  const description =
    mode === "permanent"
      ? connected
        ? `Server access connected${email ? ` as ${email}` : ""}.`
        : "Server access is selected but not connected yet."
      : mode === "temporary"
        ? service === "googleDrive"
          ? tokenPresent
            ? "Browser token is available for this device."
            : "Browser token will be captured the next time you sign in with Google."
          : "Temporary Calendar mode is saved, but posting sessions requires permanent server access."
        : "Integration is disabled for app workflows.";
  const action =
    mode === "off"
      ? {
          label: "Disconnect",
          onClick: connected ? onDisconnect : tokenPresent ? onClearTemporary : undefined,
          variant: "danger" as const,
          disabled: !connected && !tokenPresent,
        }
      : mode === "temporary"
        ? isCalendar
          ? {
              label: "No action",
              onClick: undefined,
              variant: "neutral" as const,
              disabled: true,
            }
          : tokenPresent
            ? {
                label: "Connected",
                onClick: onConnectTemporary,
                variant: "success" as const,
                disabled: false,
              }
            : {
                label: "Connect",
                onClick: onConnectTemporary,
                variant: "primary" as const,
                disabled: false,
              }
        : connected
          ? {
              label: "Connected",
              onClick: onConnect,
              variant: "success" as const,
              disabled: false,
            }
          : {
              label: meta?.permissionStatus === "needs_reconnect" ? "Reconnect" : "Connect",
              onClick: onConnect,
              variant: "primary" as const,
              disabled: false,
            };
  const buttonClass =
    action.variant === "danger"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
      : action.variant === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
        : action.variant === "neutral"
          ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          : "border-sky-300 bg-sky-100 text-sky-900 shadow-sm shadow-sky-100 hover:border-sky-400 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100 dark:shadow-none dark:hover:bg-sky-900/70";
  const buttonEmphasis =
    action.variant === "primary"
      ? "min-w-[150px] px-5 py-2.5 text-sm"
      : "min-w-[116px] px-4 py-2 text-xs";

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <RGToggleGroup
        label={title}
        ariaLabel={`${title} mode`}
        value={mode}
        onChange={(next) => onModeChange(next as GoogleIntegrationMode)}
        options={INTEGRATION_MODES.map((m) => ({ value: m.value, label: m.label }))}
        fullWidth
        inputClassName="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
        optionClassName="rounded-lg px-3 py-1.5 text-sm transition"
        activeOptionClassName="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        inactiveOptionClassName="text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
        className="block"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={`rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonEmphasis} ${buttonClass}`}
            disabled={busy || action.disabled}
            onClick={action.onClick}
          >
            {busy ? "Working..." : action.label}
          </button>
          {mode === "temporary" && service === "googleDrive" && tokenPresent ? (
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              disabled={busy}
              onClick={onClearTemporary}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { profile, reloadProfile, signInWithGoogle } = useAuth();
  const integrationStatuses = useGoogleIntegrationStatuses();
  const driveScopes = useGoogleIntegrationScopes("googleDrive");
  const calendarConnect = useGoogleIntegrationConnect("googleCalendar");
  const driveConnect = useGoogleIntegrationConnect("googleDrive");
  const calendarDisconnect = useGoogleIntegrationDisconnect("googleCalendar");
  const driveDisconnect = useGoogleIntegrationDisconnect("googleDrive");
  const profileSettings =
    profile && typeof profile.settings === "object" && profile.settings
      ? (profile.settings as { textScale?: string; themeMode?: string; googleIntegrationModes?: Record<string, unknown>; calendarPushDefault?: boolean; allowAiAssistance?: boolean })
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
  const [calendarPushDefault, setCalendarPushDefault] = React.useState<boolean>(() => Boolean(profileSettings?.calendarPushDefault));
  const [allowAiAssistance, setAllowAiAssistance] = React.useState<boolean>(() => profileSettings?.allowAiAssistance === true);
  const [calendarMode, setCalendarMode] = React.useState<GoogleIntegrationMode>(() =>
    integrationModeFromSettings(profileSettings as Record<string, unknown> | undefined, "googleCalendar")
  );
  const [driveMode, setDriveMode] = React.useState<GoogleIntegrationMode>(() =>
    integrationModeFromSettings(profileSettings as Record<string, unknown> | undefined, "googleDrive")
  );
  const [hasTemporaryDriveToken, setHasTemporaryDriveToken] = React.useState(() => !!getGoogleDriveAccessToken());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setTextScale(parseTextScalePreference(profileSettings?.textScale));
    setThemeMode(parseThemeMode(profileSettings?.themeMode));
    setCalendarMode(integrationModeFromSettings(profileSettings as Record<string, unknown> | undefined, "googleCalendar"));
    setDriveMode(integrationModeFromSettings(profileSettings as Record<string, unknown> | undefined, "googleDrive"));
    setCalendarPushDefault(Boolean(profileSettings?.calendarPushDefault));
    setAllowAiAssistance(profileSettings?.allowAiAssistance === true);
  }, [profileSettings?.textScale, profileSettings?.themeMode, profileSettings?.googleIntegrationModes, profileSettings?.calendarPushDefault, profileSettings?.allowAiAssistance]);

  React.useEffect(() => {
    setTaskMode(profileTaskMode);
  }, [profileTaskMode]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (!result) return;

    const rawService = params.get("service");
    const service: GoogleIntegrationService =
      rawService === "googleDrive" ? "googleDrive" : "googleCalendar";

    api.bustCache(service === "googleDrive" ? "driveStatus" : "calendarStatus");
    const refresh =
      service === "googleDrive"
        ? integrationStatuses.drive.refetch()
        : integrationStatuses.calendar.refetch();
    void refresh.then(() => reloadProfile()).catch(() => reloadProfile());

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);

    if (result === "connected") {
      toast(`${service === "googleDrive" ? "Google Drive" : "Google Calendar"} connected`, { type: "success" });
    } else if (result === "denied") {
      toast("Google access was denied", { type: "warn" });
    } else {
      toast("Google connection did not complete", { type: "error" });
    }
  // Run once on callback landing; refetch functions are stable enough for this redirect cleanup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async (nextModes?: Partial<Record<GoogleIntegrationService, GoogleIntegrationMode>>) => {
    setSaving(true);
    try {
      const baseSettings =
        profile && typeof profile.settings === "object" && profile.settings
          ? (profile.settings as Record<string, unknown>)
          : {};
      const modes = {
        ...(typeof baseSettings.googleIntegrationModes === "object" && baseSettings.googleIntegrationModes
          ? (baseSettings.googleIntegrationModes as Record<string, unknown>)
          : {}),
        googleCalendar: nextModes?.googleCalendar ?? calendarMode,
        googleDrive: nextModes?.googleDrive ?? driveMode,
      };

      await UsersClient.meUpdate({
        settings: {
          ...baseSettings,
          textScale,
          themeMode,
          googleIntegrationModes: modes,
          calendarPushDefault,
          allowAiAssistance,
        },
        ...(taskMode != null
          ? { taskMode, taskModeSetAt: new Date().toISOString(), taskModeSetBy: "self" }
          : {}),
      });

      await reloadProfile();
      toast("Settings saved", { type: "success" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save settings", { type: "error" });
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => saveSettings();

  const applyIntegrationMode = async (service: GoogleIntegrationService, next: GoogleIntegrationMode) => {
    const previous = service === "googleCalendar" ? calendarMode : driveMode;
    try {
      if (service === "googleCalendar") setCalendarMode(next);
      if (service === "googleDrive") setDriveMode(next);

      await saveSettings({ [service]: next });

      if (next === "temporary" && service === "googleDrive") {
        setGoogleDriveTokenPersistence("local");
        toast("Temporary Drive mode saved. Sign in with Google to refresh the local browser token.", { type: "info" });
      }

      if (next === "off") {
        if (service === "googleDrive") {
          clearGoogleDriveAccessToken();
          setHasTemporaryDriveToken(false);
          setGoogleDriveTokenPersistence("session");
        }
      }
    } catch (e) {
      if (service === "googleCalendar") setCalendarMode(previous);
      if (service === "googleDrive") setDriveMode(previous);
      toast(e instanceof Error ? e.message : "Failed to update integration", { type: "error" });
    }
  };

  const connectIntegration = async (service: GoogleIntegrationService) => {
    try {
      if (service === "googleCalendar") {
        await calendarConnect.mutateAsync();
      } else {
        await driveConnect.mutateAsync();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start Google connection", { type: "error" });
    }
  };

  const disconnectIntegration = async (service: GoogleIntegrationService) => {
    try {
      if (service === "googleCalendar") {
        await calendarDisconnect.mutateAsync();
      } else {
        await driveDisconnect.mutateAsync();
        clearGoogleDriveAccessToken();
        setHasTemporaryDriveToken(false);
      }
      await reloadProfile();
      toast("Google access disconnected", { type: "success" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to disconnect Google access", { type: "error" });
    }
  };

  const clearTemporaryDriveAccess = () => {
    clearGoogleDriveAccessToken();
    setHasTemporaryDriveToken(false);
    setGoogleDriveTokenPersistence("session");
    toast("Temporary Drive access cleared", { type: "success" });
  };

  const connectTemporaryDrive = async () => {
    try {
      setGoogleDriveTokenPersistence("local");
      await signInWithGoogle();
      setHasTemporaryDriveToken(!!getGoogleDriveAccessToken());
      toast("Temporary Drive access connected on this device", { type: "success" });
    } catch (e) {
      setHasTemporaryDriveToken(!!getGoogleDriveAccessToken());
      toast(e instanceof Error ? e.message : "Failed to connect temporary Drive access", { type: "error" });
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

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-indigo-600"
              checked={allowAiAssistance}
              onChange={(event) => setAllowAiAssistance(event.target.checked)}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Allow AI assistance
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Enables the optional case-note drafting assistant for eligible payer-linked customers. Suggestions remain unsaved until you accept and save the session.
              </span>
            </span>
          </label>

          <div className="space-y-3" data-tour="settings-google-integrations">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Google integrations</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Permanent login stores refresh access server-side. Temporary login uses this browser only. Off disables app access.
              </p>
            </div>
            <IntegrationToggle
              title="Calendar"
              service="googleCalendar"
              mode={calendarMode}
              meta={statusMeta(integrationStatuses.calendar.data) ?? serviceMeta(profile as Record<string, unknown> | null, "googleCalendar")}
              busy={saving || calendarConnect.isPending || calendarDisconnect.isPending || integrationStatuses.calendar.isFetching}
              onModeChange={(next) => void applyIntegrationMode("googleCalendar", next)}
              onConnect={() => void connectIntegration("googleCalendar")}
              onConnectTemporary={() => {}}
              onDisconnect={() => void disconnectIntegration("googleCalendar")}
              onClearTemporary={clearTemporaryDriveAccess}
              hasTemporaryDriveToken={hasTemporaryDriveToken}
            />
            <IntegrationToggle
              title="Google Drive"
              service="googleDrive"
              mode={driveMode}
              meta={statusMeta(integrationStatuses.drive.data) ?? serviceMeta(profile as Record<string, unknown> | null, "googleDrive")}
              busy={saving || driveConnect.isPending || driveDisconnect.isPending || integrationStatuses.drive.isFetching}
              onModeChange={(next) => void applyIntegrationMode("googleDrive", next)}
              onConnect={() => void connectIntegration("googleDrive")}
              onConnectTemporary={() => void connectTemporaryDrive()}
              onDisconnect={() => void disconnectIntegration("googleDrive")}
              onClearTemporary={clearTemporaryDriveAccess}
              hasTemporaryDriveToken={hasTemporaryDriveToken}
            />
            {/* Inline warning when Drive is connected but user unchecked a scope */}
            {driveMode === "permanent" && !driveScopes.isLoading && driveScopes.scopes.length > 0 && (
              (!driveScopes.hasDriveScope || !driveScopes.hasSheetsScope) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">Some permissions were not granted</div>
                      <div className="mt-0.5 text-amber-800">
                        {[
                          !driveScopes.hasDriveScope && "Google Drive file access",
                          !driveScopes.hasSheetsScope && "Google Sheets access",
                        ].filter(Boolean).join(" and ")}{" "}
                        {(!driveScopes.hasDriveScope && !driveScopes.hasSheetsScope) ? "were" : "was"} not granted.
                        Click Re-authorize to add {(!driveScopes.hasDriveScope && !driveScopes.hasSheetsScope) ? "them" : "it"}.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                      disabled={driveConnect.isPending}
                      onClick={() => void connectIntegration("googleDrive")}
                    >
                      {driveConnect.isPending ? "Opening..." : "Re-authorize"}
                    </button>
                  </div>
                </div>
              )
            )}
            {getGoogleDriveTokenPersistence() === "local" ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Temporary Drive tokens are stored in local browser storage on this device.
              </div>
            ) : null}

            {/* Default for the per-note "Push to calendar" toggle on progress notes */}
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-sky-600"
                checked={calendarPushDefault}
                onChange={(e) => setCalendarPushDefault(e.target.checked)}
              />
              <span className="text-slate-700 dark:text-slate-300">
                Push new progress notes to my Google Calendar by default
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Pre-checks the “Push to calendar” option when adding a progress note. Requires Calendar connected above.
                </span>
              </span>
            </label>
          </div>

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
