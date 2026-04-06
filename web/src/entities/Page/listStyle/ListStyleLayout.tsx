/**
 * ListStyleLayout
 *
 * Standard layout for list/table pages (Customers, Grants, etc.).
 * Renders the shared metrics bar above page content unless a page supplies
 * its own metrics content.
 */
"use client";

import React from "react";
import { SharedPageMetricsBar } from "@entities/metrics/strip/PageMetricsBar";

export interface ListStyleLayoutProps {
  children: React.ReactNode;
  /** Optional metrics content. When omitted, the shared metrics bar is rendered. */
  metricsBar?: React.ReactNode;
  /** Extra class on the outer wrapper */
  className?: string;
}

export function ListStyleLayout({ children, metricsBar, className }: ListStyleLayoutProps) {
  return (
    <div className={["min-h-dvh flex flex-col", className].filter(Boolean).join(" ")}>
      {metricsBar !== undefined ? metricsBar : <SharedPageMetricsBar />}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

export default ListStyleLayout;
