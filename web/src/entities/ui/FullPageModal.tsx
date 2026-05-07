"use client";

import React, { useEffect, useRef } from "react";
import { useModalRuntime } from "./modalRuntime";

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

  const attemptClose = async () => {
    const ok = (await onBeforeClose?.()) ?? true;
    if (ok) onClose();
  };

  useModalRuntime(isOpen, panelRef);

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
      className="workspace-modal-overlay"
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
