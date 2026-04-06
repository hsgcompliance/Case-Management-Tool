//src/features/tutorial/portal.ts
// Stable DOM mount for all tour overlays/portals.
// Never remove this node during normal unmounts; React will unmount *children*.
let TOUR_ROOT: HTMLDivElement | null = null;

export function getTourRoot(): HTMLDivElement {
  if (TOUR_ROOT && document.contains(TOUR_ROOT)) return TOUR_ROOT;

  const pre = document.getElementById("tour-root") as HTMLDivElement | null;
  TOUR_ROOT = pre ?? document.createElement("div");
  TOUR_ROOT.id = "tour-root";
  Object.assign(TOUR_ROOT.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none", // children can flip this back on selectively
    zIndex: "2600"         // below popover (2620), above app chrome
  } as CSSStyleDeclaration);

  if (!pre) document.body.appendChild(TOUR_ROOT);
  return TOUR_ROOT;
}

// Optional: only remove on full page exit (prevents React reconciliation races)
window.addEventListener("beforeunload", () => {
  TOUR_ROOT?.remove();
  TOUR_ROOT = null;
});
