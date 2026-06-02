import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyCustomersRich, useOrgCustomers, type Customer } from "@/hooks/useCustomers";
import { useCustomersByGrant } from "@/hooks/useCustomerEnrollments";
import { useGrants } from "@/hooks/useGrants";

type StatusFilter = "active" | "inactive" | "all";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.floor((Date.now() - t) / (365.25 * 86400000));
}

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < FIVE_DAYS_MS;
}

function isInactive(c: Customer): boolean {
  if (typeof c.active === "boolean" && !c.active) return true;
  const s = String(c.status ?? "").toLowerCase();
  return s === "inactive" || s === "closed" || s === "deleted";
}

function populationColors(pop?: string): { bg: string; text: string } {
  switch ((pop ?? "").toLowerCase()) {
    case "youth":      return { bg: "bg-sky-100",     text: "text-sky-700" };
    case "family":     return { bg: "bg-amber-100",   text: "text-amber-700" };
    case "individual": return { bg: "bg-emerald-100", text: "text-emerald-700" };
    default:           return { bg: "bg-slate-100",   text: "text-slate-500" };
  }
}

function CustomerRow({ customer, onOpen, onLog }: {
  customer: Customer;
  onOpen: () => void;
  onLog: () => void;
}) {
  const inactive = isInactive(customer);
  const age = calcAge(customer.dob);
  const pop = populationColors(customer.population);
  const newBadge = isNew(customer.createdAt);

  return (
    <div className="flex items-stretch border-b border-slate-100 last:border-0 bg-white">
      {/* Left: info → open customer */}
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left px-4 py-3.5 active:bg-slate-50 transition-colors min-w-0"
      >
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[15px] font-semibold leading-snug ${inactive ? "text-slate-400" : "text-slate-900"}`}>
            {customer.name}
          </span>
          {newBadge && (
            <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">NEW</span>
          )}
          {inactive && (
            <span className="text-[10px] font-medium bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Inactive</span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {customer.population && (
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${pop.bg} ${pop.text}`}>
              {customer.population}
            </span>
          )}
          {age !== null && (
            <span className="text-xs text-slate-400">{age}y</span>
          )}
          {customer.cwId && (
            <span className="text-xs text-slate-400">CW {customer.cwId}</span>
          )}
          {customer.caseManagerName && (
            <span className="text-xs text-slate-400 truncate max-w-[120px]">{customer.caseManagerName}</span>
          )}
        </div>
      </button>

      {/* Divider */}
      <div className="w-px bg-slate-100 my-2.5 flex-shrink-0" />

      {/* Right: log button */}
      <button
        type="button"
        onClick={onLog}
        aria-label={`Log session with ${customer.name}`}
        className="flex items-center justify-center w-14 active:bg-indigo-50 transition-colors flex-shrink-0"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      </button>
    </div>
  );
}

function EmptyState({ search, statusFilter, myCaseload }: {
  search: string;
  statusFilter: StatusFilter;
  myCaseload: boolean;
}) {
  if (search) {
    return (
      <div className="py-16 text-center px-6">
        <p className="text-slate-500">No customers matching "{search}"</p>
      </div>
    );
  }
  if (myCaseload) {
    return (
      <div className="py-16 text-center px-6">
        <p className="text-slate-500 font-medium">No customers on your caseload</p>
        <p className="text-slate-400 text-sm mt-1">Toggle "All" to search the full directory</p>
      </div>
    );
  }
  return (
    <div className="py-16 text-center px-6">
      <p className="text-slate-400 text-sm">No {statusFilter !== "all" ? statusFilter + " " : ""}customers found</p>
    </div>
  );
}

export function CustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [myCaseload, setMyCaseload] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCMId, setFilterCMId] = useState("");
  const [filterGrantId, setFilterGrantId] = useState("");

  function handleSearchChange(value: string) {
    setSearch(value);
    if (value.trim()) setMyCaseload(false);
    else setMyCaseload(true);
  }

  const { data: myCustomers = [], isLoading: loadingMine } = useMyCustomersRich(user?.uid);
  const { data: orgCustomers = [], isLoading: loadingOrg } = useOrgCustomers(user);
  const { data: grants = [] } = useGrants(user);
  const { data: grantCustomerIds } = useCustomersByGrant(filterGrantId || null);

  // Derive distinct CMs from org customer data
  const knownCMs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of orgCustomers) {
      if (c.caseManagerId && c.caseManagerName) seen.set(c.caseManagerId, c.caseManagerName);
    }
    return [...seen.entries()]
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgCustomers]);

  const baseList = myCaseload ? myCustomers : orgCustomers;
  const loading = myCaseload ? loadingMine : loadingOrg;

  const hasAdvancedFilter = !!(filterCMId || filterGrantId);

  const displayed = useMemo(() => {
    // When an advanced filter is active, always search the full org list
    let list = hasAdvancedFilter ? orgCustomers : baseList;

    if (statusFilter === "active") {
      list = list.filter((c) => !isInactive(c));
    } else if (statusFilter === "inactive") {
      list = list.filter((c) => isInactive(c));
    }

    if (filterCMId) {
      list = list.filter((c) => c.caseManagerId === filterCMId);
    }

    if (filterGrantId && grantCustomerIds) {
      list = list.filter((c) => grantCustomerIds.has(c.id));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.cwId ?? "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [baseList, orgCustomers, search, statusFilter, filterCMId, filterGrantId, grantCustomerIds, hasAdvancedFilter]);

  function openCustomer(id: string) {
    navigate(`/customers/${id}`);
  }

  function openLog(c: Customer) {
    navigate(`/log?customerId=${c.id}&customerName=${encodeURIComponent(c.name)}`);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 pt-safe-top flex-shrink-0">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Customers</h1>
            <button
              type="button"
              onClick={() => navigate("/customers/new")}
              aria-label="Add new customer"
              className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 active:bg-indigo-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <span className="text-sm text-slate-400">
            {loading ? "…" : displayed.length}
          </span>
        </div>

        {/* Search + filter button */}
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search by name or CW ID…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Three-dot filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="More filters"
            className={`relative flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
              showFilters || hasAdvancedFilter
                ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
            {hasAdvancedFilter && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="px-4 pb-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
              {hasAdvancedFilter && (
                <button
                  type="button"
                  onClick={() => { setFilterCMId(""); setFilterGrantId(""); }}
                  className="text-xs font-semibold text-indigo-600 active:text-indigo-800"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Case Manager filter */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Case Manager</p>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                value={filterCMId}
                onChange={(e) => { setFilterCMId(e.target.value); if (e.target.value) setMyCaseload(false); }}
              >
                <option value="">— Any —</option>
                {knownCMs.map((cm) => (
                  <option key={cm.uid} value={cm.uid}>{cm.name}</option>
                ))}
              </select>
            </div>

            {/* Program / Enrollment filter */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Program / Enrollment</p>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                value={filterGrantId}
                onChange={(e) => { setFilterGrantId(e.target.value); if (e.target.value) setMyCaseload(false); }}
              >
                <option value="">— Any —</option>
                {grants.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Filter row */}
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          {/* My Caseload toggle */}
          <button
            type="button"
            onClick={() => setMyCaseload(!myCaseload)}
            className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
              myCaseload
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            My Caseload
          </button>

          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

          {/* Status filter pills */}
          {(["active", "all", "inactive"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border capitalize transition-colors ${
                statusFilter === f
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-safe-bottom">
        {loading && displayed.length === 0 ? (
          <div className="flex flex-col">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center px-4 py-4 border-b border-slate-100 bg-white gap-3">
                <div className="flex-1 h-4 bg-slate-100 rounded animate-pulse" />
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState search={search} statusFilter={statusFilter} myCaseload={myCaseload} />
        ) : (
          <div className="bg-white mt-0">
            {displayed.map((c) => (
              <CustomerRow
                key={c.id}
                customer={c}
                onOpen={() => openCustomer(c.id)}
                onLog={() => openLog(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
