// web/src/features/grants/GrantWorkspaceModal.tsx
"use client";

import React from "react";
import { useGrants } from "@hooks/useGrants";
import type { TGrant as Grant } from "@types";
import FullPageModal from "@entities/ui/FullPageModal";
import GrantDetailModal from "./GrantModal";

type Props = {
  grantId: string | null;
  onClose: () => void;
  initialCreateData?: Partial<Grant>;
  canAdminDelete?: boolean;
  onCreated?: (id: string) => void;
};

export default function GrantWorkspaceModal({
  grantId,
  onClose,
  initialCreateData,
  canAdminDelete = false,
  onCreated,
}: Props) {
  // Minimal fetch just for the breadcrumb name
  const { data: activeData = [] } = useGrants(
    { active: true, limit: 300 },
    { enabled: !!grantId && grantId !== "new", staleTime: 60_000 },
  );

  const breadcrumbLabel = React.useMemo(() => {
    if (!grantId || grantId === "new") return "New Grant";
    const hit = (activeData as Grant[]).find((g) => String(g.id || "") === grantId);
    return String(hit?.name || hit?.id || grantId);
  }, [grantId, activeData]);

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      hideSidebar
      leftPane={null}
      topBar={
        <div className="workspace-breadcrumb">
          <button type="button" className="workspace-breadcrumb-back" onClick={onClose}>
            &larr; Grants
          </button>
          <span className="workspace-breadcrumb-sep">/</span>
          <span className="workspace-breadcrumb-current">{breadcrumbLabel}</span>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto p-6 md:p-8">
          <GrantDetailModal
            grantId={grantId}
            onClose={onClose}
            initialCreateData={initialCreateData}
            canAdminDelete={canAdminDelete}
            onCreated={onCreated}
            pageMode
          />
        </div>
      }
      disableOverlayClose={false}
    />
  );
}
