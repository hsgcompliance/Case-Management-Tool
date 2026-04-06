"use client";

// BEGIN FILE: src/features/tutorial/admin/TourBuilderDock.tsx
import * as React from "react";
import { Rnd } from "react-rnd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Overlay } from "@tour/Overlay";
import type { TourFlowT as Tour, TourStepT as Step } from "@tour/schema";
import {
  normalizeTourShape,
  fetchTour,
  listAllTourSummaries,
  listDraftSummaries,
  saveDraft,
  loadDraft,
  deleteDraft,
  deleteTourDb,
  ensureUniqueId,
  publishTour,
  resolveTourById,
  type TourSummary
} from "./tourStore";
import { cssSelectorFor, type SelectorOpts } from "./selector";
import { useDomPicker } from "./useDomPicker";
import { getReactSourceFromDom, openInEditor, type ReactSourceInfo } from "./reactSource";
import { qsSafe, selectorStatus } from "@tour/dom";
import { createPortal } from "react-dom";

const OPEN_KEY = "hdb.tourBuilder.open";
const CAL_KEY = "hdb.tourBuilder.calibration";

const TOUR_DEBUG =
  String(process.env.NEXT_PUBLIC_TOUR_DEBUG || "") === "1" ||
  new URLSearchParams(location.search).get("tourDebug") === "1";
const log = (...a: any[]) => {
  if (TOUR_DEBUG) console.log("[tour/builder]", ...a);
};

type Cal = {
  tooltipX: number; tooltipY: number;
  lockScroll: boolean;
  selectorRoot?: string;
};

function useQueryFlag(name: string) {
  const searchParams = useSearchParams();
  return React.useMemo(() => searchParams.has(name), [searchParams, name]);
}

function useCal(): [Cal, (p: Partial<Cal> | ((c: Cal) => Partial<Cal>)) => void] {
  const [cal, setCal] = React.useState<Cal>(() => {
    try { return { tooltipX:0, tooltipY:0, lockScroll:false, ...JSON.parse(localStorage.getItem(CAL_KEY) || "{}") }; }
    catch { return { tooltipX:0, tooltipY:0, lockScroll:false }; }
  });
  const update = (patch: Partial<Cal> | ((c: Cal) => Partial<Cal>)) => {
    setCal(prev => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      localStorage.setItem(CAL_KEY, JSON.stringify(next));
      return next;
    });
  };
  return [cal, update];
}

export default function TourBuilderDock() {
  React.useEffect(() => { log("dock mounted", { path: location.pathname, search: location.search }); }, []);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const replaceTo = React.useCallback((path: string, sp: URLSearchParams) => {
    const q = sp.toString();
    router.replace(q ? `${path}?${q}` : path);
  }, [router]);
  const builderInUrl = useQueryFlag("builder");
  const [open, setOpen] = React.useState<boolean>(() => localStorage.getItem(OPEN_KEY) === "1" || builderInUrl);
  React.useEffect(() => { if (builderInUrl) setOpen(true); }, [builderInUrl]);
  React.useEffect(() => { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); }, [open]);

  React.useEffect(() => { log("mount", { path: pathname, search, open }); }, []);
  React.useEffect(() => { log("open state", open); }, [open]);

  const [cal, setCal] = useCal();
  React.useEffect(() => {
    if (!open || !cal.lockScroll) return;
    const html = document.documentElement, body = document.body;
    const a = html.style.overflow, b = body.style.overflow;
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    log("lockScroll on");
    return () => { html.style.overflow = a; body.style.overflow = b; log("lockScroll off"); };
  }, [open, cal.lockScroll]);

  // Hotkey: Ctrl+Alt+T toggles dock
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === "t" || e.key === "T")) { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Active tour id via ?tour=
  const qs = React.useMemo(() => new URLSearchParams(search), [search]);
  const qsTour = React.useMemo(() => qs.get("tour"), [qs]);
  const [activeId, setActiveId] = React.useState<string | null>(qsTour);
  React.useEffect(() => setActiveId(qsTour), [qsTour]);
  React.useEffect(() => {
    if (!open) return;
    if (!activeId) return;
    const sp = new URLSearchParams(search);
    if (sp.get("tour") !== activeId) {
      sp.set("tour", activeId);
      log("sync tour id to URL", { activeId });
      replaceTo(pathname, sp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId, pathname, search, replaceTo]);

  // Summaries
  const [draftSummaries, setDraftSummaries] = React.useState<TourSummary[]>(() => listDraftSummaries());
  const [dbSummaries, setDbSummaries] = React.useState<TourSummary[]>([]);
  const [dbLoaded, setDbLoaded] = React.useState(false);

  const refreshDrafts = React.useCallback(() => {
    const list = listDraftSummaries();
    setDraftSummaries(list);
    log("draft summaries", { count: list.length, ids: list.map(d => d.id) });
  }, []);
  const loadDbSummaries = React.useCallback(async () => {
    log("loadDbSummaries: start");
    const t0 = performance.now();
    const items = await listAllTourSummaries();
    setDbSummaries(items);
    setDbLoaded(true);
    log("loadDbSummaries: done", { count: items.length, ms: Math.round(performance.now() - t0) });
  }, []);

  React.useEffect(() => {
    if (open && !dbLoaded) { loadDbSummaries(); }
  }, [open, dbLoaded, loadDbSummaries]);

  // Tour under edit
  const [tour, setTour] = React.useState<Tour>(() => {
    const id = activeId ?? "";
    return resolveTourById(id) ?? loadDraft(id) ?? { id, name: id, version: 2, steps: [] };
  });

  React.useEffect(() => {
    if (!activeId) {
      setTour({ id: "onboarding", name: "Onboarding", version: 2, steps: [] });
      setIdx(0);
      log("no activeId -> default tour");
      return;
    }
    const local = resolveTourById(activeId);
    const src = local ? "local" : "empty";
    const stepsLen = Array.isArray(local?.steps) ? local!.steps.length : 0;
    log("load tour for activeId", { activeId, src, stepsLen });
    setTour(local ?? { id: activeId, name: activeId, version: 2, steps: [] });
    setIdx(0);
  }, [activeId]);

  // 🔒 Crash-proof the steps array and reuse everywhere
  const steps = React.useMemo<Step[]>(() => (Array.isArray(tour?.steps) ? tour.steps : []), [tour?.steps]);

  const [idx, setIdx] = React.useState(0);
  const step = steps[idx];
  const [autoGo, setAutoGo] = React.useState(true);

  // Picking / selector
  const [picking, setPicking] = React.useState(false);
  const { hoverEl, pickedEl, setPickedEl } = useDomPicker(picking);
  React.useEffect(() => {
    if (!picking || !pickedEl) return;
    const opts: SelectorOpts = { root: cal.selectorRoot };
    log("picked element -> selector", { route: pathname });
    mutateStep({ selector: cssSelectorFor(pickedEl, opts), route: pathname });
    setPicking(false);
    setPickedEl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, pickedEl, cal.selectorRoot, pathname]);

  // Auto-track route
  const [trackRoute, setTrackRoute] = React.useState(true);
  React.useEffect(() => {
    if (!step || !trackRoute) return;
    setTour(t => {
      const s = (Array.isArray(t.steps) ? t.steps.slice() : []);
      const cur = s[idx]; if (!cur) return t;
      if (cur.route !== pathname) {
        const next = { ...cur, route: pathname };
        log("auto-track route", { idx, from: cur.route, to: next.route });
        s[idx] = next;
        return { ...t, steps: s, updatedAt: new Date().toISOString() };
      }
      return t;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, idx, trackRoute]);

  // Scroll target into view
  React.useEffect(() => {
    if (!step?.selector) return;
    const el = qsSafe<HTMLElement>(step.selector);
    if (el) el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [step?.selector, step?.route]);

  // When builder is open and step has a route different from current path,
  // auto navigate so the target exists and overlay can render.
  React.useEffect(() => {
    if (!open || !autoGo) return;
    const want = step?.route;
    if (!want || want === pathname) return;
    const sp = new URLSearchParams(search);
    log("builder auto-nav", { from: pathname, to: want, qs: sp.toString() });
    replaceTo(want, sp);
  }, [open, autoGo, step?.route, pathname, search, replaceTo]);

  // Source info (dev)
  const [srcInfo, setSrcInfo] = React.useState<ReactSourceInfo | null>(null);
  const srcInfoRef = React.useRef<ReactSourceInfo | null>(null);
  const target = (step?.selector && qsSafe<HTMLElement>(step.selector)) || hoverEl || null;
  React.useEffect(() => {
    const info = target ? getReactSourceFromDom(target) : null;
    setSrcInfo(info);
    srcInfoRef.current = info;
    if (step?.selector) {
      const st = selectorStatus(step.selector);
      log("selectorStatus", { stepId: step?.id, selector: step?.selector, status: st });
    }
  }, [target, step?.selector, step?.id]);

  // Core mutator
  const mutateStep = (patch: Partial<Step>) => {
    setTour(t => {
      const s = (Array.isArray(t.steps) ? t.steps.slice() : []);
      const base: Step = s[idx] ?? {
        id: `step_${Date.now()}`, route: pathname || "/reports", selector: "",
        title: "New step",
        html: "<p></p>",
        padding: 8, placement: "right",
        requireClick: false, offsetX: 0, offsetY: 0,
      };
      const after = { ...base, ...patch };
      s[idx] = after;

      // tiny local audit trail
      try {
        const KEY = "hdb.tour.audit.v1";
        const cur = JSON.parse(localStorage.getItem(KEY) || "[]");
        cur.push({ ts: new Date().toISOString(), tourId: t.id, stepId: after.id, route: after.route, selector: after.selector, patch, source: srcInfoRef.current ?? null });
        localStorage.setItem(KEY, JSON.stringify(cur));
      } catch {}

      log("mutateStep", { idx, patchKeys: Object.keys(patch || {}), route: after.route, selector: after.selector });
      return { ...t, steps: s, updatedAt: new Date().toISOString() };
    });
  };

  const addStepAfter = () => {
    setTour(t => {
      const s = (Array.isArray(t.steps) ? t.steps.slice() : []);
      s.splice(idx + 1, 0, {
        id: `step_${Date.now()}`,
        route: pathname || "/reports",
        selector: "",
        title: "New step",
        body: "",
        padding: 8,
        placement: "right",
        requireClick: false,
        offsetX: 0,
        offsetY: 0,
      });
      log("addStepAfter", { newIdx: idx + 1, total: s.length });
      return { ...t, steps: s, updatedAt: new Date().toISOString() };
    });
    setIdx(i => i + 1);
  };
  const removeStep = () => {
    setTour(t => {
      const s = (Array.isArray(t.steps) ? t.steps.slice() : []);
      if (!s.length) return t;
      const removed = s[idx]?.id;
      s.splice(idx, 1);
      log("removeStep", { idx, removed, total: s.length });
      return { ...t, steps: s, updatedAt: new Date().toISOString() };
    });
    setIdx(i => Math.max(0, i - 1));
  };

  const closeDock = () => {
    setOpen(false);
    const sp = new URLSearchParams(search);
    sp.delete("tour"); sp.delete("step");
    log("closeDock -> strip tour/step from URL");
    replaceTo(pathname, sp);
  };

  // Draft + Publish
  const saveDraftNow = () => {
    const id = (tour.id || "").trim();
    if (!id) { alert("Set a Tour ID first."); return; }
    saveDraft({ ...tour, id });
    refreshDrafts();
    log("saveDraft", { id, steps: steps.length });
  };

  const startTour = () => {
    if (!tour.id) { alert("Pick a tour first."); return; }
    if (!steps.length) { alert("Add a step first."); return; }
    const sp = new URLSearchParams(search);
    sp.set("tour", tour.id);
    sp.set("step", "0");
    sp.set("run", "1"); // custom runner only
    sp.delete("joyride");
    // Close dock before navigation to avoid portal teardown races (#300)
    setOpen(false);
    const dest = `${steps[0]?.route || "/reports"}?${sp.toString()}`;
    log("preview start: closing dock then nav", { dest });
    // Defer one tick so the dock unmounts cleanly
    setTimeout(() => router.replace(dest), 0);
  };

  // Effective offsets for preview
  const effOffsetX = (step?.offsetX ?? 0) + cal.tooltipX;
  const effOffsetY = (step?.offsetY ?? 0) + cal.tooltipY;

  // UI helpers
  const clickTarget = () => target?.click();
  const focusTarget = () => target?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  // z-index tokens
  const zMask = Number(getComputedStyle(document.documentElement).getPropertyValue("--tour-z-mask")) || 2600;
  const zPop  = Number(getComputedStyle(document.documentElement).getPropertyValue("--tour-z-popover")) || 2620;
  const zDock = Number(getComputedStyle(document.documentElement).getPropertyValue("--tour-z-dock")) || 3000;

  // Combined list for switcher
  const combinedSummaries = React.useMemo(() => {
    const arr = [...draftSummaries, ...dbSummaries];
    log("combinedSummaries", { drafts: draftSummaries.length, db: dbSummaries.length, total: arr.length });
    return arr;
  }, [draftSummaries, dbSummaries]);

  const root = document.getElementById("tour-builder-root") ?? (() => {
    const el = document.createElement("div"); el.id = "tour-builder-root"; document.body.appendChild(el); return el;
  })();

  return createPortal(
    open ? (
      <>
        {step && target && (
          <Overlay
            key={step.id}
            target={target}
            title={step.title}
            body={step.body}
            placement={step.placement}
            padding={step.padding ?? 8}
            offsetX={effOffsetX}
            offsetY={effOffsetY}
            onExit={() => {}}
            onPrev={() => setIdx(i => Math.max(0, i - 1))}
            onNext={() => setIdx(i => Math.min(steps.length - 1, i + 1))}
            showPrev={idx > 0}
            showNext
            zIndexMask={zMask}
            zIndexPopover={zPop}
            interactive={!picking}        // click-through only while picking
            disableBackdrop               // builder never needs a clickable backdrop
            closeOnBackdrop={false}
            disableSpotlight={false}
            root
          />
        )}

        <Rnd
          default={{ x: Math.max(16, window.innerWidth - 420), y: Math.max(16, window.innerHeight - 560), width: 420, height: 560 }}
          bounds="window"
          dragHandleClassName="tb-drag"
          style={{ zIndex: zDock }}
        >
          <div className="h-full w-full flex flex-col rounded-xl border border-amber-300 bg-white shadow-xl" data-tour-builder-root="1">
            <div className="tb-drag cursor-move px-3 py-2 border-b bg-amber-50 rounded-t-xl flex items-center gap-2">
              <div className="font-semibold text-sm">Tour Builder</div>

              {/* Switcher */}
              <select
                className="text-xs border rounded px-1 py-0.5 ml-3"
                value={activeId ?? ""}
                onChange={(e) => setActiveId(e.target.value || null)}
                title="Switch tour"
              >
                {combinedSummaries.length === 0 && <option value={activeId || ""}>{activeId || "onboarding"}</option>}
                {combinedSummaries.map((t) => (
                  <option key={`${t.source}-${t.id}`} value={t.id}>
                    {t.id}{t.source === "draft" ? " · draft" : ""}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex gap-1">
                <button className="btn-ghost text-xs" onClick={() => closeDock()}>Close</button>
              </div>
            </div>

            <div className="p-3 space-y-3 overflow-auto text-sm">
              {/* Data sources row */}
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={refreshDrafts}>Refresh drafts</button>
                <button className="btn-ghost text-xs" onClick={loadDbSummaries} disabled={dbLoaded}>Load DB list</button>
                <button
                  className="btn-ghost text-xs"
                  onClick={async () => {
                    try {
                      console.info("[tour/builder] Load from DB clicked", { id: activeId }); // visible even if debug disabled
                      if (!activeId) { alert("Pick a tour first."); return; }
                      const raw = await fetchTour(activeId);
                      const t = normalizeTourShape(raw);
                      if (!Array.isArray(t.steps)) t.steps = [];
                      setTour(t);
                      setIdx(0);
                      console.info("[tour/builder] Loaded tour", { id: t.id, steps: t.steps.length });
                    } catch (e: any) {
                      console.error("[tour/builder] Load from DB failed", e?.message || e);
                      alert(`Load from DB failed: ${e?.message || e}`);
                    }
                  }}
                >
                  Load from DB
                </button>
              </div>

              {/* Tour meta */}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs col-span-2">
                  Tour ID
                  <input className="input" value={tour.id} onChange={(e) => setTour(t => ({ ...t, id: e.target.value.trim() || "onboarding" }))} />
                </label>
                <label className="text-xs col-span-2">
                  Tour Name
                  <input className="input" value={tour.name} onChange={(e) => setTour(t => ({ ...t, name: e.target.value }))} />
                </label>
              </div>

              {/* Nav */}
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={!steps.length}>Prev</button>
                <div>{steps.length ? `${idx + 1}/${steps.length}` : "0/0"}</div>
                <button className="btn-ghost text-xs" onClick={() => setIdx(i => Math.min(steps.length - 1, i + 1))} disabled={!steps.length}>Next</button>
                <button className="btn text-xs ml-auto" onClick={addStepAfter}>+ Step</button>
                <button className="btn-ghost text-xs text-red-600" onClick={removeStep} disabled={!steps.length}>Remove</button>
              </div>

              {/* Global calibration */}
              <fieldset className="border rounded p-2 space-y-2">
                <legend className="text-xs px-1">Global Calibration</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Tooltip Cal X<input type="number" className="input" value={cal.tooltipX} onChange={(e) => setCal({ tooltipX: Number(e.target.value) || 0 })} /></label>
                  <label className="text-xs">Tooltip Cal Y<input type="number" className="input" value={cal.tooltipY} onChange={(e) => setCal({ tooltipY: Number(e.target.value) || 0 })} /></label>
                  <label className="text-xs col-span-2">Selector Root (optional)
                    <input className="input" placeholder='e.g. main, [data-app-shell="1"]' value={cal.selectorRoot || ""} onChange={(e) => setCal({ selectorRoot: e.target.value.trim() || undefined })} />
                  </label>
                  <label className="text-xs col-span-2 inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!cal.lockScroll} onChange={(e) => setCal({ lockScroll: e.target.checked })} />
                    Lock page scroll while building
                  </label>
                  <label className="text-xs col-span-2 inline-flex items-center gap-2">
                    <input type="checkbox" checked={autoGo} onChange={(e) => setAutoGo(e.target.checked)} />
                    Auto-jump to the current step’s route
                  </label>
                </div>
              </fieldset>

              {/* Source info */}
              {srcInfo?.file && (
                <div className="text-[11px] text-slate-600 -mt-1 mb-1 flex items-center gap-2">
                  <code className="font-mono">{srcInfo.file}{srcInfo.line ? `:${srcInfo.line}` : ""}{srcInfo.column ? `:${srcInfo.column}` : ""}</code>
                  <button className="btn-ghost text-xs" onClick={() => openInEditor(srcInfo.file, srcInfo.line, srcInfo.column)}>Open</button>
                  <button className="btn-ghost text-xs" onClick={() => navigator.clipboard.writeText(`${srcInfo.file}:${srcInfo.line ?? 1}${srcInfo.column ? `:${srcInfo.column}` : ""}`)}>Copy</button>
                </div>
              )}

              {/* Step editor */}
              {step ? (
                <>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={trackRoute} onChange={(e) => setTrackRoute(e.target.checked)} /> Auto-route
                    </label>
                    <button className="btn-ghost text-xs ml-auto" onClick={() => mutateStep({ route: pathname })}>Set route = current</button>
                    <button className="btn-ghost text-xs" onClick={() => router.replace(step.route || "/reports")}>Go to route</button>
                  </div>

                  <label className="text-xs">Route
                    <input className="input" value={step.route} onChange={(e) => mutateStep({ route: e.target.value })} />
                  </label>

                  <div className="flex gap-2">
                    <label className="text-xs flex-1">Selector
                      <input className="input" value={step.selector} onChange={(e) => mutateStep({ selector: e.target.value })} placeholder='e.g. [data-tour="tool-toggle-MyCustomers"]' />
                    </label>
                    <button className={["btn-ghost text-xs", picking ? "bg-amber-100" : ""].join(" ")} onClick={() => setPicking(p => !p)} title="Pick element on page">
                      {picking ? "Picking…" : "Pick"}
                    </button>
                  </div>
                  {(() => {
                    const st = selectorStatus(step.selector);
                    if (st.reason === "empty") return null;
                    if (!st.valid && st.reason === "invalid")
                      return <div className="text-xs text-red-600 mt-1">Invalid CSS selector.</div>;
                    if (st.valid && st.reason === "nomatch")
                      return <div className="text-xs text-amber-700 mt-1">No elements match this selector on this page.</div>;
                    return <div className="text-[11px] text-slate-500 mt-1">Matches {st.count} element{st.count === 1 ? "" : "s"}.</div>;
                  })()}

                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs" onClick={focusTarget} disabled={!target}>Focus</button>
                    <button className="btn-ghost text-xs" onClick={clickTarget} disabled={!target}>Click</button>
                    <button className="btn-ghost text-xs" onClick={async () => { if (step.selector) await navigator.clipboard.writeText(step.selector); }}>Copy selector</button>
                  </div>

                  <label className="text-xs">Title
                    <input className="input" value={step.title} onChange={(e) => mutateStep({ title: e.target.value })} />
                  </label>

                  <label className="text-xs">Body
                    <textarea className="input" rows={6} placeholder="Welcome…" value={step.body ?? ""} onChange={(e) => mutateStep({ body: e.target.value })} />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">Placement
                      <select className="select" value={step.placement || "right"} onChange={(e) => mutateStep({ placement: e.target.value as any })}>
                        <option>auto</option><option>top</option><option>right</option><option>bottom</option><option>left</option>
                      </select>
                    </label>
                    <label className="text-xs">Padding (spotlight)
                      <input type="number" className="input" value={step.padding ?? 8} onChange={(e) => mutateStep({ padding: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="text-xs">Tooltip Offset X
                      <input type="number" className="input" value={step.offsetX ?? 0} onChange={(e) => mutateStep({ offsetX: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="text-xs">Tooltip Offset Y
                      <input type="number" className="input" value={step.offsetY ?? 0} onChange={(e) => mutateStep({ offsetY: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="text-xs col-span-2 inline-flex items-center gap-2">
                      <input type="checkbox" checked={!!step.requireClick} onChange={(e) => mutateStep({ requireClick: e.target.checked })} />
                      Require real click to advance
                    </label>
                  </div>

                  {/* Nudge helpers */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Nudge (Alt+Arrows):</span>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetX: (step.offsetX ?? 0) - 10 })}>◀︎ 10</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetX: (step.offsetX ?? 0) - 1 })}>◀︎ 1</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetX: 0, offsetY: 0 })}>0,0</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetX: (step.offsetX ?? 0) + 1 })}>1 ▶︎</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetX: (step.offsetX ?? 0) + 10 })}>10 ▶︎</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-0">Nudge</span>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetY: (step.offsetY ?? 0) - 10 })}>▲ 10</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetY: (step.offsetY ?? 0) - 1 })}>▲ 1</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetY: (step.offsetY ?? 0) + 1 })}>1 ▼</button>
                    <button className="btn-ghost text-xs" onClick={() => mutateStep({ offsetY: (step.offsetY ?? 0) + 10 })}>10 ▼</button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-600">Add your first step.</div>
              )}

              {/* Save/preview/publish */}
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={saveDraftNow}>Save draft</button>
                <button
                  className="btn text-xs"
                  onClick={async () => {
                    try {
                      const id = tour.id?.trim() || await ensureUniqueId(tour.name || "Onboarding");
                      const saved = await publishTour({ ...tour, id }, { ensureUnique: false, merge: true });
                      alert(`Published "${saved.name}" (${saved.id})`);
                      log("publish ok", { id: saved.id });
                    } catch (e: any) {
                      log("publish failed", e?.message || e);
                      alert(`Publish failed: ${e?.message || e}`);
                    }
                  }}
                >
                  Publish to DB
                </button>
                <button className="btn-ghost text-xs ml-auto" onClick={startTour}>Preview full tour</button>
              </div>

              {/* Danger zone */}
              <details className="mt-2">
                <summary className="text-xs text-red-700 cursor-pointer">Danger Zone</summary>
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost text-xs text-red-600" onClick={() => { deleteDraft(tour.id); refreshDrafts(); log("delete draft", tour.id); }}>Delete draft</button>
                  <button
                    className="btn-ghost text-xs text-red-600"
                    onClick={async () => { if (confirm(`Delete "${tour.id}" from DB?`)) { await deleteTourDb(tour.id); alert("Deleted from DB (if existed)"); log("delete from DB", tour.id); } }}
                  >
                    Delete from DB
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => {
                      const json = localStorage.getItem("hdb.tour.audit.v1") || "[]";
                      const blob = new Blob([json], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "tour-audit.json"; a.click(); URL.revokeObjectURL(url);
                      log("export audit");
                    }}
                  >
                    Export audit
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => { localStorage.removeItem("hdb.tour.audit.v1"); log("clear audit"); }}>Clear audit</button>
                </div>
              </details>
            </div>
          </div>
        </Rnd>
      </>
    ) : null,
    document.body
  );
}
// END FILE: src/features/tutorial/admin/TourBuilderDock.tsx
