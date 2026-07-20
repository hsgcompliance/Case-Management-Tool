// web/src/entities/dialogs/tasks/TasksDueModal.tsx
"use client";
import React from "react";
import { Modal } from "@entities/ui/Modal";
import { useAuth } from "@app/auth/AuthProvider";
import { isViewerLike } from "@lib/roles";
import { useMyTasksDue } from "@hooks/useInbox";
import { useCustomersAll } from "@hooks/useCustomers";
import { useTaskOtherCreate, useTaskOtherStatus, useTasksUpdateStatus } from "@hooks/useTasks";
import type { InboxItem, TCustomer as Customer } from "@types";

type Props = {
  isOpen: boolean;
  clientId?: string;
  customerName?: string;
  onClose: () => void;
};

type GroupOption = "" | "admin" | "casemanager" | "compliance";

function customerLabel(c: Customer): string {
  const name = String((c as any)?.name || "").trim();
  if (name) return name;
  const parts = [String((c as any)?.firstName || "").trim(), String((c as any)?.lastName || "").trim()].filter(
    Boolean,
  );
  return parts.join(" ") || "Unnamed customer";
}

function parseTaskUtid(utid: string): { enrollmentId: string; taskId: string } | null {
  const parts = String(utid || "").split("|");
  if (parts.length < 3 || parts[0] !== "task") return null;
  return { enrollmentId: parts[1], taskId: parts.slice(2).join("|") };
}

export function TasksDueModal({ isOpen, clientId, customerName, onClose }: Props) {
  const { profile } = useAuth();
  const isRestrictedViewer = isViewerLike(profile as any);
  const taskMode = String((profile as any)?.extras?.taskMode || (profile as any)?.taskMode || "workflow");
  const canMarkDone = !isRestrictedViewer && taskMode !== "viewer";
  const canCreate = !isRestrictedViewer;

  // The modal is mounted once at the app root (so it can be opened from anywhere),
  // so gate the fetch on isOpen — otherwise it would fire on every page load,
  // including for signed-out visitors.
  const dueQ = useMyTasksDue(undefined, { enabled: isOpen });
  const items = (dueQ.data || []) as InboxItem[];
  const rows = React.useMemo(() => {
    const openItems = items.filter((i) => i.status !== "done");
    const scoped = clientId ? openItems.filter((i) => i.clientId === clientId) : openItems;
    return [...scoped].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  }, [items, clientId]);

  const updateTaskStatus = useTasksUpdateStatus();
  const updateOtherStatus = useTaskOtherStatus();

  const markDone = (item: InboxItem) => {
    if (item.source === "task") {
      const parsed = parseTaskUtid(item.utid);
      if (!parsed) return;
      updateTaskStatus.mutate({ enrollmentId: parsed.enrollmentId, taskId: parsed.taskId, action: "complete" });
    } else if (item.source === "other") {
      const otherId = String((item as any).sourceId || item.utid.replace(/^other\|/, ""));
      updateOtherStatus.mutate({ id: otherId, action: "complete" });
    }
  };

  // --- Create form ---
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [group, setGroup] = React.useState<GroupOption>("");
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [selectedCustomer, setSelectedCustomer] = React.useState<{ id: string; label: string } | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const customersQ = useCustomersAll(undefined, { enabled: showCreate });
  const customerMatches = React.useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    const all = customersQ.data || [];
    return all.filter((c) => customerLabel(c).toLowerCase().includes(q)).slice(0, 8);
  }, [customerQuery, customersQ.data]);

  const createTask = useTaskOtherCreate();

  const resetCreateForm = React.useCallback(() => {
    setTitle("");
    setNotes("");
    setDueDate("");
    setGroup("");
    setCustomerQuery("");
    setSelectedCustomer(null);
  }, []);

  // Reset per-open state, and preset the customer link when opened from a customer card bubble.
  React.useEffect(() => {
    if (!isOpen) return;
    resetCreateForm();
    setShowCreate(false);
    if (clientId) setSelectedCustomer({ id: clientId, label: customerName || "This customer" });
  }, [isOpen, clientId, customerName, resetCreateForm]);

  const canSubmit = title.trim().length > 0 && dueDate.trim().length > 0;

  const handleCreate = async () => {
    if (!canSubmit || createTask.isPending) return;
    await createTask.mutateAsync({
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate,
      notify: true,
      customerId: selectedCustomer?.id || null,
      assign: group ? { group } : undefined,
    });
    resetCreateForm();
    setShowCreate(false);
  };

  const heading = clientId ? `Tasks due for ${customerName || "this customer"}` : "Tasks due this month";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={heading}
      widthClass="max-w-xl"
      tourId="tasks-due-modal"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {canCreate ? (
            <button className="btn-secondary" onClick={() => setShowCreate((v) => !v)} data-tour="tasks-due-modal-new">
              {showCreate ? "Cancel" : "+ New Task"}
            </button>
          ) : (
            <span />
          )}
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm" data-tour="tasks-due-modal-content">
        {showCreate && canCreate ? (
          <div
            className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
            data-tour="tasks-due-modal-create"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Title</label>
              <input
                type="text"
                className="w-full rounded border px-2 py-1"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                placeholder="e.g. Follow up on lease renewal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Notes (optional)</label>
              <textarea
                className="w-full rounded border px-2 py-1"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Due date</label>
              <input
                type="date"
                className="w-full rounded border px-2 py-1"
                value={dueDate}
                onChange={(e) => setDueDate(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Customer (optional)</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span>{selectedCustomer.label}</span>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-800"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded border px-2 py-1"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.currentTarget.value)}
                    placeholder="Search customers by name…"
                  />
                  {customerMatches.length > 0 ? (
                    <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {customerMatches.map((c) => (
                        <button
                          key={String(c.id)}
                          type="button"
                          className="block w-full px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => {
                            setSelectedCustomer({ id: String(c.id), label: customerLabel(c) });
                            setCustomerQuery("");
                          }}
                        >
                          {customerLabel(c)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Group (optional)</label>
              <select
                className="w-full rounded border px-2 py-1"
                value={group}
                onChange={(e) => setGroup(e.currentTarget.value as GroupOption)}
              >
                <option value="">— none —</option>
                <option value="admin">Admin</option>
                <option value="casemanager">Case Manager</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                className="btn-primary disabled:opacity-50"
                disabled={!canSubmit || createTask.isPending}
                onClick={handleCreate}
              >
                {createTask.isPending ? "Creating…" : "Create Task"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2" data-tour="tasks-due-modal-list">
          {dueQ.isLoading ? (
            <div className="text-slate-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-slate-500">No tasks due{clientId ? " for this customer" : " this month"}.</div>
          ) : (
            rows.map((item) => (
              <div
                key={item.utid}
                className="flex items-start justify-between gap-3 rounded border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.title}</div>
                  {!clientId && item.customerName ? (
                    <div className="text-xs text-slate-500">{String(item.customerName)}</div>
                  ) : null}
                  {item.subtitle ? <div className="text-xs text-slate-500">{item.subtitle}</div> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-500">{item.dueDate || "—"}</span>
                  {canMarkDone && (item.source === "task" || item.source === "other") ? (
                    <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <input type="checkbox" onChange={() => markDone(item)} />
                      Mark done
                    </label>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TasksDueModal;
