"use client";

import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import UsersClient from "@client/users";
import {
  getPageLayoutPreference,
  normalizePageLayoutPreference,
  samePageLayoutPreference,
  type PageLayoutPreference,
  writePageLayoutPreference,
} from "@lib/userSettings";
import { createDefaultState, pageLayoutReducer, sanitizeForTools } from "./pageLayout.reducer";
import type { PageLayoutContextValue, PageLayoutProviderProps } from "./pageLayout.types";

const PageLayoutContext = React.createContext<PageLayoutContextValue | null>(null);
const layoutCache = new Map<string, PageLayoutPreference>();

function cacheKey(uid: string, prefsKey: string) {
  return `${uid}:${prefsKey}`;
}

export function PageLayoutProvider({
  children,
  tools,
  selectedToolId,
  prefsKey = "dashboardPrefs",
}: PageLayoutProviderProps) {
  const { profile } = useAuth();
  const uid = String(profile?.uid || "");
  const settings = profile?.settings;
  const validIds = React.useMemo(() => new Set(tools.map((tool) => tool.id)), [tools]);
  const defaults = React.useMemo(() => createDefaultState(tools, selectedToolId), [tools, selectedToolId]);
  const [state, dispatch] = React.useReducer(pageLayoutReducer, defaults);
  const syncedRef = React.useRef<PageLayoutPreference | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const routeToolId = selectedToolId && validIds.has(selectedToolId) ? selectedToolId : null;
    const cached = uid ? layoutCache.get(cacheKey(uid, prefsKey)) || null : null;
    const persisted = cached || getPageLayoutPreference(settings, prefsKey);
    const normalized = normalizePageLayoutPreference({
      // URL param wins; if no URL tool, always start with no-tool-selected (ignore persisted activeToolId)
      activeToolId: routeToolId || null,
      pinnedToolIds: sanitizeForTools(persisted?.pinnedToolIds || defaults.pinnedToolIds, validIds),
      recency: sanitizeForTools(persisted?.recency || defaults.recency, validIds),
    });
    syncedRef.current = normalized;
    dispatch({ type: "HYDRATE_SETTINGS", payload: normalized });
  }, [defaults.activeToolId, defaults.pinnedToolIds, defaults.recency, prefsKey, selectedToolId, settings, uid, validIds]);

  const didUrlSyncRef = React.useRef(false);
  React.useEffect(() => {
    if (didUrlSyncRef.current) return;
    if (!selectedToolId || !validIds.has(selectedToolId)) return;
    if (state.activeToolId !== selectedToolId) {
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: selectedToolId });
    }
    didUrlSyncRef.current = true;
  }, [selectedToolId, state.activeToolId, validIds]);

  const settingsSnapshot = React.useMemo(
    () =>
      normalizePageLayoutPreference({
        activeToolId: state.activeToolId || null,
        pinnedToolIds: state.pinnedToolIds,
        recency: state.recency,
      }),
    [state.activeToolId, state.pinnedToolIds, state.recency],
  );

  React.useEffect(() => {
    if (!uid || !state.settingsLoaded) return;
    const next = settingsSnapshot;
    const prev = syncedRef.current;
    if (prev && samePageLayoutPreference(prev, next)) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await UsersClient.meUpdate({ settings: writePageLayoutPreference(settings, prefsKey, next) });
        layoutCache.set(cacheKey(uid, prefsKey), next);
        syncedRef.current = next;
      } catch {
        // Keep optimistic UI and retry on the next state change.
      }
    }, 250);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [prefsKey, settings, settingsSnapshot, state.settingsLoaded, uid]);

  const value = React.useMemo<PageLayoutContextValue>(
    () => ({
      state,
      setActiveTool: (toolId) => dispatch({ type: "SET_ACTIVE_TOOL", toolId }),
      togglePin: (toolId) => dispatch({ type: "TOGGLE_PIN", toolId }),
      setFilter: (toolId, filterState) => dispatch({ type: "SET_FILTER", toolId, filterState }),
      setSelection: (toolId, selection) => dispatch({ type: "SET_SELECTION", toolId, selection }),
      navPush: (toolId, crumb) => dispatch({ type: "NAV_PUSH", toolId, crumb }),
      navPop: (toolId) => dispatch({ type: "NAV_POP", toolId }),
      navReset: (toolId) => dispatch({ type: "NAV_RESET", toolId }),
      navSetStack: (toolId, stack) => dispatch({ type: "NAV_SET_STACK", toolId, stack }),
    }),
    [state],
  );

  return <PageLayoutContext.Provider value={value}>{children}</PageLayoutContext.Provider>;
}

export function usePageLayout() {
  const ctx = React.useContext(PageLayoutContext);
  if (!ctx) throw new Error("usePageLayout must be used within PageLayoutProvider");
  return ctx;
}
