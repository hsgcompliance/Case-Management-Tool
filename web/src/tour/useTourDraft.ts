// src/tours/useTourDraft.ts
import * as React from "react";
import type { TourFlowT as Tour } from "./schema";
import { TourRegistry } from "./registry";

const key = (id: string) => `tour:draft:${id}`;
const clone = <T,>(x: T): T =>
  (typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone(x)
    : JSON.parse(JSON.stringify(x)));

export function useTourDraft(id: string) {
  const code =
    TourRegistry[id] || { id, name: id, version: 2 as const, steps: [] };
  const [source, setSource] = React.useState<"local"|"code">("code");
  const [tour, setTour] = React.useState<Tour>(() => {
    const ls = localStorage.getItem(key(id));
    if (ls) { setSource("local"); return JSON.parse(ls) as Tour; }
    return clone(code);
  });

  React.useEffect(() => {
    const ls = localStorage.getItem(key(id));
    if (ls) { setSource("local"); setTour(JSON.parse(ls)); }
    else { setSource("code"); setTour(clone(TourRegistry[id] || code)); }
  }, [id]);

  const saveLocal = (t: Tour) => {
    const withStamp = { ...t, updatedAt: new Date().toISOString() };
    localStorage.setItem(key(id), JSON.stringify(withStamp));
    setTour(withStamp);
    setSource("local");
  };

  const discardLocal = () => {
    localStorage.removeItem(key(id));
    setTour(clone(TourRegistry[id] || code));
    setSource("code");
  };

  const exportJSON = () => navigator.clipboard.writeText(JSON.stringify(tour, null, 2));
  const importJSON = () => {
    const raw = prompt("Paste Tour JSON:");
    if (!raw) return;
    try { const parsed = JSON.parse(raw); setTour(parsed); saveLocal(parsed); }
    catch { alert("Invalid JSON"); }
  };

  return { tour, setTour, source, saveLocal, discardLocal, exportJSON, importJSON };
}
