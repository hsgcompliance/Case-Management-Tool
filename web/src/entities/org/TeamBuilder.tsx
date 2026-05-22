"use client";

import React from "react";

export type TeamBuilderTeam = {
  id: string;
  name?: string;
  active?: boolean;
};

export function TeamBuilder({
  orgId,
  orgName,
  teams,
  teamId,
  teamName,
  busy,
  onTeamIdChange,
  onTeamNameChange,
  onAddTeam,
  onRemoveTeam,
}: {
  orgId?: string;
  orgName?: string;
  teams: TeamBuilderTeam[];
  teamId: string;
  teamName: string;
  busy?: boolean;
  onTeamIdChange: (value: string) => void;
  onTeamNameChange: (value: string) => void;
  onAddTeam: () => void;
  onRemoveTeam: (teamId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Teams for Selected Org</h2>
          <div className="text-xs text-slate-500">
            {orgId ? `${orgId}${orgName ? ` (${orgName})` : ""}` : "Select an org"}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="team id"
            value={teamId}
            onChange={(event) => onTeamIdChange(event.currentTarget.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="team name (optional)"
            value={teamName}
            onChange={(event) => onTeamNameChange(event.currentTarget.value)}
          />
          <button
            type="button"
            disabled={!orgId || busy}
            onClick={onAddTeam}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Add Team
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {teams.map((team) => (
          <div
            key={team.id}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <code>{team.id}</code>
            {team.name ? <span className="text-slate-600 dark:text-slate-300">{team.name}</span> : null}
            {team.active === false ? <span className="text-rose-600">inactive</span> : null}
            <button
              type="button"
              disabled={busy || !orgId}
              onClick={() => onRemoveTeam(team.id)}
              className="text-rose-600 hover:text-rose-500 disabled:opacity-50"
              title="Remove team"
            >
              Remove
            </button>
          </div>
        ))}
        {!orgId ? <div className="text-sm text-slate-500">Select an org to manage teams.</div> : null}
        {orgId && !teams.length ? <div className="text-sm text-slate-500">No teams configured for this org.</div> : null}
      </div>
    </section>
  );
}

export default TeamBuilder;
