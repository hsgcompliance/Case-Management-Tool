"use client";

import React from "react";
import {
  DEFAULT_REPORT_SOURCE_PROFILES,
  buildReconciliationPacket,
  deriveHeadersAndRows,
  type ReconciliationPacket,
  type ReportSourceProfile,
} from "./reportProfiles";
import {
  MAX_RECONCILIATION_ROWS,
  parseReportFilePreview,
  type ParsedReportPreview,
} from "./reportFilePreview";
import type { ReportUpload, ReportUploadConfig } from "@entities/report-upload/ReportUploadPanel";

const ACTIVE_PROFILE_IDS = [
  "financial_edge_project_activity",
  "coordinated_entry_by_name_list",
  "hmis_service_payment_report",
  "caseworthy_service_report",
] as const;

type ReconciliationWorkspaceValue = {
  profiles: ReportSourceProfile[];
  uploads: ReportUpload[];
  /** Live packets derived from each upload's current mapping config. */
  packets: ReconciliationPacket[];
  error: string | null;
  reading: boolean;
  addFiles: (files: FileList | File[] | null) => Promise<void>;
  updateUploadConfig: (id: string, patch: Partial<ReportUploadConfig>) => void;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
};

const ReconciliationWorkspaceContext = React.createContext<ReconciliationWorkspaceValue | null>(null);

export function getReconciliationProfiles() {
  return DEFAULT_REPORT_SOURCE_PROFILES.filter((profile) => ACTIVE_PROFILE_IDS.includes(profile.id as (typeof ACTIVE_PROFILE_IDS)[number]));
}

export function reconciliationPacketKey(packet: ReconciliationPacket) {
  return `${packet.profileId}:${packet.sourceFile}:${packet.headerRowIndex}`;
}

function buildPacketForUpload(
  profiles: ReportSourceProfile[],
  fileName: string,
  allRows: unknown[][],
  config: ReportUploadConfig,
): ReconciliationPacket {
  const profile = profiles.find((item) => item.id === config.profileId) ?? profiles[0];
  const { headers, dataRows, headerRowIndex } = deriveHeadersAndRows(allRows, config.headerRowIndex);
  return buildReconciliationPacket({
    profile,
    headers,
    rows: dataRows,
    sourceFile: fileName,
    headerRowIndex,
    fieldOverrides: config.fieldOverrides,
  });
}

function uploadFromPreview(profiles: ReportSourceProfile[], preview: ParsedReportPreview): ReportUpload {
  const config: ReportUploadConfig = {
    profileId: preview.profileCandidates[0]?.profile.id ?? profiles[0]?.id ?? "",
    headerRowIndex: preview.headerRowIndex,
    fieldOverrides: {},
  };
  return {
    id: `${preview.fileName}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    fileName: preview.fileName,
    sheetName: preview.sheetName,
    allRows: preview.allRows,
    profileCandidates: preview.profileCandidates.map((candidate) => ({ profile: candidate.profile, score: candidate.score })),
    config,
    packet: buildPacketForUpload(profiles, preview.fileName, preview.allRows, config),
  };
}

export function ReconciliationWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const profiles = React.useMemo(() => getReconciliationProfiles(), []);
  const [uploads, setUploads] = React.useState<ReportUpload[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);

  const addFiles = React.useCallback(
    async (files: FileList | File[] | null) => {
      const arr = Array.from(files ?? []).filter((file): file is File => Boolean(file));
      if (!arr.length) return;
      setReading(true);
      setError(null);
      const created: ReportUpload[] = [];
      const errors: string[] = [];
      for (const file of arr) {
        try {
          const preview = await parseReportFilePreview(file, profiles, { maxRows: MAX_RECONCILIATION_ROWS });
          created.push(uploadFromPreview(profiles, preview));
        } catch (e: unknown) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "Unable to parse this report."}`);
        }
      }
      if (created.length) setUploads((prev) => [...created, ...prev].slice(0, 12));
      setError(errors.length ? errors.join(" · ") : null);
      setReading(false);
    },
    [profiles],
  );

  const updateUploadConfig = React.useCallback(
    (id: string, patch: Partial<ReportUploadConfig>) => {
      setUploads((prev) =>
        prev.map((upload) => {
          if (upload.id !== id) return upload;
          const config = { ...upload.config, ...patch };
          return { ...upload, config, packet: buildPacketForUpload(profiles, upload.fileName, upload.allRows, config) };
        }),
      );
    },
    [profiles],
  );

  const value = React.useMemo<ReconciliationWorkspaceValue>(
    () => ({
      profiles,
      uploads,
      packets: uploads.map((upload) => upload.packet),
      error,
      reading,
      addFiles,
      updateUploadConfig,
      removeUpload: (id) => setUploads((prev) => prev.filter((upload) => upload.id !== id)),
      clearUploads: () => setUploads([]),
    }),
    [addFiles, error, profiles, reading, updateUploadConfig, uploads],
  );

  return <ReconciliationWorkspaceContext.Provider value={value}>{children}</ReconciliationWorkspaceContext.Provider>;
}

export function useReconciliationWorkspace() {
  const ctx = React.useContext(ReconciliationWorkspaceContext);
  if (!ctx) throw new Error("useReconciliationWorkspace must be used inside ReconciliationWorkspaceProvider");
  return ctx;
}
