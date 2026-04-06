"use client";
import React from "react";
import { useRouter, useParams } from "next/navigation";
import GrantWorkspaceModal from "@features/grants/GrantWorkspaceModal";

export default function GrantModalClient() {
  const router = useRouter();
  const { grantId } = useParams<{ grantId: string }>();
  return (
    <GrantWorkspaceModal
      grantId={grantId}
      canAdminDelete={false}
      onClose={() => router.back()}
    />
  );
}
