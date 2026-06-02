//src/app/(protected)/grants/@modal/(.)new/page.tsx
"use client";
import React from "react";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewGrantModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedKind = searchParams.get("kind") === "program" ? "program" : "grant";
  return (
    <GrantWorkspaceModal
      grantId={null}
      initialCreateData={{ status: "draft", kind: requestedKind }}
      canAdminDelete={false}
      onClose={() => router.back()}
    />
  );
}
