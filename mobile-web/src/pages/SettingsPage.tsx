import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { useCalendarIntegration, useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { clearWebsiteCache } from "@/lib/clearCache";

function PrefToggleRow({
  emoji,
  title,
  description,
  checked,
  onToggle,
}: {
  emoji: string;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="text-lg">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-indigo-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { prefs, updatePrefs, updatePrefsAsync, updatingPrefs } = useUserPrefs(user?.uid);
  const { connected, needsReconnect, googleEmail, connecting, connect, disconnect, disconnecting, invalidate } =
    useCalendarIntegration(user ?? null);
  const driveIntegration = useDriveIntegration(user ?? null);
  const qc = useQueryClient();
  const [appCacheCleared, setAppCacheCleared] = useState(false);
  const [calendarBanner, setCalendarBanner] = useState<"connected" | "denied" | "error" | null>(null);
  const [bannerService, setBannerService] = useState<"googleCalendar" | "googleDrive">("googleCalendar");

  // Handle OAuth redirect-back query params
  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    const service = searchParams.get("service") === "googleDrive" ? "googleDrive" : "googleCalendar";
    setBannerService(service);

    if (result === "connected") {
      setCalendarBanner("connected");
      if (service === "googleDrive") {
        void driveIntegration.invalidate();
      } else {
        void invalidate();
      }
    } else if (result === "denied") {
      setCalendarBanner("denied");
    } else {
      setCalendarBanner("error");
    }

    // Clean up query params without triggering a navigation
    setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login", { replace: true });
  }

  function handleClearAppCache() {
    qc.clear();
    setAppCacheCleared(true);
    setTimeout(() => setAppCacheCleared(false), 2500);
  }

  type IntegrationMode = "permanent" | "temporary" | "off";
  type IntegrationService = "googleCalendar" | "googleDrive";

  async function setIntegrationMode(
    service: IntegrationService,
    mode: IntegrationMode,
  ) {
    const previous = prefs.googleIntegrationModes[service] ?? "off";
    try {
      await updatePrefsAsync({
        googleIntegrationModes: {
          ...prefs.googleIntegrationModes,
          [service]: mode,
        },
      });
    } catch {
      await updatePrefsAsync({
        googleIntegrationModes: {
          ...prefs.googleIntegrationModes,
          [service]: previous,
        },
      }).catch(() => {});
    }
  }

  function IntegrationModeRow({
    title,
    service,
    connected_,
    email,
    needsReconnect_,
    busy,
  }: {
    title: string;
    service: IntegrationService;
    connected_: boolean;
    email?: string;
    needsReconnect_: boolean;
    busy: boolean;
  }) {
    const mode = prefs.googleIntegrationModes[service] ?? "off";
    const description =
      mode === "permanent"
        ? connected_
          ? email || "Server access connected"
          : needsReconnect_
            ? "Connection expired. Reconnect to keep server access."
            : "Server access selected. Connect to finish setup."
        : mode === "temporary"
          ? service === "googleDrive"
            ? "Use this device's browser token when available."
            : "Saved for this device; session posting still needs permanent access."
          : "Integration disabled for app workflows.";
    const action =
      mode === "off"
        ? {
            label: "Disconnect",
            onClick: connected_
              ? () => (service === "googleCalendar" ? disconnect() : driveIntegration.disconnect())
              : undefined,
            disabled: !connected_,
            style: "border-red-100 bg-red-50 text-red-600",
          }
        : mode === "temporary"
          ? service === "googleCalendar"
            ? {
                label: "No action",
                onClick: undefined,
                disabled: true,
                style: "border-slate-200 bg-slate-50 text-slate-400",
              }
            : {
                label: "Connect",
                onClick: () => driveIntegration.connect(),
                disabled: false,
                style: "border-sky-300 bg-sky-100 text-sky-900 shadow-sm shadow-sky-100",
              }
          : connected_
            ? {
                label: "Connected",
                onClick: () => (service === "googleCalendar" ? connect() : driveIntegration.connect()),
                disabled: false,
                style: "border-emerald-100 bg-emerald-50 text-emerald-700",
              }
            : {
                label: needsReconnect_ ? "Reconnect" : "Connect",
                onClick: () => (service === "googleCalendar" ? connect() : driveIntegration.connect()),
                disabled: false,
                style: "border-sky-300 bg-sky-100 text-sky-900 shadow-sm shadow-sky-100",
              };
    const isBusy = busy || updatingPrefs;

    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
            {service === "googleCalendar" ? "CAL" : "DRV"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200">
          {(["permanent", "temporary", "off"] as const).map((next) => (
            <button
              key={next}
              type="button"
              disabled={isBusy}
              onClick={() => void setIntegrationMode(service, next)}
              className={`px-2 py-2 text-xs font-semibold capitalize transition-colors disabled:opacity-50 ${
                mode === next ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              {next === "permanent" ? "Permanent" : next === "temporary" ? "Temporary" : "Off"}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button
            type="button"
            disabled={isBusy || action.disabled}
            onClick={() => void action.onClick?.()}
            className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${action.style}`}
          >
            {isBusy ? "Working..." : action.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content bg-slate-50">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

      {/* Calendar OAuth result banner */}
      {calendarBanner && (
        <div
          className={`mx-4 mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            calendarBanner === "connected"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          <span>{calendarBanner === "connected" ? "✓" : "⚠️"}</span>
          <span>
            {calendarBanner === "connected"
              ? `${bannerService === "googleDrive" ? "Google Drive" : "Google Calendar"} connected successfully.`
              : calendarBanner === "denied"
                ? `${bannerService === "googleDrive" ? "Google Drive" : "Google Calendar"} access was denied.`
                : `Something went wrong connecting ${bannerService === "googleDrive" ? "Google Drive" : "Google Calendar"}.`}
          </span>
          <button
            type="button"
            onClick={() => setCalendarBanner(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile card */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-4 flex items-center gap-3">
        {user?.photoURL ? (
          <img src={user.photoURL} className="h-12 w-12 rounded-full" alt="" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
            {user?.displayName?.[0] ?? user?.email?.[0] ?? "?"}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-900">{user?.displayName ?? "—"}</p>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
      </div>

      {/* Display preferences */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        {/* Time format */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="text-lg">🕐</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Time Format</p>
            <p className="text-xs text-slate-400 mt-0.5">How times display in the log form</p>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => updatePrefs({ timeFormat: "12h" })}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                prefs.timeFormat === "12h" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ timeFormat: "24h" })}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${
                prefs.timeFormat === "24h" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              24h
            </button>
          </div>
        </div>

        {/* Time interval */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="text-lg">⏱</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Time Step</p>
            <p className="text-xs text-slate-400 mt-0.5">Snap interval when dragging</p>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => updatePrefs({ timeInterval: 5 })}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                prefs.timeInterval === 5 ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              5 min
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ timeInterval: 15 })}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${
                prefs.timeInterval === 15 ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              15 min
            </button>
          </div>
        </div>
      </div>

      {/* Google integrations */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        <IntegrationModeRow
          title="Google Calendar"
          service="googleCalendar"
          connected_={connected}
          email={googleEmail}
          needsReconnect_={needsReconnect}
          busy={connecting || disconnecting}
        />
        <IntegrationModeRow
          title="Google Drive"
          service="googleDrive"
          connected_={driveIntegration.connected}
          email={driveIntegration.googleEmail}
          needsReconnect_={driveIntegration.needsReconnect}
          busy={driveIntegration.connecting || driveIntegration.disconnecting}
        />

      </div>

      {/* Session defaults — all ON by default for every user; turn off here. */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        <PrefToggleRow
          emoji="📅"
          title="Add to calendar by default"
          description="Pre-check the calendar toggle when logging sessions"
          checked={prefs.calendarDefault}
          onToggle={() => updatePrefs({ calendarDefault: !prefs.calendarDefault })}
        />
        <PrefToggleRow
          emoji="📓"
          title="Push to workbook by default"
          description="Pre-check the workbook toggle when logging sessions"
          checked={prefs.workbookPushDefault}
          onToggle={() => updatePrefs({ workbookPushDefault: !prefs.workbookPushDefault })}
        />
        <PrefToggleRow
          emoji="⏱"
          title="Require session time"
          description="A start time must be entered before a session can be saved"
          checked={prefs.requireSessionTime}
          onToggle={() => updatePrefs({ requireSessionTime: !prefs.requireSessionTime })}
        />
        <PrefToggleRow
          emoji="✨"
          title="AI assistance"
          description="AI case-note suggestions, where your organization allows them"
          checked={prefs.allowAiAssistance}
          onToggle={() => updatePrefs({ allowAiAssistance: !prefs.allowAiAssistance })}
        />
      </div>

      {/* Cache controls */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        <button
          type="button"
          onClick={handleClearAppCache}
          className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-slate-50 transition-colors"
        >
          <span className="text-lg">🗑️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Clear app data</p>
            <p className="text-xs text-slate-400 mt-0.5">Refreshes cached customer and grant data</p>
          </div>
          {appCacheCleared && (
            <span className="shrink-0 text-xs font-semibold text-emerald-600">Done</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => void clearWebsiteCache()}
          className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-slate-50 transition-colors"
        >
          <span className="text-lg">🔄</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Clear website cache</p>
            <p className="text-xs text-slate-400 mt-0.5">Removes cached app files and reloads — you'll stay signed in</p>
          </div>
        </button>
      </div>

      {/* Sign out */}
      <div className="mx-4 mb-5 bg-white rounded-xl border border-slate-100 shadow-sm">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-red-50 transition-colors"
        >
          <span className="text-lg">🚪</span>
          <span className="text-sm font-medium text-red-600">Sign Out</span>
        </button>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">HDB Mobile · v0.1.0</p>
    </div>
  );
}
