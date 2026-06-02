// src/entities/Modal.tsx
"use client";
import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalRuntime } from "./modalRuntime";
import { useOverlayLayer } from "./overlayLayers";

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
  draggable?: boolean;
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
  draggable = true,
  tourId,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [mounted, setMounted] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = React.useState(false);
  const { zIndex, bringToFront } = useOverlayLayer(isOpen, "modal");

  useEffect(() => {
    setMounted(true);
  }, []);

  const attemptClose = async () => {
    const ok = (await onBeforeClose?.()) ?? true;
    if (ok) onClose();
  };

  useModalRuntime(isOpen, panelRef);

  useEffect(() => {
    if (isOpen) return;
    setDragOffset({ x: 0, y: 0 });
    setHasDragged(false);
  }, [isOpen]);

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

  if (!isOpen || !mounted) return null;
  const isMoved = dragOffset.x !== 0 || dragOffset.y !== 0;

  const beginDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggable || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button,a,input,select,textarea,[data-modal-drag-ignore]")) return;

    e.preventDefault();
    bringToFront();

    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = dragOffset.x;
    const baseY = dragOffset.y;
    let moved = false;

    const onMove = (event: PointerEvent) => {
      const nextX = baseX + event.clientX - startX;
      const nextY = baseY + event.clientY - startY;
      if (!moved && Math.hypot(nextX - baseX, nextY - baseY) > 3) {
        moved = true;
        setHasDragged(true);
      }
      setDragOffset({ x: nextX, y: nextY });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const modal = (
    <div
      className={["modal-overlay", hasDragged ? "modal-overlay-clear" : ""].filter(Boolean).join(" ")}
      style={{ zIndex }}
      data-tour={tourId ? `${tourId}-overlay` : undefined}
      ref={overlayRef}
      onMouseDown={(e) => {
        const target = e.target as Node;
        if (!overlayRef.current?.contains(target)) return;
        e.stopPropagation();
        bringToFront();
        if (disableOverlayClose) return;
        if (e.target === overlayRef.current) attemptClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className={`modal ${widthClass}`}
        ref={panelRef}
        tabIndex={-1}
        data-tour={tourId}
        style={isMoved ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
      >
        <header
          className={["modal-header", draggable ? "cursor-move select-none" : ""].filter(Boolean).join(" ")}
          data-tour={tourId ? `${tourId}-header` : undefined}
          onPointerDown={beginDrag}
        >
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

  return createPortal(modal, document.body);
}

export default Modal;
