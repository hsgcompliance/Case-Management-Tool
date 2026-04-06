"use client";

import React, { useEffect, useRef } from "react";

type FullPageModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  onBeforeClose?: () => Promise<boolean> | boolean;
  topBar?: React.ReactNode;
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  leftWidthClass?: string;
  hideSidebar?: boolean;
  disableOverlayClose?: boolean;
  disableEscClose?: boolean;
  tourId?: string;
};

export function FullPageModal({
  isOpen,
  onClose = () => {},
  onBeforeClose,
  topBar,
  leftPane,
  rightPane,
  leftWidthClass = "w-[360px]",
  hideSidebar = false,
  disableOverlayClose = false,
  disableEscClose = false,
  tourId,
}: FullPageModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const attemptClose = async () => {
    const ok = (await onBeforeClose?.()) ?? true;
    if (ok) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prevFocusRef.current?.focus?.();
      prevFocusRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || disableEscClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, disableEscClose, onBeforeClose, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 p-2 backdrop-blur-sm md:p-4"
      data-tour={tourId ? `${tourId}-overlay` : undefined}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (disableOverlayClose) return;
        if (e.target === overlayRef.current) attemptClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="workspace-modal-shell"
        data-tour={tourId}
      >
        {topBar ? <div className="workspace-modal-topbar" data-tour={tourId ? `${tourId}-topbar` : undefined}>{topBar}</div> : null}
        <div className="workspace-modal-body" data-tour={tourId ? `${tourId}-body` : undefined}>
          {!hideSidebar && (
            <aside
              className={`workspace-modal-left ${leftWidthClass}`}
              data-tour={tourId ? `${tourId}-left` : undefined}
            >
              {leftPane}
            </aside>
          )}
          <section className="workspace-modal-right" data-tour={tourId ? `${tourId}-right` : undefined}>
            {rightPane}
          </section>
        </div>
      </div>
    </div>
  );
}

export default FullPageModal;
