"use client";

import React from "react";

export type OverlayLayerKind =
  | "floating"
  | "modal"
  | "appChromePopover"
  | "tour"
  | "game"
  | "globalPending"
  | "toast";

export const OVERLAY_Z_BASE: Record<OverlayLayerKind, number> = {
  floating: 1000,
  modal: 1100,
  appChromePopover: 3000,
  tour: 4000,
  game: 9000,
  globalPending: 9990,
  toast: 12000,
};

const LAYER_STEP = 20;
type OverlayId = symbol;

const activeLayers: Record<OverlayLayerKind, OverlayId[]> = {
  floating: [],
  modal: [],
  appChromePopover: [],
  tour: [],
  game: [],
  globalPending: [],
  toast: [],
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function register(kind: OverlayLayerKind, id: OverlayId) {
  const layers = activeLayers[kind].filter((entry) => entry !== id);
  layers.push(id);
  activeLayers[kind] = layers;
  notify();
}

function unregister(kind: OverlayLayerKind, id: OverlayId) {
  const layers = activeLayers[kind].filter((entry) => entry !== id);
  activeLayers[kind] = layers;
  notify();
}

function moveToFront(kind: OverlayLayerKind, id: OverlayId) {
  if (!activeLayers[kind].includes(id)) return;
  register(kind, id);
}

function getZIndex(kind: OverlayLayerKind, id: OverlayId) {
  const index = activeLayers[kind].indexOf(id);
  if (index < 0) return OVERLAY_Z_BASE[kind];
  return OVERLAY_Z_BASE[kind] + (index + 1) * LAYER_STEP;
}

export function useOverlayLayer(isOpen: boolean, kind: OverlayLayerKind = "modal") {
  const idRef = React.useRef<OverlayId | null>(null);
  if (!idRef.current) idRef.current = Symbol(kind);
  const id = idRef.current;
  const [zIndex, setZIndex] = React.useState(() => getZIndex(kind, id));

  React.useEffect(() => {
    if (!isOpen) return;
    const sync = () => setZIndex(getZIndex(kind, id));
    listeners.add(sync);
    register(kind, id);
    sync();

    return () => {
      listeners.delete(sync);
      unregister(kind, id);
    };
  }, [id, isOpen, kind]);

  const bringToFront = React.useCallback(() => {
    moveToFront(kind, id);
    setZIndex(getZIndex(kind, id));
  }, [id, kind]);

  return { zIndex, bringToFront };
}
