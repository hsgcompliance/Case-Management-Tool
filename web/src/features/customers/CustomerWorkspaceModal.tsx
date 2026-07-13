"use client";

import React from "react";
import { useCustomer } from "@hooks/useCustomers";
import FullPageModal from "@entities/ui/FullPageModal";
import { toast } from "@lib/toast";
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
  const [currentCustomerId, setCurrentCustomerId] = React.useState(customerId);

  React.useEffect(() => {
    setCurrentCustomerId(customerId);
  }, [customerId]);

  const { data: customer } = useCustomer(currentCustomerId ?? undefined, {
    enabled: !!currentCustomerId && currentCustomerId !== "new",
  });

  const shareCustomerLink = React.useCallback(async () => {
    if (!currentCustomerId || currentCustomerId === "new") return;
    const url = `${window.location.origin}/customers/${encodeURIComponent(currentCustomerId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Customer link copied.", { type: "success" });
    } catch {
      toast(url, { type: "info" });
    }
  }, [currentCustomerId]);

  const breadcrumbLabel = currentCustomerId === "new" || !currentCustomerId
    ? "New Customer"
    : displayName(customer as { name?: string; firstName?: string; lastName?: string } | null) ?? currentCustomerId;
  const canShare = !!currentCustomerId && currentCustomerId !== "new";

  return (
    <FullPageModal
      isOpen
      onClose={onClose}
      hideSidebar
      leftPane={null}
      topBar={
        <div className="flex w-full items-center gap-2">
          {canShare ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void shareCustomerLink()}
              title="Copy customer link"
              aria-label="Copy customer link"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 10.7 15.4 6.3" />
                <path d="M8.6 13.3 15.4 17.7" />
              </svg>
            </button>
          ) : null}
          <div className="workspace-breadcrumb min-w-0">
            <button type="button" className="workspace-breadcrumb-back" onClick={onClose}>
              &larr; Customers
            </button>
            <span className="workspace-breadcrumb-sep">/</span>
            <span className="workspace-breadcrumb-current truncate">{breadcrumbLabel}</span>
          </div>
        </div>
      }
      rightPane={
        <div className="h-full overflow-y-auto p-6 md:p-8">
          <CustomerWorkspaceErrorBoundary resetKey={`${currentCustomerId || "new"}:${initialTab || ""}`}>
            <CustomersModal
              customerId={currentCustomerId}
              onClose={onClose}
              pageMode
              initialTab={initialTab}
              onCreated={setCurrentCustomerId}
            />
          </CustomerWorkspaceErrorBoundary>
        </div>
      }
      disableOverlayClose={false}
    />
  );
}
