import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { CustomerSearchBar } from "./CustomerSearchBar";
import { SubmitNotifications } from "./SubmitNotifications";
import { RENT_DETERMINATION_FORM_ID } from "@/lib/rentCertExtract";

// Primary tabs are the day-to-day surfaces. The power-user views (All forms,
// Submissions, Webhooks, Activity) live behind the ☰ menu — most staff never
// need them.
const PRIMARY_TABS = [
  { to: "/staff/purchases", label: "Purchases" },
  { to: "/staff/referrals", label: "Referrals" },
  { to: "/staff/intake", label: "Intake forms" },
];

const MENU_TABS = [
  { to: "/staff/forms", label: "All forms" },
  { to: "/staff/submissions", label: "Submissions" },
  { to: "/staff/webhooks", label: "Webhooks" },
  { to: "/staff/activity", label: "Activity" },
];

export function StaffLayout() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tabs = isAdmin ? [...PRIMARY_TABS, { to: "/staff/admin", label: "Admin" }] : PRIMARY_TABS;
  const activeMenuTab = MENU_TABS.find((t) => location.pathname.startsWith(t.to));

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
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <NavLink to="/staff" end className="block min-w-0 no-underline" title="Staff home — quick links">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">HDB Forms</div>
              <div className="text-sm font-bold text-slate-900">Staff workspace</div>
            </NavLink>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <NavLink
                to={`/staff/submissions?formId=${RENT_DETERMINATION_FORM_ID}`}
                className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-indigo-500"
                title="Open Submission Manager with Rent Determination & Unit Eligibility selected"
              >
                + New Rent Cert
              </NavLink>
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
            {tabs.map((t) => (
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
                title="More tools (submissions, webhooks, activity)"
                className={[
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium transition sm:px-3",
                  activeMenuTab
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <span aria-hidden className="text-base leading-none">☰</span>
                {activeMenuTab ? activeMenuTab.label : null}
              </button>
              {menuOpen ? (
                <div className="absolute left-0 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {MENU_TABS.map((t) => (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      className={({ isActive }) =>
                        [
                          "block px-3 py-2 text-sm font-medium",
                          isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50",
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

      <main className="mx-auto max-w-screen-2xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
