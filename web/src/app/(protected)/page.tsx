import RunnerGame from "@features/games/runner/RunnerGame";

const OTHER_APPS = [
  {
    name: "Mobile App",
    description: "Field-friendly customer lookup, activity logging, and case manager workflows.",
    href: "https://housing-db-mobile.web.app/",
  },
  {
    name: "Forms App",
    description: "Staff forms, customer prefill flows, checkout, intake, and submission tools.",
    href: "https://housing-db-forms.web.app/",
  },
] as const;

export default function Page() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 py-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
            Runner
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Take a quick break, chase the high score, then jump back into the dashboard.
          </p>
        </div>
        <RunnerGame embedded title="Runner" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Check out our other apps
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {OTHER_APPS.map((app) => (
            <a
              key={app.href}
              href={app.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-950 dark:text-slate-50">
                    {app.name}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">
                    {app.description}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-lg text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                >
                  -&gt;
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
