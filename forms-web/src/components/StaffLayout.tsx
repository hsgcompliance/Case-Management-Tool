import { NavLink, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { CustomerSearchBar } from "./CustomerSearchBar";

const BASE_TABS = [
  { to: "/staff/purchases", label: "Purchases" },
  { to: "/staff/intake", label: "Intake forms" },
  { to: "/staff/forms", label: "All forms" },
  { to: "/staff/submissions", label: "Submissions" },
  { to: "/staff/webhooks", label: "Webhooks" },
  { to: "/staff/activity", label: "Activity" },
];

export function StaffLayout() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const TABS = isAdmin ? [...BASE_TABS, { to: "/staff/admin", label: "Admin" }] : BASE_TABS;
  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">HDB Forms</div>
              <div className="text-sm font-bold text-slate-900">Staff workspace</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:inline">{user?.email}</span>
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
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700",
                  ].join(" ")
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
