// src/features/dashboard/components/Pagination.tsx
import React from 'react';

export function usePagination<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil((rows?.length || 0) / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = React.useMemo(() => rows.slice(start, end), [rows, start, end]);
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  return { page, setPage, pageCount, pageRows, pageSize };
}

export function Pagination({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (n:number)=>void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs py-1">
      <button className="btn-secondary btn-xs" onClick={()=>setPage(1)} disabled={page<=1}>«</button>
      <button className="btn-secondary btn-xs" onClick={()=>setPage(page-1)} disabled={page<=1}>Prev</button>
      <span className="text-slate-600">Page {page} / {pageCount}</span>
      <button className="btn-secondary btn-xs" onClick={()=>setPage(page+1)} disabled={page>=pageCount}>Next</button>
      <button className="btn-secondary btn-xs" onClick={()=>setPage(pageCount)} disabled={page>=pageCount}>»</button>
    </div>
  );
}
