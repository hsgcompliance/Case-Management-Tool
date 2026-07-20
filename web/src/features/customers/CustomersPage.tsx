// web/src/features/customers/CustomersPage.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ListStyleLayout } from "@entities/Page/listStyle";
import { TourProvider } from "../../tour/TourCtx";
import { useCustomers, useCustomersAll } from "@hooks/useCustomers";
import { useGrantEnrollmentMap, type EnrollmentStatusBucket } from "@hooks/useEnrollments";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import { useOrgConfig } from "@hooks/useOrgConfig";
import { useMe, useUpdateMe, useUsers, type CompositeUser } from "@hooks/useUsers";
import type { TCustomerEntity } from "@types";
import {
  buildSecretGameFeatureFlagsForRoute,
  readSecretGamesAdminConfig,
  resolveCustomerSearchSecretLaunch,
} from "@features/secret-games";

import PageHeader from "@entities/Page/PageHeader";
import { HelpButton } from "@entities/help/HelpButton";
import RefreshButton from "@entities/ui/RefreshButton";
import { CustomerFilterBar } from "./components/CustomerFilterBar";
import { CustomerRowActionMenu, TIER_SELECTED_CLASS } from "./components/CustomerActionMenu";
import { statusChipClass } from "@lib/colorRegistry";
import { isAdminLike, isCaseManagerLike, isDevLike, isViewerLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { useSystemMetrics } from "@hooks/useMetrics";
import { CustomersMetricsBar } from "./components/CustomersMetricsBar";
import CustomersNewStateView from "./components/CustomersNewStateView";
import { contactCaseManagerIdsForCustomer } from "./contactCaseManagers";
import CustomerWorkspaceModal from "./CustomerWorkspaceModal";

const PAGE_SIZE = 50;

// ─── Persisted filter state (survives in-session navigation) ──────────────────

const FILTER_KEY = "customers_page_filters";
const HIDDEN_CUSTOMERS_KEY = "customers_page_hidden_ids";

type PersistedFilters = {
  activeMode: ActiveMode;
  deletedMode: DeletedMode;
  scopeMode: ScopeMode;
  cmFilter: string;
  populationFilter: PopulationFilter;
  tierFilter: TierFilter;
  sortMode: CustomerSortMode;
  cardPoolMode: CardPoolMode;
  grantFilter: string;
  enrollmentStatuses: EnrollmentStatusBucket[];
};

function readPersistedFilters(): Partial<PersistedFilters> {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (raw) return JSON.parse(raw) as Partial<PersistedFilters>;
  } catch {}
  return {};
}

function writePersistedFilters(patch: Partial<PersistedFilters>) {
  try {
    const current = readPersistedFilters();
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}

type ActiveMode = "all" | "active" | "inactive";
type DeletedMode = "exclude" | "include" | "only";
type CustomersPageMode = "sheet" | "card";
type ScopeMode = "all" | "my" | "primary" | "secondary";
type PopulationFilter = "all" | "Youth" | "Individual" | "Family" | "unknown";
type TierFilter = "all" | "1" | "2" | "3";
type CustomerSortMode =
  | "alphabetical"
  | "first-added"
  | "last-added"
  | "first-updated"
  | "last-updated"
  | "tier-asc"
  | "tier-desc";
type CardPoolMode = "mine" | "all";
type CustomerModalState = {
  customerId: string | null;
  initialTab?: "tasks";
};

function defaultScopeMode(myUid: string, isCM: boolean): ScopeMode {
  return myUid && isCM ? "my" : "all";
}

function toActiveQuery(mode: ActiveMode) {
  if (mode === "all") return "all" as const;
  return mode === "active" ? ("true" as const) : ("false" as const);
}

function readCustomersPageMode(user: CompositeUser | null | undefined): CustomersPageMode {
  // Stored on userExtras as "legacy" | "new"; default to "card" unless user explicitly saved "legacy"
  return user?.extras?.customersPageMode === "legacy" ? "sheet" : "card";
}

function normName(c: TCustomerEntity) {
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    ""
  ).toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// prefix match ("cori" → "corrine") or 1-edit tolerance ("willson" → "wilson")
function tokenFuzzy(qt: string, nt: string): boolean {
  if (nt.startsWith(qt)) return true;
  if (qt.length < 4) return false;
  if (Math.abs(qt.length - nt.length) > 2) return false;
  return levenshtein(qt, nt) <= 1;
}

function matchesSearch(q: string, c: TCustomerEntity): boolean {
  const name = normName(c);
  const alias = String((c as any)?.alias || "").toLowerCase().trim();
  const id = String(c?.id || "").toLowerCase();
  const hmisId = String(c?.hmisId || "").toLowerCase();
  const cwId = String(c?.cwId || "").toLowerCase();

  if (name.includes(q) || alias.includes(q) || id.includes(q) || hmisId.includes(q) || cwId.includes(q)) return true;

  const qTokens = q.split(/\s+/).filter(Boolean);
  if (!qTokens.length) return true;
  const haystack = [...name.split(/\s+/), ...alias.split(/\s+/)].filter(Boolean);
  return qTokens.every((qt) => haystack.some((nt) => tokenFuzzy(qt, nt)));
}

function displayName(c: TCustomerEntity) {
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function asTime(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  const maybeTs = value as { seconds?: number; toDate?: () => Date };
  if (typeof maybeTs.toDate === "function") return maybeTs.toDate().getTime();
  if (typeof maybeTs.seconds === "number") return maybeTs.seconds * 1000;
  return 0;
}

function isDeletedCustomer(customer: TCustomerEntity): boolean {
  return customer.deleted === true || String(customer.status || "").toLowerCase() === "deleted";
}

function isActiveCustomer(customer: TCustomerEntity): boolean {
  if (typeof customer.active === "boolean") return customer.active;
  const status = String(customer.status || "").toLowerCase();
  if (status === "active") return true;
  if (status === "inactive") return false;
  if (status === "deleted") return false;
  return true;
}

function matchesDeletedFilter(customer: TCustomerEntity, mode: DeletedMode): boolean {
  const deleted = isDeletedCustomer(customer);
  if (mode === "exclude") return !deleted;
  if (mode === "only") return deleted;
  return true;
}

function matchesPopulationFilter(customer: TCustomerEntity, filter: PopulationFilter): boolean {
  if (filter === "all") return true;
  const population = String(customer.population || "").trim();
  if (filter === "unknown") return !population;
  return population === filter;
}

function matchesTierFilter(customer: TCustomerEntity, filter: TierFilter): boolean {
  if (filter === "all") return true;
  const tier = (customer as { tier?: unknown }).tier;
  return tier != null && String(tier) === filter;
}

function sortCustomerRows(rows: TCustomerEntity[], mode: CustomerSortMode): TCustomerEntity[] {
  const compareName = (a: TCustomerEntity, b: TCustomerEntity) => displayName(a).localeCompare(displayName(b));
  const tierOf = (c: TCustomerEntity) => {
    const t = (c as { tier?: number | null }).tier;
    return typeof t === "number" ? t : null;
  };

  return [...rows].sort((a, b) => {
    if (mode === "alphabetical") return compareName(a, b);
    if (mode === "first-added") return asTime(a.createdAt) - asTime(b.createdAt) || compareName(a, b);
    if (mode === "last-added") return asTime(b.createdAt) - asTime(a.createdAt) || compareName(a, b);
    if (mode === "first-updated") {
      return asTime(a.updatedAt || a.createdAt) - asTime(b.updatedAt || b.createdAt) || compareName(a, b);
    }
    if (mode === "last-updated") {
      return asTime(b.updatedAt || b.createdAt) - asTime(a.updatedAt || a.createdAt) || compareName(a, b);
    }
    if (mode === "tier-asc" || mode === "tier-desc") {
      // Untiered customers always sort to the bottom regardless of direction.
      const aTier = tierOf(a);
      const bTier = tierOf(b);
      if (aTier == null && bTier == null) return compareName(a, b);
      if (aTier == null) return 1;
      if (bTier == null) return -1;
      const delta = mode === "tier-asc" ? aTier - bTier : bTier - aTier;
      return delta || compareName(a, b);
    }
    return compareName(a, b);
  });
}

export function CustomersPage() {
  const router = useRouter();

  const [cursorId, setCursorId] = React.useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = React.useState<(string | undefined)[]>([]);

  const persisted = React.useRef(readPersistedFilters());

  const [activeMode, _setActiveMode] = React.useState<ActiveMode>(persisted.current.activeMode ?? "active");
  const setActiveMode = React.useCallback((v: ActiveMode) => { _setActiveMode(v); writePersistedFilters({ activeMode: v }); }, []);

  const [deletedMode, _setDeletedMode] = React.useState<DeletedMode>(persisted.current.deletedMode ?? "exclude");
  const setDeletedMode = React.useCallback((v: DeletedMode) => { _setDeletedMode(v); writePersistedFilters({ deletedMode: v }); }, []);

  const [scopeMode, _setScopeMode] = React.useState<ScopeMode>(persisted.current.scopeMode ?? "all");
  const setScopeMode = React.useCallback((v: ScopeMode | ((prev: ScopeMode) => ScopeMode)) => {
    _setScopeMode((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      writePersistedFilters({ scopeMode: next });
      return next;
    });
  }, []);

  const [cmFilter, _setCmFilter] = React.useState<string>(persisted.current.cmFilter ?? "all");
  const setCmFilter = React.useCallback((v: string | ((prev: string) => string)) => {
    _setCmFilter((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      writePersistedFilters({ cmFilter: next });
      return next;
    });
  }, []);

  const [search, setSearch] = React.useState<string>("");
  const [populationFilter, _setPopulationFilter] = React.useState<PopulationFilter>(persisted.current.populationFilter ?? "all");
  const setPopulationFilter = React.useCallback((v: PopulationFilter) => { _setPopulationFilter(v); writePersistedFilters({ populationFilter: v }); }, []);

  const [tierFilter, _setTierFilter] = React.useState<TierFilter>(persisted.current.tierFilter ?? "all");
  const setTierFilter = React.useCallback((v: TierFilter) => { _setTierFilter(v); writePersistedFilters({ tierFilter: v }); }, []);

  const [sortMode, _setSortMode] = React.useState<CustomerSortMode>(persisted.current.sortMode ?? "alphabetical");
  const setSortMode = React.useCallback((v: CustomerSortMode) => { _setSortMode(v); writePersistedFilters({ sortMode: v }); }, []);

  const [grantFilter, _setGrantFilter] = React.useState<string>(persisted.current.grantFilter ?? "all");
  const setGrantFilter = React.useCallback((v: string) => { _setGrantFilter(v); writePersistedFilters({ grantFilter: v }); }, []);

  const [enrollmentStatuses, _setEnrollmentStatuses] = React.useState<EnrollmentStatusBucket[]>(
    persisted.current.enrollmentStatuses ?? ["active", "closed", "deleted"],
  );
  const setEnrollmentStatuses = React.useCallback((v: EnrollmentStatusBucket[]) => {
    _setEnrollmentStatuses(v);
    writePersistedFilters({ enrollmentStatuses: v });
  }, []);

  const [pageMode, setPageMode] = React.useState<CustomersPageMode>("card");
  const [cardPoolMode, _setCardPoolMode] = React.useState<CardPoolMode>(persisted.current.cardPoolMode ?? "all");
  const setCardPoolMode = React.useCallback((v: CardPoolMode) => { _setCardPoolMode(v); writePersistedFilters({ cardPoolMode: v }); }, []);
  const [localCustomerModal, setLocalCustomerModal] = React.useState<CustomerModalState | null>(null);

  const { data: me } = useMe();
  const meUser = (me || null) as CompositeUser | null;
  const updateMe = useUpdateMe();
  const myUid = String(meUser?.uid || "");
  const [hiddenCustomerIds, setHiddenCustomerIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(HIDDEN_CUSTOMERS_KEY) || "[]") as unknown;
      if (Array.isArray(parsed)) setHiddenCustomerIds(new Set(parsed.map(String).filter(Boolean)));
    } catch {}
  }, []);

  const hideCustomer = React.useCallback((customerId: string) => {
    setHiddenCustomerIds((current) => {
      const next = new Set(current).add(customerId);
      try { localStorage.setItem(HIDDEN_CUSTOMERS_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  const showAllCustomers = React.useCallback(() => {
    setHiddenCustomerIds(new Set());
    try { localStorage.removeItem(HIDDEN_CUSTOMERS_KEY); } catch {}
  }, []);
  const meReady = me !== undefined;
  const isCM = isCaseManagerLike(meUser);
  const isDevUser = isDevLike(meUser);
  const isAdminUser = isAdminLike(meUser);
  const isViewer = isViewerLike(meUser);
  const didApplyInitialScope = React.useRef(false);
  const didApplyInitialCardPool = React.useRef(false);
  const defaultScope = defaultScopeMode(myUid, isCM);
  const defaultCardPoolMode: CardPoolMode = myUid && isCM ? "mine" : "all";

  React.useEffect(() => {
    setPageMode(readCustomersPageMode(me));
  }, [me]);

  React.useEffect(() => {
    if (didApplyInitialScope.current || !myUid) return;
    setScopeMode((current) => (current === "all" ? defaultScope : current));
    // Sync CM selector to "Me" for case managers on first load (only if still at default)
    if (isCM) setCmFilter((current) => (current === "all" ? myUid : current));
    didApplyInitialScope.current = true;
  }, [defaultScope, myUid, isCM, setScopeMode, setCmFilter]);

  React.useEffect(() => {
    if (didApplyInitialCardPool.current) return;
    if (!myUid) return;
    // Only apply default if nothing was persisted
    if (!persisted.current.cardPoolMode) setCardPoolMode(defaultCardPoolMode);
    didApplyInitialCardPool.current = true;
  }, [defaultCardPoolMode, myUid, setCardPoolMode]);

  const { data: users = [] } = useUsers({ status: "all", limit: 500 });
  const { data: orgConfig } = useOrgConfig();

  const caseManagerOptions = React.useMemo(() => {
    const labelFor = (u: CompositeUser) =>
      String(u?.displayName || u?.email || u?.uid || "-").trim();

    return (users || [])
      .filter((u: CompositeUser) => !!u?.uid && isCaseManagerLike(u))
      .map((u: CompositeUser) => ({
        uid: String(u.uid),
        email: u.email ? String(u.email) : null,
        label: labelFor(u),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const cmNameByUid = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const option of caseManagerOptions) map.set(option.uid, option.label);
    return map;
  }, [caseManagerOptions]);

  React.useEffect(() => {
    setCursorId(undefined);
    setCursorStack([]);
  }, [activeMode, deletedMode, cmFilter]);

  React.useEffect(() => {
    if (isAdminUser) return;
    if (deletedMode !== "exclude") setDeletedMode("exclude");
  }, [deletedMode, isAdminUser, setDeletedMode]);

  const searchActive = search.trim().length > 0;
  const needsFullFilterPool = searchActive;
  const serverCmId = cmFilter !== "all" ? cmFilter : undefined;
  const searchPoolFilters = React.useMemo(
    () => ({
      active: "all" as const,
      deleted: "exclude" as const,
      caseManagerId: serverCmId,
    }),
    [serverCmId],
  );

  const { data: items = [], isFetching, isError, refetch } = useCustomers(
    {
      limit: PAGE_SIZE,
      cursorId,
      active: toActiveQuery(activeMode),
      deleted: isAdminUser ? deletedMode : "exclude",
      caseManagerId: serverCmId,
    },
  );

  const { data: filterPool = [], isFetching: isFilteringPool } = useCustomersAll(
    searchPoolFilters,
    { enabled: needsFullFilterPool, maxItems: 25_000 },
  );

  const {
    data: myCustomersPool = [],
    isFetching: isFetchingMyCustomersPool,
    isError: isMyCustomersPoolError,
  } = useCustomersAll(
    { active: "all", deleted: "include", contactCaseManagerId: myUid || undefined },
    {
      enabled: meReady && defaultCardPoolMode === "mine",
      maxItems: 25_000,
    },
  );

  const {
    data: allCustomersPool = [],
    isFetching: isFetchingAllCustomersPool,
    isError: isAllCustomersPoolError,
  } = useCustomersAll(
    { active: "all", deleted: "include" },
    {
      enabled: meReady && (defaultCardPoolMode === "all" || cardPoolMode === "all"),
      maxItems: 25_000,
    },
  );

  const grantFilterActive = grantFilter !== "all" && !!grantFilter;
  const { data: enrollmentMap, isFetching: isLoadingEnrolledIds } = useGrantEnrollmentMap(
    grantFilterActive ? grantFilter : undefined,
  );

  const sourceRows = needsFullFilterPool
    ? (filterPool as TCustomerEntity[])
    : (items as TCustomerEntity[]);

  const displayRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceRows;
    return sourceRows.filter((c) => matchesSearch(q, c));
  }, [search, sourceRows]);

  const activeCardPoolRows = React.useMemo(
    () =>
      ((defaultCardPoolMode === "mine" && cardPoolMode !== "all"
        ? myCustomersPool
        : allCustomersPool) as TCustomerEntity[]),
    [allCustomersPool, cardPoolMode, defaultCardPoolMode, myCustomersPool],
  );

  const scopedRows = React.useMemo(() => {
    const targetUid = cmFilter !== "all" ? cmFilter : myUid;

    return activeCardPoolRows.filter((customer) => {
      const primaryUid = String(customer.caseManagerId || "").trim();
      const secondaryUid = String(
        (customer as { secondaryCaseManagerId?: string | null }).secondaryCaseManagerId || "",
      ).trim();
      const contactIds = contactCaseManagerIdsForCustomer(customer as Record<string, unknown>);

      if (scopeMode === "my") {
        if (!targetUid) return true;
        return contactIds.includes(targetUid);
      }

      if (scopeMode === "primary") {
        if (!targetUid) return true;
        return primaryUid === targetUid;
      }

      if (scopeMode === "secondary") {
        if (!targetUid) return true;
        return secondaryUid === targetUid;
      }

      if (cmFilter !== "all") return contactIds.includes(cmFilter);
      return true;
    });
  }, [activeCardPoolRows, cmFilter, myUid, scopeMode]);

  const locallyFilteredRows = React.useMemo(() => {
    const effectiveDeletedMode: DeletedMode = searchActive ? "exclude" : (isAdminUser ? deletedMode : "exclude");
    let rows = scopedRows
      .filter((customer) => matchesDeletedFilter(customer, effectiveDeletedMode))
      .filter((customer) => matchesPopulationFilter(customer, populationFilter))
      .filter((customer) => matchesTierFilter(customer, tierFilter));

    // Enrollment filter: show only customers enrolled in the selected grant (with status filter)
    if (grantFilterActive && enrollmentMap) {
      const statusSet = new Set(enrollmentStatuses);
      rows = rows.filter((customer) => {
        const bucket = enrollmentMap.get(String(customer.id || ""));
        return !!bucket && statusSet.has(bucket);
      });
    }

    if (searchActive) return rows;
    if (effectiveDeletedMode === "only") return rows;
    if (activeMode === "all") return rows;

    return rows.filter((customer) =>
      activeMode === "active" ? isActiveCustomer(customer) : !isActiveCustomer(customer),
    );
  }, [
    activeMode,
    deletedMode,
    enrollmentMap,
    enrollmentStatuses,
    grantFilterActive,
    isAdminUser,
    populationFilter,
    tierFilter,
    scopedRows,
    searchActive,
  ]);

  const newPageDisplayRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = !q ? locallyFilteredRows : locallyFilteredRows.filter((customer) => matchesSearch(q, customer));
    return sortCustomerRows(rows, sortMode);
  }, [locallyFilteredRows, search, sortMode]);

  const secretSearchFallbackCustomerId = React.useMemo(() => {
    const firstCustomer = newPageDisplayRows.find((customer) => !!String(customer?.id || "").trim());
    return firstCustomer ? String(firstCustomer.id || "").trim() : null;
  }, [newPageDisplayRows]);

  const secretGamesAdminConfig = React.useMemo(
    () => readSecretGamesAdminConfig(orgConfig?.secretGames),
    [orgConfig],
  );

  const secretGameCustomerPageFlags = React.useMemo(
    () => buildSecretGameFeatureFlagsForRoute(secretGamesAdminConfig, "customers"),
    [secretGamesAdminConfig],
  );

  const newPageTotalRows = React.useMemo(() => activeCardPoolRows.length, [activeCardPoolRows]);
  const isFetchingNewPagePool =
    defaultCardPoolMode === "mine" && cardPoolMode !== "all"
      ? isFetchingMyCustomersPool
      : isFetchingAllCustomersPool;
  const isNewPageError =
    defaultCardPoolMode === "mine" && cardPoolMode !== "all"
      ? isMyCustomersPoolError
      : isAllCustomersPoolError;
  const newPageIsLoading = isFetchingNewPagePool || (grantFilterActive && isLoadingEnrolledIds);

  const promoteCustomersPool = React.useCallback(() => {
    if (defaultCardPoolMode === "mine") setCardPoolMode("all");
  }, [defaultCardPoolMode, setCardPoolMode]);

  const onNext = () => {
    if (!items.length || items.length < PAGE_SIZE) return;
    const lastId = (items[items.length - 1] as TCustomerEntity | undefined)?.id as string | undefined;
    if (!lastId) return;
    setCursorStack((s) => [...s, cursorId]);
    setCursorId(lastId);
  };

  const onPrev = () => {
    if (cursorStack.length === 0) return;
    const prev = cursorStack[cursorStack.length - 1];
    setCursorStack((s) => s.slice(0, -1));
    setCursorId(prev);
  };

  const openDetailModal = React.useCallback((id: string, options?: { tab?: "tasks" }) => {
    setLocalCustomerModal({ customerId: id, initialTab: options?.tab });
  }, []);
  const openNewModal = React.useCallback(() => {
    setLocalCustomerModal({ customerId: null });
  }, []);
  const closeLocalCustomerModal = React.useCallback(() => {
    setLocalCustomerModal(null);
  }, []);

  const { data: systemMetrics } = useSystemMetrics();
  // True total from the weekly-reconciled metric doc — avoids the page-size cap
  const metricTotal =
    activeMode === "active"
      ? (systemMetrics?.customers?.active ?? null)
      : activeMode === "inactive"
        ? (systemMetrics?.customers?.inactive ?? null)
        : systemMetrics?.customers
          ? Number(systemMetrics.customers.active || 0) + Number(systemMetrics.customers.inactive || 0)
          : null;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [rowContextMenu, setRowContextMenu] = React.useState<{ id: string; x: number; y: number; nonce: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const resetFilters = () => {
    try { sessionStorage.removeItem(FILTER_KEY); } catch {}
    setActiveMode("all");
    setDeletedMode("exclude");
    setScopeMode(defaultScope);
    setCmFilter(isCM && myUid ? myUid : "all");
    setSearch("");
    setPopulationFilter("all");
    setTierFilter("all");
    setSortMode("alphabetical");
    setGrantFilter("all");
    setEnrollmentStatuses(["active", "closed", "deleted"]);
    setCardPoolMode(defaultCardPoolMode);
    setMenuOpen(false);
  };

  const handleScopeModeChange = React.useCallback(
    (nextScopeMode: ScopeMode) => {
      setScopeMode(nextScopeMode);
      promoteCustomersPool();
    },
    [promoteCustomersPool, setScopeMode],
  );

  const handleCmFilterChange = React.useCallback(
    (nextCmFilter: string) => {
      setCmFilter(nextCmFilter);
      // CM = All → also reset scope to All so the two stay in sync
      if (nextCmFilter === "all") setScopeMode("all");
      promoteCustomersPool();
    },
    [promoteCustomersPool, setCmFilter, setScopeMode],
  );

  const handleSearchChange = React.useCallback(
    (nextSearch: string) => {
      setSearch(nextSearch);
    },
    [],
  );

  const handleSearchEnter = React.useCallback(() => {
    if (isDevUser) {
      const secretLaunch = resolveCustomerSearchSecretLaunch({
        input: search,
        isDevUser,
        userId: myUid,
        fallbackCustomerId: secretSearchFallbackCustomerId,
        featureFlags: secretGameCustomerPageFlags,
      });

      if (secretLaunch.matched) {
        if (secretLaunch.ok) {
          void router.push(secretLaunch.href);
        } else {
          toast(secretLaunch.message, { type: "warning" });
        }
        return;
      }
    }
    // Search across everything — reset scope and CM filter to All
    setScopeMode("all");
    setCmFilter("all");
    promoteCustomersPool();
  }, [isDevUser, myUid, promoteCustomersPool, router, search, secretGameCustomerPageFlags, secretSearchFallbackCustomerId, setCmFilter, setScopeMode]);

  // ── 2-hour stale data banner ───────────────────────────────────────────────

  const qc = useQueryClient();
  const [staleBannerVisible, setStaleBannerVisible] = React.useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState(() => Date.now());

  React.useEffect(() => {
    setStaleBannerVisible(false);
    const t = setTimeout(() => setStaleBannerVisible(true), 2 * 60 * 60_000);
    return () => clearTimeout(t);
  }, [lastRefreshedAt]);

  const handleManualRefresh = React.useCallback(() => {
    setLastRefreshedAt(Date.now());
    setStaleBannerVisible(false);
    void qc.invalidateQueries({ queryKey: qk.customers.root, exact: false });
    void qc.refetchQueries({ queryKey: qk.customers.root, exact: false, type: "active" });
    if (!isViewer) {
      void qc.invalidateQueries({ queryKey: qk.enrollments.root, exact: false });
      void qc.refetchQueries({ queryKey: qk.enrollments.root, exact: false, type: "active" });
    }
    if (pageMode === "card") {
      setCardPoolMode("all");
    } else {
      void refetch();
    }
  }, [isViewer, pageMode, qc, refetch, setCardPoolMode]);

  const setCustomersPageMode = React.useCallback(
    async (nextMode: CustomersPageMode) => {
      if (nextMode === pageMode) return;
      const prevMode = pageMode;
      setPageMode(nextMode);
      setMenuOpen(false);
      try {
        // Persisted contract value is still "legacy" | "new"
        await updateMe.mutateAsync({ customersPageMode: nextMode === "sheet" ? "legacy" : "new" });
      } catch {
        setPageMode(prevMode);
      }
    },
    [pageMode, updateMe],
  );

  const pageModeToggle = (
    <div className="inline-flex items-center rounded border border-slate-300 bg-slate-50 p-0.5 text-sm dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        className={[
          "rounded px-3 py-1 transition",
          pageMode === "sheet"
            ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
        ].join(" ")}
        onClick={() => void setCustomersPageMode("sheet")}
        disabled={updateMe.isPending}
      >
        Sheet
      </button>
      <button
        type="button"
        className={[
          "rounded px-3 py-1 transition",
          pageMode === "card"
            ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
        ].join(" ")}
        onClick={() => void setCustomersPageMode("card")}
        disabled={updateMe.isPending}
      >
        Card
      </button>
    </div>
  );

  const metricsBar = pageMode === "card" ? <CustomersMetricsBar myUid={myUid} /> : undefined;

  return (
    <>
      <ListStyleLayout metricsBar={metricsBar}>
      <TourProvider tourKey="CustomersPage">
        <section className="space-y-4" data-tour="customers-page">
        {staleBannerVisible && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            <span>
              Customer and enrollment data may be a few hours old. This page does not automatically
              update — if you are monitoring for active changes, use the Refresh button frequently.
            </span>
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              onClick={handleManualRefresh}
            >
              Refresh now
            </button>
            <button
              type="button"
              className="ml-auto leading-none opacity-50 hover:opacity-90"
              aria-label="Dismiss"
              onClick={() => setStaleBannerVisible(false)}
            >
              ✕
            </button>
          </div>
        )}
        <PageHeader
          tourId="customers-header"
          title="Customers"
          subtitle={pageModeToggle}
          actions={
            <>
              <HelpButton pageKey="customers" />
              <RefreshButton
                queryKeys={isViewer ? [qk.customers.root] : [qk.customers.root, qk.enrollments.root]}
                onRefresh={handleManualRefresh}
                className="btn btn-sm rounded-lg"
                label="Refresh"
                title="Refresh customers"
                tourId="customers-refresh"
              />
              {!isViewer && (
                <button className="btn btn-primary btn-sm rounded-lg" data-tour="customers-new" onClick={openNewModal}>
                  New Customer
                </button>
              )}
            </>
          }
        />

        {pageMode === "card" ? (
          <CustomersNewStateView
            myUid={myUid}
            isAdminUser={isAdminUser}
            rows={newPageDisplayRows}
            totalRows={newPageTotalRows}
            isLoading={newPageIsLoading}
            isError={isNewPageError}
            activeMode={activeMode}
            deletedMode={deletedMode}
            scopeMode={scopeMode}
            cmFilter={cmFilter}
            search={search}
            populationFilter={populationFilter}
            tierFilter={tierFilter}
            sortMode={sortMode}
            grantFilter={grantFilter}
            enrollmentStatuses={enrollmentStatuses}
            caseManagerOptions={caseManagerOptions}
            onActiveModeChange={setActiveMode}
            onDeletedModeChange={setDeletedMode}
            onScopeModeChange={handleScopeModeChange}
            onCmFilterChange={handleCmFilterChange}
            onSearchChange={handleSearchChange}
            onPopulationFilterChange={setPopulationFilter}
            onTierFilterChange={setTierFilter}
            onSortModeChange={setSortMode}
            onGrantFilterChange={setGrantFilter}
            onEnrollmentStatusesChange={setEnrollmentStatuses}
            onResetFilters={resetFilters}
            onSearchEnter={handleSearchEnter}
            hiddenCustomerIds={hiddenCustomerIds}
            onHideCustomer={hideCustomer}
            onShowAllCustomers={showAllCustomers}
            onCustomerOpen={openDetailModal}
            featureFlags={isViewer ? { showEnrollmentRefreshAction: false, showBulkActions: false } : undefined}
          />
        ) : (
          <>
            <CustomerFilterBar
              myUid={myUid}
              isAdminUser={isAdminUser}
              search={search}
              defaultExpanded
              searchPlaceholder="Name, ID, HMIS, CW — Enter to search all"
              resultLabel={newPageIsLoading ? "Loading..." : `${newPageDisplayRows.length} / ${newPageTotalRows} Customers`}
              activeMode={activeMode}
              deletedMode={deletedMode}
              scopeMode={scopeMode}
              cmFilter={cmFilter}
              populationFilter={populationFilter}
              tierFilter={tierFilter}
              sortMode={sortMode}
              grantFilter={grantFilter}
              enrollmentStatuses={enrollmentStatuses}
              caseManagerOptions={caseManagerOptions}
              onActiveModeChange={setActiveMode}
              onDeletedModeChange={setDeletedMode}
              onScopeModeChange={handleScopeModeChange}
              onCmFilterChange={handleCmFilterChange}
              onSearchChange={handleSearchChange}
              onPopulationFilterChange={setPopulationFilter}
              onTierFilterChange={setTierFilter}
              onSortModeChange={setSortMode}
              onGrantFilterChange={setGrantFilter}
              onEnrollmentStatusesChange={setEnrollmentStatuses}
              onResetFilters={resetFilters}
              onSearchEnter={handleSearchEnter}
            />

            <div className="table-wrap" data-tour="customers-list">
              {hiddenCustomerIds.size > 0 ? (
                <div className="flex justify-end border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={showAllCustomers}>
                    Show All ({hiddenCustomerIds.size})
                  </button>
                </div>
              ) : null}
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-1">#</th>
                    <th>Name</th>
                    <th>Case Manager</th>
                    <th>Secondary Contact</th>
                    <th>Status</th>
                    <th>Population</th>
                    <th>Tier</th>
                    <th className="w-1">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {newPageIsLoading && newPageDisplayRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-600" colSpan={8}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {isNewPageError && !newPageIsLoading ? (
                    <tr>
                      <td className="px-4 py-3 text-red-600" colSpan={8}>
                        Error loading customers.
                      </td>
                    </tr>
                  ) : null}

                  {!newPageIsLoading && !isNewPageError && newPageDisplayRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-600" colSpan={8}>
                        {search.trim()
                          ? "No customers match your search. Try a different name or ID, or expand the filters."
                          : "No customers found. Try expanding your filters or adjusting the scope."}
                      </td>
                    </tr>
                  ) : null}

                  {newPageDisplayRows.filter((c) => !hiddenCustomerIds.has(String(c?.id || ""))).map((c, idx) => {
                    const id = String(c?.id || "");
                    const status = String(c?.status || "-");
                    const secondaryUid = String(
                      (c as { secondaryCaseManagerId?: string | null }).secondaryCaseManagerId || "",
                    ).trim();
                    const secondaryName = secondaryUid ? cmNameByUid.get(secondaryUid) || secondaryUid : "—";
                    const tier = (c as { tier?: number | null }).tier ?? null;

                    return (
                      <tr
                        key={id}
                        onClick={() => openDetailModal(id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setRowContextMenu({ id, x: event.clientX, y: event.clientY, nonce: Date.now() });
                        }}
                        title="Open customer"
                      >
                        <td className="text-slate-400">{idx + 1}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{displayName(c)}</span>
                            {c?.cwId ? <span className="text-xs text-slate-500">CW: {String(c.cwId)}</span> : null}
                            {c?.hmisId ? <span className="text-xs text-slate-500">HMIS: {String(c.hmisId)}</span> : null}
                          </div>
                        </td>

                        <td className="text-slate-700">
                          {c?.caseManagerId
                            ? cmNameByUid.get(String(c.caseManagerId)) || c.caseManagerName || c.caseManagerId
                            : "-"}
                        </td>

                        <td className="text-slate-700">{secondaryName}</td>

                        <td>
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                              statusChipClass(status),
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="text-slate-700">{c?.population ?? "-"}</td>

                        <td>
                          {typeof tier === "number" ? (
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                TIER_SELECTED_CLASS[tier] || "border-slate-200 bg-white text-slate-600",
                              ].join(" ")}
                            >
                              Tier {tier}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <CustomerRowActionMenu
                            customer={c as TCustomerEntity & { id: string }}
                            canManage={!isViewer}
                            onOpen={() => openDetailModal(id)}
                            onHide={() => hideCustomer(id)}
                            openAt={rowContextMenu?.id === id ? rowContextMenu : null}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        </section>
      </TourProvider>
      </ListStyleLayout>
      {localCustomerModal ? (
        <CustomerWorkspaceModal
          customerId={localCustomerModal.customerId}
          initialTab={localCustomerModal.initialTab}
          onClose={closeLocalCustomerModal}
        />
      ) : null}
    </>
  );
}

export default CustomersPage;
