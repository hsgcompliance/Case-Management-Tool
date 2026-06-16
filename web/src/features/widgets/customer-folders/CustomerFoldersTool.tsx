"use client";

import React from "react";
import {
  useGDriveCustomerFolderIndex,
  useSheetArchiveClient,
  useSheetUnarchiveClient,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import type { TCustomerFolder } from "@types";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import type { DashboardToolDefinition, NavCrumb } from "@entities/Page/dashboardStyle/types";
import { useAuth } from "@app/auth/AuthProvider";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";

export type CustomerFoldersFilterState = {
  search: string;
  showExited: boolean;
};

type CustomerFoldersSelection = null;

const LEGACY_CUSTOMER_FOLDERS_URL =
  "https://script.google.com/a/macros/thehrdc.org/s/AKfycby1UgNzSZYurMKSq67cFEj9CUfFHZt7Ox4-yVC_MVa7Bum4B14BqUb0lVBkxAd95N90yQ/exec";

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

function useTemporaryDriveAccess() {
  const { signInWithGoogle } = useAuth();
  const [hasDriveToken, setHasDriveToken] = React.useState(() => !!getGoogleDriveAccessToken());
  const [connecting, setConnecting] = React.useState(false);

  const connect = React.useCallback(async () => {
    setConnecting(true);
    try {
      await signInWithGoogle();
      setHasDriveToken(!!getGoogleDriveAccessToken());
    } finally {
      setConnecting(false);
    }
  }, [signInWithGoogle]);

  return { hasDriveToken, connecting, connect };
}

function ConnectForArchiveButton({
  connecting,
  onConnect,
}: {
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      disabled={connecting}
      onClick={() => void onConnect()}
      title="Needed for archive and restore actions"
    >
      {connecting ? "Connecting..." : "Connect for archive"}
    </button>
  );
}

export const CustomerFoldersTopbar: DashboardToolDefinition<
  CustomerFoldersFilterState,
  CustomerFoldersSelection
>["ToolTopbar"] = ({ value, onChange }: CustomerFoldersTopbarProps) => {
  const { hasDriveToken, connecting, connect } = useTemporaryDriveAccess();
  const { refetch, isFetching } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    { staleTime: 5 * 60_000 },
  );

  return (
    <>
      {!hasDriveToken ? (
        <ConnectForArchiveButton connecting={connecting} onConnect={connect} />
      ) : null}
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

export function CustomerFoldersTool(
  props: {
    filterState?: CustomerFoldersFilterState;
    onFilterChange?: (next: CustomerFoldersFilterState) => void;
  } = {},
) {
  const { hasDriveToken, connecting, connect } = useTemporaryDriveAccess();

  const [localFilterState, setLocalFilterState] = React.useState<CustomerFoldersFilterState>({
    search: "",
    showExited: true,
  });
  const filterState = props.filterState ?? localFilterState;
  const setFilterState = props.onFilterChange ?? setLocalFilterState;
  const { search, showExited } = filterState;

  const { data, isLoading, isError, error, refetch, isFetching } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    { staleTime: 5 * 60_000 },
  );

  const archiveMut = useSheetArchiveClient();
  const unarchiveMut = useSheetUnarchiveClient();

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
            {!hasDriveToken ? (
              <ConnectForArchiveButton connecting={connecting} onConnect={connect} />
            ) : null}
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
        <span>Active: <strong className="text-slate-700">{activeCount}</strong></span>
        <span>Exited: <strong className="text-slate-700">{exitedCount}</strong></span>
        {search ? <span>Showing: <strong className="text-slate-700">{folders.length}</strong></span> : null}
      </div>

      <ToolTable
        headers={["Name", "First", "Last", "CWID", "Status", "Created", ""]}
        rows={
          isLoading ? (
            <tr>
              <td colSpan={7} className="py-4 text-center text-sm text-slate-500">
                Loading folders from Drive...
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={7} className="py-6 text-center">
                <div className="text-sm text-slate-600">
                  Customer folders could not be loaded.
                  <br />
                  <span className="text-xs text-slate-500">
                    {error instanceof Error
                      ? error.message
                      : "Check the Drive integration settings and folder index configuration."}
                  </span>
                  <div className="mt-3">
                    <a
                      href={LEGACY_CUSTOMER_FOLDERS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                    >
                      Open legacy Customer Folders
                    </a>
                  </div>
                </div>
              </td>
            </tr>
          ) : folders.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-4 text-center text-sm text-slate-500">
                No folders found.
              </td>
            </tr>
          ) : (
            folders.map((f) => (
              <FolderRow
                key={f.id}
                folder={f}
                onArchive={() => archiveMut.mutate(f.id)}
                onUnarchive={() => unarchiveMut.mutate(f.id)}
                busy={archiveMut.isPending || unarchiveMut.isPending}
                canMutate={hasDriveToken}
              />
            ))
          )
        }
      />
    </ToolCard>
  );
}

function FolderRow({
  folder: f,
  onArchive,
  onUnarchive,
  busy,
  canMutate,
}: {
  folder: TCustomerFolder;
  onArchive: () => void;
  onUnarchive: () => void;
  busy: boolean;
  canMutate: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50">
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
      <td className="text-right">
        {f.status === "active" ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-slate-500 hover:text-red-600"
            disabled={busy || !canMutate}
            onClick={onArchive}
            title={canMutate ? "Mark inactive" : "Connect temporary Drive access to archive"}
          >
            Archive
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-slate-500 hover:text-emerald-600"
            disabled={busy || !canMutate}
            onClick={onUnarchive}
            title={canMutate ? "Restore to active" : "Connect temporary Drive access to restore"}
          >
            Restore
          </button>
        )}
      </td>
    </tr>
  );
}
