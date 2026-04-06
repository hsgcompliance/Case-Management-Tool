// web/src/app/(protected)/customers/@modal/(.)new/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CustomerWorkspaceModal from "@features/customers/CustomerWorkspaceModal";

export default function CustomerNewModalPage() {
  const router = useRouter();
  return <CustomerWorkspaceModal customerId={null} onClose={() => router.back()} />;
}
