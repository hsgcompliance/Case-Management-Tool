//frontend/src/features/tutorial/admin/exporter.ts
import type { TourFlowT as Tour } from "@tour/schema";

export function toTsModule(tour: Tour): string {
  const normalized: Tour = {
    id: tour.id || "onboarding",
    name: tour.name || "Onboarding",
    version: 2,
    steps: (tour.steps || []).map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      route: s.route || "/reports",
      selector: s.selector || "",
      title: s.title || `Step ${i + 1}`,
      body: s.body || "",
      placement: s.placement || "right",
      padding: s.padding ?? 8,
      requireClick: !!s.requireClick,
      offsetX: s.offsetX ?? 0,
      offsetY: s.offsetY ?? 0,
    })),
    updatedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(normalized, null, 2);
  return `import type { TourFlowT as Tour } from "@tour/schema";
export const onboardingFlow: Tour = ${json} as const;
`;
}

export function downloadFile(filename: string, contents: string, mime = "text/typescript") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
