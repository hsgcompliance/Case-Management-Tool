"use client";
import React from "react";
import { useRouter, useParams } from "next/navigation";
import CustomersModal from "@features/customers/CustomersModal";

export default function CustomerModalOnCaseManagersClient() {
  const router = useRouter();
  const { customerId } = useParams<{ customerId: string }>();
  return <CustomersModal customerId={customerId} onClose={() => router.back()} />;
}
