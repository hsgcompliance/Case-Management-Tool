//client/gdrive.ts
import api from './api';
import { getGoogleDriveAccessToken } from '@lib/googleDriveAccessToken';
import type {
  TGDriveCreateFolderBody, TGDriveUploadBody, TGDriveBuildCustomerFolderBody,
  TGDriveCustomerFolderSyncBody,
  GDriveCreateFolderResp, GDriveUploadResp, GDriveListResp,
  GDriveCustomerFolderIndexResp, GDriveBuildCustomerFolderResp,
  GDriveConfigGetResp, GDriveConfigPatchResp, GDriveCustomerFolderSyncResp,
} from '@types';
import type { ReqOf } from '@types';

type GDriveConfigPatchReq = ReqOf<'gdriveConfigPatch'>;

function driveHeaders() {
  const accessToken = getGoogleDriveAccessToken();
  return accessToken ? { 'x-drive-access-token': accessToken } : undefined;
}

function maybeDriveHeaders(includeDriveToken = true) {
  return includeDriveToken ? driveHeaders() : undefined;
}

function sanitizeParentId(value: string | undefined): string | undefined {
  const trimmed = String(value || '').trim();
  return trimmed.length >= 3 ? trimmed : undefined;
}

function sanitizeCustomerFolderIndexQuery(query: { activeParentId?: string; exitedParentId?: string }) {
  return {
    activeParentId: sanitizeParentId(query.activeParentId),
    exitedParentId: sanitizeParentId(query.exitedParentId),
  };
}

export const GDrive = {
  list: (query?: { folderId?: string }) =>
    api.getWith('gdriveList', query, driveHeaders()) as Promise<GDriveListResp>,
  createFolder: (body: TGDriveCreateFolderBody) =>
    api.postWith('gdriveCreateFolder', body, driveHeaders()) as Promise<GDriveCreateFolderResp>,
  upload: (body: TGDriveUploadBody) =>
    api.postWith('gdriveUpload', body, driveHeaders()) as Promise<GDriveUploadResp>,
  customerFolderIndex: (
    query: { activeParentId?: string; exitedParentId?: string },
    opts?: { includeDriveToken?: boolean }
  ) =>
    api.getWith(
      'gdriveCustomerFolderIndex',
      sanitizeCustomerFolderIndexQuery(query),
      maybeDriveHeaders(opts?.includeDriveToken ?? true)
    ) as Promise<GDriveCustomerFolderIndexResp>,
  configGet: () =>
    api.getWith('gdriveConfigGet', undefined, driveHeaders()) as Promise<GDriveConfigGetResp>,
  configPatch: (body: GDriveConfigPatchReq) =>
    api.postWith('gdriveConfigPatch', body, driveHeaders()) as Promise<GDriveConfigPatchResp>,
  buildCustomerFolder: (body: TGDriveBuildCustomerFolderBody) =>
    api.postWith('gdriveBuildCustomerFolder', body, driveHeaders()) as Promise<GDriveBuildCustomerFolderResp>,
  customerFolderSync: (body: TGDriveCustomerFolderSyncBody) =>
    api.postWith('gdriveCustomerFolderSync', body, driveHeaders()) as Promise<GDriveCustomerFolderSyncResp>,
};

export default GDrive;
