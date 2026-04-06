"use client";

import React from "react";
import { createPortal } from "react-dom";

export type ActionItem = {
  key: string;
  label: string;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
};

export default function ActionMenu({
  items,
  disabled = false,
  tourId,
}: {
  items: ActionItem[];
  disabled?: boolean;
  tourId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updateMenuPosition = React.useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menu = menuRef.current;
    const menuWidth = menu?.offsetWidth ?? 176;
    const menuHeight = menu?.offsetHeight ?? 0;
    const gap = 4;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > viewportW - 8) left = Math.max(8, viewportW - menuWidth - 8);

    let top = rect.bottom + gap;
    if (menuHeight && top + menuHeight > viewportH - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    setMenuPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => updateMenuPosition();

    updateMenuPosition();
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

  React.useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, items.length, updateMenuPosition]);

  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[1000] min-w-44 rounded-md border border-slate-200 bg-white shadow-md"
      style={{ top: menuPos.top, left: menuPos.left }}
      data-tour={tourId ? `${tourId}-menu` : undefined}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={disabled || item.disabled}
          className={[
            "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
            item.danger ? "text-red-700" : "text-slate-700",
            (disabled || item.disabled) ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
          onClick={async () => {
            setOpen(false);
            await item.onSelect();
          }}
          data-tour={tourId ? `${tourId}-item-${item.key}` : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative inline-flex" ref={wrapRef} data-tour={tourId}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-ghost h-8 px-2"
        aria-label="Open actions"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        data-tour={tourId ? `${tourId}-toggle` : undefined}
      >
        <span className="text-lg leading-none" aria-hidden="true">&#8942;</span>
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
