"use client";
import React from "react";
import { useRouter, useParams } from "next/navigation";
import CustomerWorkspaceModal from "@features/customers/CustomerWorkspaceModal";

export default function CustomersModalRouteClient() {
  const router = useRouter();
  const { customerId } = useParams<{ customerId: string }>();
  return <CustomerWorkspaceModal customerId={customerId} onClose={() => router.back()} />;
}
