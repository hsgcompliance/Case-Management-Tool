"use client";
import React from "react";
import { TasksDueModal } from "@entities/dialogs/tasks/TasksDueModal";

type OpenOptions = {
  clientId?: string;
  customerName?: string;
};

type Ctx = {
  openTasksDueModal: (opts?: OpenOptions) => void;
  closeTasksDueModal: () => void;
};

const TasksDueModalContext = React.createContext<Ctx | null>(null);

export function TasksDueModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<OpenOptions>({});

  const openTasksDueModal = React.useCallback((opts?: OpenOptions) => {
    setFilter(opts || {});
    setIsOpen(true);
  }, []);

  const closeTasksDueModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({ openTasksDueModal, closeTasksDueModal }),
    [openTasksDueModal, closeTasksDueModal],
  );

  return (
    <TasksDueModalContext.Provider value={value}>
      {children}
      <TasksDueModal
        isOpen={isOpen}
        clientId={filter.clientId}
        customerName={filter.customerName}
        onClose={closeTasksDueModal}
      />
    </TasksDueModalContext.Provider>
  );
}

export function useTasksDueModal(): Ctx {
  const ctx = React.useContext(TasksDueModalContext);
  if (!ctx) {
    // Safe no-op fallback so consumers never crash if the provider is missing
    // (e.g. component rendered outside the app shell in a test).
    return { openTasksDueModal: () => {}, closeTasksDueModal: () => {} };
  }
  return ctx;
}
