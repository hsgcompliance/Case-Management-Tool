"use client";

import React from "react";

export interface EmptyStateProps {
  /** Icon or illustration (emoji, SVG, etc.) */
  icon?: React.ReactNode;
  heading: string;
  subtext?: string;
  /** Optional action button / link */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, heading, subtext, action, className }: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400",
        className,
      ].filter(Boolean).join(" ")}
    >
      {icon ? <div className="text-4xl opacity-50">{icon}</div> : null}
      <p className="text-base font-medium text-slate-500">{heading}</p>
      {subtext ? <p className="max-w-xs text-sm">{subtext}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
