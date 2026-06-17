"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { Orgs, type OrgConfigDoc, type OrgDoc } from "@client/orgs";
import { toast } from "@lib/toast";
import { isDevLike } from "@lib/roles";

const ORG_QK = (orgId: string) => ["orgs", orgId] as const;
const DISPLAY_CONFIG_QK = ["orgConfig", "displayConfig"] as const;

export type OrgConfigDocsByKind = {
  display: OrgConfigDoc[];
  system: OrgConfigDoc[];
  email_template: OrgConfigDoc[];
};

type OrgConfigDashboardContextValue = {
  profile: ReturnType<typeof useAuth>["profile"];
  isDev: boolean;
  targetOrgId: string;
  setTargetOrgId: (next: string) => void;
  org: OrgDoc | null;
  configDocs: OrgConfigDoc[];
  docsByKind: OrgConfigDocsByKind;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  patchConfigDoc: (configId: string, patch: Record<string, unknown>) => Promise<void>;
  createOrg: (id: string, name: string) => Promise<OrgDoc>;
  deleteCurrentOrg: () => Promise<void>;
  isCreatingOrg: boolean;
  isDeletingOrg: boolean;
};

const OrgConfigDashboardContext = React.createContext<OrgConfigDashboardContextValue | null>(null);

function groupDocs(configDocs: OrgConfigDoc[]): OrgConfigDocsByKind {
  return configDocs.reduce<OrgConfigDocsByKind>(
    (acc, doc) => {
      if (doc.kind === "display") acc.display.push(doc);
      if (doc.kind === "system") acc.system.push(doc);
      if (doc.kind === "email_template") acc.email_template.push(doc);
      return acc;
    },
    { display: [], system: [], email_template: [] },
  );
}

export function OrgConfigDashboardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isDev = isDevLike(profile as { topRole?: unknown; role?: unknown; roles?: unknown } | null);
  const [targetOrgId, setTargetOrgId] = React.useState("");

  const orgQ = useQuery({
    queryKey: [...ORG_QK(targetOrgId || "my"), targetOrgId],
    queryFn: () => Orgs.get(targetOrgId || undefined),
    select: (r) => r.org,
    retry: false,
  });

  const org = orgQ.data ?? null;
  const configDocs = React.useMemo(
    () => (org?.config ? Object.values(org.config).sort((a, b) => a.label.localeCompare(b.label)) : []),
    [org?.config],
  );
  const docsByKind = React.useMemo(() => groupDocs(configDocs), [configDocs]);

  const patchMutation = useMutation({
    mutationFn: async ({ configId, patch }: { configId: string; patch: Record<string, unknown> }) => {
      await Orgs.configPatch(configId, patch, org?.id);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orgs"] }),
        qc.invalidateQueries({ queryKey: DISPLAY_CONFIG_QK }),
      ]);
      await orgQ.refetch();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const result = await Orgs.create(id, name);
      return result.org;
    },
    onSuccess: async (createdOrg) => {
      setTargetOrgId(createdOrg.id);
      await qc.invalidateQueries({ queryKey: ["orgs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("No org is loaded.");
      await Orgs.delete(org.id);
    },
    onSuccess: async () => {
      setTargetOrgId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orgs"] }),
        qc.invalidateQueries({ queryKey: DISPLAY_CONFIG_QK }),
      ]);
    },
  });

  const value = React.useMemo<OrgConfigDashboardContextValue>(
    () => ({
      profile,
      isDev,
      targetOrgId,
      setTargetOrgId,
      org,
      configDocs,
      docsByKind,
      isLoading: orgQ.isLoading,
      isError: orgQ.isError,
      error: orgQ.error,
      refetch: () => {
        void orgQ.refetch();
      },
      patchConfigDoc: async (configId, patch) => {
        await patchMutation.mutateAsync({ configId, patch });
      },
      createOrg: async (id, name) => createMutation.mutateAsync({ id, name }),
      deleteCurrentOrg: async () => {
        await deleteMutation.mutateAsync();
      },
      isCreatingOrg: createMutation.isPending,
      isDeletingOrg: deleteMutation.isPending,
    }),
    [
      profile,
      isDev,
      targetOrgId,
      org,
      configDocs,
      docsByKind,
      orgQ.isLoading,
      orgQ.isError,
      orgQ.error,
      orgQ.refetch,
      patchMutation,
      createMutation,
      deleteMutation,
    ],
  );

  return <OrgConfigDashboardContext.Provider value={value}>{children}</OrgConfigDashboardContext.Provider>;
}

export function useOrgConfigDashboard() {
  const ctx = React.useContext(OrgConfigDashboardContext);
  if (!ctx) throw new Error("useOrgConfigDashboard must be used inside OrgConfigDashboardProvider");
  return ctx;
}

export function useOrgConfigToasts() {
  return React.useMemo(
    () => ({
      success: (message: string) => toast(message, { type: "success" }),
      error: (message: string) => toast(message, { type: "error" }),
    }),
    [],
  );
}

