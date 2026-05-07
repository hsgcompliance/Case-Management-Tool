// src/hooks/useGDrive.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { GDrive } from '@client/gdrive';
import type { TCustomerFolder, TGDriveBuildCustomerFolderBody, TGDriveOrgConfig, TGDriveConfigPatchBody, GDriveConfigGetResp } from '@types';
import { qk } from './queryKeys';
import { RQ_DEFAULTS } from './base';
import { useInvalidateMutation } from './optimistic';
import { ACTIVE_PARENT_ID, EXITED_PARENT_ID } from '@lib/driveConfig';

const INDEX_STALE_MS = 20 * 60_000; // 20 min - index changes infrequently

function sanitizeParentId(value: string | undefined): string | undefined {
  const trimmed = String(value || '').trim();
  return trimmed.length >= 3 ? trimmed : undefined;
}

function sanitizeIndexQuery(query: { activeParentId?: string; exitedParentId?: string }) {
  return {
    activeParentId: sanitizeParentId(query.activeParentId),
    exitedParentId: sanitizeParentId(query.exitedParentId),
  };
}

export function useGDriveList(filters?: { folderId?: string }, opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = opts?.enabled ?? true;
  return useQuery<any>({
    ...RQ_DEFAULTS,
    enabled,
    retry: false,
    queryKey: qk.gdrive.list(filters),
    queryFn: () => GDrive.list(filters),
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

export function useGDriveCreateFolder() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    mutationFn: (body: { parentId: string; name: string }) => GDrive.createFolder(body),
    onSuccess: (_r, body) => qc.invalidateQueries({ queryKey: qk.gdrive.list({ folderId: body.parentId }) }),
  });
}

export function useGDriveCustomerFolderIndex(
  query: { activeParentId?: string; exitedParentId?: string },
  opts?: { enabled?: boolean; staleTime?: number; includeDriveToken?: boolean }
) {
  const normalizedQuery = sanitizeIndexQuery(query);
  const enabled = opts?.enabled ?? !!(normalizedQuery.activeParentId || normalizedQuery.exitedParentId);
  return useQuery<{ ok: boolean; folders: TCustomerFolder[] }>({
    ...RQ_DEFAULTS,
    enabled,
    retry: false,
    queryKey: qk.gdrive.customerFolderIndex(normalizedQuery as Record<string, unknown>),
    queryFn: () =>
      GDrive.customerFolderIndex(normalizedQuery, {
        includeDriveToken: opts?.includeDriveToken ?? true,
      }) as Promise<{ ok: boolean; folders: TCustomerFolder[] }>,
    staleTime: opts?.staleTime ?? INDEX_STALE_MS,
  });
}

export function useGDriveBuildCustomerFolder(
  indexQuery: { activeParentId?: string; exitedParentId?: string },
  opts?: { onSuccess?: (folder: { id: string; name: string; url: string }) => void }
) {
  const qc = useQueryClient();
  const normalizedIndexQuery = sanitizeIndexQuery(indexQuery);
  return useInvalidateMutation({
    queryClient: qc,
    mutationFn: (body: TGDriveBuildCustomerFolderBody) => GDrive.buildCustomerFolder(body),
    onSuccess: (result, body) => {
      // Optimistically prepend the new folder into the index cache
      const folder = (result as any)?.folder as { id: string; name: string; url: string } | undefined;
      if (folder) {
        const cacheKey = qk.gdrive.customerFolderIndex(normalizedIndexQuery as Record<string, unknown>);
        qc.setQueryData<{ ok: boolean; folders: TCustomerFolder[] }>(cacheKey, (prev) => {
          if (!prev) return prev;
          // Build a minimal TCustomerFolder from the new folder
          const nameParts = folder.name.match(/^([^,]+),\s*([^_]+?)(?:_(.+))?$/) ?? [];
          const newEntry: TCustomerFolder = {
            id: folder.id,
            name: folder.name,
            url: folder.url,
            createdTime: new Date().toISOString(),
            status: (body.parentId === ACTIVE_PARENT_ID ? 'active' : 'exited') as 'active' | 'exited',
            last: nameParts[1]?.trim() ?? null,
            first: nameParts[2]?.trim() ?? null,
            cwid: nameParts[3]?.trim() ?? null,
          };
          return { ...prev, folders: [newEntry, ...prev.folders] };
        });
        opts?.onSuccess?.(folder);
      }
      // Also invalidate the file list for the new folder's parent
      qc.invalidateQueries({ queryKey: qk.gdrive.list({ folderId: body.parentId }) });
    },
  });
}

export function useGDriveUpload() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.gdrive.root],
    mutationFn: (body: { name: string; mimeType: string; contentBase64: string; parentId: string }) =>
      GDrive.upload(body),
    onSuccess: (_r, body) => {
      const folderId = (body as any)?.parentId;
      if (folderId) qc.invalidateQueries({ queryKey: qk.gdrive.list({ folderId }) });
    },
  });
}

export function useGDriveConfig(opts?: { enabled?: boolean }) {
  return useQuery<GDriveConfigGetResp>({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: qk.gdrive.config,
    queryFn: () => GDrive.configGet() as Promise<GDriveConfigGetResp>,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useGDriveConfigPatch() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.gdrive.config],
    mutationFn: (body: TGDriveConfigPatchBody) =>
      GDrive.configPatch(body as any),
  });
}

export function useGDriveCustomerFolderSync() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => GDrive.customerFolderSync(body),
  });
}

// Re-exported for use in panel
export { ACTIVE_PARENT_ID, EXITED_PARENT_ID };
