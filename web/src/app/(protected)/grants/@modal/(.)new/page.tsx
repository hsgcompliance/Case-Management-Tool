//src/app/(protected)/grants/@modal/(.)new/page.tsx
"use client";
import React from "react";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import { useRouter } from "next/navigation";

export default function NewGrantModal() {
  const router = useRouter();
  return (
    <GrantWorkspaceModal
      grantId={null}
      initialCreateData={{ status: "draft" }}
      canAdminDelete={false}
      onClose={() => router.back()}
    />
  );
}
