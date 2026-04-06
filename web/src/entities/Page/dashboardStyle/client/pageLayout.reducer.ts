import type { DashboardToolId, NavCrumb } from "../types";
import type { PageLayoutAction, PageLayoutState } from "./pageLayout.types";

export const MAX_PINNED = 10;

function uniq(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function sanitizeForTools(ids: string[], validIds: Set<string>) {
  return uniq(ids).filter((id) => validIds.has(id));
}

function applyPinWithLRU(
  state: PageLayoutState,
  toolId: string,
): Pick<PageLayoutState, "pinnedToolIds" | "recency"> {
  let pinned = uniq([toolId, ...state.pinnedToolIds]);
  let recency = uniq([toolId, ...state.recency.filter((id) => pinned.includes(id))]);
  for (const id of pinned) {
    if (!recency.includes(id)) recency.push(id);
  }

  if (pinned.length > MAX_PINNED) {
    const evictionCandidate = [...recency].reverse().find((id) => id !== toolId && pinned.includes(id));
    const evict = evictionCandidate || pinned.find((id) => id !== toolId) || null;
    if (evict) {
      pinned = pinned.filter((id) => id !== evict);
      recency = recency.filter((id) => id !== evict);
    }
  }

  return {
    pinnedToolIds: pinned.slice(0, MAX_PINNED) as DashboardToolId[],
    recency: recency.filter((id) => pinned.includes(id)).slice(0, MAX_PINNED) as DashboardToolId[],
  };
}

export function createDefaultState(
  tools: ReadonlyArray<{
    id: DashboardToolId;
    defaultPinned?: boolean;
    createFilterState?: () => unknown;
  }>,
  selectedToolId?: string,
): PageLayoutState {
  const activeToolId = tools.some((tool) => tool.id === selectedToolId) ? String(selectedToolId) : "none";
  const defaultPinned = tools.filter((tool) => tool.defaultPinned).map((tool) => tool.id);
  const pinnedToolIds = uniq(defaultPinned.length ? defaultPinned : [fallbackId]).slice(0, MAX_PINNED) as DashboardToolId[];
  const recency = uniq(activeToolId === "none" ? [...pinnedToolIds] : [activeToolId, ...pinnedToolIds]).slice(0, MAX_PINNED) as DashboardToolId[];

  const perToolFilterState: Record<DashboardToolId, unknown> = {} as Record<DashboardToolId, unknown>;
  const perToolSelection: Record<DashboardToolId, unknown | null> = {} as Record<DashboardToolId, unknown | null>;
  const perToolNavStack: Record<DashboardToolId, NavCrumb<unknown>[]> = {} as Record<
    DashboardToolId,
    NavCrumb<unknown>[]
  >;

  for (const tool of tools) {
    perToolFilterState[tool.id] = tool.createFilterState ? tool.createFilterState() : {};
    perToolSelection[tool.id] = null;
    perToolNavStack[tool.id] = [];
  }

  const baseState = {
    activeToolId: activeToolId as DashboardToolId,
    pinnedToolIds,
    recency,
    perToolFilterState,
    perToolSelection,
    perToolNavStack: perToolNavStack as PageLayoutState["perToolNavStack"],
    settingsLoaded: false,
  };
  const pinnedAfterOpen = activeToolId === "none"
    ? { pinnedToolIds, recency }
    : applyPinWithLRU(baseState, activeToolId);

  return {
    activeToolId: activeToolId as DashboardToolId,
    pinnedToolIds: pinnedAfterOpen.pinnedToolIds,
    recency: pinnedAfterOpen.recency,
    perToolFilterState,
    perToolSelection,
    perToolNavStack: perToolNavStack as PageLayoutState["perToolNavStack"],
    settingsLoaded: false,
  };
}

export function pageLayoutReducer(state: PageLayoutState, action: PageLayoutAction): PageLayoutState {
  switch (action.type) {
    case "HYDRATE_SETTINGS":
      return {
        ...state,
        activeToolId: action.payload.activeToolId || state.activeToolId,
        pinnedToolIds: action.payload.pinnedToolIds,
        recency: action.payload.recency,
        settingsLoaded: true,
      };
    case "SET_ACTIVE_TOOL": {
      const nextPinned = applyPinWithLRU(state, action.toolId);
      return {
        ...state,
        activeToolId: action.toolId,
        pinnedToolIds: nextPinned.pinnedToolIds,
        recency: nextPinned.recency,
      };
    }
    case "TOGGLE_PIN": {
      const isPinned = state.pinnedToolIds.includes(action.toolId);
      if (isPinned) {
        return {
          ...state,
          pinnedToolIds: state.pinnedToolIds.filter((id) => id !== action.toolId),
          recency: state.recency.filter((id) => id !== action.toolId),
        };
      }
      const nextPinned = applyPinWithLRU(state, action.toolId);
      return { ...state, pinnedToolIds: nextPinned.pinnedToolIds, recency: nextPinned.recency };
    }
    case "SET_FILTER":
      return {
        ...state,
        perToolFilterState: { ...state.perToolFilterState, [action.toolId]: action.filterState },
      };
    case "SET_SELECTION":
      return {
        ...state,
        perToolSelection: { ...state.perToolSelection, [action.toolId]: action.selection },
      };
    case "NAV_PUSH":
      return {
        ...state,
        perToolNavStack: {
          ...state.perToolNavStack,
          [action.toolId]: [...(state.perToolNavStack[action.toolId] || []), action.crumb],
        },
      };
    case "NAV_POP": {
      const prev = state.perToolNavStack[action.toolId] || [];
      return {
        ...state,
        perToolNavStack: {
          ...state.perToolNavStack,
          [action.toolId]: prev.slice(0, Math.max(0, prev.length - 1)),
        },
      };
    }
    case "NAV_RESET":
      return {
        ...state,
        perToolNavStack: { ...state.perToolNavStack, [action.toolId]: [] },
      };
    case "NAV_SET_STACK":
      return {
        ...state,
        perToolNavStack: { ...state.perToolNavStack, [action.toolId]: action.stack },
      };
    default:
      return state;
  }
}
