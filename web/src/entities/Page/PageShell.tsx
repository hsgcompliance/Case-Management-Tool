// entities/PageShell.tsx
// Standard page wrapper with optional metricsArea and filterBar slots.
// Pass null explicitly to a slot to hide it (nullable). Omit to hide by default.
import React from "react";

type PageShellProps = {
  /**
   * Metrics strip rendered above the filter bar and content.
   * Pass null to force-hide (useful when a page doesn't support metrics).
   * Omitting the prop also hides it.
   */
  metricsArea?: React.ReactNode | null;
  /**
   * Filter bar rendered above the main content.
   * Pass null to hide.
   */
  filterBar?: React.ReactNode | null;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ metricsArea, filterBar, children, className }: PageShellProps) {
  return (
    <div className={["space-y-4", className].filter(Boolean).join(" ")}>
      {metricsArea != null ? (
        <div data-shell-slot="metrics">{metricsArea}</div>
      ) : null}
      {filterBar != null ? (
        <div data-shell-slot="filterbar">{filterBar}</div>
      ) : null}
      <div data-shell-slot="content">{children}</div>
    </div>
  );
}

export default PageShell;
