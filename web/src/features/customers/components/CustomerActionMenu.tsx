"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { TCustomerEntity } from "@types";
import { Modal } from "@entities/ui/Modal";
import GrantSelect from "@entities/selectors/GrantSelect";
import { useCustomerEnrollments, useEnrollCustomer } from "@hooks/useEnrollments";
import { useSetCustomerActive, useSetCustomerTier } from "@hooks/useCustomers";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import { todayISO } from "./paymentScheduleUtils";
import { CustomerInactivePreviewDialog } from "./CustomerInactivePreviewDialog";

// Selected-state colors for the Tier 1/2/3 mini-cards / pickers.
// Tier 1 = highest risk (red) → Tier 3 = lowest (green).
// Saturated, high-contrast fills so the active tier reads at a glance on the card.
export const TIER_SELECTED_CLASS: Record<number, string> = {
  1: "border-rose-700 bg-rose-600 text-white shadow-sm dark:border-rose-500 dark:bg-rose-700 dark:text-white",
  2: "border-amber-500 bg-amber-400 text-amber-950 shadow-sm dark:border-amber-400 dark:bg-amber-500 dark:text-amber-950",
  3: "border-emerald-700 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-700 dark:text-white",
};

function displayName(customer: Pick<TCustomerEntity, "name" | "firstName" | "lastName">): string {
  return (
    (customer.name && String(customer.name).trim()) ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function isInactiveCustomer(customer: TCustomerEntity): boolean {
  if (typeof customer.active === "boolean") return !customer.active;
  const status = String(customer.status || "").trim().toLowerCase();
  return status === "inactive" || status === "closed" || status === "deleted";
}

// ── Enroll dialog ────────────────────────────────────────────────────────────

export function EnrollCustomerQuickModal({
  open,
  customerId,
  customerName,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const enrollCustomer = useEnrollCustomer();
  const [grantId, setGrantId] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState(todayISO());

  React.useEffect(() => {
    if (!open) return;
    setGrantId(null);
    setStartDate(todayISO());
  }, [open]);

  const submit = async () => {
    const gid = String(grantId || "").trim();
    if (!gid) {
      toast("Choose a program to enroll into.", { type: "error" });
      return;
    }
    if (!startDate) {
      toast("Pick a start date.", { type: "error" });
      return;
    }
    try {
      await enrollCustomer.mutateAsync({
        customerId,
        grantId: gid,
        extra: { status: "active", active: true, startDate },
      });
      toast("Customer enrolled.", { type: "success" });
      onEnrolled();
      onClose();
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to enroll customer.", { type: "error" });
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Enroll Customer"
      widthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={enrollCustomer.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void submit()}
            disabled={enrollCustomer.isPending || !grantId}
          >
            {enrollCustomer.isPending ? "Enrolling…" : "Enroll"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Enroll <span className="font-semibold">{customerName}</span> into a program. The new enrollment loads onto the card automatically.
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</span>
          <GrantSelect
            value={grantId}
            onChange={setGrantId}
            placeholderLabel="Select program"
            disabled={enrollCustomer.isPending}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</span>
          <input
            type="date"
            className="input w-full"
            value={startDate}
            onChange={(event) => setStartDate(event.currentTarget.value)}
            disabled={enrollCustomer.isPending}
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Shared menu body (used by the card right-click bar and the legacy table) ──

export type CustomerActionMenuBodyProps = {
  customerName: string;
  inactive: boolean;
  currentTier: number | null;
  canManage: boolean;
  busy?: boolean;
  onOpen: () => void;
  onToggleActive: () => void;
  onEnroll: () => void;
  onHide?: () => void;
  onSelectTier: (tier: number) => void;
};

export function CustomerActionMenuBody({
  customerName,
  inactive,
  currentTier,
  canManage,
  busy = false,
  onOpen,
  onToggleActive,
  onEnroll,
  onHide,
  onSelectTier,
}: CustomerActionMenuBodyProps) {
  return (
    <>
      <div className="border-b border-slate-100 px-3 pb-2 dark:border-slate-800">
        <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{customerName}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {inactive ? "Inactive" : "Active"}
          {currentTier ? ` · Tier ${currentTier}` : ""}
        </div>
      </div>
      <button
        type="button"
        className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={onOpen}
        role="menuitem"
      >
        Open
      </button>
      {onHide ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onHide}
          role="menuitem"
        >
          Hide
        </button>
      ) : null}
      {canManage ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onToggleActive}
          disabled={busy}
          role="menuitem"
        >
          {inactive ? "Mark active" : "Mark inactive"}
        </button>
      ) : null}
      {canManage ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-sky-50 hover:text-sky-900 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onEnroll}
          role="menuitem"
        >
          Enroll customer…
        </button>
      ) : null}
      {canManage ? (
        <>
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Tier
          </div>
          <div className="grid grid-cols-3 gap-1 px-3 pb-2">
            {[1, 2, 3].map((t) => {
              const selected = currentTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelectTier(t)}
                  disabled={busy}
                  title={selected ? `Tier ${t} — click to clear` : `Set Tier ${t}`}
                  className={[
                    "rounded-md border px-1.5 py-1 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? TIER_SELECTED_CLASS[t]
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}

// ── Table row wrapper: a three-dots button that opens the shared menu body ────

export function CustomerRowActionMenu({
  customer,
  canManage,
  onOpen,
  onChanged,
  onHide,
  openAt,
}: {
  customer: TCustomerEntity & { id: string };
  canManage: boolean;
  onOpen: () => void;
  onChanged?: () => void;
  onHide?: () => void;
  openAt?: { x: number; y: number; nonce: number } | null;
}) {
  const setActive = useSetCustomerActive();
  const setTier = useSetCustomerTier();
  const [open, setOpen] = React.useState(false);
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [inactivePreviewOpen, setInactivePreviewOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const openedFromContextMenu = React.useRef(false);

  const inactive = isInactiveCustomer(customer);
  const enrollmentsQuery = useCustomerEnrollments(customer.id, { enabled: inactivePreviewOpen && !inactive, limit: 500 });
  const currentTier = (customer as { tier?: number | null }).tier ?? null;
  const busy = setActive.isPending || setTier.isPending;

  const updateMenuPosition = React.useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 224;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuWidth - 8);
    let top = rect.bottom + 4;
    if (menuHeight && top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }
    setMenuPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => openedFromContextMenu.current ? setOpen(false) : updateMenuPosition();
    if (!openedFromContextMenu.current) updateMenuPosition();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  React.useEffect(() => {
    if (!openAt) return;
    openedFromContextMenu.current = true;
    setMenuPos({ top: openAt.y, left: openAt.x });
    setOpen(true);
  }, [openAt]);

  const toggleActive = async () => {
    try {
      await setActive.mutateAsync({ id: customer.id, active: inactive });
      toast(inactive ? "Customer marked active." : "Customer marked inactive.", { type: "success" });
      onChanged?.();
      return true;
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to update status.", { type: "error" });
      return false;
    }
  };

  const requestToggleActive = () => {
    if (inactive) {
      void toggleActive();
      return;
    }
    setInactivePreviewOpen(true);
  };

  const selectTier = async (t: number) => {
    const next = currentTier === t ? null : t;
    try {
      await setTier.mutateAsync({ id: customer.id, tier: next });
      onChanged?.();
    } catch (error: unknown) {
      toast(toApiError(error).error || "Failed to update tier.", { type: "error" });
    }
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[1300] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ top: menuPos.top, left: menuPos.left }}
          role="menu"
        >
          <CustomerActionMenuBody
            customerName={displayName(customer)}
            inactive={inactive}
            currentTier={currentTier}
            canManage={canManage}
            busy={busy}
            onOpen={() => {
              setOpen(false);
              onOpen();
            }}
            onToggleActive={() => {
              setOpen(false);
              requestToggleActive();
            }}
            onEnroll={() => {
              setOpen(false);
              setEnrollOpen(true);
            }}
            onHide={onHide ? () => {
              setOpen(false);
              onHide();
            } : undefined}
            onSelectTier={(t) => {
              setOpen(false);
              void selectTier(t);
            }}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        className="btn btn-ghost h-8 px-2"
        aria-label="Open actions"
        onClick={() => {
          openedFromContextMenu.current = false;
          if (!open) {
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 224) });
          }
          setOpen((v) => !v);
        }}
      >
        <span className="text-lg leading-none" aria-hidden="true">&#8942;</span>
      </button>
      {typeof document !== "undefined" ? menu : null}
      {enrollOpen ? (
        <EnrollCustomerQuickModal
          open
          customerId={customer.id}
          customerName={displayName(customer)}
          onClose={() => setEnrollOpen(false)}
          onEnrolled={() => onChanged?.()}
        />
      ) : null}
      <CustomerInactivePreviewDialog
        open={inactivePreviewOpen}
        customerName={displayName(customer)}
        enrollments={(enrollmentsQuery.data || []) as unknown as Record<string, unknown>[]}
        loading={enrollmentsQuery.isLoading || enrollmentsQuery.isFetching}
        busy={setActive.isPending}
        onCancel={() => setInactivePreviewOpen(false)}
        onConfirm={() => {
          void toggleActive().then((changed) => {
            if (changed) setInactivePreviewOpen(false);
          });
        }}
      />
    </div>
  );
}
