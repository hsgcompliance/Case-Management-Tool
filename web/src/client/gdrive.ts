//client/gdrive.ts
import api from './api';
import { getGoogleDriveAccessToken } from '@lib/googleDriveAccessToken';
import type {
  TGDriveCreateFolderBody, TGDriveUploadBody, TGDriveBuildCustomerFolderBody,
  GDriveCreateFolderResp, GDriveUploadResp, GDriveListResp,
  GDriveCustomerFolderIndexResp, GDriveBuildCustomerFolderResp,
} from '@types';

function driveHeaders() {
  const accessToken = getGoogleDriveAccessToken();
  return accessToken ? { 'x-google-access-token': accessToken } : undefined;
}

export const GDrive = {
  list: (query?: { folderId?: string }) =>
    api.getWith('gdriveList', query, driveHeaders()) as Promise<GDriveListResp>,
  createFolder: (body: TGDriveCreateFolderBody) =>
    api.postWith('gdriveCreateFolder', body, driveHeaders()) as Promise<GDriveCreateFolderResp>,
  upload: (body: TGDriveUploadBody) =>
    api.postWith('gdriveUpload', body, driveHeaders()) as Promise<GDriveUploadResp>,
  customerFolderIndex: (query: { activeParentId?: string; exitedParentId?: string }) =>
    api.getWith('gdriveCustomerFolderIndex', query, driveHeaders()) as Promise<GDriveCustomerFolderIndexResp>,
  buildCustomerFolder: (body: TGDriveBuildCustomerFolderBody) =>
    api.postWith('gdriveBuildCustomerFolder', body, driveHeaders()) as Promise<GDriveBuildCustomerFolderResp>,
};

export default GDrive;
