// src/entities/Modal.tsx
"use client";
import React, { useEffect, useId, useRef } from "react";
import { useModalRuntime } from "./modalRuntime";

type ModalProps = {
  isOpen: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  onBeforeClose?: () => Promise<boolean> | boolean;
  widthClass?: string; // e.g. "max-w-5xl"
  footer?: React.ReactNode;

  disableOverlayClose?: boolean;
  disableEscClose?: boolean;
  tourId?: string;
};

export function Modal({
  isOpen,
  title,
  children,
  onClose = () => {},
  onBeforeClose,
  widthClass = "max-w-3xl",
  footer,
  disableOverlayClose = false,
  disableEscClose = false,
  tourId,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const attemptClose = async () => {
    const ok = (await onBeforeClose?.()) ?? true;
    if (ok) onClose();
  };

  useModalRuntime(isOpen, panelRef);

  // ESC closes
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
      className="modal-overlay"
      data-tour={tourId ? `${tourId}-overlay` : undefined}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (disableOverlayClose) return;
        if (e.target === overlayRef.current) attemptClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className={`modal ${widthClass}`} ref={panelRef} tabIndex={-1} data-tour={tourId}>
        <header className="modal-header" data-tour={tourId ? `${tourId}-header` : undefined}>
          <div className="modal-title" id={titleId} data-tour={tourId ? `${tourId}-title` : undefined}>
            {title}
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={attemptClose} data-tour={tourId ? `${tourId}-close` : undefined}>
            ✕
          </button>
        </header>

        <div className="modal-body" data-tour={tourId ? `${tourId}-body` : undefined}>{children}</div>

        <footer className="modal-footer" data-tour={tourId ? `${tourId}-footer` : undefined}>
          {footer ?? (
            <button className="btn btn-secondary" onClick={attemptClose}>
              Close
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default Modal;
