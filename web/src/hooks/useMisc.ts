// src/hooks/useMisc.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { Misc } from '@client/misc';
import { qk } from './queryKeys';
import { RQ_DEFAULTS } from './base';

export function useHealth(opts?: { enabled?: boolean; staleTime?: number }) {
  const enabled = opts?.enabled ?? true;
  return useQuery<{ ok: boolean } | any>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.misc.health(),
    queryFn: () => Misc.health(),
    // Intentional: health checks should refresh faster than standard list cadence.
    staleTime: opts?.staleTime ?? 30_000,
  });
}

export function useCreateSession() {
  return useMutation({ mutationFn: (body: any) => Misc.createSession(body) });
}
