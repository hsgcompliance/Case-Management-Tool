"use client";

import React from "react";
import { useSetCustomerCaseManager } from "@hooks/useCustomers";
import { useEnrollmentsPatch } from "@hooks/useEnrollments";
import { getInboxDetailKind, type InboxDetailKind } from "@hooks/useInboxDetail";
import { usePaymentsSpend, usePaymentsUpdateCompliance } from "@hooks/usePayments";
import {
  useTaskOtherStatus,
  useTaskOtherUpdate,
  useTasksUpdateFields,
  useTasksUpdateStatus,
} from "@hooks/useTasks";
import { useSetUserActive, useUsers } from "@hooks/useUsers";

export type InboxTaskRow = {
  id?: string;
  utid?: string;
  dueDate?: string;
  title?: string;
  source?: string;
  sourcePath?: string;
  assignedToGroup?: string | null;
  assignedToUid?: string | null;
  customerId?: string | null;
  clientId?: string | null;
  status?: string;
  note?: string | null;
  notes?: string | null;
  subtitle?: string | null;
  [key: string]: unknown;
};

export type InboxTaskSourceKind = "task" | "other" | "unsupported";

export type InboxTaskActions = {
  kind: InboxDetailKind;
  sourceKind: InboxTaskSourceKind;
  canComplete: boolean;
  canReopen: boolean;
  canVerify: boolean;
  canSaveNote: boolean;
  canAssignCaseManager: boolean;
  canUpdateCompliance: boolean;
  canMarkPaid: boolean;
  canApproveUser: boolean;
  blockedStatusReason: string | null;
  complete?: () => Promise<void>;
  reopen?: () => Promise<void>;
  verify?: () => Promise<void>;
  saveNote?: (note: string) => Promise<void>;
  assignCaseManager?: (uid: string | null) => Promise<void>;
  updateCompliance?: (patch: { hmisComplete?: boolean; caseworthyComplete?: boolean }) => Promise<void>;
  markPaid?: (paid: boolean) => Promise<void>;
  approveUser?: () => Promise<void>;
};

function noOpActionSet(kind: InboxDetailKind, source: InboxTaskSourceKind, reason: string | null): InboxTaskActions {
  return {
    kind,
    sourceKind: source,
    canComplete: false,
    canReopen: false,
    canVerify: false,
    canSaveNote: false,
    canAssignCaseManager: false,
    canUpdateCompliance: false,
    canMarkPaid: false,
    canApproveUser: false,
    blockedStatusReason: reason,
  };
}

export function inboxIdOf(row: InboxTaskRow): string {
  return String(row.utid || row.id || "");
}

export function parseTaskRef(row: InboxTaskRow): { enrollmentId: string; taskId: string } | null {
  const utid = String(row.utid || row.id || "");
  if (!utid.startsWith("task|")) return null;
  const parts = utid.split("|");
  if (parts.length < 3) return null;
  return { enrollmentId: String(parts[1] || ""), taskId: String(parts[2] || "") };
}

export function parseOtherId(row: InboxTaskRow): string | null {
  const utid = String(row.utid || row.id || "");
  if (utid.startsWith("other|")) return String(utid.split("|")[1] || "") || null;
  const sourcePath = String(row.sourcePath || "");
  const m = sourcePath.match(/otherTasks\/([^#\s]+)/);
  return m?.[1] || null;
}

export function parsePaymentRef(
  row: InboxTaskRow
): { enrollmentId: string; paymentId: string; source: "payment" | "paymentcompliance" } | null {
  const source = String(row.source || "").toLowerCase();
  const utid = String(row.utid || row.id || "");
  if (utid.startsWith("pay|") || utid.startsWith("comp|")) {
    const parts = utid.split("|");
    if (parts.length >= 3) {
      return {
        enrollmentId: String(parts[1] || ""),
        paymentId: String(parts[2] || ""),
        source: utid.startsWith("comp|") ? "paymentcompliance" : "payment",
      };
    }
  }
  const sourcePath = String(row.sourcePath || "");
  const m = sourcePath.match(/^customerEnrollments\/([^#\s]+)#payments:([^#\s]+)/);
  if (!m) return null;
  return {
    enrollmentId: String(m[1] || ""),
    paymentId: String(m[2] || ""),
    source: source === "paymentcompliance" ? "paymentcompliance" : "payment",
  };
}

export function parseAuthUid(row: InboxTaskRow): string | null {
  const sourcePath = String(row.sourcePath || "");
  const m = sourcePath.match(/^auth:([^#\s]+)/);
  return m?.[1] || null;
}

export function parseGenericInboxId(row: InboxTaskRow): string | null {
  const taskRef = parseTaskRef(row);
  if (taskRef) return null;
  const otherId = parseOtherId(row);
  if (otherId) return otherId;
  return inboxIdOf(row) || null;
}

export function sourceKind(row: InboxTaskRow): InboxTaskSourceKind {
  const src = String(row.source || "").toLowerCase();
  if (src === "task" && !!parseTaskRef(row)) return "task";
  if (parsePaymentRef(row)) return "other";
  if ((src === "other" && !!parseOtherId(row)) || !!parseGenericInboxId(row)) return "other";
  return "unsupported";
}

export function readInboxNote(row: InboxTaskRow): string {
  const val = row.note ?? row.notes ?? row.subtitle ?? "";
  return String(val || "").trim();
}

export function appendStampedInboxNote(existing: string, add: string, tag: string): string {
  const extra = String(add || "").trim();
  if (!extra) return existing;
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const line = `[${tag} ${stamp}] ${extra}`;
  return existing ? `${existing}\n${line}` : line;
}

export function appendInboxReassignNote(existing: string, add: string): string {
  return appendStampedInboxNote(existing, add, "reassign");
}

export function blockedStatusReason(row: InboxTaskRow): string | null {
  const source = String(row.source || "").toLowerCase();
  if (source === "adminenrollment") return "Assign a case manager on the enrollment to resolve this item.";
  if (source === "grantcompliance") return "Update the grant compliance checklist to resolve this item.";
  const kind = getInboxDetailKind(row as any);
  if (kind === "assessment") return "Submit the linked assessment to resolve this item.";
  if (kind === "userVerification") return "Approve the user to resolve this item.";
  return null;
}

export function canDirectlyToggleInboxStatus(row: InboxTaskRow): boolean {
  return !blockedStatusReason(row);
}

export function formatInboxActionError(e: unknown, fallback: string): string {
  const msg =
    e && typeof e === "object"
      ? String(
          (e as { meta?: { response?: { error?: unknown } }; message?: unknown }).meta?.response?.error ||
            (e as { message?: unknown }).message ||
            fallback
        )
      : fallback;
  if (msg === "previous_step_not_complete") return "A previous sequential step must be completed first.";
  if (msg === "task_verified_locked") return "This task is verified and can no longer be changed.";
  if (msg === "task_not_found") return "That task no longer exists on the enrollment.";
  if (msg === "enrollment_not_found") return "That enrollment no longer exists.";
  return msg;
}

export function useInboxTaskRegistry() {
  const updateStatus = useTasksUpdateStatus();
  const updateFields = useTasksUpdateFields();
  const otherStatus = useTaskOtherStatus();
  const updateOther = useTaskOtherUpdate();
  const spendPayment = usePaymentsSpend();
  const updatePaymentCompliance = usePaymentsUpdateCompliance();
  const patchEnrollment = useEnrollmentsPatch();
  const setCustomerCaseManager = useSetCustomerCaseManager();
  const setUserActive = useSetUserActive();
  const usersQ = useUsers({ status: "all", limit: 1000 });

  const resolve = React.useCallback((row: InboxTaskRow): InboxTaskActions => {
    const kind = getInboxDetailKind(row as any);
    const srcKind = sourceKind(row);
    const taskRef = parseTaskRef(row);
    const paymentRef = parsePaymentRef(row);
    const genericId = parseGenericInboxId(row);
    const reason = blockedStatusReason(row);

    const saveTaskNote =
      taskRef
        ? async (note: string) => {
            await updateFields.mutateAsync({
              enrollmentId: taskRef.enrollmentId,
              taskId: taskRef.taskId,
              patch: { notes: note },
            } as any);
          }
        : undefined;

    const saveOtherNote =
      genericId
        ? async (note: string) => {
            await updateOther.mutateAsync({ id: genericId, patch: { notes: note } } as any);
          }
        : undefined;

    if (kind === "payment" && paymentRef) {
      return {
        kind,
        sourceKind: srcKind,
        canComplete: true,
        canReopen: true,
        canVerify: false,
        canSaveNote: false,
        canAssignCaseManager: false,
        canUpdateCompliance: true,
        canMarkPaid: true,
        canApproveUser: false,
        blockedStatusReason: null,
        complete: async () => {
          await spendPayment.mutateAsync({
            body: { enrollmentId: paymentRef.enrollmentId, paymentId: paymentRef.paymentId, reverse: false },
          });
        },
        reopen: async () => {
          await spendPayment.mutateAsync({
            body: { enrollmentId: paymentRef.enrollmentId, paymentId: paymentRef.paymentId, reverse: true },
          });
        },
        markPaid: async (paid: boolean) => {
          await spendPayment.mutateAsync({
            body: { enrollmentId: paymentRef.enrollmentId, paymentId: paymentRef.paymentId, reverse: !paid },
          });
        },
        updateCompliance: async (patch) => {
          await updatePaymentCompliance.mutateAsync({
            enrollmentId: paymentRef.enrollmentId,
            paymentId: paymentRef.paymentId,
            patch,
          });
        },
      };
    }

    if (kind === "complianceTask" && paymentRef) {
      return {
        kind,
        sourceKind: srcKind,
        canComplete: true,
        canReopen: true,
        canVerify: false,
        canSaveNote: false,
        canAssignCaseManager: false,
        canUpdateCompliance: true,
        canMarkPaid: false,
        canApproveUser: false,
        blockedStatusReason: null,
        complete: async () => {
          await updatePaymentCompliance.mutateAsync({
            enrollmentId: paymentRef.enrollmentId,
            paymentId: paymentRef.paymentId,
            patch: { status: "approved" },
          });
        },
        reopen: async () => {
          await updatePaymentCompliance.mutateAsync({
            enrollmentId: paymentRef.enrollmentId,
            paymentId: paymentRef.paymentId,
            patch: { status: null },
          });
        },
        updateCompliance: async (patch) => {
          await updatePaymentCompliance.mutateAsync({
            enrollmentId: paymentRef.enrollmentId,
            paymentId: paymentRef.paymentId,
            patch,
          });
        },
      };
    }

    if (kind === "customer") {
      const enrollmentId = String((row as any)?.enrollmentId || "").trim();
      const customerId = String((row.customerId || row.clientId || "")).trim();
      return {
        ...noOpActionSet(kind, srcKind, reason),
        canAssignCaseManager: !!enrollmentId,
        assignCaseManager:
          enrollmentId
            ? async (uid: string | null) => {
                if (!uid) return;
                const selectedUser = (usersQ.data || []).find((u) => String(u?.uid || "") === uid);
                await Promise.all([
                  customerId
                    ? setCustomerCaseManager.mutateAsync({
                        id: customerId,
                        caseManagerId: uid,
                        caseManagerName: null,
                      })
                    : Promise.resolve(),
                  patchEnrollment.mutateAsync({
                    id: enrollmentId,
                    patch: {
                      caseManagerId: uid,
                      caseManagerName:
                        String(selectedUser?.displayName || selectedUser?.email || "").trim() || null,
                    },
                  } as any),
                ]);
              }
            : undefined,
      };
    }

    if (kind === "userVerification") {
      const uid = parseAuthUid(row);
      return {
        ...noOpActionSet(kind, srcKind, reason),
        canApproveUser: !!genericId,
        approveUser:
          genericId
            ? async () => {
                if (uid) await setUserActive.mutateAsync({ uid, active: true });
                await otherStatus.mutateAsync({ id: genericId, action: "complete" });
              }
            : undefined,
      };
    }

    if (kind === "assessment") {
      return {
        ...noOpActionSet(kind, srcKind, reason),
        canSaveNote: !!saveTaskNote || !!saveOtherNote,
        saveNote: saveTaskNote || saveOtherNote,
      };
    }

    if (kind === "grantCompliance") {
      return noOpActionSet(kind, srcKind, reason);
    }

    if (taskRef) {
      return {
        kind,
        sourceKind: srcKind,
        canComplete: !reason,
        canReopen: !reason,
        canVerify: kind !== "assessment",
        canSaveNote: true,
        canAssignCaseManager: false,
        canUpdateCompliance: false,
        canMarkPaid: false,
        canApproveUser: false,
        blockedStatusReason: reason,
        complete: !reason
          ? async () => {
              await updateStatus.mutateAsync({
                enrollmentId: taskRef.enrollmentId,
                taskId: taskRef.taskId,
                action: "complete",
              });
            }
          : undefined,
        reopen: !reason
          ? async () => {
              await updateStatus.mutateAsync({
                enrollmentId: taskRef.enrollmentId,
                taskId: taskRef.taskId,
                action: "reopen",
              });
            }
          : undefined,
        verify: kind !== "assessment"
          ? async () => {
              await updateStatus.mutateAsync({
                enrollmentId: taskRef.enrollmentId,
                taskId: taskRef.taskId,
                action: "verify",
              } as any);
            }
          : undefined,
        saveNote: saveTaskNote,
      };
    }

    if (genericId) {
      return {
        kind,
        sourceKind: srcKind,
        canComplete: !reason,
        canReopen: !reason,
        canVerify: false,
        canSaveNote: true,
        canAssignCaseManager: false,
        canUpdateCompliance: false,
        canMarkPaid: false,
        canApproveUser: false,
        blockedStatusReason: reason,
        complete: !reason
          ? async () => {
              await otherStatus.mutateAsync({ id: genericId, action: "complete" });
            }
          : undefined,
        reopen: !reason
          ? async () => {
              await otherStatus.mutateAsync({ id: genericId, action: "reopen" });
            }
          : undefined,
        saveNote: saveOtherNote,
      };
    }

    return noOpActionSet(kind, srcKind, reason);
  }, [
    otherStatus,
    patchEnrollment,
    setCustomerCaseManager,
    setUserActive,
    spendPayment,
    updateFields,
    updateOther,
    updatePaymentCompliance,
    updateStatus,
    usersQ.data,
  ]);

  return React.useMemo(() => ({
    resolve,
    pending: {
      updateStatus: updateStatus.isPending,
      updateFields: updateFields.isPending,
      otherStatus: otherStatus.isPending,
      updateOther: updateOther.isPending,
      spendPayment: spendPayment.isPending,
      updatePaymentCompliance: updatePaymentCompliance.isPending,
      patchEnrollment: patchEnrollment.isPending,
      setCustomerCaseManager: setCustomerCaseManager.isPending,
      setUserActive: setUserActive.isPending,
    },
  }), [
    otherStatus.isPending,
    patchEnrollment.isPending,
    resolve,
    setCustomerCaseManager.isPending,
    setUserActive.isPending,
    spendPayment.isPending,
    updateFields.isPending,
    updateOther.isPending,
    updatePaymentCompliance.isPending,
    updateStatus.isPending,
  ]);
}
