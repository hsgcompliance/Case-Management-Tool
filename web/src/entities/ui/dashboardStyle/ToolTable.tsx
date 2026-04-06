//web/src/features/dashboard/components/ToolTable.tsx
import React from "react";

export interface ToolTableProps {
  headers: React.ReactNode[];
  rows: React.ReactNode;
  caption?: string;
}

export function ToolTable({ headers, rows, caption }: ToolTableProps) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={typeof h === "string" ? h : `col-${i}`} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

export default ToolTable;
