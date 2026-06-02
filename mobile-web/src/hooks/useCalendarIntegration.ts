import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { GoogleIntegrations, type CalendarPostEventInput } from "@/lib/googleIntegrations";
import { qk } from "@/hooks/queryKeys";

export interface CalendarStatus {
  connected: boolean;
  needsReconnect: boolean;
  ok?: boolean;
  service?: "googleCalendar" | "googleDrive";
  googleEmail?: string;
  scopes?: string[];
  permissionStatus: "connected" | "needs_reconnect" | "revoked" | "error" | "disconnected";
  connectedAt?: string;
  lastSyncAt?: string;
  accessTokenExpiresAt?: string | null;
}

export type PostEventInput = CalendarPostEventInput;

function normalizeStatus(resp: Partial<CalendarStatus>): CalendarStatus {
  const permissionStatus = resp.permissionStatus ?? "disconnected";
  return {
    ...resp,
    connected: resp.connected === true && permissionStatus === "connected",
    needsReconnect: permissionStatus === "needs_reconnect" || permissionStatus === "revoked",
    permissionStatus,
  };
}

export function useCalendarIntegration(user: User | null) {
  const qc = useQueryClient();
  const uid = user?.uid;
  const qKey = uid ? qk.google.integration("googleCalendar", uid) : qk.google.integration("googleCalendar", "");

  const statusQuery = useQuery({
    queryKey: qKey,
    queryFn: async () => normalizeStatus(await GoogleIntegrations.status("googleCalendar")),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => GoogleIntegrations.connect("googleCalendar"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => GoogleIntegrations.disconnect("googleCalendar"),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const postEventMutation = useMutation({
    mutationFn: (data: PostEventInput) => GoogleIntegrations.postCalendarEvent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const status = statusQuery.data ?? {
    connected: false,
    needsReconnect: false,
    permissionStatus: "disconnected" as const,
  };

  return {
    ...status,
    isLoading: statusQuery.isLoading,
    connect: () => connectMutation.mutateAsync(),
    connecting: connectMutation.isPending,
    disconnect: () => disconnectMutation.mutateAsync(),
    disconnecting: disconnectMutation.isPending,
    postEvent: postEventMutation.mutateAsync,
    postingEvent: postEventMutation.isPending,
    invalidate: () => qc.invalidateQueries({ queryKey: qKey }),
  };
}

export function useDriveIntegration(user: User | null) {
  const qc = useQueryClient();
  const uid = user?.uid;
  const qKey = uid ? qk.google.integration("googleDrive", uid) : qk.google.integration("googleDrive", "");

  const statusQuery = useQuery({
    queryKey: qKey,
    queryFn: async () => normalizeStatus(await GoogleIntegrations.status("googleDrive")),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => GoogleIntegrations.connect("googleDrive"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => GoogleIntegrations.disconnect("googleDrive"),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const status = statusQuery.data ?? {
    connected: false,
    needsReconnect: false,
    permissionStatus: "disconnected" as const,
  };

  return {
    ...status,
    isLoading: statusQuery.isLoading,
    connect: () => connectMutation.mutateAsync(),
    connecting: connectMutation.isPending,
    disconnect: () => disconnectMutation.mutateAsync(),
    disconnecting: disconnectMutation.isPending,
    invalidate: () => qc.invalidateQueries({ queryKey: qKey }),
  };
}
