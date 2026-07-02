// src/hooks/useGDrive.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { GDrive } from '@client/gdrive';
import type {
  TCustomerFolder,
  TGDriveBuildCustomerFolderBody,
  TGDriveCopyGrantTemplatesBody,
  TGDriveConfigPatchBody,
  GDriveConfigGetResp,
} from '@types';
import { qk } from './queryKeys';
import { RQ_DEFAULTS } from './base';
import { useInvalidateMutation } from './optimistic';
import { ACTIVE_PARENT_ID, EXITED_PARENT_ID, FOLDER_INDEX_SHEET_ID } from '@lib/driveConfig';
import { getGoogleDriveAccessToken, clearGoogleDriveAccessToken } from '@lib/googleDriveAccessToken';

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

/**
 * Warm the customer folder index into the *same* cache entry that
 * useGDriveCustomerFolderIndex reads. Fire-and-forget (e.g. when the new-customer
 * flow opens) so the folder build step has the index ready instead of stalling on
 * first load. prefetchQuery respects INDEX_STALE_MS, so this is a no-op when the
 * index is already cached and fresh.
 */
export function prefetchGDriveCustomerFolderIndex(
  qc: QueryClient,
  query: { activeParentId?: string; exitedParentId?: string },
  opts?: { includeDriveToken?: boolean; staleTime?: number }
) {
  const normalizedQuery = sanitizeIndexQuery(query);
  if (!normalizedQuery.activeParentId && !normalizedQuery.exitedParentId) return Promise.resolve();
  return qc.prefetchQuery({
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
  opts?: {
    onSuccess?: (
      folder: {
        id: string;
        name: string;
        url: string;
        warnings?: Array<{ phase: "template" | "subfolder"; name: string; fileId?: string; error: string }>;
      },
      // The exact variables passed to .mutate()/.mutateAsync() — callers may pass
      // extra client-only fields (e.g. `variant`) alongside TGDriveBuildCustomerFolderBody
      // to read back in onSuccess without a round trip through the server.
      variables: TGDriveBuildCustomerFolderBody & Record<string, unknown>
    ) => void;
  }
) {
  const qc = useQueryClient();
  const normalizedIndexQuery = sanitizeIndexQuery(indexQuery);
  // This hook only creates the Drive folder. Customer-link persistence should
  // follow the Google integrations storage order:
  // customerDrive.folderId -> meta.driveFolderId -> meta.driveFolders[0].id.
  // Callers are responsible for mirroring legacy fields during migration.
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
        opts?.onSuccess?.(folder, body);
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

export function useGDriveCopyGrantTemplates() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.gdrive.root],
    mutationFn: (body: TGDriveCopyGrantTemplatesBody) => GDrive.copyGrantTemplates(body),
    onSuccess: (_r, body) => {
      qc.invalidateQueries({ queryKey: qk.customers.detail(body.customerId) });
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

// ── Sheets-based folder index ─────────────────────────────────────────────────

function parseSheetRows(values: string[][]): TCustomerFolder[] {
  const [rawHeader = [], ...rows] = values;
  const header = rawHeader.map((v) => String(v || '').trim());
  const col = (label: string) => header.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  const firstCol = (labels: string[]) => {
    for (const label of labels) {
      const idx = col(label);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const idC = col('Folder ID');
  const nameC = col('Folder Name');
  const urlC = col('Folder URL');
  const firstC = col('First');
  const lastC = col('Last');
  const cwidC = col('CWID');
  const statusC = col('Status');
  const createdC = col('Created At');
  const tssWorkbookIdC = firstCol(['TSS Workbook ID', 'TSS Workbook Id', 'TSS Workbook', 'Workbook ID', 'Workbook Id', 'TSS ID']);
  const tssWorkbookUrlC = firstCol(['TSS Workbook URL', 'TSS Workbook Url', 'Workbook URL', 'Workbook Url']);
  const tssWorkbookNameC = firstCol(['TSS Workbook Name', 'Workbook Name']);
  const spreadsheetIdFromUrl = (value: string) => {
    const text = String(value || '').trim();
    return (
      text.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1] ||
      text.match(/[?&]id=([-\w]{20,})/i)?.[1] ||
      (/^[-\w]{20,}$/.test(text) ? text : '')
    );
  };
  if (idC < 0) return [];
  return rows
    .filter((r) => r[idC])
    .map((r) => {
      const rawTssWorkbookUrl = tssWorkbookUrlC >= 0 ? String(r[tssWorkbookUrlC] || '').trim() : '';
      const tssWorkbookId =
        (tssWorkbookIdC >= 0 ? String(r[tssWorkbookIdC] || '').trim() : '') ||
        spreadsheetIdFromUrl(rawTssWorkbookUrl) ||
        null;
      const tssWorkbookUrl = rawTssWorkbookUrl || (tssWorkbookId ? `https://docs.google.com/spreadsheets/d/${tssWorkbookId}/edit` : null);
      const tssWorkbookName = (tssWorkbookNameC >= 0 ? String(r[tssWorkbookNameC] || '').trim() : '') || null;
      return {
        id: r[idC] ?? "",
        name: nameC >= 0 ? r[nameC] ?? "" : "",
        url: urlC >= 0 ? r[urlC] ?? "" : "",
        first: firstC >= 0 ? r[firstC] || null : null,
        last: lastC >= 0 ? r[lastC] || null : null,
        cwid: cwidC >= 0 ? r[cwidC] || null : null,
        status: ((statusC >= 0 ? r[statusC] : '')?.toUpperCase() === "ACTIVE" ? "active" : "exited") as "active" | "exited",
        createdTime: createdC >= 0 ? r[createdC] || null : null,
        ...(tssWorkbookId ? { tssWorkbookId, tssWorkbookUrl, tssWorkbookName } : {}),
      };
    });
}

// Index sheet layout mirrors the Apps Script INDEX_HEADERS: FUNC is column A and
// Folder ID is column F. Writing a command word into the FUNC cell queues it for
// the nightly index job (which processes ARCHIVE/UNARCHIVE/DELETE/NEW and clears
// the column). We never move the folder live from the client.
const FOLDER_INDEX_TAB = "index";
const FOLDER_INDEX_ID_COL = "F";
const FOLDER_INDEX_FUNC_COL = "A";

/**
 * Raised when a Sheets call fails for an auth reason. The temporary Drive token
 * is cleared so the UI re-prompts via the existing "Connect for archive" flow.
 */
export class DriveSheetsAuthError extends Error {
  readonly needsAuth = true;
  constructor(public readonly status: number) {
    super(
      status === 401 || status === 403
        ? "Google access expired or is missing the Sheets permission. Reconnect Drive access and try again."
        : "Connect Google Drive access to queue customer-folder changes.",
    );
    this.name = "DriveSheetsAuthError";
  }
}

function requireDriveToken(): string {
  const token = getGoogleDriveAccessToken();
  if (!token) throw new DriveSheetsAuthError(0);
  return token;
}

async function sheetsApiFetch(path: string, token: string) {
  const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      clearGoogleDriveAccessToken();
      throw new DriveSheetsAuthError(resp.status);
    }
    throw new Error(`Sheets API ${resp.status}`);
  }
  return resp.json();
}

async function sheetsApiWrite(spreadsheetId: string, rangeA1: string, values: string[][], token: string) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
    `${encodeURIComponent(rangeA1)}?valueInputOption=RAW`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      clearGoogleDriveAccessToken();
      throw new DriveSheetsAuthError(resp.status);
    }
    throw new Error(`Sheets API ${resp.status}`);
  }
  return resp.json();
}

/** Find a folder's 1-based row in the index sheet by Folder ID (column F). */
async function findFolderIndexRow(spreadsheetId: string, folderId: string, token: string): Promise<number> {
  const range = `${FOLDER_INDEX_TAB}!${FOLDER_INDEX_ID_COL}:${FOLDER_INDEX_ID_COL}`;
  const json = (await sheetsApiFetch(`${spreadsheetId}/values/${encodeURIComponent(range)}`, token)) as {
    values?: string[][];
  };
  const rows = json.values ?? [];
  const target = String(folderId || "").trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() === target) return i + 1; // sheet rows are 1-based
  }
  return -1;
}

/** Queue a FUNC command (ARCHIVE / UNARCHIVE) for a folder in the index sheet. */
async function queueFolderFuncCommand(
  spreadsheetId: string,
  folderId: string,
  command: "ARCHIVE" | "UNARCHIVE",
): Promise<{ folderId: string; command: string; row: number }> {
  const sheetId = String(spreadsheetId || "").trim();
  if (!sheetId) {
    throw new Error("No customer index sheet configured. Set it in Org Config → Google Drive.");
  }
  const token = requireDriveToken();
  const row = await findFolderIndexRow(sheetId, folderId, token);
  if (row < 0) {
    throw new Error("Folder is not in the index sheet yet. Rebuild the folder index, then retry.");
  }
  await sheetsApiWrite(sheetId, `${FOLDER_INDEX_TAB}!${FOLDER_INDEX_FUNC_COL}${row}`, [[command]], token);
  return { folderId, command, row };
}

/** Effective customer index sheet id: org config first, env fallback. */
function useResolvedIndexSheetId(): string {
  const configQ = useGDriveConfig();
  const fromConfig = String(configQ.data?.config?.customerFolderIndex?.sheetId || "").trim();
  return fromConfig || FOLDER_INDEX_SHEET_ID;
}

export function useSheetCustomerFolderIndex(opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = (opts?.enabled ?? true) && !!FOLDER_INDEX_SHEET_ID;
  // Legacy Apps Script/Sheets index reader. Prefer useGDriveCustomerFolderIndex
  // for new customer folder resolution and keep this for archive/index fallback
  // paths until the Drive storage migration is complete.
  return useQuery<{ ok: boolean; folders: TCustomerFolder[] }>({
    ...RQ_DEFAULTS,
    enabled,
    retry: false,
    queryKey: qk.gdrive.sheetFolderIndex(),
    queryFn: async () => {
      const token = getGoogleDriveAccessToken();
      if (!token) throw new Error("No Google access token");
      const json = await sheetsApiFetch(`${FOLDER_INDEX_SHEET_ID}/values/index`, token) as { values?: string[][] };
      return { ok: true, folders: parseSheetRows(json.values ?? []) };
    },
    staleTime: opts?.staleTime ?? 5 * 60_000,
  });
}

// Archive / restore queue an ARCHIVE / UNARCHIVE FUNC command into the index
// sheet. The nightly index job performs the actual Drive move, so the live Drive
// index won't change until it runs — callers should reflect a "queued" state
// rather than an immediate status flip.
export function useSheetArchiveClient() {
  const qc = useQueryClient();
  const sheetId = useResolvedIndexSheetId();
  return useMutation({
    mutationFn: (folderId: string) => queueFolderFuncCommand(sheetId, folderId, "ARCHIVE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.gdrive.sheetFolderIndex() });
      qc.invalidateQueries({ queryKey: qk.gdrive.root });
    },
  });
}

export function useSheetUnarchiveClient() {
  const qc = useQueryClient();
  const sheetId = useResolvedIndexSheetId();
  return useMutation({
    mutationFn: (folderId: string) => queueFolderFuncCommand(sheetId, folderId, "UNARCHIVE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.gdrive.sheetFolderIndex() });
      qc.invalidateQueries({ queryKey: qk.gdrive.root });
    },
  });
}

// Re-exported for use in panel
export { ACTIVE_PARENT_ID, EXITED_PARENT_ID };
