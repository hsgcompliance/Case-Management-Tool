// web/src/client/orgs.ts
import api from './api';

export type OrgConfigKind = "display" | "system" | "email_template";

export type OrgConfigDoc = {
  id: string;
  orgId: string;
  label: string;
  kind: OrgConfigKind;
  active: boolean;
  schemaVersion?: number;
  // display / system
  value?: Record<string, unknown>;
  // email_template
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  placeholders?: string[];
  // audit
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type OrgDoc = {
  id: string;
  orgId: string;
  name: string;
  active: boolean;
  teams?: { id: string; name?: string; active: boolean }[];
  config: Record<string, OrgConfigDoc>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const Orgs = {
  get: (orgId?: string) =>
    api.get('orgGet', orgId ? { orgId } : {}) as Promise<{ ok: boolean; org: OrgDoc }>,

  configGet: (configId: string) =>
    api.get('orgConfigGet', { configId }) as Promise<{ ok: boolean; config: OrgConfigDoc }>,

  configPatch: (configId: string, patch: Record<string, unknown>, orgId?: string) =>
    api.post('orgConfigPatch', { configId, patch, ...(orgId ? { orgId } : {}) }) as Promise<{ ok: boolean; config: OrgConfigDoc }>,

  create: (id: string, name: string) =>
    api.post('orgCreate', { id, name }) as Promise<{ ok: boolean; org: OrgDoc }>,

  delete: (orgId: string) =>
    api.post('orgDelete', { orgId }) as Promise<{ ok: boolean; deleted: string }>,
};

export default Orgs;
