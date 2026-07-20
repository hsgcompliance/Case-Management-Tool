"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useAuth} from "@app/auth/AuthProvider";
import Inbox from "@client/inbox";

const subscriptionKey = (uid: string) => ["inbox", "digestSubscriptions", uid] as const;

export function useGrantDigestSubscription(grantId?: string) {
  const {user} = useAuth();
  const uid = user?.uid || "";
  const qc = useQueryClient();
  const normalizedGrantId = String(grantId || "").trim();

  const query = useQuery({
    queryKey: subscriptionKey(uid),
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await Inbox.digestSubsGet();
      const mine = response.records.find((record) => record.uid === uid);
      return Array.from(new Set((mine?.grantProgramIds || []).map(String).filter(Boolean)));
    },
  });

  const mutation = useMutation({
    mutationFn: async (subscribed: boolean) => {
      if (!uid || !normalizedGrantId) throw new Error("Missing user or grant.");
      await Inbox.digestSubUpdate({uid, digestType: "grantPrograms", subscribed, grantId: normalizedGrantId});
      return subscribed;
    },
    onMutate: async (subscribed) => {
      await qc.cancelQueries({queryKey: subscriptionKey(uid)});
      const previous = qc.getQueryData<string[]>(subscriptionKey(uid)) || [];
      const next = subscribed
        ? Array.from(new Set([...previous, normalizedGrantId]))
        : previous.filter((id) => id !== normalizedGrantId);
      qc.setQueryData(subscriptionKey(uid), next);
      return {previous};
    },
    onError: (_error, _subscribed, context) => {
      if (context?.previous) qc.setQueryData(subscriptionKey(uid), context.previous);
    },
    onSettled: () => qc.invalidateQueries({queryKey: subscriptionKey(uid)}),
  });

  return {
    subscribed: query.data?.includes(normalizedGrantId) === true,
    loading: query.isLoading,
    busy: mutation.isPending,
    canSubscribe: !!uid && !!normalizedGrantId,
    setSubscribed: mutation.mutateAsync,
  };
}
