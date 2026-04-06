//web/src/features/dashboard/components/ToolList.tsx
import React from "react";

export interface ToolListItem {
  key: string;
  label?: string;
  href?: string;
  render: React.ReactNode | (() => React.ReactNode);
}

export interface ToolListProps {
  tools: readonly ToolListItem[];
  className?: string;
}

function ToolListInner({ tools, className }: ToolListProps) {
  return (
    <div className={className || "space-y-3"}>
      {tools.map((t) => (
        <div key={t.key}>{typeof t.render === "function" ? (t.render as () => React.ReactNode)() : t.render}</div>
      ))}
    </div>
  );
}

export const ToolList = React.memo(ToolListInner);
export default ToolList;
