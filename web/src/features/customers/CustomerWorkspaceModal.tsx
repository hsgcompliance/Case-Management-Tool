"use client";

import React from "react";
import { useCustomer } from "@hooks/useCustomers";
import FullPageModal from "@entities/ui/FullPageModal";
import CustomersModal from "./CustomersModal";

type Props = {
  customerId: string | null;
  onClose: () => void;
  initialTab?: "details" | "enrollments" | "case" | "assessments" | "tasks" | "payments" | "files";
};

function displayName(c: { name?: string; firstName?: string; lastName?: string } | null | undefined) {
  if (!c) return null;
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    null
  );
}

type CustomerWorkspaceErrorBoundaryProps = {
  children: React.ReactNode;
  resetKey: string;
};

type CustomerWorkspaceErrorBoundaryState = {
  error: Error | null;
};

class CustomerWorkspaceErrorBoundary extends React.Component<
  CustomerWorkspaceErrorBoundaryProps,
  CustomerWorkspaceErrorBoundaryState
> {
  state: CustomerWorkspaceErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CustomerWorkspaceErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("CustomerWorkspaceModal render failed:", error, info);
  }

  componentDidUpdate(prevProps: CustomerWorkspaceErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
          <div className="text-sm font-semibold">Customer page failed to load</div>
          <p className="mt-2 text-sm">
            {this.state.error.message || "An unexpected customer page error occurred."}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function CustomerWorkspaceModal({ customerId, onClose, initialTab }: Props) {
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
          <CustomerWorkspaceErrorBoundary resetKey={`${customerId || "new"}:${initialTab || ""}`}>
            <CustomersModal customerId={customerId} onClose={onClose} pageMode initialTab={initialTab} />
          </CustomerWorkspaceErrorBoundary>
        </div>
      }
      disableOverlayClose={false}
    />
  );
}
