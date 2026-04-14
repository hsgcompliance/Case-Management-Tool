"use client";

import React from "react";
import { toApiError } from "@client/api";
import { useCustomer, usePatchCustomers } from "@hooks/useCustomers";
import {
  useGDriveList,
  useGDriveCustomerFolderIndex,
  useGDriveBuildCustomerFolder,
  useGDriveUpload,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import { fmtBytes, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import { DRIVE_FILE_TEMPLATES } from "@lib/driveConfig";
import type { TCustomerFolder } from "@types";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type LinkedFolder = {
  id: string;
  alias?: string | null;
  name?: string | null;
  driveId?: string | null;
};

type DriveFile = {
  id?: string;
  name?: string;
  size?: number | string;
  modifiedTime?: string;
  webViewLink?: string;
};

const FOLDER_TEMPLATES = DRIVE_FILE_TEMPLATES;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFiles(input: unknown): DriveFile[] {
  if (!input || typeof input !== "object") return [];
  const files = (input as { files?: unknown }).files;
  return Array.isArray(files) ? (files as DriveFile[]) : [];
}

function parseFolderId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  const byFolders = s.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolders) return byFolders;
  const byQuery = s.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  if (/^[-\w]{20,}$/.test(s)) return s;
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Failed to read file"));
    r.onload = () => {
      const result = String(r.result || "");
      const marker = "base64,";
      const idx = result.indexOf(marker);
      resolve(idx >= 0 ? result.slice(idx + marker.length) : result);
    };
    r.readAsDataURL(file);
  });
}

function buildFolderName(last: string, first: string, cwid?: string | null) {
  const base = `${last.trim()}, ${first.trim()}`;
  return cwid ? `${base}_${cwid.trim()}` : base;
}

function renderDocName(tpl: string, first: string, last: string): string {
  return tpl
    .replace(/\{first\}/gi, first)
    .replace(/\{last\}/gi, last)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scoreMatch(folder: TCustomerFolder, first: string, last: string, cwid?: string | null): number {
  let score = 0;
  const fl = folder.last?.toLowerCase() ?? "";
  const ff = folder.first?.toLowerCase() ?? "";
  const fc = folder.cwid?.toLowerCase() ?? "";
  if (fl === last.toLowerCase()) score += 10;
  else if (fl.startsWith(last.toLowerCase())) score += 5;
  if (ff === first.toLowerCase()) score += 8;
  else if (ff.startsWith(first.toLowerCase())) score += 3;
  if (cwid && fc === cwid.toLowerCase()) score += 15;
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// BuildFolderDialog — full GAS-equivalent new-folder builder
// ─────────────────────────────────────────────────────────────────────────────

export function BuildFolderDialog({
  defaultName,
  customerFirst,
  customerLast,
  customerCwid,
  onBuild,
  onCancel,
  indexFolders,
  indexLoading,
}: {
  defaultName: string;
  customerFirst: string;
  customerLast: string;
  customerCwid?: string | null;
  onBuild: (args: {
    name: string;
    parentId: string;
    templates: Array<{ fileId: string; name: string }>;
    subfolders: string[];
  }) => void;
  onCancel: () => void;
  indexFolders: TCustomerFolder[];
  indexLoading: boolean;
}) {
  const [name, setName] = React.useState(defaultName);
  const [parentId, setParentId] = React.useState(ACTIVE_PARENT_ID);
  const [medicaid, setMedicaid] = React.useState<"yes" | "no" | "not_sure">("not_sure");
  const [selectedTemplates, setSelectedTemplates] = React.useState<Set<string>>(
    () => new Set(FOLDER_TEMPLATES.filter((t) => t.defaultChecked).map((t) => t.key)),
  );
  const [subfolderDrafts, setSubfolderDrafts] = React.useState<string[]>([]);
  const [subfolderInput, setSubfolderInput] = React.useState("");
  const [dupesAcknowledged, setDupesAcknowledged] = React.useState(false);

  // Duplicate detection against the index
  const duplicates = React.useMemo(() => {
    if (!indexFolders.length || !customerLast) return [];
    return indexFolders
      .map((f) => ({ folder: f, score: scoreMatch(f, customerFirst, customerLast, customerCwid) }))
      .filter((x) => x.score >= 8) // name match threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.folder);
  }, [indexFolders, customerFirst, customerLast, customerCwid]);

  const showDupeWarning = duplicates.length > 0 && !dupesAcknowledged;

  const addSubfolder = () => {
    const clean = subfolderInput.trim();
    if (!clean || subfolderDrafts.includes(clean)) return;
    setSubfolderDrafts((prev) => [...prev, clean]);
    setSubfolderInput("");
  };

  const buildTemplatePayload = (): Array<{ fileId: string; name: string }> => {
    return FOLDER_TEMPLATES.flatMap((tmpl) => {
      if (!selectedTemplates.has(tmpl.key)) return [];
      const docName = renderDocName(tmpl.docNameTpl, customerFirst, customerLast);
      if ("variants" in tmpl) {
        const fileId = medicaid === "yes" ? tmpl.variants.payer : tmpl.variants.nonpayer;
        return [{ fileId, name: docName }];
      }
      return [{ fileId: tmpl.id, name: docName }];
    });
  };

  const onSubmit = () => {
    if (!name.trim()) return;
    onBuild({
      name: name.trim(),
      parentId,
      templates: buildTemplatePayload(),
      subfolders: subfolderDrafts,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Build Customer Folder</div>
          <button type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
          {/* Duplicate warning */}
          {indexLoading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Checking for existing folders…
            </div>
          )}
          {showDupeWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-900">Possible duplicates found</div>
              <div className="space-y-1">
                {duplicates.map((f) => (
                  <a
                    key={f.id}
                    href={f.url || `https://drive.google.com/drive/folders/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm hover:bg-amber-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{f.name}</div>
                      <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                        <span className={f.status === "active" ? "text-emerald-600" : "text-slate-400"}>{f.status}</span>
                        {f.cwid && <span>CWID: {f.cwid}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-sky-600 hover:underline">Open ↗</span>
                  </a>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm border border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setDupesAcknowledged(true)}
                >
                  Build anyway
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showDupeWarning && (
            <>
              {/* Folder name + location */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="field md:col-span-2">
                  <span className="label">Folder name</span>
                  <input
                    className="input w-full"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    autoFocus
                  />
                  <span className="mt-1 block text-xs text-slate-400">Convention: Last, First_CWID</span>
                </label>
                <label className="field">
                  <span className="label">Location</span>
                  <select className="input w-full" value={parentId} onChange={(e) => setParentId(e.currentTarget.value)}>
                    <option value={ACTIVE_PARENT_ID}>Active Customers</option>
                    <option value={EXITED_PARENT_ID}>Exited Customers</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Medicaid enrolled</span>
                  <select
                    className="input w-full"
                    value={medicaid}
                    onChange={(e) => setMedicaid(e.currentTarget.value as typeof medicaid)}
                  >
                    <option value="not_sure">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              {/* Template selection */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Copy templates into folder
                </div>
                <div className="space-y-1.5">
                  {FOLDER_TEMPLATES.map((tmpl) => {
                    const checked = selectedTemplates.has(tmpl.key);
                    return (
                      <label
                        key={tmpl.key}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-sky-300 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-sky-600"
                          checked={checked}
                          onChange={() =>
                            setSelectedTemplates((prev) => {
                              const next = new Set(prev);
                              if (next.has(tmpl.key)) next.delete(tmpl.key);
                              else next.add(tmpl.key);
                              return next;
                            })
                          }
                        />
                        <div>
                          <div className="font-medium">{tmpl.label}</div>
                          {"variants" in tmpl ? (
                            <div className="text-xs text-slate-400">
                              {medicaid === "yes" ? "Payer variant" : "Non-payer variant"} · Google Sheet
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">Google Sheet</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subfolders */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Auto-create subfolders
                </div>
                {subfolderDrafts.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {subfolderDrafts.map((sub) => (
                      <span
                        key={sub}
                        className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                      >
                        {sub}
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-500 ml-0.5"
                          onClick={() => setSubfolderDrafts((prev) => prev.filter((s) => s !== sub))}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Subfolder name"
                    value={subfolderInput}
                    onChange={(e) => setSubfolderInput(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubfolder();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={addSubfolder}
                    disabled={!subfolderInput.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!showDupeWarning && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSubmit}
              disabled={!name.trim()}
            >
              Build Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkFolderDialog — link existing Drive folder
// ─────────────────────────────────────────────────────────────────────────────

export function LinkFolderDialog({
  customerFirst,
  customerLast,
  customerCwid,
  onLink,
  onCancel,
  busy,
}: {
  customerFirst: string;
  customerLast: string;
  customerCwid?: string | null;
  onLink: (folderId: string, folderName: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [urlInput, setUrlInput] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [searchMode, setSearchMode] = React.useState<"suggestions" | "url">("suggestions");

  const { data: indexData, isLoading: indexLoading } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
  );

  const suggestions = React.useMemo(() => {
    if (!indexData?.folders || !customerLast) return [];
    return indexData.folders
      .map((f) => ({ folder: f, score: scoreMatch(f, customerFirst, customerLast, customerCwid) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.folder);
  }, [indexData, customerFirst, customerLast, customerCwid]);

  const onLinkByUrl = () => {
    const id = parseFolderId(urlInput);
    if (!id) { setUrlError("Enter a valid Drive folder URL or ID."); return; }
    setUrlError(null);
    onLink(id, urlInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Link Existing Folder</div>
          <button type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            <button
              className={`btn btn-xs ${searchMode === "suggestions" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSearchMode("suggestions")}
            >
              Suggestions
            </button>
            <button
              className={`btn btn-xs ${searchMode === "url" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSearchMode("url")}
            >
              Paste URL / ID
            </button>
          </div>

          {searchMode === "suggestions" ? (
            <div>
              {indexLoading ? (
                <div className="text-sm text-slate-500">Loading folders from Drive…</div>
              ) : suggestions.length === 0 ? (
                <div className="text-sm text-slate-500">No close matches. Try "Paste URL / ID".</div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-auto">
                  {suggestions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                      onClick={() => onLink(f.id, f.name)}
                      disabled={busy}
                    >
                      <div className="text-sm font-medium text-slate-900">{f.name}</div>
                      <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                        <span className={f.status === "active" ? "text-emerald-600" : "text-slate-400"}>{f.status}</span>
                        {f.cwid && <span>CWID: {f.cwid}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="field block">
                <span className="label">Drive Folder URL or ID</span>
                <input
                  className="input w-full"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.currentTarget.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                  autoFocus
                />
              </label>
              {urlError && <div className="text-sm text-red-600">{urlError}</div>}
              <button
                className="btn btn-sm"
                onClick={onLinkByUrl}
                disabled={!urlInput.trim() || busy}
              >
                Link Folder
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerFilesPanel({ customerId }: { customerId: string }) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();
  const upload = useGDriveUpload();

  const customerFirst = String((customer as any)?.firstName || "");
  const customerLast = String((customer as any)?.lastName || "");
  const customerCwid = String((customer as any)?.cwId || (customer as any)?.hmisId || "");

  const defaultFolderName = customerLast && customerFirst
    ? buildFolderName(customerLast, customerFirst, customerCwid || null)
    : "";

  const folders = React.useMemo<LinkedFolder[]>(
    () =>
      Array.isArray((customer as any)?.meta?.driveFolders)
        ? (((customer as any).meta.driveFolders as LinkedFolder[]).map((f) => ({
            ...f,
            id: String(f?.id || "").trim(),
            alias: typeof f?.alias === "string" ? f.alias.trim() || null : (f?.alias ?? null),
            name: typeof f?.name === "string" ? f.name.trim() || null : (f?.name ?? null),
            driveId: typeof f?.driveId === "string" ? f.driveId.trim() || null : (f?.driveId ?? null),
          })).filter((f) => !!f.id))
        : [],
    [customer],
  );

  const [activeFolder, setActiveFolder] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showBuildDialog, setShowBuildDialog] = React.useState(false);
  const [showLinkDialog, setShowLinkDialog] = React.useState(false);
  const [folderInput, setFolderInput] = React.useState("");
  const [aliasInput, setAliasInput] = React.useState("");
  // Background build state: null = idle, "building" = in-progress
  const [buildingName, setBuildingName] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!activeFolder && folders.length > 0) setActiveFolder(folders[0].id);
    if (activeFolder && !folders.some((f) => f.id === activeFolder)) setActiveFolder(null);
  }, [folders, activeFolder]);

  const filesQ = useGDriveList(
    { folderId: activeFolder || undefined },
    { enabled: !!activeFolder, staleTime: 10_000 },
  );
  const files = readFiles(filesQ.data);
  const filesError = filesQ.error ? toApiError(filesQ.error).error : null;

  // Index data — preloaded so BuildFolderDialog has it immediately
  const { data: indexData, isLoading: indexLoading } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
  );
  const indexFolders = indexData?.folders ?? [];

  const buildFolder = useGDriveBuildCustomerFolder(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    {
      onSuccess: async (folder) => {
        // Attach to customer
        const next = [...folders, { id: folder.id, name: folder.name, alias: null }];
        await saveLinkedFolders(next);
        setActiveFolder(folder.id);
        setBuildingName(null);
        toast(`Folder "${folder.name}" is ready.`, { type: "success" });
      },
    },
  );

  const saveLinkedFolders = async (nextFolders: LinkedFolder[]) => {
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: {
        meta: {
          ...((customer as any)?.meta || {}),
          driveFolders: nextFolders,
        },
      },
    } as any);
  };

  const onAddFolder = async () => {
    const id = parseFolderId(folderInput);
    if (!id) { setError("Enter a valid Drive folder URL or id."); return; }
    if (folders.some((f) => f.id === id)) { setError("That folder is already linked."); return; }
    setError(null);
    const next = folders.concat({ id, alias: aliasInput.trim() || null });
    await saveLinkedFolders(next);
    setFolderInput("");
    setAliasInput("");
    setActiveFolder(id);
  };

  const onRemoveFolder = async (id: string) => {
    const next = folders.filter((f) => f.id !== id);
    setError(null);
    await saveLinkedFolders(next);
    if (activeFolder === id) setActiveFolder(next[0]?.id || null);
  };

  const onBuildConfirm = (args: {
    name: string;
    parentId: string;
    templates: Array<{ fileId: string; name: string }>;
    subfolders: string[];
  }) => {
    setShowBuildDialog(false);
    setBuildingName(args.name);
    setError(null);
    buildFolder.mutate(args, {
      onError: (err) => {
        setBuildingName(null);
        setError(toApiError(err).error || "Failed to build folder.");
      },
    });
  };

  const onLinkConfirm = async (folderId: string, folderName: string) => {
    if (folders.some((f) => f.id === folderId)) {
      setError("That folder is already linked.");
      setShowLinkDialog(false);
      return;
    }
    setError(null);
    const next = folders.concat({ id: folderId, name: folderName || folderId, alias: null });
    await saveLinkedFolders(next);
    setActiveFolder(folderId);
    setShowLinkDialog(false);
  };

  const onUpload = async (file: File) => {
    if (!activeFolder) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be 10MB or less."); return; }
    setError(null);
    const contentBase64 = await fileToBase64(file);
    await upload.mutateAsync({ parentId: activeFolder, name: file.name, mimeType: file.type || "application/octet-stream", contentBase64 });
    await filesQ.refetch();
  };

  const onCreateSubfolder = async () => {
    if (!activeFolder) return;
    const name = window.prompt("New subfolder name");
    if (!name || !name.trim()) return;
    setError(null);
    // Use raw createFolder API directly (small inline call)
    const { GDrive } = await import("@client/gdrive");
    await GDrive.createFolder({ parentId: activeFolder, name: name.trim() });
    await filesQ.refetch();
  };

  const busy = patchCustomer.isPending || upload.isPending || filesQ.isFetching;

  const customerDisplayName =
    String((customer as any)?.name || "").trim() ||
    [customerFirst, customerLast].filter(Boolean).join(" ") ||
    null;

  // Match candidates for the initial empty state — pre-scored from the index
  const matchCandidates = React.useMemo(() => {
    if (!indexFolders.length || !customerLast) return [];
    return indexFolders
      .map((f) => ({ folder: f, score: scoreMatch(f, customerFirst, customerLast, customerCwid || null) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.folder);
  }, [indexFolders, customerFirst, customerLast, customerCwid]);

  // ── No folders linked — show smart setup view ──
  if (folders.length === 0 && !buildingName) {
    return (
      <>
        {showBuildDialog && (
          <BuildFolderDialog
            defaultName={defaultFolderName}
            customerFirst={customerFirst}
            customerLast={customerLast}
            customerCwid={customerCwid || null}
            onBuild={onBuildConfirm}
            onCancel={() => setShowBuildDialog(false)}
            indexFolders={indexFolders}
            indexLoading={indexLoading}
          />
        )}
        {showLinkDialog && (
          <LinkFolderDialog
            customerFirst={customerFirst}
            customerLast={customerLast}
            customerCwid={customerCwid || null}
            onLink={(id, name) => void onLinkConfirm(id, name)}
            onCancel={() => setShowLinkDialog(false)}
            busy={busy}
          />
        )}

        <div className="space-y-4">
          {customerDisplayName && (
            <div className="text-base font-semibold text-slate-800">{customerDisplayName} — Drive Files</div>
          )}
          <div className="rounded-xl border border-slate-200 p-6 text-center space-y-4">
            <div className="text-base font-medium text-slate-900">No folder linked yet</div>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Build a new Drive folder or link an existing one.
              {defaultFolderName && (
                <> Suggested name: <strong className="text-slate-700">{defaultFolderName}</strong>.</>
              )}
            </p>
            <div className="flex justify-center gap-3">
              <button className="btn btn-sm btn-primary" onClick={() => setShowBuildDialog(true)} disabled={busy}>
                Build New Folder
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLinkDialog(true)} disabled={busy}>
                Link Existing
              </button>
            </div>
            {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          </div>

          {/* Match candidates — shown immediately on the initial page */}
          {(indexLoading || matchCandidates.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Possible matches in Drive
              </div>
              {indexLoading ? (
                <div className="px-4 py-3 text-sm text-slate-500">Searching Drive…</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {matchCandidates.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{f.name}</div>
                        <div className="flex gap-2 mt-0.5 text-xs text-slate-500">
                          <span className={f.status === "active" ? "text-emerald-600" : "text-slate-400"}>{f.status}</span>
                          {f.cwid && <span>CWID: {f.cwid}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={f.url || `https://drive.google.com/drive/folders/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-xs"
                        >
                          Open ↗
                        </a>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          disabled={busy}
                          onClick={() => void onLinkConfirm(f.id, f.name)}
                        >
                          Link
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Folders linked — show file browser ──
  return (
    <>
      {showBuildDialog && (
        <BuildFolderDialog
          defaultName={defaultFolderName}
          customerFirst={customerFirst}
          customerLast={customerLast}
          customerCwid={customerCwid || null}
          onBuild={onBuildConfirm}
          onCancel={() => setShowBuildDialog(false)}
          indexFolders={indexFolders}
          indexLoading={indexLoading}
        />
      )}
      {showLinkDialog && (
        <LinkFolderDialog
          customerFirst={customerFirst}
          customerLast={customerLast}
          customerCwid={customerCwid || null}
          onLink={(id, name) => void onLinkConfirm(id, name)}
          onCancel={() => setShowLinkDialog(false)}
          busy={busy}
        />
      )}

      <div className="space-y-4">
        {customerDisplayName && (
          <div className="text-base font-semibold text-slate-800">{customerDisplayName} — Drive Files</div>
        )}
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Background build progress banner */}
        {buildingName && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            <div className="text-sm text-sky-900">
              Building <strong>{buildingName}</strong>… You can continue using the app.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          {/* Folder list */}
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="text-sm font-medium text-slate-900">Linked Folders</div>
              <div className="flex gap-1">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowBuildDialog(true)}
                  disabled={busy}
                  title="Build new folder"
                >
                  + New
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowLinkDialog(true)}
                  disabled={busy}
                  title="Link existing folder"
                >
                  Link
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto p-2">
              <ul className="space-y-1">
                {folders.map((f) => {
                  const active = activeFolder === f.id;
                  return (
                    <li key={f.id} className={["rounded-lg border px-2 py-2", active ? "bg-slate-50 border-slate-300" : "border-transparent"].join(" ")}>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="text-left text-sm text-sky-700 hover:underline dark:text-sky-300"
                          onClick={() => setActiveFolder(f.id)}
                        >
                          {f.alias || f.name || f.id}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-red-500 shrink-0"
                          onClick={() => void onRemoveFolder(f.id)}
                          disabled={busy}
                          title="Remove link (does not delete folder)"
                        >
                          Remove
                        </button>
                      </div>
                      <a
                        href={`https://drive.google.com/drive/folders/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-slate-400 hover:underline"
                      >
                        Open in Drive ↗
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* File list */}
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="text-sm font-medium text-slate-900">Files</div>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => void filesQ.refetch()} disabled={!activeFolder || busy}>
                  Refresh
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={!activeFolder || busy}>
                  Upload
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => void onCreateSubfolder()} disabled={!activeFolder || busy}>
                  + Subfolder
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) void onUpload(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </div>

            {!activeFolder ? (
              <div className="p-3 text-sm text-slate-600">Select a linked folder to view files.</div>
            ) : filesQ.isLoading ? (
              <div className="p-3 text-sm text-slate-600">Loading files…</div>
            ) : filesQ.isError ? (
              <div className="p-3 text-sm text-rose-700">Failed to load files: {filesError || "Drive request failed."}</div>
            ) : files.length === 0 ? (
              <div className="p-3 text-sm text-slate-600">No files found. Upload or open the folder in Drive.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Modified</th>
                      <th className="px-3 py-2 text-left">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f, idx) => (
                      <tr key={`${f.id || f.name || "file"}:${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          {f.webViewLink ? (
                            <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                              {f.name || "(untitled)"}
                            </a>
                          ) : (
                            f.name || "(untitled)"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{fmtDateOrDash(f.modifiedTime)}</td>
                        <td className="px-3 py-2 text-slate-500">{fmtBytes(f.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Legacy URL input (collapsed) */}
        <details className="rounded-xl border border-slate-100">
          <summary className="cursor-pointer px-4 py-2 text-xs text-slate-400 select-none">
            Link folder by URL / ID manually
          </summary>
          <div className="px-4 pb-4 pt-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="field min-w-[280px] grow">
                <span className="label">Folder URL or ID</span>
                <input
                  className="input"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.currentTarget.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                />
              </label>
              <label className="field min-w-[180px]">
                <span className="label">Alias</span>
                <input
                  className="input"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.currentTarget.value)}
                  placeholder="Optional label"
                />
              </label>
              <button className="btn btn-sm" onClick={() => void onAddFolder()} disabled={!folderInput || busy}>
                Add
              </button>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
