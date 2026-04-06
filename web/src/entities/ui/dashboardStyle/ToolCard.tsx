//web/src/features/dashboard/components/ToolCard.tsx
import React from "react";

export interface ToolCardProps {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ToolCard({ title, children, actions }: ToolCardProps) {
  return (
    <section className="card">
      <div className="card-section border-b border-slate-200 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="card-section space-y-3">{children}</div>
    </section>
  );
}

export default ToolCard;
