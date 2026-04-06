//src/features/tutorial/admin/useDomPicker.ts
import * as React from "react";

type PickerOpts = {
  /** Optional: limit picking to a subtree */
  rootSelector?: string;
  /** Optional: extra selectors to ignore */
  ignoreSelectors?: string[];
};

export function useDomPicker(enabled: boolean, opts: PickerOpts = {}) {
  const [hoverEl, setHoverEl] = React.useState<HTMLElement | null>(null);
  const [pickedEl, setPickedEl] = React.useState<HTMLElement | null>(null);

  // simple highlight box
  const hiRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const updateHi = React.useCallback((el: HTMLElement | null) => {
    if (!el) { if (hiRef.current) hiRef.current.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    let hi = hiRef.current;
    if (!hi) {
      hi = document.createElement("div");
      hi.dataset.tourIgnorePick = "1";
      hi.style.position = "fixed";
      hi.style.pointerEvents = "none";
      hi.style.zIndex = String(Number(getComputedStyle(document.documentElement).getPropertyValue("--tour-z-picker")) || 4000);
      hi.style.border = "2px solid #f59e0b"; // amber
      hi.style.borderRadius = "6px";
      hi.style.boxShadow = "0 0 0 2px rgba(245,158,11,.25)";
      document.body.appendChild(hi);
      hiRef.current = hi;
    }
    hi.style.display = "block";
    hi.style.left = `${Math.max(0, r.left - 2)}px`;
    hi.style.top = `${Math.max(0, r.top - 2)}px`;
    hi.style.width = `${Math.max(0, r.width + 4)}px`;
    hi.style.height = `${Math.max(0, r.height + 4)}px`;
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      setHoverEl(null);
      setPickedEl(null);
      updateHi(null);
      return;
    }

    const root =
      (opts.rootSelector ? (document.querySelector(opts.rootSelector) as HTMLElement | null) : null) ||
      document.body;

    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || overlayRootContains(t, opts.ignoreSelectors)) return;
      if (root && !root.contains(t)) return;
      const el = t.closest("[data-tour-no-pick]") as HTMLElement | null || t;
      setHoverEl(el);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => updateHi(el));
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || overlayRootContains(t, opts.ignoreSelectors)) return;
      if (root && !root.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
      setPickedEl(t);
      updateHi(t);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setHoverEl(null); setPickedEl(null); updateHi(null); }
      if (e.key === "Enter" && hoverEl) setPickedEl(hoverEl);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    document.body.classList.add("cursor-crosshair");
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("cursor-crosshair");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hiRef.current) { hiRef.current.remove(); hiRef.current = null; }
    };
  }, [enabled, opts.rootSelector, opts.ignoreSelectors, updateHi, hoverEl]);

  return { hoverEl, pickedEl, setPickedEl };
}

function overlayRootContains(node: Node, extraIgnores: string[] = []) {
  // ignore events inside dock/overlay/any explicit opt-out
  const selectors = [
    '[data-tour-builder-root="1"]',
    '[data-tour-overlay-root="1"]', // <- overlay gets this attr now
    '[data-tour-ignore-pick]',
    ...extraIgnores,
  ].join(",");
  const el = (node instanceof Element ? node : node.parentElement) as Element | null;
  return !!el?.closest(selectors);
}
