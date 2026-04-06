"use client";

import React from "react";
import { useGDriveCustomerFolderIndex } from "@hooks/useGDrive";
import type { TCustomerFolder } from "@types";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import type { DashboardToolDefinition, NavCrumb } from "@entities/Page/dashboardStyle/types";
import { ACTIVE_PARENT_ID, EXITED_PARENT_ID } from "@lib/driveConfig";

export type CustomerFoldersFilterState = {
  search: string;
  showExited: boolean;
};

type CustomerFoldersSelection = null;

type CustomerFoldersToolProps = {
  filterState?: CustomerFoldersFilterState;
  onFilterChange?: (next: CustomerFoldersFilterState) => void;
};

type CustomerFoldersTopbarProps = {
  value: CustomerFoldersFilterState;
  onChange: (next: CustomerFoldersFilterState) => void;
  selection: CustomerFoldersSelection;
  nav: {
    stack: NavCrumb<CustomerFoldersSelection>[];
    push: (c: NavCrumb<CustomerFoldersSelection>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<CustomerFoldersSelection>[]) => void;
  };
};

function normStr(s: string | null | undefined) {
  return (s ?? "").toLowerCase();
}

export const CustomerFoldersTopbar: DashboardToolDefinition<
  CustomerFoldersFilterState,
  CustomerFoldersSelection
>["ToolTopbar"] = ({ value, onChange }: CustomerFoldersTopbarProps) => {
  const { refetch, isFetching } = useGDriveCustomerFolderIndex(
    {
      activeParentId: ACTIVE_PARENT_ID,
      exitedParentId: EXITED_PARENT_ID,
    },
    { staleTime: 5 * 60_000 }
  );

  return (
    <>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={value.showExited}
          onChange={(e) => onChange({ ...value, showExited: e.currentTarget.checked })}
          className="rounded"
        />
        Show exited
      </label>
      <input
        className="input w-56"
        placeholder="Search name, CWID..."
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.currentTarget.value })}
      />
      <button className="btn btn-ghost btn-xs" onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? "Refreshing..." : "Refresh"}
      </button>
    </>
  );
};

export function CustomerFoldersTool(props: CustomerFoldersToolProps = {}) {
  const [localFilterState, setLocalFilterState] = React.useState<CustomerFoldersFilterState>({
    search: "",
    showExited: true,
  });
  const filterState = props.filterState ?? localFilterState;
  const setFilterState = props.onFilterChange ?? setLocalFilterState;
  const { search, showExited } = filterState;

  const { data, isLoading, isError, refetch, isFetching } = useGDriveCustomerFolderIndex(
    {
      activeParentId: ACTIVE_PARENT_ID,
      exitedParentId: EXITED_PARENT_ID,
    },
    { staleTime: 5 * 60_000 }
  );

  const folders: TCustomerFolder[] = React.useMemo(() => {
    const all = data?.folders ?? [];
    const q = search.trim().toLowerCase();
    return all
      .filter((f) => showExited || f.status === "active")
      .filter((f) => {
        if (!q) return true;
        return (
          normStr(f.name).includes(q) ||
          normStr(f.first).includes(q) ||
          normStr(f.last).includes(q) ||
          normStr(f.cwid).includes(q)
        );
      })
      .sort((a, b) => normStr(a.last).localeCompare(normStr(b.last)));
  }, [data, search, showExited]);

  const activeCount = data?.folders?.filter((f) => f.status === "active").length ?? 0;
  const exitedCount = data?.folders?.filter((f) => f.status === "exited").length ?? 0;

  return (
    <ToolCard
      title="Customer Folders"
      actions={
        props.filterState ? undefined : (
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showExited}
                onChange={(e) => setFilterState({ ...filterState, showExited: e.currentTarget.checked })}
                className="rounded"
              />
              Show exited
            </label>
            <input
              className="input w-56"
              placeholder="Search name, CWID..."
              value={search}
              onChange={(e) => setFilterState({ ...filterState, search: e.currentTarget.value })}
            />
            <button className="btn btn-ghost btn-xs" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        )
      }
    >
      <div className="mb-2 flex gap-3 text-xs text-slate-500">
        <span>
          Active: <strong className="text-slate-700">{activeCount}</strong>
        </span>
        <span>
          Exited: <strong className="text-slate-700">{exitedCount}</strong>
        </span>
        {search ? (
          <span>
            Showing: <strong className="text-slate-700">{folders.length}</strong>
          </span>
        ) : null}
      </div>

      <ToolTable
        headers={["Name", "First", "Last", "CWID", "Status", "Created"]}
        rows={
          isLoading ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-sm text-slate-500">
                Loading folders from Drive...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-sm text-rose-600">
                Failed to load folders. Check Drive access.
              </td>
            </tr>
          ) : folders.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-sm text-slate-500">
                No folders found.
              </td>
            </tr>
          ) : (
            folders.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block max-w-[220px] truncate font-medium text-sky-700 hover:underline"
                    title={f.name}
                  >
                    {f.name}
                  </a>
                </td>
                <td>{f.first ?? <span className="text-slate-400">-</span>}</td>
                <td>{f.last ?? <span className="text-slate-400">-</span>}</td>
                <td className="font-mono text-xs">{f.cwid ?? <span className="text-slate-400">-</span>}</td>
                <td>
                  <span
                    className={
                      f.status === "active"
                        ? "inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : "inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {f.status}
                  </span>
                </td>
                <td className="text-xs text-slate-500">
                  {f.createdTime ? new Date(f.createdTime).toLocaleDateString() : "-"}
                </td>
              </tr>
            ))
          )
        }
      />
    </ToolCard>
  );
}
