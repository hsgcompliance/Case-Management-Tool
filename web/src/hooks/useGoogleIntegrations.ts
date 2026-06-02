import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GoogleIntegrations, type GoogleIntegrationService } from "@client/googleIntegrations";
import { RQ_DEFAULTS } from "./base";
import { qk } from "./queryKeys";

export function useGoogleIntegrationStatus(
  service: GoogleIntegrationService,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery({
    ...RQ_DEFAULTS,
    enabled: opts?.enabled ?? true,
    queryKey: qk.google.integration(service),
    queryFn: () => GoogleIntegrations.status(service),
    staleTime: opts?.staleTime ?? 60_000,
    retry: false,
  });
}

export function useGoogleIntegrationStatuses(opts?: { enabled?: boolean; staleTime?: number }) {
  const calendar = useGoogleIntegrationStatus("googleCalendar", opts);
  const drive = useGoogleIntegrationStatus("googleDrive", opts);
  return {
    calendar,
    drive,
    isLoading: calendar.isLoading || drive.isLoading,
    isFetching: calendar.isFetching || drive.isFetching,
  };
}

export function useGoogleIntegrationConnect(service: GoogleIntegrationService) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => GoogleIntegrations.connect(service),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.google.integration(service) });
      void qc.invalidateQueries({ queryKey: qk.users.me() });
    },
  });
}

export function useGoogleIntegrationDisconnect(service: GoogleIntegrationService) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => GoogleIntegrations.disconnect(service),
    onSuccess: (resp) => {
      qc.setQueryData(qk.google.integration(service), resp);
      void qc.invalidateQueries({ queryKey: qk.google.integration(service) });
      void qc.invalidateQueries({ queryKey: qk.users.me() });
    },
  });
}
