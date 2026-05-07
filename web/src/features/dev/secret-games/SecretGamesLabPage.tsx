"use client";
// web/src/features/dev/secret-games/SecretGamesLabPage.tsx
// Unified secret-games testing environment — replaces the 4-tab sandbox.
// Layout: action bar (triggers + launch) → live customers clone → settings drawer.

import React from "react";
import type { TCustomerEntity } from "@types";
import type { EnrollmentStatusBucket } from "@hooks/useEnrollments";
import { useCustomers } from "@hooks/useCustomers";
import { useGDriveCustomerFolderSync } from "@hooks/useGDrive";
import { useMe, useUsers, type CompositeUser } from "@hooks/useUsers";
import PageHeader from "@entities/Page/PageHeader";
import CustomersNewStateView from "@features/customers/components/CustomersNewStateView";
import { type CustomerViewFeatureFlags } from "@features/customers/components/customerViewFlags";
import { isAdminLike, isCaseManagerLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { toApiError } from "@client/api";
import {
  parseSecretSearchTrigger,
  resolveSecretGameLaunch,
  getSecretGameById,
  SecretOverlayGameHost,
} from "@features/secret-games";
import { createSandboxLaunchEnvironment } from "@features/secret-games/sandboxLaunch";
import { useGameMiniPlayer } from "@features/games/GameMiniPlayerContext";
import { useRouter } from "next/navigation";
import { useSecretGamesSandbox } from "./SecretGamesSandboxContext";
import GamesSandboxActionBar from "./GamesSandboxActionBar";
import GamesSandboxDrawer from "./GamesSandboxDrawer";

type ActiveMode = "all" | "active" | "inactive";
type DeletedMode = "exclude" | "include" | "only";
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
type ReconcileDirection = "customer_to_folder" | "folder_to_customer";

function normName(customer: TCustomerEntity) {
  return (
    (customer?.name && String(customer.name).trim()) ||
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
    ""
  ).toLowerCase();
}

function displayName(customer: TCustomerEntity) {
  return (
    (customer?.name && String(customer.name).trim()) ||
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
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
  if (status === "inactive" || status === "deleted") return false;
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
    if (mode === "first-updated") return asTime(a.updatedAt || a.createdAt) - asTime(b.updatedAt || b.createdAt) || compareName(a, b);
    if (mode === "last-updated") return asTime(b.updatedAt || b.createdAt) - asTime(a.updatedAt || a.createdAt) || compareName(a, b);
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

// ─── Game-starting overlay ────────────────────────────────────────────────────

function GameStartingOverlay({
  visible,
  onCancel,
}: {
  visible: boolean;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onCancel]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-700 bg-slate-900/95 px-10 py-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="mb-1 text-3xl font-bold tracking-tight text-white">Game Starting</div>
        <div className="mt-3 space-y-1.5 text-sm text-slate-300">
          <div>
            Press{" "}
            <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">Q</kbd>
            {" "}or{" "}
            <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">Esc</kbd>
            {" "}to cancel
          </div>
          <div>
            Press{" "}
            <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">P</kbd>
            {" "}to pause
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecretGamesLabPage() {
  const router = useRouter();
  const { openMiniPlayer, closeMiniPlayer, state: miniPlayerState } = useGameMiniPlayer();
  const { useRealCustomers, visibleCustomerEntities } = useSecretGamesSandbox();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<ActiveMode>("active");
  const [deletedMode, setDeletedMode] = React.useState<DeletedMode>("exclude");
  const [scopeMode, setScopeMode] = React.useState<ScopeMode>("all");
  const [cmFilter, setCmFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [populationFilter, setPopulationFilter] = React.useState<PopulationFilter>("all");
  const [sortMode, setSortMode] = React.useState<CustomerSortMode>("alphabetical");
  const [grantFilter, setGrantFilter] = React.useState<string>("all");
  const [enrollmentStatuses, setEnrollmentStatuses] = React.useState<EnrollmentStatusBucket[]>([
    "active",
    "closed",
    "deleted",
  ]);
  const [reconcileDirection, setReconcileDirection] = React.useState<ReconcileDirection>("customer_to_folder");
  const [reconcileOnlyLinked, setReconcileOnlyLinked] = React.useState(true);
  const [reconcilePreview, setReconcilePreview] = React.useState<any[]>([]);
  const [reconcileCount, setReconcileCount] = React.useState(0);

  // Game-starting overlay
  const [showStartOverlay, setShowStartOverlay] = React.useState(false);
  const [overlayGameId, setOverlayGameId] = React.useState<string | null>(null);
  const prevMiniPlayerOpen = React.useRef(false);
  const [viewportSize, setViewportSize] = React.useState({ width: 1280, height: 720 });

  const { data: me } = useMe();
  const customerFolderSync = useGDriveCustomerFolderSync();
  const meUser = (me || null) as CompositeUser | null;
  const myUid = String(meUser?.uid || "");
  const isAdminUser = isAdminLike(meUser);
  const isCM = isCaseManagerLike(meUser);
  const sampleLimit = 10;

  const { data: users = [] } = useUsers({ status: "all", limit: 500 });
  const { data: realCustomers = [], isFetching: realFetching, isError: realError } = useCustomers(
    { limit: sampleLimit, active: "all", deleted: isAdminUser ? deletedMode : "exclude" },
    { staleTime: 60_000 },
  );

  // Unified customer source: real Firestore data or sandbox fixtures
  const sampleCustomers: TCustomerEntity[] = useRealCustomers
    ? realCustomers
    : visibleCustomerEntities;
  const isFetching = useRealCustomers ? realFetching : false;
  const isError = useRealCustomers ? realError : false;

  // Game-active state: mini-player open
  const gameActive = miniPlayerState.open;

  // Show the "Game Starting" overlay whenever a game becomes active
  React.useEffect(() => {
    const wasOpen = prevMiniPlayerOpen.current;
    if (miniPlayerState.open && !wasOpen) {
      setShowStartOverlay(true);
      const t = setTimeout(() => setShowStartOverlay(false), 3_000);
      prevMiniPlayerOpen.current = true;
      return () => clearTimeout(t);
    }
    if (!miniPlayerState.open) {
      prevMiniPlayerOpen.current = false;
    }
  }, [miniPlayerState.open]);

  // Cancel overlay + active game
  const handleCancelGame = React.useCallback(() => {
    setShowStartOverlay(false);
    closeMiniPlayer();
  }, [closeMiniPlayer]);

  // Scroll locking rules:
  //   page overlays  (bug canvas, game-start banner) → lock scroll
  //   modal overlays (drawer)                        → lock scroll
  //   inline games   (mini-player)                   → leave scroll alone
  const shouldLockScroll = drawerOpen || showStartOverlay;

  React.useEffect(() => {
    if (!shouldLockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [shouldLockScroll]);

  React.useEffect(() => {
    const syncViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);
    return () => window.removeEventListener("resize", syncViewportSize);
  }, []);

  const caseManagerOptions = React.useMemo(() => {
    const labelFor = (user: CompositeUser) => String(user?.displayName || user?.email || user?.uid || "-").trim();
    return (users || [])
      .filter((user: CompositeUser) => !!user?.uid && isCaseManagerLike(user))
      .map((user: CompositeUser) => ({
        uid: String(user.uid),
        email: user.email ? String(user.email) : null,
        label: labelFor(user),
        active: user.active !== false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const sandboxViewFlags = React.useMemo<Partial<CustomerViewFeatureFlags>>(
    () => ({
      showEnrollmentRefreshAction: false,
      showBulkActions: false,
      searchPlaceholder: "Search customers — or type flip, farm, broken data, necromancer, asteroids",
      emptyStateDefaultMessage: "No sampled customers found.",
      emptyStateSearchMessage: "No sampled customers match your search.",
    }),
    [],
  );

  const filteredRows = React.useMemo(() => {
    let rows = sampleCustomers.filter((customer) => matchesDeletedFilter(customer, isAdminUser ? deletedMode : "exclude"));
    if (scopeMode === "my") {
      rows = rows.filter((customer) => {
        const primary = String(customer.caseManagerId || "").trim();
        const secondary = String(customer.secondaryCaseManagerId || "").trim();
        return primary === myUid || secondary === myUid;
      });
    } else if (scopeMode === "secondary") {
      if (cmFilter !== "all") rows = rows.filter((customer) => String(customer.secondaryCaseManagerId || "") === cmFilter);
      else rows = rows.filter((customer) => !!String(customer.secondaryCaseManagerId || "").trim());
    } else if (cmFilter !== "all") {
      rows = rows.filter((customer) => String(customer.caseManagerId || "") === cmFilter);
    } else if (scopeMode === "primary") {
      rows = rows.filter((customer) => !!String(customer.caseManagerId || "").trim());
    }
    rows = rows.filter((customer) => matchesPopulationFilter(customer, populationFilter));
    if (activeMode !== "all") rows = rows.filter((customer) => activeMode === "active" ? isActiveCustomer(customer) : !isActiveCustomer(customer));
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((customer) =>
        normName(customer).includes(query) ||
        String(customer?.id || "").toLowerCase().includes(query) ||
        String(customer?.hmisId || "").toLowerCase().includes(query) ||
        String(customer?.cwId || "").toLowerCase().includes(query),
      );
    }
    return sortCustomerRows(rows, sortMode);
  }, [activeMode, cmFilter, deletedMode, isAdminUser, myUid, populationFilter, sampleCustomers, scopeMode, search, sortMode]);

  const handleSearchEnter = React.useCallback(() => {
    const parsed = parseSecretSearchTrigger(search);
    if (!parsed.matched) {
      if (search.trim()) {
        toast("No game command matched — try: flip, broken data, farm, necromancer, asteroids", { type: "info" });
      }
      return;
    }

    const environment = createSandboxLaunchEnvironment();
    const decision = resolveSecretGameLaunch(parsed.request, environment);

    if (!decision.ok || !decision.game) {
      toast(decision.blockers[0]?.reason || "Resolver blocked this launch.", { type: "warning" });
      return;
    }

    const game = getSecretGameById(parsed.gameId);

    // Legacy mini-player games → launch directly
    if (game?.kind === "legacy-adapter" && game.legacyAdapter?.launchHost === "mini-player" && game.legacyAdapter.legacyGameId) {
      openMiniPlayer(game.legacyAdapter.legacyGameId);
      setSearch("");
      return;
    }

    // Card-native games — open customer page for the first result so user sees it in context
    if (game?.presentation === "card-native") {
      const customerId = filteredRows[0]?.id ? String(filteredRows[0].id) : null;
      if (customerId) {
        toast(`${game.title} — opening customer card`, { type: "info" });
        void router.push(`/customers/${customerId}`);
      } else {
        toast(`${game.title} — card-native game (needs a customer card to mount in)`, { type: "info" });
      }
      setSearch("");
      return;
    }

    // Immersive overlay games — not yet playable
    if (game?.presentation === "immersive") {
      setOverlayGameId(game.id);
      setSearch("");
      return;
    }

    toast(`${decision.game.title} — resolver ok, no launch path for this game type yet`, { type: "info" });
    setSearch("");
  }, [filteredRows, openMiniPlayer, router, search]);

  const handleResetFilters = React.useCallback(() => {
    setActiveMode("active");
    setDeletedMode("exclude");
    setScopeMode("all");
    setCmFilter("all");
    setSearch("");
    setPopulationFilter("all");
    setSortMode("alphabetical");
    setGrantFilter("all");
    setEnrollmentStatuses(["active", "closed", "deleted"]);
  }, []);

  // Disable customer modal redirect while a game is active
  const handleCustomerOpen = React.useCallback((customerId: string) => {
    if (gameActive) {
      toast("Finish the game first.", { type: "info" });
      return;
    }
    void router.push(`/customers/${customerId}`);
  }, [gameActive, router]);

  const runReconcile = React.useCallback(async (apply: boolean) => {
    try {
      const result = await customerFolderSync.mutateAsync({
        mode: "reconcile",
        direction: reconcileDirection,
        onlyLinked: reconcileOnlyLinked,
        apply,
        limit: 250,
      });
      const items = Array.isArray((result as any)?.items) ? (result as any).items : [];
      setReconcilePreview(items);
      setReconcileCount(Number((result as any)?.count || items.length || 0));
      toast(apply ? "Folder reconcile applied." : "Folder reconcile preview loaded.", { type: "success" });
    } catch (error) {
      toast(toApiError(error).error || "Failed to run folder reconcile.", { type: "error" });
    }
  }, [customerFolderSync, reconcileDirection, reconcileOnlyLinked]);

  return (
    <>
      <GameStartingOverlay visible={showStartOverlay} onCancel={handleCancelGame} />
      <GamesSandboxDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <SecretOverlayGameHost
        gameId={overlayGameId}
        open={overlayGameId !== null}
        availableWidth={viewportSize.width}
        availableHeight={viewportSize.height}
        onOpenChange={(next) => {
          if (!next) setOverlayGameId(null);
        }}
      />

      <section className="space-y-4">
        <GamesSandboxActionBar
          onSettingsOpen={() => setDrawerOpen(true)}
        />

        <PageHeader
          title="Secret Games Lab"
          subtitle={
            <span>
              Live customer clone. Use trigger buttons above to fire ambient floaters; use Start buttons for
              direct game launch. Type a secret command in the search box and press Enter.
            </span>
          }
        />

        {isAdminUser && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">Customer / Folder Reconcile</div>
                <div className="text-xs text-slate-500">
                  Preview or apply archive sync between customer active state and the folder index sheet.
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="field min-w-[220px]">
                  <span className="label">Direction</span>
                  <select
                    className="input"
                    value={reconcileDirection}
                    onChange={(e) => setReconcileDirection(e.currentTarget.value as ReconcileDirection)}
                  >
                    <option value="customer_to_folder">Archive folders from customer status</option>
                    <option value="folder_to_customer">Mark customers from folder status</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-600"
                    checked={reconcileOnlyLinked}
                    onChange={(e) => setReconcileOnlyLinked(e.currentTarget.checked)}
                  />
                  Only linked folders
                </label>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={customerFolderSync.isPending}
                    onClick={() => void runReconcile(false)}
                  >
                    Preview
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={customerFolderSync.isPending}
                    onClick={() => void runReconcile(true)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {customerFolderSync.isPending ? "Running reconcile…" : `${reconcileCount} mismatches in current preview`}
            </div>
            {reconcilePreview.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Folder</th>
                      <th className="px-3 py-2 text-left">Current</th>
                      <th className="px-3 py-2 text-left">Target</th>
                      <th className="px-3 py-2 text-left">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcilePreview.slice(0, 20).map((item) => (
                      <tr
                        key={`${String(item.customerId || "")}:${String(item.folderId || "")}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2 text-slate-900">{String(item.customerName || item.customerId || "-")}</td>
                        <td className="px-3 py-2 text-slate-900">{String(item.folderName || item.folderId || "-")}</td>
                        <td className="px-3 py-2 text-slate-500">
                          Customer: {item.customerActive ? "active" : "inactive"} / Folder: {String(item.folderStatus || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          Customer: {item.targetCustomerActive ? "active" : "inactive"} / Folder: {String(item.targetFolderStatus || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{String(item.matchScore || 0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <CustomersNewStateView
          myUid={myUid}
          isAdminUser={isAdminUser}
          rows={filteredRows}
          totalRows={sampleCustomers.length}
          isLoading={isFetching}
          isError={isError}
          activeMode={activeMode}
          deletedMode={deletedMode}
          scopeMode={myUid && isCM ? scopeMode : "all"}
          cmFilter={cmFilter}
          search={search}
          populationFilter={populationFilter}
          sortMode={sortMode}
          grantFilter={grantFilter}
          enrollmentStatuses={enrollmentStatuses}
          caseManagerOptions={caseManagerOptions}
          onActiveModeChange={setActiveMode}
          onDeletedModeChange={setDeletedMode}
          onScopeModeChange={setScopeMode}
          onCmFilterChange={setCmFilter}
          onSearchChange={setSearch}
          onPopulationFilterChange={setPopulationFilter}
          onSortModeChange={setSortMode}
          onGrantFilterChange={setGrantFilter}
          onEnrollmentStatusesChange={setEnrollmentStatuses}
          onResetFilters={handleResetFilters}
          onSearchEnter={handleSearchEnter}
          onCustomerOpen={handleCustomerOpen}
          featureFlags={sandboxViewFlags}
        />
      </section>
    </>
  );
}
