// web/src/tours/Overlay.tsx
'use client';

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Rect = { x: number; y: number; w: number; h: number };

function computeRect(el: HTMLElement, padding = 8): Rect {
  const r = el.getBoundingClientRect();
  const p = Math.max(0, padding);
  return { x: r.left - p, y: r.top - p, w: r.width + 2*p, h: r.height + 2*p };
}

export function Overlay({
  target,
  zIndexMask = 9999,
  zIndexPopover = 10000,
  title,
  body,
  html,
  onNext, onPrev, onExit,
  showPrev, showNext,
  // Tour schema uses `padding`; existing TourHost passes `rectPadding`.
  padding,
  rectPadding,
  placement = "auto",
  offsetX = 0,
  offsetY = 0,
  interactive = false,
  disableBackdrop = false,
  closeOnBackdrop = true,
  disableSpotlight = false,
  root,
}: {
  target: HTMLElement | null;
  zIndexMask?: number;
  zIndexPopover?: number;
  title?: string; body?: string;
  html?: string;
  onNext: () => void; onPrev: () => void; onExit: () => void;
  showPrev: boolean; showNext: boolean;
  padding?: number;
  rectPadding?: number;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  offsetX?: number;
  offsetY?: number;
  interactive?: boolean;
  disableBackdrop?: boolean;
  closeOnBackdrop?: boolean;
  disableSpotlight?: boolean;
  root?: Element | null | boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  const pad = rectPadding ?? padding ?? 8;

  useEffect(() => {
    if (!target) { setRect(null); return; }
    const update = () => setRect(computeRect(target, pad));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [target, pad]);

  if (typeof document === "undefined") return null;
  const portalRoot = root && typeof root === "object" ? (root as Element) : document.body;

  const popoverPos = (() => {
    if (!rect) return { left: 16, top: 16 };
    const gap = 12;
    const baseLeft = Math.max(16, rect.x);
    const baseTop = rect.y + rect.h + gap;

    if (placement === "top") {
      return { left: baseLeft, top: Math.max(16, rect.y - gap - 120) };
    }
    if (placement === "left") {
      return { left: Math.max(16, rect.x - gap - 420), top: Math.max(16, rect.y) };
    }
    if (placement === "right") {
      return { left: Math.max(16, rect.x + rect.w + gap), top: Math.max(16, rect.y) };
    }
    // auto/bottom
    return { left: baseLeft, top: baseTop };
  })();

  return createPortal(
    <>
      {/* Dimmer */}
      {!disableBackdrop && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: zIndexMask,
            pointerEvents: interactive ? "none" : "auto",
          }}
          onClick={closeOnBackdrop ? onExit : undefined}
        />
      )}
      {/* Hole highlight */}
      {rect && !disableSpotlight && !disableBackdrop && (
        <div style={{
          position:"fixed", left: rect.x, top: rect.y, width: rect.w, height: rect.h,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 2px white",
          borderRadius: 8, pointerEvents: "none", zIndex: zIndexMask+1,
          transition: "all 120ms ease",
        }}/>
      )}
      {/* Popover */}
      {rect && (
        <div style={{
          position:"fixed", left: popoverPos.left + offsetX, top: popoverPos.top + offsetY,
          maxWidth: 420, background: "white", borderRadius: 12, padding: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: zIndexPopover,
        }}>
          {title && <div className="text-sm font-semibold">{title}</div>}
          {!!html ? (
            <div
              className="text-sm mt-1 opacity-80"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            body && <div className="text-sm mt-1 opacity-80">{body}</div>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={onExit} className="px-3 py-1 rounded bg-gray-100">Exit</button>
            {showPrev && <button onClick={onPrev} className="px-3 py-1 rounded bg-gray-100">Back</button>}
            {showNext && <button onClick={onNext} className="px-3 py-1 rounded bg-black text-white">Next</button>}
          </div>
        </div>
      )}
    </>,
    portalRoot
  );
}