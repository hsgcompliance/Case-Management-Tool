import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrgFolderIndex } from "@/hooks/useOrgFolderIndex";
import { useOrgGDriveConfig } from "@/hooks/useOrgGDriveConfig";
import { suggestFolders } from "@/lib/folderMatch";
import { GoogleIntegrations } from "@/lib/googleIntegrations";
import { getCustomerDriveFolder, type Customer } from "@/hooks/useCustomers";
import { qk } from "@/hooks/queryKeys";
import { BuildFolderSheet } from "@/components/BuildFolderSheet";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "unknown";
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function FolderGlyph({ muted = false }: { muted?: boolean }) {
  return (
    <svg className={`w-7 h-7 flex-shrink-0 ${muted ? "opacity-40" : ""}`} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-.94-.94a2.25 2.25 0 0 0-1.59-.66H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

export function CustomerFolderSection({ customer }: { customer: Customer }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const linked = getCustomerDriveFolder(customer);

  const idx = useOrgFolderIndex(linked ? null : user ?? null);
  const cfg = useOrgGDriveConfig(linked ? null : user ?? null);

  const [busy, setBusy] = useState<string | null>(null); // folderId | "paste" | "refresh"
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [showBuild, setShowBuild] = useState(false);

  const suggestions = useMemo(
    () => (idx.data ? suggestFolders(idx.data.folders, customer) : []),
    [idx.data, customer],
  );

  const afterChange = async () => {
    await qc.invalidateQueries({ queryKey: qk.customers.detail(customer.id) });
    await qc.invalidateQueries({ queryKey: qk.customers.root });
    void qc.invalidateQueries({ queryKey: ["folderIndex"] });
  };

  async function linkFolder(folderId: string, folderName?: string) {
    setBusy(folderId); setError(null);
    try {
      const resp = await GoogleIntegrations.linkCustomerFolder({ customerId: customer.id, folderId, folderName });
      if (!resp.ok) { setError(resp.error || "Could not link folder."); return; }
      await afterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link folder.");
    } finally { setBusy(null); }
  }

  async function linkPasted() {
    const url = pasteUrl.trim();
    if (!url) return;
    setBusy("paste"); setError(null);
    try {
      const resp = await GoogleIntegrations.linkCustomerFolder({ customerId: customer.id, folderUrl: url });
      if (!resp.ok) { setError(resp.error || "Could not link folder."); return; }
      setPasteUrl(""); setShowPaste(false);
      await afterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link folder.");
    } finally { setBusy(null); }
  }

  // ── Linked state ──
  if (linked) {
    return (
      <a
        href={linked.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50 transition-colors"
      >
        <FolderGlyph />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Google Drive folder</p>
          <p className="text-xs text-slate-500 truncate">{linked.label}</p>
        </div>
        <span className="text-slate-300 text-sm flex-shrink-0">↗</span>
      </a>
    );
  }

  const hasTemplates = (cfg.data?.templates?.length ?? 0) > 0;

  // ── Unlinked state ──
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FolderGlyph muted />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">No Drive folder linked</p>
          <p className="text-xs text-slate-400">
            {idx.isLoading ? "Loading folder index…" : `Index synced ${timeAgo(idx.data?.lastSyncedAt ?? null)}`}
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "refresh"}
          onClick={async () => {
            setBusy("refresh"); setError(null);
            try { await GoogleIntegrations.refreshFolderIndex(); await idx.refetch(); }
            catch (e) { setError(e instanceof Error ? e.message : "Refresh failed."); }
            finally { setBusy(null); }
          }}
          className="text-xs font-semibold text-indigo-600 active:text-indigo-800 disabled:opacity-50"
        >
          {busy === "refresh" ? "…" : "Refresh"}
        </button>
      </div>

      {/* Suggestions from the cached index */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Suggested folders</p>
          {suggestions.map(({ folder, score }) => (
            <div key={folder.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{folder.name || folder.id}</p>
                <p className="text-[11px] text-slate-400">
                  {folder.status === "exited" ? "Exited · " : ""}{score}% match
                  {folder.linkedCustomerId && folder.linkedCustomerId !== customer.id ? " · linked to another customer" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void linkFolder(folder.id, folder.name)}
                className="flex-shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50"
              >
                {busy === folder.id ? "Linking…" : "Link"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Build a new folder */}
      {hasTemplates && (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowBuild(true)}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Build a new folder…
          </button>
        </div>
      )}

      {showBuild && (
        <BuildFolderSheet
          customerId={customer.id}
          firstName={customer.firstName ?? ""}
          lastName={customer.lastName ?? ""}
          cwId={customer.cwId}
          hmisId={customer.hmisId}
          onClose={() => setShowBuild(false)}
          onBuilt={() => {
            setShowBuild(false);
            void afterChange();
            void qc.invalidateQueries({ queryKey: ["workbook", "data", customer.id] });
          }}
        />
      )}

      {/* Paste a folder link */}
      <div className="border-t border-slate-100 pt-3">
        {showPaste ? (
          <div className="flex flex-col gap-2">
            <input
              type="url"
              inputMode="url"
              placeholder="Paste a Google Drive folder link…"
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
                {busy === "paste" ? "Linking…" : "Link folder"}
              </button>
              <button type="button" onClick={() => { setShowPaste(false); setPasteUrl(""); }} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 active:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowPaste(true)} className="text-xs font-semibold text-slate-500 active:text-slate-700">
            Or paste a folder link →
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
