"use client";

// Full-page / detachable Google Sheets modal for the workbook "Sheet" view.
//
// Two modes:
//   frozen   — full-page modal over a dimmed backdrop; page scroll locked; only
//              the sheet (iframe) is interactive. Dragging the header detaches it.
//   floating — draggable/resizable window (react-rnd); no backdrop, so the
//              customer page behind is fully usable (scroll, open other modals).
//              A "Freeze" button returns to the frozen full-page state.
//
// "Structured" switches back to the inline structured view (onSwitchToStructured),
// closing the modal. "Close" returns to the inline "click to open" card.

import React from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { ExternalServiceIcon } from "@entities/gdrive/FileTypeIcon";

function buildEmbedUrl(spreadsheetId: string, gid?: string | number | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const g = gid != null ? String(gid).trim() : "";
  return g ? `${base}#gid=${g}` : base;
}

type Mode = "frozen" | "floating";

export function WorkbookSheetModal({
  spreadsheetId,
  gid,
  spreadsheetName = "Workbook",
  openUrl,
  onClose,
  onSwitchToStructured,
}: {
  spreadsheetId: string;
  gid?: string | number | null;
  spreadsheetName?: string;
  openUrl?: string;
  onClose: () => void;
  onSwitchToStructured?: () => void;
}) {
  const [mode, setMode] = React.useState<Mode>("frozen");
  const [loaded, setLoaded] = React.useState(false);
  const [floatRect, setFloatRect] = React.useState({ x: 80, y: 80, width: 760, height: 560 });

  const embedUrl = buildEmbedUrl(spreadsheetId, gid);
  const href = openUrl || embedUrl;

  // Lock page scroll only while frozen.
  React.useEffect(() => {
    if (mode !== "frozen") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mode]);

  // Detect a header drag while frozen → detach to floating.
  const onFrozenHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest("button,a")) return; // let controls work
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (m: MouseEvent) => {
      if (Math.abs(m.clientX - startX) > 5 || Math.abs(m.clientY - startY) > 5) {
        setMode("floating");
        cleanup();
      }
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", cleanup);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", cleanup);
  };

  const iframe = (
    <div className="relative h-full w-full bg-slate-50">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
          Loading workbook…
        </div>
      )}
      <iframe
        src={embedUrl}
        className="block h-full w-full border-0"
        onLoad={() => setLoaded(true)}
        allow="clipboard-read; clipboard-write"
        title={spreadsheetName}
      />
    </div>
  );

  const header = (extraClass = "") => (
    <div
      className={`flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 ${extraClass}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-slate-400" aria-hidden>⠿</span>
        <span className="truncate text-sm font-semibold text-slate-900">{spreadsheetName}</span>
        <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">
          {mode === "frozen" ? "· drag to detach" : "· detached"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {mode === "floating" ? (
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setMode("frozen")}
          >
            Freeze
          </button>
        ) : null}
        {onSwitchToStructured ? (
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={onSwitchToStructured}
          >
            Structured
          </button>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ExternalServiceIcon service="sheets" />
          Open
        </a>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );

  const content = (
    // Root never blocks the page by itself; only the frozen backdrop does.
    // Rendered via createPortal but still a React-tree child of the card that
    // opened it, so clicks here bubble through the React tree (not the DOM
    // tree) back up to the card's onClick (which opens the customer modal)
    // unless stopped here.
    <div
      className="fixed inset-0 z-[10050] pointer-events-none"
      onClick={(e) => e.stopPropagation()}
    >
      {mode === "frozen" ? (
        <>
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" />
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <div className="pointer-events-auto flex h-[92vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="cursor-grab active:cursor-grabbing" onMouseDown={onFrozenHeaderMouseDown}>
                {header()}
              </div>
              <div className="min-h-0 flex-1">{iframe}</div>
            </div>
          </div>
        </>
      ) : (
        <Rnd
          className="pointer-events-auto"
          bounds="window"
          minWidth={360}
          minHeight={280}
          dragHandleClassName="wb-modal-drag"
          size={{ width: floatRect.width, height: floatRect.height }}
          position={{ x: floatRect.x, y: floatRect.y }}
          onDragStop={(_e, d) => setFloatRect((r) => ({ ...r, x: d.x, y: d.y }))}
          onResizeStop={(_e, _dir, ref, _delta, pos) =>
            setFloatRect({ width: ref.offsetWidth, height: ref.offsetHeight, x: pos.x, y: pos.y })
          }
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
            <div className="wb-modal-drag cursor-grab active:cursor-grabbing">{header()}</div>
            <div className="min-h-0 flex-1">{iframe}</div>
          </div>
        </Rnd>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
