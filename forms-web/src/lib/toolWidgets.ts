// Registry for the standalone eligibility-calculator widgets embedded from
// public/tools/ (copies of projects/eviction-prevention-calculator/widgets/).
// Each widget is a self-contained HTML/JS page; prefill values are passed as
// query-string params it reads on load. Local-only — no backend involved.

export type ToolWidgetId = "ami" | "esg-asset-limit" | "income" | "fmr";

export const TOOL_WIDGETS: Record<
  ToolWidgetId,
  { title: string; file: string; height: number; width: number; badge?: string }
> = {
  ami: { title: "AMI Calculator", file: "ami-widget.html", height: 670, width: 680, badge: "Eviction Prevention" },
  "esg-asset-limit": {
    title: "Asset Limit Calculation",
    file: "esg-asset-limit-widget.html",
    height: 670,
    width: 680,
    badge: "Eviction Prevention",
  },
  income: { title: "Payment Calculation", file: "income-calculator-widget.html", height: 1200, width: 1080 },
  fmr: { title: "Fair Market Rent", file: "fmr-widget.html", height: 540, width: 680 },
};

export function toolWidgetUrl(id: ToolWidgetId, prefill?: Record<string, string | undefined>): string {
  const base = `/tools/${TOOL_WIDGETS[id].file}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(prefill ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function openToolWindow(id: ToolWidgetId, prefill?: Record<string, string | undefined>): void {
  const def = TOOL_WIDGETS[id];
  window.open(
    toolWidgetUrl(id, prefill),
    `tool-${id}`,
    `width=${def.width},height=${Math.min(def.height, 800)},noopener,noreferrer`
  );
}
