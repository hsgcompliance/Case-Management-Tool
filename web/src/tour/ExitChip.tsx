//src/features/tutorial/ExitChip.tsx
import React from "react";
import { createPortal } from "react-dom";

export function ExitChip({ onExit, z = 100005 }: { onExit: () => void; z?: number }) {
  return createPortal(
    <button
      onClick={onExit}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: z,
        padding: "8px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: "rgba(17,24,39,.9)",
        color: "white",
        border: "1px solid rgba(255,255,255,.15)",
        boxShadow: "0 6px 14px rgba(0,0,0,.25)",
      }}
      aria-label="Exit tour"
    >
      Exit tour
    </button>,
    document.body
  );
}
