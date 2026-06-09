"use client";

import React from "react";
import { toApiError } from "@client/api";
import { useCustomer, usePatchCustomers } from "@hooks/useCustomers";
import {
  useGDriveList,
  useGDriveCustomerFolderIndex,
  useGDriveBuildCustomerFolder,
  useGDriveCustomerFolderSync,
  useGDriveUpload,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import { useGoogleIntegrationConnect } from "@hooks/useGoogleIntegrations";
import { fmtBytes, fmtDateOrDash } from "@lib/formatters";
import { toast } from "@lib/toast";
import { DRIVE_FILE_TEMPLATES } from "@lib/driveConfig";
import { PermissionErrorBanner, isScopeError, type ScopeErrorPayload } from "@entities/ui/PermissionErrorBanner";
import {
  FileTypeIcon,
  FOLDER_MIME,
  getMimeCategory as _getMimeCategory,
} from "@entities/gdrive/FileTypeIcon";
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
  mimeType?: string;
  size?: number | string;
  modifiedTime?: string;
  webViewLink?: string;
};

// FileTypeIcon, FOLDER_MIME, getMimeCategory imported from @entities/gdrive/FileTypeIcon

const FOLDER_TEMPLATES = DRIVE_FILE_TEMPLATES;
const ORIGINAL_CUSTOMER_FILE_TOOL_URL =
  "https://script.google.com/a/macros/thehrdc.org/s/AKfycby1UgNzSZYurMKSq67cFEj9CUfFHZt7Ox4-yVC_MVa7Bum4B14BqUb0lVBkxAd95N90yQ/exec";
const CUSTOMER_FILE_PARENT_FOLDER_URL =
  "https://drive.google.com/drive/folders/1Bfu-bd98xtv3taCKii8ud44gPuAFdGnO";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFiles(input: unknown): DriveFile[] {
  if (!input || typeof input !== "object") return [];
  const files = (input as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  return (files as Array<Record<string, unknown>>).map((f) => ({
    id:           typeof f.id === "string" ? f.id : undefined,
    name:         typeof f.name === "string" ? f.name : undefined,
    mimeType:     typeof f.mimeType === "string" ? f.mimeType : undefined,
    size:         f.size != null ? (f.size as number | string) : undefined,
    modifiedTime: typeof f.modifiedTime === "string" ? f.modifiedTime : undefined,
    webViewLink:  typeof f.webViewLink === "string" ? f.webViewLink : undefined,
  }));
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

function cleanLinkedFolders(folders: LinkedFolder[]): LinkedFolder[] {
  return folders
    .map((folder) => {
      const id = String(folder.id || "").trim();
      const alias = typeof folder.alias === "string" ? folder.alias.trim() : "";
      const name = typeof folder.name === "string" ? folder.name.trim() : "";
      const driveId = typeof folder.driveId === "string" ? folder.driveId.trim() : "";
      return {
        id,
        ...(alias ? { alias } : {}),
        ...(name ? { name } : {}),
        ...(driveId ? { driveId } : {}),
      };
    })
    .filter((folder) => !!folder.id);
}

function normalizeMatchText(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_,-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function renderDocName(tpl: string, first: string, last: string): string {
  return tpl
    .replace(/\{first\}/gi, first)
    .replace(/\{last\}/gi, last)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scoreMatch(folder: TCustomerFolder, first: string, last: string, cwid?: string | null): number {
  const folderLast = normalizeMatchText(folder.last);
  const folderFirst = normalizeMatchText(folder.first);
  const folderName = normalizeMatchText(folder.name);
  const folderCwid = String(folder.cwid || "").trim().toLowerCase();
  const customerLast = normalizeMatchText(last);
  const customerFirst = normalizeMatchText(first);
  const customerCwid = String(cwid || "").trim().toLowerCase();

  let score = 0;
  if (customerCwid && folderCwid && customerCwid === folderCwid) score += 95;
  else if (customerCwid && folderCwid) score -= 30;

  if (customerLast && folderLast && customerLast === folderLast) score += 42;
  else if (customerLast && folderLast && (folderLast.startsWith(customerLast) || customerLast.startsWith(folderLast))) score += 18;

  if (customerFirst && folderFirst && customerFirst === folderFirst) score += 34;
  else if (customerFirst && folderFirst && (folderFirst.startsWith(customerFirst) || customerFirst.startsWith(folderFirst))) score += 14;

  const expectedFolderName = normalizeMatchText(buildFolderName(last, first, cwid || null));
  if (expectedFolderName && expectedFolderName === folderName) score += 18;

  return Math.max(0, Math.min(100, score));
}

type FolderMatchCandidate = {
  folder: TCustomerFolder;
  score: number;
  linked: boolean;
  customerMissingCwId: boolean;
  folderMissingCwId: boolean;
};

function scoreTone(score: number): string {
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 70) return "bg-sky-50 text-sky-700 border-sky-200";
  if (score >= 45) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function buildFolderMatchCandidates(args: {
  folders: TCustomerFolder[];
  linkedFolderIds: string[];
  first: string;
  last: string;
  cwid?: string | null;
}) {
  const linkedIds = new Set(args.linkedFolderIds.map((value) => String(value || "").trim()).filter(Boolean));
  const customerCwId = String(args.cwid || "").trim();

  return args.folders
    .map((folder) => ({
      folder,
      score: scoreMatch(folder, args.first, args.last, customerCwId || null),
      linked: linkedIds.has(String(folder.id || "").trim()),
      customerMissingCwId: !customerCwId && !!String(folder.cwid || "").trim(),
      folderMissingCwId: !!customerCwId && !String(folder.cwid || "").trim(),
    }))
    .filter((candidate) => candidate.linked || candidate.score > 0)
    .sort((a, b) => {
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      return b.score - a.score;
    });
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
    templates: Array<{ fileId: string; name: string; role?: string }>;
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

  const buildTemplatePayload = (): Array<{ fileId: string; name: string; role?: string }> => {
    return FOLDER_TEMPLATES.flatMap((tmpl) => {
      if (!selectedTemplates.has(tmpl.key)) return [];
      const docName = renderDocName(tmpl.docNameTpl, customerFirst, customerLast);
      // The TSS Workbook template gets flagged so the build returns its created
      // file for auto-linking as the customer's TSS workbook.
      const role = tmpl.key === "tss_workbook" ? "tssWorkbook" : undefined;
      if ("variants" in tmpl) {
        const fileId = medicaid === "yes" ? tmpl.variants.payer : tmpl.variants.nonpayer;
        if (fileId.length < 3) return [];
        return [{ fileId, name: docName, ...(role ? { role } : {}) }];
      }
      if (tmpl.id.length < 3) return [];
      return [{ fileId: tmpl.id, name: docName, ...(role ? { role } : {}) }];
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
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 p-4">
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
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 p-4">
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
                <div className="text-sm text-slate-500">No close matches. Try &quot;Paste URL / ID&quot;.</div>
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
  const folderSync = useGDriveCustomerFolderSync();
  const driveConnect = useGoogleIntegrationConnect("googleDrive");

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
  // Subfolder navigation — stack of { id, name } pushed as user drills in
  const [subfolderStack, setSubfolderStack] = React.useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = React.useState<string | ScopeErrorPayload | null>(null);
  const [showBuildDialog, setShowBuildDialog] = React.useState(false);
  const [showLinkDialog, setShowLinkDialog] = React.useState(false);
  const [folderInput, setFolderInput] = React.useState("");
  const [aliasInput, setAliasInput] = React.useState("");
  const [mapperBusyFolderId, setMapperBusyFolderId] = React.useState<string | null>(null);
  // Background build state: null = idle, "building" = in-progress
  const [buildingName, setBuildingName] = React.useState<string | null>(null);
  // Inline subfolder creation
  const [showSubfolderInput, setShowSubfolderInput] = React.useState(false);
  const [newSubfolderName, setNewSubfolderName] = React.useState("");
  const [creatingSubfolder, setCreatingSubfolder] = React.useState(false);
  // Drag-and-drop upload
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  // The folder being listed — current subfolder or the root linked folder
  const listFolderId = subfolderStack.length > 0
    ? subfolderStack[subfolderStack.length - 1].id
    : activeFolder;

  // Reset subfolder stack when the user switches the linked root folder
  React.useEffect(() => {
    setSubfolderStack([]);
    setShowSubfolderInput(false);
  }, [activeFolder]);

  React.useEffect(() => {
    if (!activeFolder && folders.length > 0) setActiveFolder(folders[0].id);
    if (activeFolder && !folders.some((f) => f.id === activeFolder)) setActiveFolder(null);
  }, [folders, activeFolder]);

  const filesQ = useGDriveList(
    { folderId: listFolderId || undefined },
    { enabled: !!listFolderId, staleTime: 10_000 },
  );
  const files = readFiles(filesQ.data);
  const filesError = filesQ.error ? toApiError(filesQ.error).error : null;

  // Index data — preloaded so BuildFolderDialog has it immediately
  const { data: indexData, isLoading: indexLoading } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
  );
  const indexFolders = indexData?.folders ?? [];
  const linkedFolderIds = React.useMemo(
    () => folders.map((folder) => String(folder.id || "").trim()).filter(Boolean),
    [folders],
  );

  const buildFolder = useGDriveBuildCustomerFolder(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    {
      onSuccess: async (folder) => {
        // Attach to customer
        const next = [...folders, { id: folder.id, name: folder.name, alias: null }];
        await saveLinkedFolders(next);
        setActiveFolder(folder.id);
        setBuildingName(null);
        const warningCount = Array.isArray(folder.warnings) ? folder.warnings.length : 0;
        toast(
          warningCount
            ? `Folder "${folder.name}" was created, but ${warningCount} item${warningCount === 1 ? "" : "s"} need manual cleanup.`
            : `Folder "${folder.name}" is ready.`,
          { type: warningCount ? "warning" : "success" },
        );
      },
    },
  );

  const saveLinkedFolders = async (nextFolders: LinkedFolder[]) => {
    // Transitional customer folder write. During the Drive storage migration,
    // mirror this primary folder into customerDrive.folderId and meta.driveFolderId
    // when the canonical customerDrive object is introduced for this panel.
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: {
        meta: {
          ...((customer as any)?.meta || {}),
          driveFolders: cleanLinkedFolders(nextFolders),
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
    templates: Array<{ fileId: string; name: string; role?: string }>;
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

  const onCopyFolderCwIdToCustomer = async (folder: TCustomerFolder) => {
    const nextCwId = String(folder.cwid || "").trim();
    if (!nextCwId) return;
    setMapperBusyFolderId(folder.id);
    setError(null);
    try {
      await patchCustomer.mutateAsync({
        id: customerId,
        patch: { cwId: nextCwId },
      } as any);
      toast(`Set customer CW ID to ${nextCwId}.`, { type: "success" });
    } catch (err) {
      setError(toApiError(err).error || "Failed to update customer CW ID.");
    } finally {
      setMapperBusyFolderId(null);
    }
  };

  const onCopyCustomerCwIdToFolder = async (folder: TCustomerFolder) => {
    if (!customerCwid.trim()) return;
    setMapperBusyFolderId(folder.id);
    setError(null);
    try {
      await folderSync.mutateAsync({
        mode: "folderCwIdFromCustomer",
        customerId,
        folderId: folder.id,
        apply: true,
      });
      toast("Updated folder name with customer CW ID.", { type: "success" });
    } catch (err) {
      setError(toApiError(err).error || "Failed to update folder CW ID.");
    } finally {
      setMapperBusyFolderId(null);
    }
  };

  const onUpload = async (file: File) => {
    if (!listFolderId) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be 10MB or less."); return; }
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      await upload.mutateAsync({ parentId: listFolderId, name: file.name, mimeType: file.type || "application/octet-stream", contentBase64 });
      await filesQ.refetch();
    } catch (err) {
      const apiErr = toApiError(err);
      setError(isScopeError(apiErr) ? (apiErr as ScopeErrorPayload) : (apiErr.error || "Upload failed."));
    }
  };

  const onUploadFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      await onUpload(file);
    }
  };

  const onCreateSubfolder = async () => {
    const name = newSubfolderName.trim();
    if (!name || !listFolderId) return;
    setCreatingSubfolder(true);
    setError(null);
    try {
      const { GDrive } = await import("@client/gdrive");
      await GDrive.createFolder({ parentId: listFolderId, name });
      setNewSubfolderName("");
      setShowSubfolderInput(false);
      await filesQ.refetch();
    } catch (err) {
      const apiErr = toApiError(err);
      setError(isScopeError(apiErr) ? (apiErr as ScopeErrorPayload) : (apiErr.error || "Failed to create subfolder."));
    } finally {
      setCreatingSubfolder(false);
    }
  };

  const onNavigateInto = (folder: DriveFile) => {
    if (!folder.id || !folder.name) return;
    setSubfolderStack((prev) => [...prev, { id: folder.id!, name: folder.name! }]);
    setShowSubfolderInput(false);
  };

  const onBreadcrumbNav = (depth: number) => {
    // depth = -1 means root, 0 means first subfolder, etc.
    setSubfolderStack((prev) => depth < 0 ? [] : prev.slice(0, depth + 1));
    setShowSubfolderInput(false);
  };

  const busy = patchCustomer.isPending || upload.isPending || filesQ.isFetching || folderSync.isPending || creatingSubfolder;

  const customerDisplayName =
    String((customer as any)?.name || "").trim() ||
    [customerFirst, customerLast].filter(Boolean).join(" ") ||
    null;

  // Match candidates for the initial empty state — pre-scored from the index
  const matchCandidates = React.useMemo(
    () =>
      buildFolderMatchCandidates({
        folders: indexFolders,
        linkedFolderIds,
        first: customerFirst,
        last: customerLast,
        cwid: customerCwid || null,
      }).slice(0, 8),
    [indexFolders, linkedFolderIds, customerFirst, customerLast, customerCwid],
  );
  const mapperCandidates = React.useMemo(() => matchCandidates.slice(0, 6), [matchCandidates]);

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
                  {matchCandidates.map((candidate) => (
                    <li
                      key={candidate.folder.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium text-slate-900">{candidate.folder.name}</div>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              scoreTone(candidate.score),
                            ].join(" ")}
                          >
                            {candidate.score}%
                          </span>
                        </div>
                        <div className="flex gap-2 mt-0.5 text-xs text-slate-500">
                          <span
                            className={
                              candidate.folder.status === "active" ? "text-emerald-600" : "text-slate-400"
                            }
                          >
                            {candidate.folder.status}
                          </span>
                          {candidate.folder.cwid && <span>CWID: {candidate.folder.cwid}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={
                            candidate.folder.url ||
                            `https://drive.google.com/drive/folders/${candidate.folder.id}`
                          }
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
                          onClick={() => void onLinkConfirm(candidate.folder.id, candidate.folder.name)}
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
        {error && (
          isScopeError(error) ? (
            <PermissionErrorBanner
              payload={error as ScopeErrorPayload}
              reauthorizing={driveConnect.isPending}
              onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
            />
          ) : (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div>{String(error)}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <a
                  href={ORIGINAL_CUSTOMER_FILE_TOOL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-red-800 underline underline-offset-2 hover:text-red-950"
                >
                  Open original customer filer tool
                </a>
                <a
                  href={CUSTOMER_FILE_PARENT_FOLDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-red-800 underline underline-offset-2 hover:text-red-950"
                >
                  Open customer file folder
                </a>
              </div>
            </div>
          )
        )}

        {/* Background build progress banner */}
        {buildingName && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            <div className="text-sm text-sky-900">
              Building <strong>{buildingName}</strong>… You can continue using the app.
            </div>
          </div>
        )}

        {(indexLoading || mapperCandidates.length > 0) && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <div className="text-sm font-medium text-slate-900">Auto Mapper</div>
              <div className="text-xs text-slate-500">
                Matches folders using linked ids first, then CWID, last name, and first name.
              </div>
            </div>
            {indexLoading ? (
              <div className="px-4 py-3 text-sm text-slate-500">Scanning indexed foldersâ€¦</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mapperCandidates.map((candidate) => {
                  const folder = candidate.folder;
                  const mapperBusy = mapperBusyFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-medium text-slate-900">{folder.name}</div>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              scoreTone(candidate.score),
                            ].join(" ")}
                          >
                            Match {candidate.score}%
                          </span>
                          {candidate.linked && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              Linked
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className={folder.status === "active" ? "text-emerald-600" : "text-slate-400"}>
                            {folder.status}
                          </span>
                          <span>Folder CWID: {folder.cwid || "None"}</span>
                          <span>Customer CWID: {customerCwid || "None"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <a
                          href={folder.url || `https://drive.google.com/drive/folders/${folder.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-xs"
                        >
                          Open â†—
                        </a>
                        {!candidate.linked && (
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            disabled={busy || mapperBusy}
                            onClick={() => void onLinkConfirm(folder.id, folder.name)}
                          >
                            Link Folder
                          </button>
                        )}
                        {candidate.customerMissingCwId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={busy || mapperBusy}
                            onClick={() => void onCopyFolderCwIdToCustomer(folder)}
                          >
                            Use Folder CWID
                          </button>
                        )}
                        {candidate.folderMissingCwId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={busy || mapperBusy}
                            onClick={() => void onCopyCustomerCwIdToFolder(folder)}
                          >
                            Use Customer CWID
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

          {/* File browser */}
          <div className="rounded-xl border border-slate-200 flex flex-col min-h-0">

            {/* Header row */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 shrink-0">
              {/* Breadcrumb */}
              <div className="flex min-w-0 items-center gap-1 text-sm overflow-hidden">
                <button
                  type="button"
                  className={[
                    "shrink-0 font-medium transition-colors",
                    subfolderStack.length > 0 ? "text-sky-600 hover:text-sky-800" : "text-slate-900 cursor-default",
                  ].join(" ")}
                  onClick={() => onBreadcrumbNav(-1)}
                  disabled={subfolderStack.length === 0}
                >
                  Files
                </button>
                {subfolderStack.map((seg, idx) => (
                  <React.Fragment key={seg.id}>
                    <span className="text-slate-300 shrink-0">/</span>
                    <button
                      type="button"
                      className={[
                        "truncate max-w-[120px] transition-colors",
                        idx < subfolderStack.length - 1
                          ? "text-sky-600 hover:text-sky-800"
                          : "text-slate-900 font-medium cursor-default",
                      ].join(" ")}
                      onClick={() => onBreadcrumbNav(idx)}
                      disabled={idx === subfolderStack.length - 1}
                      title={seg.name}
                    >
                      {seg.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => void filesQ.refetch()}
                  disabled={!listFolderId || busy}
                  title="Refresh"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!listFolderId || busy}
                >
                  Upload
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => { setShowSubfolderInput((v) => !v); setNewSubfolderName(""); }}
                  disabled={!listFolderId || busy}
                >
                  + Folder
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { void onUploadFiles(e.currentTarget.files); e.currentTarget.value = ""; }}
                />
              </div>
            </div>

            {/* Inline create subfolder */}
            {showSubfolderInput && (
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 shrink-0">
                <input
                  autoFocus
                  className="input input-sm flex-1 text-sm"
                  placeholder="New folder name"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onCreateSubfolder();
                    if (e.key === "Escape") { setShowSubfolderInput(false); setNewSubfolderName(""); }
                  }}
                  disabled={creatingSubfolder}
                />
                <button
                  type="button"
                  className="btn btn-xs btn-primary shrink-0"
                  disabled={!newSubfolderName.trim() || creatingSubfolder}
                  onClick={() => void onCreateSubfolder()}
                >
                  {creatingSubfolder ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs shrink-0"
                  onClick={() => { setShowSubfolderInput(false); setNewSubfolderName(""); }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* File list body — also a drag-and-drop zone */}
            <div
              ref={dropZoneRef}
              className={[
                "relative flex-1 min-h-0 transition-colors",
                isDragging ? "bg-sky-50 outline outline-2 outline-dashed outline-sky-300 outline-offset-[-2px] rounded-b-xl" : "",
              ].join(" ")}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => {
                if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void onUploadFiles(e.dataTransfer.files);
              }}
            >
              {isDragging && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-b-xl">
                  <div className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm">
                    Drop to upload
                  </div>
                </div>
              )}

              {!listFolderId ? (
                <div className="p-4 text-sm text-slate-500">Select a linked folder to view files.</div>
              ) : filesQ.isLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
                  <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Loading…
                </div>
              ) : filesQ.isError ? (
                <div className="p-3">
                  {isScopeError(filesQ.error) ? (
                    <PermissionErrorBanner
                      payload={filesQ.error as unknown as ScopeErrorPayload}
                      reauthorizing={driveConnect.isPending}
                      onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
                    />
                  ) : (
                    <div className="text-sm text-rose-700">Failed to load: {filesError || "Drive request failed."}</div>
                  )}
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-400">
                  <svg className="h-8 w-8 text-slate-200" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                  <span>Empty folder</span>
                  <span className="text-xs text-slate-300">Upload a file or create a subfolder</span>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {files.map((f, idx) => {
                    const isFolder = f.mimeType === FOLDER_MIME;
                    return (
                      <li
                        key={`${f.id || f.name || "f"}:${idx}`}
                        className="group flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <FileTypeIcon mime={f.mimeType} />

                        <div className="min-w-0 flex-1">
                          {isFolder ? (
                            <button
                              type="button"
                              className="w-full truncate text-left text-sm font-medium text-slate-900 hover:text-sky-700 transition-colors"
                              onClick={() => onNavigateInto(f)}
                              title={f.name}
                            >
                              {f.name || "(untitled)"}
                            </button>
                          ) : (
                            <a
                              href={f.webViewLink || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm text-slate-900 hover:text-sky-700 transition-colors"
                              title={f.name}
                            >
                              {f.name || "(untitled)"}
                            </a>
                          )}
                          {f.modifiedTime && (
                            <div className="text-[11px] text-slate-400">{fmtDateOrDash(f.modifiedTime)}</div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isFolder && f.size != null && (
                            <span className="text-[11px] text-slate-400">{fmtBytes(f.size)}</span>
                          )}
                          {isFolder ? (
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"
                              onClick={() => onNavigateInto(f)}
                            >
                              Open →
                            </button>
                          ) : null}
                          {f.webViewLink ? (
                            <a
                              href={f.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                              title="Open in Google Drive"
                            >
                              ↗
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
