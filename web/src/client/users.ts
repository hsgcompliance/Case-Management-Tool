// web/src/client/users.ts
import api from './api';
import { idemKey } from '@lib/idem';
import { noUndefined } from '@lib/safeData';

import type {
  ReqOf,
  RespOf,
  UsersCreateReq, UsersCreateResp,
  UsersInviteReq, UsersInviteResp,
  UsersSetRoleReq, UsersSetRoleResp,
  UsersSetActiveReq, UsersSetActiveResp,
  UsersUpdateProfileReq, UsersUpdateProfileResp,
  UsersResendInviteReq, UsersResendInviteResp,
  UsersRevokeSessionsReq, UsersRevokeSessionsResp,
  UsersListResp, UsersMeResp, UsersMeUpdateReq, UsersMeUpdateResp
} from '@types';

export const Users = {
  create: (body: UsersCreateReq) =>
    api.callIdem('usersCreate', noUndefined(body) as any, idemKey(body)) as Promise<UsersCreateResp>,

  invite: (body: UsersInviteReq) =>
    api.callIdem('usersInvite', noUndefined(body) as any, idemKey(body)) as Promise<UsersInviteResp>,

  setRole: (body: UsersSetRoleReq) =>
    api.callIdem('usersSetRole', noUndefined(body) as any, idemKey(body)) as Promise<UsersSetRoleResp>,

  setActive: (body: UsersSetActiveReq) =>
    api.callIdem('usersSetActive', noUndefined(body) as any, idemKey(body)) as Promise<UsersSetActiveResp>,

  updateProfile: (body: UsersUpdateProfileReq) =>
    api.callIdem('usersUpdateProfile', noUndefined(body) as any, idemKey(body)) as Promise<UsersUpdateProfileResp>,

  resendInvite: (body: UsersResendInviteReq) =>
    api.callIdem('usersResendInvite', noUndefined(body) as any, idemKey(body)) as Promise<UsersResendInviteResp>,

  revokeSessions: (body: UsersRevokeSessionsReq = {}) =>
    api.callIdem('usersRevokeSessions', noUndefined(body) as any, idemKey({ op: 'usersRevokeSessions', body })) as Promise<UsersRevokeSessionsResp>,

  list: async (query?: { limit?: number; pageToken?: string; status?: 'all'|'active'|'inactive'; orgId?: string }) => {
    const maxPerPage = 1000;
    const requested = Number(query?.limit);
    const needsPagination = Number.isFinite(requested) && requested > maxPerPage;

    const first = (await api.get('usersList', {
      ...(query || {}),
      ...(needsPagination ? { limit: maxPerPage } : {}),
    })) as UsersListResp;

    if (!needsPagination) return first;

    const target = Math.max(1, requested);
    const outUsers = Array.isArray((first as any)?.users) ? [...((first as any).users as any[])] : [];
    let nextPageToken = ((first as any)?.nextPageToken as string | null | undefined) ?? null;

    while (outUsers.length < target && nextPageToken) {
      const remaining = target - outUsers.length;
      const page = (await api.get('usersList', {
        ...(query || {}),
        limit: Math.min(maxPerPage, remaining),
        pageToken: nextPageToken,
      })) as UsersListResp;

      const users = Array.isArray((page as any)?.users) ? ((page as any).users as any[]) : [];
      if (!users.length) break;
      outUsers.push(...users);
      nextPageToken = ((page as any)?.nextPageToken as string | null | undefined) ?? null;
    }

    return {
      ...(first as any),
      users: outUsers.slice(0, target),
      nextPageToken,
    } as UsersListResp;
  },

  me: () =>
    api.get('usersMe') as Promise<UsersMeResp>,   // { ok, user }

  meUpdate: (updates: UsersMeUpdateReq['updates']) =>
    api.callIdem('usersMeUpdate', { updates: noUndefined(updates) } as UsersMeUpdateReq, idemKey(updates)) as Promise<UsersMeUpdateResp>,

  // Dev-only function (emulators): promote current uid to admin
  devGrantAdmin: (uid?: string) =>
    api.callIdem('devGrantAdmin', { uid }, idemKey({ uid, dev: true })) as Promise<any>,

  devOrgsList: (query?: ReqOf<'devOrgsList'>) =>
    api.get('devOrgsList', query) as Promise<RespOf<'devOrgsList'>>,

  devOrgsUpsert: (body: ReqOf<'devOrgsUpsert'>) =>
    api.callIdem('devOrgsUpsert', noUndefined(body) as any, idemKey({ scope: 'devOrgs', op: 'upsert', body })) as Promise<RespOf<'devOrgsUpsert'>>,

  devOrgsPatchTeams: (body: ReqOf<'devOrgsPatchTeams'>) =>
    api.callIdem('devOrgsPatchTeams', noUndefined(body) as any, idemKey({ scope: 'devOrgs', op: 'patchTeams', body })) as Promise<RespOf<'devOrgsPatchTeams'>>,
};

export default Users;
