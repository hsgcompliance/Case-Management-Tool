// web/src/hooks/useUsers.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from '@client/users';
import { qk } from './queryKeys';
import { useOptimisticMutation } from './optimistic';
import { useInvalidateMutation } from './optimistic';
import { RQ_DEFAULTS, RQ_DETAIL } from './base';
import type { UsersMeUpdateReq } from "@types";

export type CompositeUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  phone?: string | null;
  disabled?: boolean;
  active?: boolean;
  roles?: string[];
  role?: string | null;
  topRole?: string | null;
  admin?: boolean;
  createdAt?: string | null;
  lastLogin?: string | null;
  extras?: Record<string, any> | null;
};

type UsersList = { ok?: boolean; users?: CompositeUser[]; nextPageToken?: string | null } | CompositeUser[];
export type UsersListEnvelope = { ok?: boolean; users?: CompositeUser[]; nextPageToken?: string | null };

const readUsersArray = (res?: UsersList): CompositeUser[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res as CompositeUser[];
  if (Array.isArray((res as any).users)) return (res as any).users as CompositeUser[];
  return [];
};

/* ---------------- queries ---------------- */

export function useUsers(filters?: { limit?: number; pageToken?: string; status?: 'all'|'active'|'inactive'; orgId?: string }) {
  return useQuery({
    queryKey: qk.users.list(filters || {}),
    queryFn: async () => {
      const res = await Users.list(filters);
      return readUsersArray(res);
    },
    ...RQ_DEFAULTS,
  });
}

export function useUsersList(filters?: { limit?: number; pageToken?: string; status?: 'all'|'active'|'inactive'; orgId?: string }) {
  return useQuery({
    queryKey: qk.users.list(filters || {}),
    queryFn: async () => {
      const res = await Users.list(filters);
      if (Array.isArray(res)) return { ok: true, users: res, nextPageToken: null } as UsersListEnvelope;
      return {
        ok: (res as any)?.ok ?? true,
        users: readUsersArray(res),
        nextPageToken: (res as any)?.nextPageToken ?? null,
      } as UsersListEnvelope;
    },
    ...RQ_DEFAULTS,
  });
}

export function useUser(uid?: string) {
  const qc = useQueryClient();
  return useQuery({
    enabled: !!uid,
    queryKey: qk.users.detail(uid || 'noop'),
    queryFn: async () => {
      if (!uid) return null;
      // We don’t have a dedicated /get route; hydrate from any list cache if possible.
      // If absent, ask /usersList (all) as a fallback, then cache the detail.
      const cachedLists = qc.getQueriesData<CompositeUser[]>({ queryKey: qk.users.root });
      for (const [, arr] of cachedLists) {
        const hit = (arr || []).find(u => u.uid === uid);
        if (hit) return hit;
      }
      const res = await Users.list({ status: 'all', limit: 500 });
      const users = readUsersArray(res);
      const found = users.find(u => u.uid === uid) || null;
      if (found) qc.setQueryData(qk.users.detail(uid), found);
      return found;
    },
    ...RQ_DETAIL,
  });
}

export function useMe() {
  return useQuery({
    queryKey: qk.users.me(),
    queryFn: async () => ((await Users.me()).user ?? null) as CompositeUser | null,
    ...RQ_DETAIL,
  });
}

/* ---------------- mutations (basic) ---------------- */

export function useCreateUser() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.users.root],
    mutationFn: Users.create,
    onSuccess: (res) => {
      const u = (res as any)?.user as CompositeUser | undefined;
      if (u?.uid) {
        // optimistic add to "all" list
        const keyAll = qk.users.list({ status: 'all' });
        const prev = qc.getQueryData<any>(keyAll);
        if (prev?.length) {
          const arr = prev as CompositeUser[];
          const exists = arr.some(x => x.uid === u.uid);
          if (!exists) qc.setQueryData(keyAll, [u, ...arr]);
        }
        qc.setQueryData(qk.users.detail(u.uid), u);
      }
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.users.root],
    mutationFn: Users.invite,
    onSuccess: (res) => {
      const u = (res as any)?.user as CompositeUser | undefined;
      if (u?.uid) {
        const keyAll = qk.users.list({ status: 'all' });
        const prev = qc.getQueryData<any>(keyAll);
        if (prev?.length) {
          const arr = prev as CompositeUser[];
          const exists = arr.some(x => x.uid === u.uid);
          if (!exists) qc.setQueryData(keyAll, [u, ...arr]);
        }
        qc.setQueryData(qk.users.detail(u.uid), u);
      }
    },
  });
}

/* ---------------- mutations (optimistic) ---------------- */

function upsertInArray(arr: CompositeUser[], user: CompositeUser) {
  const i = arr.findIndex(u => u.uid === user.uid);
  if (i >= 0) {
    const copy = arr.slice();
    copy[i] = { ...arr[i], ...user };
    return copy;
  }
  return [user, ...arr];
}

function removeFromArray(arr: CompositeUser[], uid: string) {
  return arr.filter(u => u.uid !== uid);
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useOptimisticMutation(
    (body: Parameters<typeof Users.setRole>[0]) => Users.setRole(body),
    {
      makePatches: (body) => {
        const { uid, roles } = body as any;
        if (!uid) return [];
        const apply = (before: any) => {
          // detail cache
          if (!before) return before;
          return { ...(before as any), roles: roles as string[], admin: (roles as string[]).includes('admin') };
        };
        const updateList = (prev: any) => {
          const list = Array.isArray(prev) ? prev as CompositeUser[] : Array.isArray(prev?.users) ? (prev.users as CompositeUser[]) : null;
          if (!list) return prev;
          const replaced = upsertInArray(list, {
            ...(list.find(u => u.uid === uid) || ({ uid } as any)),
            roles: roles as string[],
            admin: (roles as string[]).includes('admin'),
          });
          if (Array.isArray(prev)) return replaced;
          return { ...(prev || {}), users: replaced };
        };
        return [
          { key: qk.users.detail(uid), update: apply },
          { key: qk.users.list({ status: 'all' }), update: updateList },
          { key: qk.users.list({ status: 'active' }), update: updateList },
          { key: qk.users.list({ status: 'inactive' }), update: updateList },
        ];
      },
      afterSuccess: async () => {
        let selfUid = "";
        try {
          const { auth } = await import('@lib/firebase');
          selfUid = String(auth.currentUser?.uid || "");
          await auth.currentUser?.getIdToken(true);
        } catch {}
        // Keep optimistic cache as source of truth for normal UX; only refresh /me when current user's claims may have changed.
        if (selfUid) {
          void qc.invalidateQueries({ queryKey: qk.users.me() });
          void qc.invalidateQueries({ queryKey: qk.users.detail(selfUid) });
        }
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useOptimisticMutation(
    (body: Parameters<typeof Users.setActive>[0]) => Users.setActive(body),
    {
      makePatches: (body) => {
        const { uid, active } = body as any;
        if (!uid) return [];
        const applyDetail = (before: any) => (before ? { ...(before as any), active: !!active, disabled: !active } : before);

        const updateAll = (prev: any) => {
          const list = Array.isArray(prev) ? prev as CompositeUser[] : Array.isArray(prev?.users) ? (prev.users as CompositeUser[]) : null;
          if (!list) return prev;
          const nextArr = upsertInArray(list, {
            ...(list.find(u => u.uid === uid) || ({ uid } as any)),
            active: !!active,
            disabled: !active,
          });
          if (Array.isArray(prev)) return nextArr;
          return { ...(prev || {}), users: nextArr };
        };

        const updateActive = (prev: any) => {
          const list = Array.isArray(prev) ? prev as CompositeUser[] : Array.isArray(prev?.users) ? (prev.users as CompositeUser[]) : null;
          if (!list) return prev;
          const stripped = removeFromArray(list, uid);
          const shouldAdd = !!active;
          const nextArr = shouldAdd
            ? upsertInArray(stripped, { uid, ...(list.find(u => u.uid === uid) || {} as any), active: true, disabled: false })
            : stripped;
          if (Array.isArray(prev)) return nextArr;
          return { ...(prev || {}), users: nextArr };
        };

        const updateInactive = (prev: any) => {
          const list = Array.isArray(prev) ? prev as CompositeUser[] : Array.isArray(prev?.users) ? (prev.users as CompositeUser[]) : null;
          if (!list) return prev;
          const stripped = removeFromArray(list, uid);
          const shouldAdd = !active;
          const nextArr = shouldAdd
            ? upsertInArray(stripped, { uid, ...(list.find(u => u.uid === uid) || {} as any), active: false, disabled: true })
            : stripped;
          if (Array.isArray(prev)) return nextArr;
          return { ...(prev || {}), users: nextArr };
        };

        return [
          { key: qk.users.detail(uid), update: applyDetail },
          { key: qk.users.list({ status: 'all' }), update: updateAll },
          { key: qk.users.list({ status: 'active' }), update: updateActive },
          { key: qk.users.list({ status: 'inactive' }), update: updateInactive },
        ];
      },
      afterSuccess: async () => {
        let selfUid = "";
        try {
          const { auth } = await import('@lib/firebase');
          selfUid = String(auth.currentUser?.uid || "");
          await auth.currentUser?.getIdToken(true);
        } catch {}
        // Keep optimistic cache as source of truth for normal UX; only refresh /me when current user's auth state may differ.
        if (selfUid) {
          void qc.invalidateQueries({ queryKey: qk.users.me() });
          void qc.invalidateQueries({ queryKey: qk.users.detail(selfUid) });
        }
      },
      revalidateAfterMs: 0,
    },
    { meta: { queryClient: qc } }
  );
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.users.root],
    mutationFn: Users.updateProfile,
    onSuccess: (res) => {
      const u = (res as any)?.user as CompositeUser | undefined;
      if (u?.uid) qc.setQueryData(qk.users.detail(u.uid), u);
    },
  });
}

export function useResendUserInvite() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.users.root],
    mutationFn: Users.resendInvite,
    onSuccess: (res) => {
      const u = (res as any)?.user as CompositeUser | undefined;
      if (u?.uid) qc.setQueryData(qk.users.detail(u.uid), u);
    },
  });
}

/* ---------------- me extras ---------------- */

export function useUpdateMe() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    mutationFn: (updates: UsersMeUpdateReq['updates']) => Users.meUpdate(updates),
    onSuccess: (res) => {
      const out = res as any;
      // Update /me cache
      const prev = qc.getQueryData<any>(qk.users.me());
      if (prev) {
        qc.setQueryData(qk.users.me(), { ...prev, extras: out?.extras ?? prev?.extras ?? {} });
      }
    },
  });
}

/* ---------------- dev helper ---------------- */

export function useDevGrantAdmin() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.users.root, qk.users.me()],
    mutationFn: (uid?: string) => Users.devGrantAdmin(uid),
    onSuccess: async (r: any, uid) => {
      // If prod path returns needRefresh:true, or we’re on emulator (harmless), refresh once
      try {
        if (r?.needRefresh !== false) {
          const { auth } = await import('@lib/firebase');
          await auth.currentUser?.getIdToken(true);
        }
      } catch {}
      if (uid) qc.invalidateQueries({ queryKey: qk.users.detail(uid) });
    },
  });
}

export function useDevOrgs(opts?: { enabled?: boolean; staleTime?: number }) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: ['users', 'devOrgs'],
    queryFn: () => Users.devOrgsList(),
    staleTime: opts?.staleTime ?? RQ_DEFAULTS.staleTime,
  });
}

export function useDevOrgsUpsert() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [['users', 'devOrgs']],
    mutationFn: (body: Parameters<typeof Users.devOrgsUpsert>[0]) => Users.devOrgsUpsert(body),
  });
}

export function useDevOrgsPatchTeams() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [['users', 'devOrgs']],
    mutationFn: (body: Parameters<typeof Users.devOrgsPatchTeams>[0]) => Users.devOrgsPatchTeams(body),
  });
}
