"use client";

import React from "react";
import TaskReassignDialog from "@entities/dialogs/tasks/TaskReassignDialog";
import type { TaskReassignTarget } from "@entities/selectors/TaskReassignSelect";
import { usePageLayout } from "../client";

type TaskReassignPayload = { target: TaskReassignTarget; note: string };
type TaskReassignRequest = {
  title?: string;
  onSubmit: (payload: TaskReassignPayload) => Promise<void> | void;
};

type ToolModalState =
  | { kind: "none" }
  | {
      kind: "taskReassign";
      request: TaskReassignRequest;
    };

type DashboardToolModalContextValue = {
  openTaskReassign: (request: TaskReassignRequest) => void;
  closeModal: () => void;
};

const DashboardToolModalContext = React.createContext<DashboardToolModalContextValue | null>(null);

export function DashboardToolModalProvider({ children }: { children: React.ReactNode }) {
  const { state } = usePageLayout();
  const [modal, setModal] = React.useState<ToolModalState>({ kind: "none" });
  const [submitting, setSubmitting] = React.useState(false);

  const closeModal = React.useCallback(() => {
    if (submitting) return;
    setModal({ kind: "none" });
  }, [submitting]);

  const openTaskReassign = React.useCallback((request: TaskReassignRequest) => {
    setModal({ kind: "taskReassign", request });
  }, []);

  React.useEffect(() => {
    setModal({ kind: "none" });
  }, [state.activeToolId]);

  const onSubmitTaskReassign = React.useCallback(
    async (payload: TaskReassignPayload) => {
      if (modal.kind !== "taskReassign") return;
      setSubmitting(true);
      try {
        await modal.request.onSubmit(payload);
        setModal({ kind: "none" });
      } finally {
        setSubmitting(false);
      }
    },
    [modal]
  );

  const value = React.useMemo<DashboardToolModalContextValue>(
    () => ({ openTaskReassign, closeModal }),
    [openTaskReassign, closeModal]
  );

  return (
    <DashboardToolModalContext.Provider value={value}>
      {children}
      <TaskReassignDialog
        open={modal.kind === "taskReassign"}
        title={modal.kind === "taskReassign" ? modal.request.title : "Reassign Task"}
        submitting={submitting}
        onClose={closeModal}
        onSubmit={onSubmitTaskReassign}
      />
    </DashboardToolModalContext.Provider>
  );
}

export function useDashboardToolModal() {
  const ctx = React.useContext(DashboardToolModalContext);
  if (!ctx) throw new Error("useDashboardToolModal must be used within DashboardToolModalProvider");
  return ctx;
}
