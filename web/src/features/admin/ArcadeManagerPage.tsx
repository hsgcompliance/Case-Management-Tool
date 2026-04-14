"use client";

import React from "react";
import { useOrgConfig, useSaveOrgConfig } from "@hooks/useOrgConfig";
import { toast } from "@lib/toast";
import {
  SECRET_GAME_ROUTE_OPTIONS,
  createDefaultSecretGamesAdminConfig,
  readSecretGamesAdminConfig,
  AMBIENT_TRIGGER_LABELS,
  type SecretGameAdminEntry,
  type SecretGameRouteId,
  type SecretGamesAdminConfig,
  type AmbientTriggerId,
  type AmbientTriggerAdminEntry,
} from "@features/secret-games/adminConfig";
import { listSecretGames } from "@features/secret-games";

type ToggleProps = {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (next: boolean) => void;
};

function ToggleRow({ checked, label, hint, onChange }: ToggleProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

function RouteCheckboxes(props: {
  value: SecretGameRouteId[];
  onChange: (next: SecretGameRouteId[]) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.values(SECRET_GAME_ROUTE_OPTIONS).map((route) => {
        const checked = value.includes(route.id);
        return (
          <label
            key={route.id}
            className={[
              "flex items-start gap-3 rounded-lg border px-3 py-3",
              disabled ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200 bg-white",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? Array.from(new Set([...value, route.id]))
                  : value.filter((entry) => entry !== route.id);
                onChange(next);
              }}
            />
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-900">{route.label}</div>
              <div className="text-xs text-slate-500">{route.description}</div>
              <div className="text-[11px] font-mono text-slate-400">{route.path}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ─── Ambient Trigger Card ─────────────────────────────────────────────────────

const TRIGGER_IDS: AmbientTriggerId[] = ["bug", "asteroid", "plant", "snake"];

function TriggerCard({
  id,
  entry,
  onChange,
}: {
  id: AmbientTriggerId;
  entry: AmbientTriggerAdminEntry;
  onChange: (patch: Partial<AmbientTriggerAdminEntry>) => void;
}) {
  const meta = AMBIENT_TRIGGER_LABELS[id];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.emoji}</span>
            <h3 className="text-base font-semibold text-slate-900">{meta.label}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">{meta.hint}</p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={entry.enabled}
            onChange={(e) => onChange({ enabled: e.currentTarget.checked })}
          />
          Enabled
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Timing */}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Timing</div>
          <label className="block text-xs">
            <span className="text-slate-600">Min interval (minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              value={entry.minIntervalMinutes}
              onChange={(e) =>
                onChange({ minIntervalMinutes: Math.max(1, Number(e.currentTarget.value) || 1) })
              }
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600">Jitter (minutes, added randomly)</span>
            <input
              type="number"
              min={0}
              max={60}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              value={entry.jitterMinutes}
              onChange={(e) =>
                onChange({ jitterMinutes: Math.max(0, Number(e.currentTarget.value) || 0) })
              }
            />
          </label>
          <div className="text-[11px] text-slate-400">
            Appears every {entry.minIntervalMinutes}–{entry.minIntervalMinutes + entry.jitterMinutes} min
          </div>
        </div>

        {/* Allowed routes */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Allowed Routes</div>
          <RouteCheckboxes
            value={entry.allowedRoutes}
            onChange={(next) => onChange({ allowedRoutes: next })}
          />
        </div>
      </div>
    </article>
  );
}

export default function ArcadeManagerPage() {
  const { data: orgConfig, isLoading, isError, error } = useOrgConfig();
  const saveOrgConfig = useSaveOrgConfig();
  const [draft, setDraft] = React.useState<SecretGamesAdminConfig>(() => createDefaultSecretGamesAdminConfig());

  const savedConfig = React.useMemo(
    () => readSecretGamesAdminConfig(orgConfig?.secretGames),
    [orgConfig],
  );

  React.useEffect(() => {
    setDraft(savedConfig);
  }, [savedConfig]);

  const games = React.useMemo(() => listSecretGames(), []);

  const updateFlags = React.useCallback(
    (patch: Partial<SecretGamesAdminConfig["flags"]>) => {
      setDraft((current) => ({
        ...current,
        flags: {
          ...current.flags,
          ...patch,
        },
      }));
    },
    [],
  );

  const updateGame = React.useCallback(
    (gameId: string, patch: Partial<SecretGameAdminEntry>) => {
      setDraft((current) => ({
        ...current,
        games: {
          ...current.games,
          [gameId]: {
            ...current.games[gameId],
            ...patch,
          },
        },
      }));
    },
    [],
  );

  const updateTrigger = React.useCallback(
    (triggerId: AmbientTriggerId, patch: Partial<AmbientTriggerAdminEntry>) => {
      setDraft((current) => ({
        ...current,
        triggers: {
          ...current.triggers,
          [triggerId]: {
            ...current.triggers[triggerId],
            ...patch,
          },
        },
      }));
    },
    [],
  );

  const isDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedConfig),
    [draft, savedConfig],
  );

  const handleSave = React.useCallback(async () => {
    if (!orgConfig) return;
    try {
      await saveOrgConfig.mutateAsync({
        ...orgConfig,
        secretGames: draft,
      });
      toast("Arcade manager settings saved.", { type: "success" });
    } catch (saveError) {
      toast(
        saveError instanceof Error ? saveError.message : "Failed to save arcade manager settings.",
        { type: "error" },
      );
    }
  }, [draft, orgConfig, saveOrgConfig]);

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading arcade manager…</div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load arcade manager configuration."}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Arcade Manager</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Control secret-game rollout from one place. All games default disabled. Route access is
          restricted to the customer page until more real mount surfaces are ready.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Global Flags
              </h2>
            </div>
            <div className="space-y-3">
              <ToggleRow
                checked={draft.flags.masterEnabled}
                label="Master Enable"
                hint="Hard gate for every secret-game launch path."
                onChange={(next) => updateFlags({ masterEnabled: next })}
              />
              <ToggleRow
                checked={draft.flags.customerPageEnabled}
                label="Customer Page Launches"
                hint="Allows the real customer search box to invoke the secret-games resolver."
                onChange={(next) => updateFlags({ customerPageEnabled: next })}
              />
              <ToggleRow
                checked={draft.flags.legacyAdaptersEnabled}
                label="Legacy Adapters"
                hint="Keeps legacy quick-break and arcade wrappers eligible for launch."
                onChange={(next) => updateFlags({ legacyAdaptersEnabled: next })}
              />
              <ToggleRow
                checked={draft.flags.sandboxEnabled}
                label="Sandbox Launches"
                hint="Reserve this for future non-dev entry points; leave off for now."
                onChange={(next) => updateFlags({ sandboxEnabled: next })}
              />
              <ToggleRow
                checked={draft.flags.ambientTriggersEnabled}
                label="Ambient Triggers"
                hint="Controls Konami and other hidden trigger families outside explicit search."
                onChange={(next) => updateFlags({ ambientTriggersEnabled: next })}
              />
              <ToggleRow
                checked={draft.flags.killSwitch}
                label="Kill Switch"
                hint="Immediate hard stop that overrides dev bypass and all per-game settings."
                onChange={(next) => updateFlags({ killSwitch: next })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Route Access
              </h2>
            </div>
            <RouteCheckboxes
              value={draft.routesEnabled}
              onChange={(next) => setDraft((current) => ({ ...current, routesEnabled: next }))}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!isDirty || saveOrgConfig.isPending}
                onClick={() => void handleSave()}
              >
                {saveOrgConfig.isPending ? "Saving…" : "Save Arcade Settings"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!isDirty || saveOrgConfig.isPending}
                onClick={() => setDraft(savedConfig)}
              >
                Reset Draft
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saveOrgConfig.isPending}
                onClick={() => setDraft(createDefaultSecretGamesAdminConfig())}
              >
                Restore Safe Defaults
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Safe defaults keep the entire arcade platform disabled, while route targeting stays
              narrowed to the customer page for future rollout.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Ambient Triggers */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Ambient Triggers
              </h2>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              These critters appear at random intervals while users browse. Each trigger is
              independently gated by the <strong>Ambient Triggers</strong> global flag and its own
              enable toggle. Configure timing and which pages they&apos;re allowed on.
            </p>
            <div className="space-y-3">
              {TRIGGER_IDS.map((id) => (
                <TriggerCard
                  key={id}
                  id={id}
                  entry={draft.triggers[id]}
                  onChange={(patch) => updateTrigger(id, patch)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Game Catalog
              </h2>
            </div>
            <div className="space-y-3">
              {games.map((game) => {
                const gameDraft = draft.games[game.id];
                return (
                  <article
                    key={game.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{game.title}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {game.kind}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {game.presentation}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{game.description}</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={gameDraft?.enabled === true}
                          onChange={(event) => updateGame(game.id, { enabled: event.currentTarget.checked })}
                        />
                        Enabled
                      </label>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Allowed Routes
                        </div>
                        <RouteCheckboxes
                          value={gameDraft?.allowedRoutes || []}
                          onChange={(next) => updateGame(game.id, { allowedRoutes: next })}
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Mount Profile
                        </div>
                        <div className="text-xs text-slate-600">
                          Preferred: <span className="font-mono">{game.preferredContainerMode}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Allowed:{" "}
                          <span className="font-mono">{game.allowedContainerModes.join(", ")}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Triggered by:{" "}
                          <span className="font-mono">
                            {game.triggers.map((trigger) => trigger.kind).join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
