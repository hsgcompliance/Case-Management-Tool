"use client";

import React from "react";

export interface CardGridProps {
  children: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  /** Shown while loading */
  loadingMessage?: string;
  /** Shown on error */
  errorMessage?: string;
  /** Custom empty state node; falls back to plain text */
  emptyState?: React.ReactNode;
  /** Number of columns at max breakpoint (default: 2) */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

const COL_CLASSES: Record<NonNullable<CardGridProps["cols"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};

export function CardGrid({
  children,
  isLoading,
  isError,
  isEmpty,
  loadingMessage = "Loading...",
  errorMessage = "Error loading results.",
  emptyState,
  cols = 2,
  className,
}: CardGridProps) {
  if (isLoading) {
    return <div className="py-12 text-center text-sm text-slate-400">{loadingMessage}</div>;
  }
  if (isError) {
    return <div className="py-12 text-center text-sm text-red-600">{errorMessage}</div>;
  }
  if (isEmpty) {
    return <>{emptyState ?? <div className="py-12 text-center text-sm text-slate-400">No results.</div>}</>;
  }
  return (
    <div className={["grid gap-4", COL_CLASSES[cols], className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export default CardGrid;
