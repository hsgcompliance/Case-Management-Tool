"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { TCustomerEntity } from "@types";
import { useCustomers } from "@hooks/useCustomers";
import { useMe, useUsers, type CompositeUser } from "@hooks/useUsers";
import PageHeader from "@entities/Page/PageHeader";
import CustomersNewStateView from "@features/customers/components/CustomersNewStateView";
import { CustomersMetricsBar } from "@features/customers/components/CustomersMetricsBar";
import { type CustomerViewFeatureFlags } from "@features/customers/components/customerViewFlags";
import { isAdminLike, isCaseManagerLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { parseSecretSearchTrigger, resolveSecretGameLaunch } from "@features/secret-games";
import { buildSandboxLaunchHref, createSandboxLaunchEnvironment } from "@features/secret-games/sandboxLaunch";

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

export default function SecretGamesOverviewPage() {
  const router = useRouter();
  const [activeMode, setActiveMode] = React.useState<ActiveMode>("active");
  const [deletedMode, setDeletedMode] = React.useState<DeletedMode>("exclude");
  const [scopeMode, setScopeMode] = React.useState<ScopeMode>("all");
  const [cmFilter, setCmFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [populationFilter, setPopulationFilter] = React.useState<PopulationFilter>("all");
  const [sortMode, setSortMode] = React.useState<CustomerSortMode>("alphabetical");
  const [grantFilter, setGrantFilter] = React.useState<string>("all");

  const { data: me } = useMe();
  const meUser = (me || null) as CompositeUser | null;
  const myUid = String(meUser?.uid || "");
  const isAdminUser = isAdminLike(meUser);
  const isCM = isCaseManagerLike(meUser);
  const sampleLimit = 10;

  const { data: users = [] } = useUsers({ status: "all", limit: 500 });
  const { data: sampleCustomers = [], isFetching, isError } = useCustomers(
    {
      limit: sampleLimit,
      active: "all",
      deleted: isAdminUser ? deletedMode : "exclude",
    },
    { staleTime: 60_000 },
  );

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
      searchPlaceholder:
        "Search by name, CW ID, HMIS ID — or type flip, farm, broken data, necromancer, asteroids",
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
      if (cmFilter !== "all") {
        rows = rows.filter((customer) => String(customer.secondaryCaseManagerId || "") === cmFilter);
      } else {
        rows = rows.filter((customer) => !!String(customer.secondaryCaseManagerId || "").trim());
      }
    } else if (cmFilter !== "all") {
      rows = rows.filter((customer) => String(customer.caseManagerId || "") === cmFilter);
    } else if (scopeMode === "primary") {
      rows = rows.filter((customer) => !!String(customer.caseManagerId || "").trim());
    }

    rows = rows.filter((customer) => matchesPopulationFilter(customer, populationFilter));

    if (activeMode !== "all") {
      rows = rows.filter((customer) =>
        activeMode === "active" ? isActiveCustomer(customer) : !isActiveCustomer(customer),
      );
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter(
        (customer) =>
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
    if (!parsed.matched) return;

    const environment = createSandboxLaunchEnvironment();
    const decision = resolveSecretGameLaunch(parsed.request, environment);
    const href = buildSandboxLaunchHref({
      decision,
      request: parsed.request,
      fallbackCustomerId: filteredRows[0]?.id ? String(filteredRows[0].id) : null,
    });

    if (!href) {
      toast(decision.blockers[0]?.reason || "Resolver did not produce a sandbox route.", { type: "warning" });
      return;
    }

    void router.push(href);
  }, [filteredRows, router, search]);

  const handleResetFilters = React.useCallback(() => {
    setActiveMode("active");
    setDeletedMode("exclude");
    setScopeMode("all");
    setCmFilter("all");
    setSearch("");
    setPopulationFilter("all");
    setSortMode("alphabetical");
    setGrantFilter("all");
  }, []);

  const handleCustomerOpen = React.useCallback((customerId: string) => {
    void router.push(`/customers/${customerId}`);
  }, [router]);

  return (
    <section className="space-y-4" data-tour="secret-games-customers-clone">
      <CustomersMetricsBar myUid={myUid} />

      <PageHeader
        title="Customers"
        subtitle={
          <span>
            Sandbox clone using shared customer-page components and a light live sample of up to {sampleLimit} real
            customers. Type an exact secret command in the search box and press Enter to launch through the resolver.
          </span>
        }
      />

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
        caseManagerOptions={caseManagerOptions}
        onActiveModeChange={setActiveMode}
        onDeletedModeChange={setDeletedMode}
        onScopeModeChange={setScopeMode}
        onCmFilterChange={setCmFilter}
        onSearchChange={setSearch}
        onPopulationFilterChange={setPopulationFilter}
        onSortModeChange={setSortMode}
        onGrantFilterChange={setGrantFilter}
        onResetFilters={handleResetFilters}
        onSearchEnter={handleSearchEnter}
        onCustomerOpen={handleCustomerOpen}
        featureFlags={sandboxViewFlags}
      />
    </section>
  );
}
