"use client";

import React from "react";

let lastActiveGame: HTMLElement | null = null;

export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return !!el.closest("[contenteditable=\"true\"]");
}

export function shouldHandleGlobalGameKey(root: HTMLElement | null, event: KeyboardEvent) {
  if (isTypingTarget(event.target)) return false;
  if (lastActiveGame && document.contains(lastActiveGame)) {
    if (!root) return false;
    return root.contains(lastActiveGame);
  }
  const active = document.activeElement as HTMLElement | null;
  const activeGame = active?.closest?.("[data-game-instance]") as HTMLElement | null;
  if (!activeGame) return true;
  if (!root) return false;
  return root.contains(activeGame);
}

export function markGameActive(el: HTMLElement | null) {
  if (!el) return;
  lastActiveGame = el;
}

export function usePauseOnHidden(pause: () => void) {
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);
}
