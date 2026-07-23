import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalServiceIcon } from "./ui";

const ENABLE_STRUCTURED_AI_WORKBOOK = false;

export function TssWorkbookModal({
  spreadsheetId,
  spreadsheetUrl,
  spreadsheetName,
  onClose,
}: {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetName?: string | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 sm:p-6" onClick={onClose}>
      <div className="flex h-[94vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{spreadsheetName || "TSS workbook"}</div>
            <div className="text-[11px] text-slate-400">Complete workbook and budget</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ENABLE_STRUCTURED_AI_WORKBOOK ? (
              <button type="button" className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                Structured
              </button>
            ) : null}
            <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <ExternalServiceIcon href={spreadsheetUrl} />
              Open in Sheets
            </a>
            <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">Close</button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1 bg-slate-50">
          {!loaded ? <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading workbook…</div> : null}
          <iframe
            src={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
            title={spreadsheetName || "TSS workbook"}
            className="block h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
