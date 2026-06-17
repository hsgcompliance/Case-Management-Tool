"use client";

import React from "react";
import {
  DEFAULT_REPORT_SOURCE_PROFILES,
  buildReconciliationPacket,
  type ReconciliationPacket,
  type ReportSourceProfile,
} from "./reportProfiles";
import { parseReportFilePreview, type ParsedReportPreview } from "./reportFilePreview";

const ACTIVE_PROFILE_IDS = [
  "financial_edge_project_activity",
  "coordinated_entry_by_name_list",
  "hmis_service_payment_report",
  "caseworthy_service_report",
] as const;

type ReconciliationWorkspaceValue = {
  profiles: ReportSourceProfile[];
  packets: ReconciliationPacket[];
  lastPreview: ParsedReportPreview | null;
  error: string | null;
  reading: boolean;
  addFile: (file: File | null, preferredProfileId?: string) => Promise<void>;
  removePacket: (packetKey: string) => void;
  clearPackets: () => void;
};

const ReconciliationWorkspaceContext = React.createContext<ReconciliationWorkspaceValue | null>(null);

export function getReconciliationProfiles() {
  return DEFAULT_REPORT_SOURCE_PROFILES.filter((profile) => ACTIVE_PROFILE_IDS.includes(profile.id as (typeof ACTIVE_PROFILE_IDS)[number]));
}

export function reconciliationPacketKey(packet: ReconciliationPacket) {
  return `${packet.profileId}:${packet.sourceFile}:${packet.headerRowIndex}`;
}

export function ReconciliationWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const profiles = React.useMemo(() => getReconciliationProfiles(), []);
  const [packets, setPackets] = React.useState<ReconciliationPacket[]>([]);
  const [lastPreview, setLastPreview] = React.useState<ParsedReportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);

  const addFile = React.useCallback(
    async (file: File | null, preferredProfileId?: string) => {
      if (!file) return;
      setReading(true);
      setError(null);
      try {
        const preview = await parseReportFilePreview(file, profiles);
        const preferred = profiles.find((profile) => profile.id === preferredProfileId) ?? null;
        const profile = preview.profileCandidates.find((candidate) => candidate.profile.id === preferred?.id)?.profile
          ?? preview.profileCandidates[0]?.profile
          ?? preferred
          ?? profiles[0];
        const packet = buildReconciliationPacket({
          profile,
          headers: preview.headers,
          rows: preview.sampleRows,
          sourceFile: preview.fileName,
          headerRowIndex: preview.headerRowIndex,
        });
        setLastPreview(preview);
        setPackets((prev) => {
          const key = reconciliationPacketKey(packet);
          return [packet, ...prev.filter((item) => reconciliationPacketKey(item) !== key)].slice(0, 12);
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unable to parse this report.");
      } finally {
        setReading(false);
      }
    },
    [profiles],
  );

  const value = React.useMemo<ReconciliationWorkspaceValue>(
    () => ({
      profiles,
      packets,
      lastPreview,
      error,
      reading,
      addFile,
      removePacket: (packetKey) => setPackets((prev) => prev.filter((packet) => reconciliationPacketKey(packet) !== packetKey)),
      clearPackets: () => setPackets([]),
    }),
    [addFile, error, lastPreview, packets, profiles, reading],
  );

  return <ReconciliationWorkspaceContext.Provider value={value}>{children}</ReconciliationWorkspaceContext.Provider>;
}

export function useReconciliationWorkspace() {
  const ctx = React.useContext(ReconciliationWorkspaceContext);
  if (!ctx) throw new Error("useReconciliationWorkspace must be used inside ReconciliationWorkspaceProvider");
  return ctx;
}
