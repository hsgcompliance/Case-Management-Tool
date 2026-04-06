export default function RouteModalLoading() {
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-950/35" />
      <div className="absolute inset-0 p-2 sm:p-4">
        <div className="mx-auto h-full w-full max-w-[1600px] rounded-xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500 dark:border-slate-700 dark:border-t-sky-400" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Opening…</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
