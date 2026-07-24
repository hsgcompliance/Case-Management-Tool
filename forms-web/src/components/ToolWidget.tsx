import { TOOL_WIDGETS, openToolWindow, toolWidgetUrl, type ToolWidgetId } from "@/lib/toolWidgets";

// Optional calculator tool, embedded from a static self-contained widget page
// (public/tools/). Always collapsed by default; expands inline here, or can
// be popped into its own small window from anywhere (see StaffLayout header).
export function ToolWidget({
  id,
  prefill,
  optional = true,
}: {
  id: ToolWidgetId;
  prefill?: Record<string, string | undefined>;
  optional?: boolean;
}) {
  const def = TOOL_WIDGETS[id];
  const url = toolWidgetUrl(id, prefill);

  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          {def.title}
          {optional ? (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
              optional
            </span>
          ) : null}
          {def.badge ? (
            <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
              {def.badge}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openToolWindow(id, prefill);
          }}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          Open in window ↗
        </button>
      </summary>
      <div className="border-t border-slate-100 p-2">
        <iframe
          src={url}
          title={def.title}
          style={{ height: def.height }}
          className="w-full rounded-lg border-0 bg-slate-50"
        />
      </div>
    </details>
  );
}
