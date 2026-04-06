import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "./base";
import { useUpdateMe } from "./useUsers";
import { useInvalidateMutation } from "./optimistic";
import ToursClient from "@client/tours";
import type {
  ToursListReq,
  ToursPatchReq,
  ToursUpsertReq,
  UsersMeUpdateReq,
  TUserExtras,
} from "@types";
import { getAllProgress, mergeAllProgress, onProgress } from "@tour/progress";

const TOURS_LIST_STALE_MS = 24 * 60 * 60 * 1000; // 24h

export function useTours(filters?: ToursListReq, opts?: { enabled?: boolean; staleTime?: number }) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? TOURS_LIST_STALE_MS,
    gcTime: TOURS_LIST_STALE_MS,
    queryKey: qk.tours.list(filters || {}),
    queryFn: async () => ToursClient.list(filters),
  });
}

export function useTour(id?: string, opts?: { enabled?: boolean; staleTime?: number }) {
  const shouldFetch = (opts?.enabled ?? true) && !!id;
  return useQuery({
    ...RQ_DETAIL,
    enabled: shouldFetch,
    staleTime: opts?.staleTime ?? RQ_DETAIL.staleTime,
    queryKey: qk.tours.detail(id ?? "__none__"),
    queryFn: async () => ToursClient.get(id!),
  });
}

export function useToursStructure() {
  return useQuery({
    queryKey: qk.tours.structure(),
    queryFn: ToursClient.structure,
    ...RQ_DEFAULTS,
  });
}

export function useUpsertTours() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.tours.root],
    mutationFn: (rows: ToursUpsertReq) => ToursClient.upsert(rows),
  });
}

export function usePatchTours() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.tours.root],
    mutationFn: (rows: ToursPatchReq) => ToursClient.patch(rows),
  });
}

export function useDeleteTours() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.tours.root],
    mutationFn: (idOrIds: string | string[]) => ToursClient.delete(idOrIds),
  });
}

export function useAdminDeleteTours() {
  const qc = useQueryClient();
  return useInvalidateMutation({
    queryClient: qc,
    queryKeys: [qk.tours.root],
    mutationFn: (idOrIds: string | string[]) => ToursClient.adminDelete(idOrIds),
  });
}

export function useSyncTourProgressToProfile(opts?: { enabled?: boolean; debounceMs?: number }) {
  const enabled = opts?.enabled ?? true;
  const debounceMs = opts?.debounceMs ?? 1200;
  const { user, profile } = useAuth();
  const updateMe = useUpdateMe();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = React.useRef<string>("");
  const hydratingRef = React.useRef(false);

  const flush = React.useCallback(async () => {
    if (!enabled || !user?.uid || hydratingRef.current) return;
    const progress = getAllProgress(user.uid);
    const sig = JSON.stringify(progress);
    if (sig === lastSentRef.current) return;
    lastSentRef.current = sig;
    const toursUpdate: NonNullable<TUserExtras["tours"]> = {
      progress,
      updatedAt: new Date().toISOString(),
    };
    const updates: UsersMeUpdateReq["updates"] = {
      tours: {
        ...toursUpdate,
      },
    };
    try {
      await updateMe.mutateAsync(updates);
    } catch {
      // best effort only
    }
  }, [enabled, user?.uid, updateMe]);

  React.useEffect(() => {
    if (!enabled || !user?.uid) return;
    const remote = profile?.tours;
    const progress =
      remote && typeof remote === "object"
        ? (remote as TUserExtras["tours"])?.progress
        : null;
    if (!progress || typeof progress !== "object") return;
    hydratingRef.current = true;
    try {
      mergeAllProgress(user.uid, progress as Record<string, unknown>);
      lastSentRef.current = JSON.stringify(getAllProgress(user.uid));
    } finally {
      hydratingRef.current = false;
    }
  }, [enabled, user?.uid, profile]);

  React.useEffect(() => {
    if (!enabled || !user?.uid) return;
    const off = onProgress(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void flush(); }, debounceMs);
    });
    return () => {
      off();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, user?.uid, debounceMs, flush]);

  return { flush, isSyncing: updateMe.isPending };
}
