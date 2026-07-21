import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { CustomerSearchBar } from "./CustomerSearchBar";
import { SubmitNotifications } from "./SubmitNotifications";
import { RENT_DETERMINATION_FORM_ID } from "@/lib/rentCertExtract";

// Primary tabs are the day-to-day surfaces. Configuration and operational
// utilities stay grouped under Tools.
const PRIMARY_TABS = [
  { to: "/staff/purchases", label: "Purchases" },
  { to: "/staff/intake", label: "Intake forms" },
  { to: "/staff/referrals", label: "Referrals" },
  { to: "/staff/submissions", label: "Submissions" },
];

const MENU_TABS = [
  {
    to: `/staff/submissions?formId=${RENT_DETERMINATION_FORM_ID}`,
    matchPath: "/staff/submissions",
    label: "New Rent Cert",
  },
  { to: "/staff/forms", label: "All forms" },
  { to: "/staff/webhooks", label: "Webhooks" },
  { to: "/staff/activity", label: "Activity" },
];

export function StaffLayout() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuTabs = isAdmin ? [...MENU_TABS, { to: "/staff/admin", label: "Admin" }] : MENU_TABS;
  const activeMenuTab = menuTabs.find((tab) => {
    if (tab.label === "New Rent Cert") {
      return location.pathname === "/staff/submissions" && new URLSearchParams(location.search).get("formId") === RENT_DETERMINATION_FORM_ID;
    }
    return location.pathname.startsWith(tab.matchPath ?? tab.to);
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Navigating anywhere closes the menu.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <NavLink to="/staff" end className="block min-w-0 no-underline" title="Staff home — quick links">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">HDB Forms</div>
              <div className="text-sm font-bold text-slate-900">Staff workspace</div>
            </NavLink>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SubmitNotifications />
              <span className="hidden max-w-[14rem] truncate text-xs text-slate-500 sm:inline">{user?.email}</span>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="pb-3">
            <CustomerSearchBar />
          </div>
          {/* No overflow-x-auto here: it would clip the ☰ dropdown (overflow-x
              forces vertical clipping too). The few tabs fit without scrolling. */}
          <nav aria-label="Staff sections" className="-mb-px flex flex-wrap items-center gap-1">
            {PRIMARY_TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium transition sm:px-3",
                    isActive
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700",
                  ].join(" ")
                }
              >
                {t.label}
              </NavLink>
            ))}

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                title="Tools and administration"
                className={[
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium transition sm:px-3",
                  activeMenuTab
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <span>Tools</span>
                <span aria-hidden className="text-[10px] leading-none">{menuOpen ? "▲" : "▼"}</span>
              </button>
              {menuOpen ? (
                <div className="absolute left-0 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {menuTabs.map((t) => (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      className={() =>
                        [
                          "block px-3 py-2 text-sm font-medium",
                          activeMenuTab?.label === t.label ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50",
                        ].join(" ")
                      }
                    >
                      {t.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-5">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-center gap-5 px-4 py-3 text-xs text-slate-500">
          <a href="https://housing-db-mobile.web.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-teal-700">
            <img src="/hdb-mobile-icon.svg" alt="" className="h-5 w-5 rounded" />
            Mobile
          </a>
          <a href="https://housing-db-v2.web.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-sky-700">
            <img src="/hdb-web-icon.svg" alt="" className="h-5 w-5 rounded" />
            Dashboard
          </a>
        </div>
      </footer>
    </div>
  );
}
