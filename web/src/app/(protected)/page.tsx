import RunnerGame from "@features/games/runner/RunnerGame";

const OTHER_APPS = [
  {
    name: "Mobile App",
    description: "Manage your caseload on the go  & quickly access  workbooks",
    href: "https://housing-db-mobile.web.app/",
    icon: "phone",
    accent: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
  {
    name: "Forms App",
    description: "Jotforms & Intakes Made Easy (I hope)",
    href: "https://housing-db-forms.web.app/",
    icon: "form",
    accent: "bg-amber-50 text-amber-700 ring-amber-200",
  },
] as const;

function AppIcon({ type }: { type: (typeof OTHER_APPS)[number]["icon"] }) {
  if (type === "phone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <rect
          x="7"
          y="2.75"
          width="10"
          height="18.5"
          rx="2.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M10 17.75h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6.5 3.5h8.1L18 6.9v13.6H6.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M14.5 3.8V7h3.2M9 11h6M9 14.5h6M9 18h3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function Page() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 py-4">
      <style>{`
        @keyframes hdbLandingAccent {
          0% { transform: translateX(-34%); opacity: 0.48; }
          50% { opacity: 0.95; }
          100% { transform: translateX(34%); opacity: 0.48; }
        }

        .hdb-landing-accent {
          animation: hdbLandingAccent 6s ease-in-out infinite alternate;
        }

        @media (prefers-reduced-motion: reduce) {
          .hdb-landing-accent {
            animation: none;
          }
        }
      `}</style>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-6">
          <div className="flex min-w-0 flex-col gap-4">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                   Case Management Dashboard
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Customer, grant, enrollment, payment, and reporting workflows in one operations workspace.
                </p>
              </div>
              <div className="relative h-1.5 w-28 overflow-hidden rounded bg-slate-200">
                <div className="hdb-landing-accent h-full w-28 rounded bg-gradient-to-r from-cyan-500 via-slate-900 to-amber-400" />
              </div>
            </header>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-inner shadow-slate-200/70">
              <div className="rounded-md border border-slate-200 bg-white p-2 sm:p-3">
                <RunnerGame embedded title="Runner" />
              </div>
            </div>
          </div>

          <aside className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Check out our other apps
              </h2>
              <div className="mt-4 grid gap-3">
                {OTHER_APPS.map((app) => (
                  <a
                    key={app.href}
                    href={app.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-slate-950 no-underline shadow-sm motion-safe:transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1 motion-safe:transition-colors ${app.accent}`}
                      >
                        <AppIcon type={app.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-950">{app.name}</span>
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-700"
                          >
                            <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-slate-600">
                          {app.description}
                        </span>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="hidden rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500 lg:block">
              These apps are simpler, load faster and are designed to clear out all the clutter from your workspace.
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
