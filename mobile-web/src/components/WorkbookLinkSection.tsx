import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { useOrgGDriveConfig } from "@/hooks/useOrgGDriveConfig";
import { getCustomerDriveFolder, type Customer } from "@/hooks/useCustomers";
import { GoogleIntegrations, type WorkbookCandidate } from "@/lib/googleIntegrations";
import { qk } from "@/hooks/queryKeys";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

function SheetsIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#0f9d58" />
      <rect x="6" y="6" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="9" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="12" width="5" height="1.5" rx=".5" fill="white" opacity=".9" />
    </svg>
  );
}

/**
 * Workbook linking for a customer with no TSS workbook yet. Mirrors the web
 * flows: build one from the org template, paste a Sheets URL, or scan the
 * customer folder to link an existing sheet / convert an .xlsx into one.
 *
 * Render in the "no workbook linked" state (e.g. PlanTab). The backend resolves
 * the customer + folder server-side, so we only pass ids and the variant.
 */
export function WorkbookLinkSection({
  customer,
  onLinked,
}: {
  customer: Customer;
  onLinked?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const drive = useDriveIntegration(user ?? null);
  const cfg = useOrgGDriveConfig(user ?? null);

  const folderLinked = !!getCustomerDriveFolder(customer);
  const templates = cfg.data?.templates ?? [];
  const hasTssTemplate = templates.some((t) => t.role === "tssWorkbook" || t.key === "tss_workbook");
  const hasVariantTemplate = templates.some((t) => !!t.variants);

  const [variant, setVariant] = useState<"payer" | "nonpayer">("nonpayer");
  const [busy, setBusy] = useState<string | null>(null); // "build" | "scan" | "paste" | candidateId
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [candidates, setCandidates] = useState<WorkbookCandidate[] | null>(null);

  const afterLinked = async () => {
    await qc.invalidateQueries({ queryKey: ["workbook", "data", customer.id] });
    await qc.invalidateQueries({ queryKey: qk.customers.detail(customer.id) });
    void qc.invalidateQueries({ queryKey: qk.customers.root });
    onLinked?.();
  };

  // Ensure Drive is connected (server-side OAuth) before a write/scan. Returns
  // false when the user dismissed the connect popup.
  const ensureDrive = async (): Promise<boolean> => {
    if (drive.connected) return true;
    const res = await drive.connectViaPopup();
    return res.result === "connected";
  };

  async function buildFromTemplate() {
    setError(null);
    if (!(await ensureDrive())) return;
    setBusy("build");
    try {
      const resp = await GoogleIntegrations.buildWorkbookFromTemplate({ customerId: customer.id, variant });
      if (!resp.ok) { setError(resp.error || "Could not build workbook."); return; }
      await afterLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build workbook.");
    } finally { setBusy(null); }
  }

  async function scanFolder() {
    setError(null);
    if (!(await ensureDrive())) return;
    setBusy("scan");
    try {
      const resp = await GoogleIntegrations.listWorkbookCandidates(customer.id);
      if (resp.status === "folder_missing") { setError("No Drive folder linked for this customer yet."); return; }
      if (resp.status === "google_drive_not_connected") { setError("Connect Google Drive to scan the folder."); return; }
      if (!resp.ok) { setError(resp.error || "Could not scan the folder."); return; }
      setCandidates((resp.items ?? []).filter((i) => i.isSpreadsheet));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not scan the folder.");
    } finally { setBusy(null); }
  }

  async function linkCandidate(item: WorkbookCandidate) {
    setError(null);
    const isExcel = item.mimeType !== SHEET_MIME;
    if (isExcel && !(await ensureDrive())) return;
    setBusy(item.id);
    try {
      const resp = isExcel
        ? await GoogleIntegrations.convertWorkbookXlsx({ customerId: customer.id, fileId: item.id, fileName: item.name, variant })
        : await GoogleIntegrations.linkWorkbookCandidate({ customerId: customer.id, spreadsheetId: item.id, spreadsheetName: item.name, variant });
      if (!resp.ok) { setError(resp.error || (isExcel ? "Could not convert file." : "Could not link sheet.")); return; }
      await afterLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link workbook.");
    } finally { setBusy(null); }
  }

  async function linkPasted() {
    const url = pasteUrl.trim();
    if (!url) return;
    setError(null);
    setBusy("paste");
    try {
      const resp = await GoogleIntegrations.linkWorkbookByUrl({ customerId: customer.id, workbookUrl: url, variant });
      if (!resp.ok) { setError(resp.error || "Could not link workbook."); return; }
      setPasteUrl(""); setShowPaste(false);
      await afterLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link workbook.");
    } finally { setBusy(null); }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">No TSS workbook linked</p>
        <p className="text-xs text-slate-400">
          Link an existing sheet or build one from the configured template.
        </p>
      </div>

      {/* Variant applies to whichever workbook ends up linked below — building
          from the template, pasting a URL, or linking/converting a folder file. */}
      {hasVariantTemplate && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Workbook type:</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(["nonpayer", "payer"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={`px-2.5 py-1 text-xs font-semibold ${variant === v ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
              >
                {v === "nonpayer" ? "Non-payer" : "Payer"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Build from the org template — only when a folder exists to build into.
          With no folder, the folder-build path (Overview tab) handles the workbook. */}
      {hasTssTemplate && folderLinked && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={busy === "build"}
            onClick={() => void buildFromTemplate()}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {busy === "build"
              ? "Building…"
              : drive.connected
                ? "Create from template"
                : "Connect Drive & create from template"}
          </button>
        </div>
      )}

      {/* No folder yet → point to the folder-build path instead of a workbook build. */}
      {!folderLinked && (
        <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          Link or build a Drive folder in the Overview tab to create a workbook, or paste an existing sheet link below.
        </p>
      )}

      {/* Scan the customer folder for an existing sheet / convertible Excel file */}
      {folderLinked && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          {candidates === null ? (
            <button
              type="button"
              disabled={busy === "scan"}
              onClick={() => void scanFolder()}
              className="inline-flex items-center gap-1.5 text-left text-xs font-semibold text-indigo-600 active:text-indigo-800 disabled:opacity-50"
            >
              <SheetsIcon />
              {busy === "scan" ? "Scanning folder…" : "Find a sheet in the customer folder →"}
            </button>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-slate-400">No sheets or Excel files found in the folder.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">In the customer folder</p>
              {candidates.map((item) => {
                const isExcel = item.mimeType !== SHEET_MIME;
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name || item.id}</p>
                      {isExcel && <p className="text-[11px] text-amber-600">Excel file · will convert to a Sheet</p>}
                    </div>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void linkCandidate(item)}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50"
                    >
                      {!isExcel && busy !== item.id ? <SheetsIcon /> : null}
                      {busy === item.id ? (isExcel ? "Converting…" : "Linking…") : isExcel ? "Convert" : "Link"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Paste a Sheets URL */}
      <div className="border-t border-slate-100 pt-3">
        {showPaste ? (
          <div className="flex flex-col gap-2">
            <input
              type="url"
              inputMode="url"
              placeholder="Paste a Google Sheets link…"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === "paste" || !pasteUrl.trim()}
                onClick={() => void linkPasted()}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
              >
                {busy === "paste" ? "Linking…" : "Link workbook"}
              </button>
              <button
                type="button"
                onClick={() => { setShowPaste(false); setPasteUrl(""); }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 active:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowPaste(true)} className="text-xs font-semibold text-slate-500 active:text-slate-700">
            Or paste a Sheets link →
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
