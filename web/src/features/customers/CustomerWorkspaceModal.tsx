"use client";

import React from "react";
import { useCustomer } from "@hooks/useCustomers";
import FullPageModal from "@entities/ui/FullPageModal";
import CustomersModal from "./CustomersModal";

type Props = {
  customerId: string | null;
  onClose: () => void;
};

function displayName(c: { name?: string; firstName?: string; lastName?: string } | null | undefined) {
  if (!c) return null;
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    null
  );
}

export default function CustomerWorkspaceModal({ customerId, onClose }: Props) {
  const { data: customer } = useCustomer(customerId ?? undefined, {
    enabled: !!customerId && customerId !== "new",
  });

  const breadcrumbLabel = customerId === "new" || !customerId
    ? "New Customer"
    : displayName(customer as { name?: string; firstName?: string; lastName?: string } | null) ?? customerId;

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      hideSidebar
      leftPane={null}
      topBar={
        <div className="workspace-breadcrumb">
          <button type="button" className="workspace-breadcrumb-back" onClick={onClose}>
            &larr; Customers
          </button>
          <span className="workspace-breadcrumb-sep">/</span>
          <span className="workspace-breadcrumb-current">{breadcrumbLabel}</span>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto p-6 md:p-8">
          <CustomersModal customerId={customerId} onClose={onClose} pageMode />
        </div>
      }
      disableOverlayClose={false}
    />
  );
}
