import React from "react";
import { fmtCurrencyUSD } from "@lib/formatters";
import { Pagination, usePagination } from "@entities/ui/dashboardStyle/Pagination";
import { SmartExportButton } from "@entities/ui/dashboardStyle/SmartExportButton";
import { ToolCard } from "@entities/ui/dashboardStyle/ToolCard";
import { ToolTable } from "@entities/ui/dashboardStyle/ToolTable";
import { useDashboardSharedData } from "@entities/Page/dashboardStyle/hooks/useDashboardSharedData";
import { useTableSort, SortableHeader, sortRows } from "@hooks/useTableSort";

export function GrantBudgetsTool() {
  const { grants, enrollments, sharedDataLoading, sharedDataError } = useDashboardSharedData();
  const { sort, onSort } = useTableSort();

  const rows = React.useMemo(() => {
    return (grants as any[])
      .filter((g) => String(g?.status || "").toLowerCase() !== "deleted" && g?.deleted !== true)
      .map((g) => {
        const b = g?.budget || {};
        const t = b?.totals || {};
        const total = Number(b?.total ?? b?.startAmount ?? 0);
        const spent = Number(t?.spent ?? b?.spent ?? 0);
        const projected = Number(t?.projected ?? b?.projected ?? 0);
        return {
          id: String(g?.id || ""),
          name: String(g?.name || g?.id || "-"),
          spent,
          projected,
          remaining: total - spent - projected,
          enrolled: (enrollments as any[]).filter((e) => String(e?.grantId || "") === String(g?.id || "")).length,
        };
      });
  }, [grants, enrollments]);

  const sortedRows = React.useMemo(
    () =>
      sortRows(rows, sort, (r, col) => {
        if (col === "name") return r.name;
        if (col === "enrolled") return r.enrolled;
        if (col === "spent") return r.spent;
        if (col === "projected") return r.projected;
        if (col === "remaining") return r.remaining;
        return null;
      }),
    [rows, sort]
  );

  const pagination = usePagination(sortedRows, 50);

  return (
    <ToolCard
      title="Grant Budgets"
      actions={
        <SmartExportButton
          allRows={rows}
          activeRows={rows}
          filenameBase="grant-budgets"
          columns={[
            { key: "name", label: "Grant", value: (r: any) => r.name },
            { key: "enrolled", label: "Enrolled", value: (r: any) => r.enrolled },
            { key: "spent", label: "Spent", value: (r: any) => r.spent },
            { key: "projected", label: "Projected", value: (r: any) => r.projected },
            { key: "remaining", label: "Remaining", value: (r: any) => r.remaining },
          ]}
        />
      }
    >
      <ToolTable
        headers={[
          <SortableHeader key="name" label="Grant" col="name" sort={sort} onSort={onSort} />,
          <SortableHeader key="enrolled" label="Enrolled" col="enrolled" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="spent" label="Spent" col="spent" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="projected" label="Projected" col="projected" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
          <SortableHeader key="remaining" label="Remaining" col="remaining" sort={sort} onSort={onSort} defaultDir="desc" align="right" />,
        ]}
        rows={
          sharedDataLoading ? (
            <tr>
              <td colSpan={5}>Loading grants...</td>
            </tr>
          ) : sharedDataError ? (
            <tr>
              <td colSpan={5}>Failed to load grants.</td>
            </tr>
          ) : pagination.pageRows.length ? (
            pagination.pageRows.map((r: any) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="text-right">{r.enrolled}</td>
                <td className="text-right">{fmtCurrencyUSD(r.spent)}</td>
                <td className="text-right">{fmtCurrencyUSD(r.projected)}</td>
                <td className="text-right">{fmtCurrencyUSD(r.remaining)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No grants.</td>
            </tr>
          )
        }
      />
      <Pagination page={pagination.page} pageCount={pagination.pageCount} setPage={pagination.setPage} />
    </ToolCard>
  );
}
