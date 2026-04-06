"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { toApiError } from "@client/api";
import { useSetUserRole, useUsersList, type CompositeUser } from "@hooks/useUsers";
import { qk } from "@hooks/queryKeys";
import { toast } from "@lib/toast";

type OrgTeam = { id: string; name?: string; active?: boolean };
type OrgRow = { id: string; name: string; active?: boolean; teams?: OrgTeam[] };

const ORGS_QK = ["dev", "orgs"] as const;

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function parseCsv(input: string) {
  return uniqStrings(String(input || "").split(","));
}

export default function OrgManagerTool() {
  const qc = useQueryClient();
  const setUserRole = useSetUserRole();

  const [newOrgId, setNewOrgId] = React.useState("");
  const [newOrgName, setNewOrgName] = React.useState("");
  const [selectedOrgId, setSelectedOrgId] = React.useState("");
  const [teamIdInput, setTeamIdInput] = React.useState("");
  const [teamNameInput, setTeamNameInput] = React.useState("");
  const [userOrgFilter, setUserOrgFilter] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [moveTargetOrgId, setMoveTargetOrgId] = React.useState("");
  const [moveExtraTeamsCsv, setMoveExtraTeamsCsv] = React.useState("");
  const [includeOrgTeamsOnMove, setIncludeOrgTeamsOnMove] = React.useState(true);
  const [selectedUserIds, setSelectedUserIds] = React.useState<Record<string, boolean>>({});

  const orgsQ = useQuery({
    queryKey: ORGS_QK,
    queryFn: async () => {
      const res = await api.get("devOrgsList", { includeInactive: true });
      return (res as { items?: OrgRow[] }).items || [];
    },
  });

  const usersQ = useUsersList({
    status: "all",
    limit: 500,
    ...(userOrgFilter ? { orgId: userOrgFilter } : {}),
  });

  const upsertOrgMut = useMutation({
    mutationFn: async (body: { id: string; name: string; active?: boolean }) => {
      return await api.call("devOrgsUpsert", { body });
    },
    onSuccess: async (res) => {
      const org = (res as { org?: OrgRow }).org;
      toast(`Org saved: ${org?.id || "ok"}`, { type: "success" });
      await qc.invalidateQueries({ queryKey: ORGS_QK });
      if (org?.id) {
        setSelectedOrgId(org.id);
        setMoveTargetOrgId((prev) => prev || org.id);
      }
      setNewOrgId("");
      setNewOrgName("");
    },
  });

  const patchTeamsMut = useMutation({
    mutationFn: async (body: { orgId: string; add?: Array<string | { id: string; name?: string }>; remove?: string[] }) => {
      return await api.call("devOrgsPatchTeams", { body });
    },
    onSuccess: async () => {
      toast("Org teams updated.", { type: "success" });
      await qc.invalidateQueries({ queryKey: ORGS_QK });
      setTeamIdInput("");
      setTeamNameInput("");
    },
  });

  const orgs = React.useMemo(() => orgsQ.data || [], [orgsQ.data]);
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) || null;

  React.useEffect(() => {
    if (!selectedOrgId && orgs.length) setSelectedOrgId(orgs[0]!.id);
    if (!moveTargetOrgId && orgs.length) setMoveTargetOrgId(orgs[0]!.id);
  }, [orgs, selectedOrgId, moveTargetOrgId]);

  const users = React.useMemo(() => {
    const all = (usersQ.data?.users || []) as CompositeUser[];
    const q = userSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((u) =>
      [u.uid, u.email, u.displayName, u.topRole, ...(u.roles || [])]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [usersQ.data, userSearch]);

  const selectedUsers = users.filter((u) => selectedUserIds[u.uid]);

  const moveSelectedUsers = async () => {
    const targetOrg = orgs.find((o) => o.id === moveTargetOrgId);
    if (!targetOrg) {
      toast("Select a target org.", { type: "error" });
      return;
    }
    if (!selectedUsers.length) {
      toast("Select at least one user.", { type: "error" });
      return;
    }

    const targetTeams = includeOrgTeamsOnMove
      ? (targetOrg.teams || []).filter((t) => t.active !== false).map((t) => t.id)
      : [];
    const teamIds = uniqStrings([targetOrg.id, ...targetTeams, ...parseCsv(moveExtraTeamsCsv)]);

    let ok = 0;
    for (const u of selectedUsers) {
      const roles = Array.isArray(u.roles) ? u.roles.filter(Boolean) : [];
      await setUserRole.mutateAsync({
        uid: u.uid,
        ...(roles.length ? { roles } : {}),
        orgId: targetOrg.id,
        teamIds,
      });
      ok++;
    }
    toast(`Reassigned ${ok} user${ok === 1 ? "" : "s"} to ${targetOrg.id}.`, { type: "success" });
    setSelectedUserIds({});
    await qc.invalidateQueries({ queryKey: qk.users.root });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Org Manager</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Super-dev tool for creating orgs, managing org team lists, and reassigning users across orgs.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create / Update Org</h2>
          <div className="mt-3 space-y-3">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="org id (e.g. acme)"
              value={newOrgId}
              onChange={(e) => setNewOrgId(e.currentTarget.value)}
            />
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="org name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.currentTarget.value)}
            />
            <button
              type="button"
              disabled={upsertOrgMut.isPending}
              onClick={() => {
                const id = newOrgId.trim();
                const name = newOrgName.trim();
                if (!id || !name) {
                  toast("Org id and name are required.", { type: "error" });
                  return;
                }
                upsertOrgMut.mutate({ id, name, active: true });
              }}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {upsertOrgMut.isPending ? "Saving..." : "Save Org"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Org Directory</h2>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => setSelectedOrgId(org.id)}
                className={[
                  "w-full rounded-lg border px-3 py-2 text-left",
                  selectedOrgId === org.id
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/20"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs">{org.id}</code>
                  <span className="text-[11px] text-slate-500">{(org.teams || []).length} teams</span>
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{org.name}</div>
              </button>
            ))}
            {!orgs.length && <div className="text-sm text-slate-500">No orgs found.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Teams for Selected Org</h2>
            <div className="text-xs text-slate-500">
              {selectedOrg ? `${selectedOrg.id} (${selectedOrg.name})` : "Select an org"}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="team id"
              value={teamIdInput}
              onChange={(e) => setTeamIdInput(e.currentTarget.value)}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="team name (optional)"
              value={teamNameInput}
              onChange={(e) => setTeamNameInput(e.currentTarget.value)}
            />
            <button
              type="button"
              disabled={!selectedOrg || patchTeamsMut.isPending}
              onClick={() => {
                if (!selectedOrg) return;
                const id = teamIdInput.trim();
                if (!id) {
                  toast("Team id is required.", { type: "error" });
                  return;
                }
                patchTeamsMut.mutate({
                  orgId: selectedOrg.id,
                  add: [{ id, ...(teamNameInput.trim() ? { name: teamNameInput.trim() } : {}) }],
                });
              }}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Add Team
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(selectedOrg?.teams || []).map((team) => (
            <div
              key={team.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <code>{team.id}</code>
              {team.name ? <span className="text-slate-600 dark:text-slate-300">{team.name}</span> : null}
              <button
                type="button"
                disabled={patchTeamsMut.isPending || !selectedOrg}
                onClick={() =>
                  selectedOrg &&
                  patchTeamsMut.mutate({
                    orgId: selectedOrg.id,
                    remove: [team.id],
                  })
                }
                className="text-rose-600 hover:text-rose-500 disabled:opacity-50"
                title="Remove team"
              >
                Remove
              </button>
            </div>
          ))}
          {!selectedOrg && <div className="text-sm text-slate-500">Select an org to manage teams.</div>}
          {selectedOrg && !(selectedOrg.teams || []).length && (
            <div className="text-sm text-slate-500">No teams configured for this org.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Filter users by org</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={userOrgFilter}
                onChange={(e) => setUserOrgFilter(e.currentTarget.value)}
              >
                <option value="">All orgs</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Search users</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={userSearch}
                onChange={(e) => setUserSearch(e.currentTarget.value)}
                placeholder="name / email / uid"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Target org</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={moveTargetOrgId}
                onChange={(e) => setMoveTargetOrgId(e.currentTarget.value)}
              >
                <option value="">Select org</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={moveExtraTeamsCsv}
              onChange={(e) => setMoveExtraTeamsCsv(e.currentTarget.value)}
              placeholder="extra team ids (csv)"
            />
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeOrgTeamsOnMove}
                onChange={(e) => setIncludeOrgTeamsOnMove(e.currentTarget.checked)}
              />
              Include org teams
            </label>
            <button
              type="button"
              disabled={setUserRole.isPending || !selectedUsers.length || !moveTargetOrgId}
              onClick={() => {
                void moveSelectedUsers().catch((e) => {
                  toast(toApiError(e, "Failed to move selected users.").error, { type: "error" });
                });
              }}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {setUserRole.isPending ? "Moving..." : `Move Selected (${selectedUsers.length})`}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && users.every((u) => !!selectedUserIds[u.uid])}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setSelectedUserIds(
                        checked
                          ? Object.fromEntries(users.map((u) => [u.uid, true]))
                          : {}
                      );
                    }}
                  />
                </th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Top role</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Org</th>
                <th className="px-3 py-2">Teams</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-slate-200 align-top dark:border-slate-700">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selectedUserIds[u.uid]}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setSelectedUserIds((prev) => ({
                          ...prev,
                          [u.uid]: checked,
                        }));
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {u.displayName || u.email || u.uid}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{u.uid}</div>
                    {u.email ? <div className="text-xs text-slate-500">{u.email}</div> : null}
                  </td>
                  <td className="px-3 py-2">{u.topRole || "-"}</td>
                  <td className="px-3 py-2">{(u.roles || []).join(", ") || "-"}</td>
                  <td className="px-3 py-2">{String((u as Record<string, unknown>).orgId || "-")}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {Array.isArray((u as Record<string, unknown>).teamIds)
                      ? ((u as Record<string, unknown>).teamIds as unknown[]).join(", ")
                      : "-"}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    {usersQ.isLoading ? "Loading users..." : "No users found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
