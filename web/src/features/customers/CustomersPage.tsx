// web/src/features/customers/CustomersPage.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ListStyleLayout } from "@entities/Page/listStyle";
import { TourProvider } from "../../tour/TourCtx";
import {
  useCustomers,
  useCustomersAll,
  useSetCustomerActive,
  useSoftDeleteCustomers,
  useHardDeleteCustomers,
} from "@hooks/useCustomers";
import { useGrantEnrolledCustomerIds } from "@hooks/useEnrollments";
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
import RefreshButton from "@entities/ui/RefreshButton";
import ActionMenu from "@entities/ui/ActionMenu";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import { statusChipClass } from "@lib/colorRegistry";
import { fmtDateSmartOrDash } from "@lib/formatters";
import { isAdminLike, isCaseManagerLike, isDevLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { useSystemMetrics } from "@hooks/useMetrics";
import { CustomersMetricsBar } from "./components/CustomersMetricsBar";
import CustomersNewStateView from "./components/CustomersNewStateView";
import { contactCaseManagerIdsForCustomer } from "./contactCaseManagers";

const PAGE_SIZE = 50;

// ─── Persisted filter state (survives in-session navigation) ──────────────────

const FILTER_KEY = "customers_page_filters";

type PersistedFilters = {
  activeMode: ActiveMode;
  deletedMode: DeletedMode;
  scopeMode: ScopeMode;
  cmFilter: string;
  populationFilter: PopulationFilter;
  sortMode: CustomerSortMode;
  cardPoolMode: CardPoolMode;
  grantFilter: string;
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
type CustomersPageMode = "legacy" | "new";
type ScopeMode = "all" | "my" | "primary" | "secondary";
type PopulationFilter = "all" | "Youth" | "Individual" | "Family" | "unknown";
type CustomerSortMode =
  | "alphabetical"
  | "first-added"
  | "last-added"
  | "first-updated"
  | "last-updated"
  | "highest-acuity"
  | "lowest-acuity";
type CardPoolMode = "mine" | "all";

function defaultScopeMode(myUid: string, isCM: boolean): ScopeMode {
  return myUid && isCM ? "my" : "all";
}

function toActiveQuery(mode: ActiveMode) {
  if (mode === "all") return "all" as const;
  return mode === "active" ? ("true" as const) : ("false" as const);
}

function readCustomersPageMode(user: CompositeUser | null | undefined): CustomersPageMode {
  // Default to "new" unless user has explicitly saved "legacy"
  return user?.extras?.customersPageMode === "legacy" ? "legacy" : "new";
}

function normName(c: TCustomerEntity) {
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    ""
  ).toLowerCase();
}

function displayName(c: TCustomerEntity) {
  return (
    (c?.name && String(c.name).trim()) ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function fmtDate(v: unknown) {
  return fmtDateSmartOrDash(v);
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

function sortCustomerRows(rows: TCustomerEntity[], mode: CustomerSortMode): TCustomerEntity[] {
  const compareName = (a: TCustomerEntity, b: TCustomerEntity) => displayName(a).localeCompare(displayName(b));

  return [...rows].sort((a, b) => {
    const aScore = typeof a.acuityScore === "number" ? a.acuityScore : null;
    const bScore = typeof b.acuityScore === "number" ? b.acuityScore : null;

    if (mode === "alphabetical") return compareName(a, b);
    if (mode === "first-added") return asTime(a.createdAt) - asTime(b.createdAt) || compareName(a, b);
    if (mode === "last-added") return asTime(b.createdAt) - asTime(a.createdAt) || compareName(a, b);
    if (mode === "first-updated") {
      return asTime(a.updatedAt || a.createdAt) - asTime(b.updatedAt || b.createdAt) || compareName(a, b);
    }
    if (mode === "last-updated") {
      return asTime(b.updatedAt || b.createdAt) - asTime(a.updatedAt || a.createdAt) || compareName(a, b);
    }
    if (mode === "lowest-acuity") {
      if (aScore == null && bScore == null) return compareName(a, b);
      if (aScore == null) return 1;
      if (bScore == null) return -1;
      return aScore - bScore || compareName(a, b);
    }
    if (aScore == null && bScore == null) return compareName(a, b);
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    return bScore - aScore || compareName(a, b);
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

  const [sortMode, _setSortMode] = React.useState<CustomerSortMode>(persisted.current.sortMode ?? "alphabetical");
  const setSortMode = React.useCallback((v: CustomerSortMode) => { _setSortMode(v); writePersistedFilters({ sortMode: v }); }, []);

  const [grantFilter, _setGrantFilter] = React.useState<string>(persisted.current.grantFilter ?? "all");
  const setGrantFilter = React.useCallback((v: string) => { _setGrantFilter(v); writePersistedFilters({ grantFilter: v }); }, []);

  const [pageMode, setPageMode] = React.useState<CustomersPageMode>("new");
  const [cardPoolMode, _setCardPoolMode] = React.useState<CardPoolMode>(persisted.current.cardPoolMode ?? "all");
  const setCardPoolMode = React.useCallback((v: CardPoolMode) => { _setCardPoolMode(v); writePersistedFilters({ cardPoolMode: v }); }, []);

  const { data: me } = useMe();
  const meUser = (me || null) as CompositeUser | null;
  const updateMe = useUpdateMe();
  const myUid = String(meUser?.uid || "");
  const meReady = me !== undefined;
  const isCM = isCaseManagerLike(meUser);
  const isDevUser = isDevLike(meUser);
  const isAdminUser = isAdminLike(meUser);
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
      enabled: pageMode === "new" && meReady && defaultCardPoolMode === "mine",
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
      enabled: pageMode === "new" && meReady && (defaultCardPoolMode === "all" || cardPoolMode === "all"),
      maxItems: 25_000,
    },
  );

  const grantFilterActive = grantFilter !== "all" && !!grantFilter;
  const { data: enrolledCustomerIds, isFetching: isLoadingEnrolledIds } = useGrantEnrolledCustomerIds(
    grantFilterActive ? grantFilter : undefined,
  );

  const sourceRows = needsFullFilterPool
    ? (filterPool as TCustomerEntity[])
    : (items as TCustomerEntity[]);

  const displayRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceRows;
    return sourceRows.filter(
      (c) =>
        normName(c).includes(q) ||
        String(c?.id || "").toLowerCase().includes(q) ||
        String(c?.hmisId || "").toLowerCase().includes(q) ||
        String(c?.cwId || "").toLowerCase().includes(q),
    );
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
        if (!myUid) return true;
        return contactIds.includes(myUid);
      }

      if (scopeMode === "primary") {
        if (!targetUid) return true;
        return primaryUid === targetUid;
      }

      if (scopeMode === "secondary") {
        if (!targetUid) return true;
        return secondaryUid === targetUid;
      }

      if (cmFilter !== "all") return primaryUid === cmFilter;
      return true;
    });
  }, [activeCardPoolRows, cmFilter, myUid, scopeMode]);

  const locallyFilteredRows = React.useMemo(() => {
    const effectiveDeletedMode: DeletedMode = searchActive ? "exclude" : (isAdminUser ? deletedMode : "exclude");
    let rows = scopedRows
      .filter((customer) => matchesDeletedFilter(customer, effectiveDeletedMode))
      .filter((customer) => matchesPopulationFilter(customer, populationFilter));

    // Enrollment filter: show only customers enrolled in the selected grant
    if (grantFilterActive && enrolledCustomerIds) {
      rows = rows.filter((customer) => enrolledCustomerIds.has(String(customer.id || "")));
    }

    if (searchActive) return rows;
    if (effectiveDeletedMode === "only") return rows;
    if (activeMode === "all") return rows;

    return rows.filter((customer) =>
      activeMode === "active" ? isActiveCustomer(customer) : !isActiveCustomer(customer),
    );
  }, [activeMode, deletedMode, enrolledCustomerIds, grantFilterActive, isAdminUser, populationFilter, scopedRows, searchActive]);

  const newPageDisplayRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = !q
      ? locallyFilteredRows
      : locallyFilteredRows.filter(
      (customer) =>
        normName(customer).includes(q) ||
        String(customer?.id || "").toLowerCase().includes(q) ||
        String(customer?.hmisId || "").toLowerCase().includes(q) ||
        String(customer?.cwId || "").toLowerCase().includes(q),
      );
    return sortCustomerRows(rows, sortMode);
  }, [locallyFilteredRows, search, sortMode]);

  const secretSearchFallbackCustomerId = React.useMemo(() => {
    const rows = pageMode === "new" ? newPageDisplayRows : displayRows;
    const firstCustomer = rows.find((customer) => !!String(customer?.id || "").trim());
    return firstCustomer ? String(firstCustomer.id || "").trim() : null;
  }, [displayRows, newPageDisplayRows, pageMode]);

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

  const promoteCustomersPool = React.useCallback(() => {
    if (pageMode !== "new") return;
    if (defaultCardPoolMode === "mine") setCardPoolMode("all");
  }, [defaultCardPoolMode, pageMode, setCardPoolMode]);

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

  const openDetailModal = (id: string) => router.push(`/customers/${id}`);
  const openNewModal = () => router.push(`/customers/new`);

  const setActive = useSetCustomerActive();
  const softDelete = useSoftDeleteCustomers();
  const hardDelete = useHardDeleteCustomers();

  const toggleActive = async (id: string, nextActive: boolean) => {
    try {
      await setActive.mutateAsync({ id, active: nextActive });
    } catch {
      // no-op for now
    }
  };

  const doDelete = async (id: string) => {
    const ok = window.confirm("Soft delete this customer? (You can include deleted later.)");
    if (!ok) return;
    try {
      await softDelete.mutateAsync(id);
    } catch {
      // no-op for now
    }
  };

  const doHardDelete = async (id: string) => {
    if (!isAdminUser) return;
    const ok = window.confirm("Hard delete this customer permanently? This cannot be undone.");
    if (!ok) return;
    try {
      await hardDelete.mutateAsync(id);
    } catch {
      // no-op for now
    }
  };

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
    setSortMode("alphabetical");
    setGrantFilter("all");
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
    void qc.invalidateQueries({ queryKey: qk.enrollments.root, exact: false });
    void qc.refetchQueries({ queryKey: qk.customers.root, exact: false, type: "active" });
    void qc.refetchQueries({ queryKey: qk.enrollments.root, exact: false, type: "active" });
    if (pageMode === "new") {
      setCardPoolMode("all");
    } else {
      void refetch();
    }
  }, [pageMode, qc, refetch, setCardPoolMode]);

  const setCustomersPageMode = React.useCallback(
    async (nextMode: CustomersPageMode) => {
      if (nextMode === pageMode) return;
      const prevMode = pageMode;
      setPageMode(nextMode);
      setMenuOpen(false);
      try {
        await updateMe.mutateAsync({ customersPageMode: nextMode });
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
          pageMode === "legacy"
            ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
        ].join(" ")}
        onClick={() => void setCustomersPageMode("legacy")}
        disabled={updateMe.isPending}
      >
        Legacy
      </button>
      <button
        type="button"
        className={[
          "rounded px-3 py-1 transition",
          pageMode === "new"
            ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
        ].join(" ")}
        onClick={() => void setCustomersPageMode("new")}
        disabled={updateMe.isPending}
      >
        New
      </button>
    </div>
  );

  const metricsBar = pageMode === "new" ? <CustomersMetricsBar myUid={myUid} /> : undefined;

  return (
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
              <RefreshButton
                queryKeys={[qk.customers.root, qk.enrollments.root]}
                onRefresh={handleManualRefresh}
                className="btn btn-sm rounded-lg"
                label="Refresh"
                title="Refresh customers"
                tourId="customers-refresh"
              />
              <button className="btn btn-primary btn-sm rounded-lg" data-tour="customers-new" onClick={openNewModal}>
                New Customer
              </button>
              {pageMode === "legacy" ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm rounded-lg"
                    aria-label="More filters"
                    title="More filters"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <span className="text-lg leading-none">...</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Filters
                      </div>
                      <div className="space-y-3">
                        {isAdminUser ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-600 dark:text-slate-300">Deleted</span>
                            <select
                              className="select"
                              value={deletedMode}
                              onChange={(e) => setDeletedMode(e.currentTarget.value as DeletedMode)}
                            >
                              <option value="exclude">Exclude</option>
                              <option value="include">Include</option>
                              <option value="only">Only</option>
                            </select>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-2 border-t pt-2">
                          <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={resetFilters}>
                            Reset
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm rounded-lg"
                            onClick={() => setMenuOpen(false)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          }
        />

        {pageMode === "new" ? (
          <CustomersNewStateView
            myUid={myUid}
            isAdminUser={isAdminUser}
            rows={newPageDisplayRows}
            totalRows={newPageTotalRows}
            isLoading={isFetchingNewPagePool || (grantFilterActive && isLoadingEnrolledIds)}
            isError={isNewPageError}
            activeMode={activeMode}
            deletedMode={deletedMode}
            scopeMode={scopeMode}
            cmFilter={cmFilter}
            search={search}
            populationFilter={populationFilter}
            sortMode={sortMode}
            grantFilter={grantFilter}
            caseManagerOptions={caseManagerOptions}
            onActiveModeChange={setActiveMode}
            onDeletedModeChange={setDeletedMode}
            onScopeModeChange={handleScopeModeChange}
            onCmFilterChange={handleCmFilterChange}
            onSearchChange={handleSearchChange}
            onPopulationFilterChange={setPopulationFilter}
            onSortModeChange={setSortMode}
            onGrantFilterChange={setGrantFilter}
            onResetFilters={resetFilters}
            onSearchEnter={handleSearchEnter}
          />
        ) : (
          <>
            <div className="card" data-tour="customers-filters">
              <div className="card-section">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Status</span>
                    <div className="inline-flex overflow-hidden rounded border border-slate-300 text-sm">
                      {([
                        ["all", "All"],
                        ["active", "Active"],
                        ["inactive", "Inactive"],
                      ] as Array<[ActiveMode, string]>).map(([mode, label], index) => (
                        <button
                          key={mode}
                          type="button"
                          className={[
                            "px-3 py-1",
                            index > 0 ? "border-l border-slate-300" : "",
                            activeMode === mode
                              ? "bg-blue-600 text-white font-medium"
                              : "bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setActiveMode(mode)}
                          disabled={isFetching || isFilteringPool}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {myUid ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Scope</span>
                      <div className="inline-flex overflow-hidden rounded border border-slate-300 text-sm">
                        <button
                          type="button"
                          className={[
                            "px-3 py-1",
                            cmFilter === myUid
                              ? "bg-blue-600 text-white font-medium"
                              : "bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setCmFilter(myUid)}
                        >
                          My Customers
                        </button>
                        <button
                          type="button"
                          className={[
                            "border-l border-slate-300 px-3 py-1",
                            cmFilter === "all"
                              ? "bg-blue-600 text-white font-medium"
                              : "bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => setCmFilter("all")}
                        >
                          All
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Case Manager</span>
                    <CaseManagerSelect
                      value={cmFilter === "all" ? null : cmFilter}
                      onChange={(uid) => setCmFilter(uid || "all")}
                      options={caseManagerOptions}
                      includeAll
                      allLabel="All"
                      tourId="customers-filter-cm"
                    />
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-sm text-slate-600">Search</span>
                    <input
                      className="input min-w-[260px]"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearchEnter(); }}
                      placeholder="Name, ID, HMIS, CW — Enter to search all"
                      aria-label="Search customers"
                      data-tour="customers-filter-search"
                    />
                    {search.trim() ? (
                      <button className="btn btn-ghost btn-sm rounded-lg" onClick={() => setSearch("")}>
                        Clear
                      </button>
                    ) : null}
                    <div className="text-xs text-gray-500">
                      {displayRows.length} / {metricTotal ?? sourceRows.length}
                      {metricTotal != null && cmFilter !== "all" ? " (filtered)" : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="table-wrap" data-tour="customers-list">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Case Manager</th>
                    <th>Status</th>
                    <th>Population</th>
                    <th>Acuity</th>
                    <th>Updated</th>
                    <th className="w-1">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {(isFetching || isFilteringPool) && sourceRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-600" colSpan={7}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {isError && !isFetching && !isFilteringPool ? (
                    <tr>
                      <td className="px-4 py-3 text-red-600" colSpan={7}>
                        Error loading customers.
                      </td>
                    </tr>
                  ) : null}

                  {!isFetching && !isFilteringPool && !isError && displayRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-600" colSpan={7}>
                        No results.
                      </td>
                    </tr>
                  ) : null}

                  {displayRows.map((c) => {
                    const id = String(c?.id || "");
                    const status = String(c?.status || "-");
                    const active =
                      typeof c?.active === "boolean"
                        ? c.active
                        : String(c?.status || "active").toLowerCase() === "active";

                    return (
                      <tr key={id} onClick={() => openDetailModal(id)} title="Open customer">
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{displayName(c)}</span>
                            {c?.cwId ? <span className="text-xs text-slate-500">CW: {String(c.cwId)}</span> : null}
                            {c?.hmisId ? <span className="text-xs text-slate-500">HMIS: {String(c.hmisId)}</span> : null}
                          </div>
                        </td>

                        <td className="text-slate-700">{c?.caseManagerName || c?.caseManagerId || "-"}</td>

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
                        <td className="text-slate-700">
                          {typeof c?.acuityScore === "number" ? c.acuityScore.toFixed(2) : "-"}
                        </td>
                        <td className="text-slate-700">{fmtDate(c?.updatedAt || c?.createdAt)}</td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <ActionMenu
                            tourId={`customers-row-actions-${id}`}
                            disabled={setActive.isPending || softDelete.isPending || hardDelete.isPending}
                            items={[
                              {
                                key: "open",
                                label: "Open",
                                onSelect: () => openDetailModal(id),
                              },
                              {
                                key: "toggle-active",
                                label: active ? "Deactivate" : "Activate",
                                onSelect: () => toggleActive(id, !active),
                              },
                              {
                                key: "delete",
                                label: "Delete",
                                danger: true,
                                onSelect: () => doDelete(id),
                              },
                              ...(isAdminUser
                                ? [{
                                    key: "hard-delete",
                                    label: "Hard Delete",
                                    danger: true,
                                    onSelect: () => doHardDelete(id),
                                  }]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t p-3" data-tour="customers-pager">
                <button
                  className="btn btn-sm"
                  onClick={onPrev}
                  disabled={needsFullFilterPool || isFetching || cursorStack.length === 0}
                  title={needsFullFilterPool ? "Paging disabled while search is active" : undefined}
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500">
                  {needsFullFilterPool
                    ? `${displayRows.length} results`
                    : `${Math.min(items.length, PAGE_SIZE)} / ${PAGE_SIZE}`}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={onNext}
                  disabled={needsFullFilterPool || isFetching || items.length < PAGE_SIZE}
                  title={needsFullFilterPool ? "Paging disabled while search is active" : undefined}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </TourProvider>
    </ListStyleLayout>
  );
}

export default CustomersPage;
