// features/customers/components/CustomerIntegrationsPanel.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { toApiError } from "@client/api";
import { useAuth } from "@app/auth/AuthProvider";
import { useCustomer, usePatchCustomers } from "@hooks/useCustomers";
import {
  useGDriveList,
  useGDriveCustomerFolderIndex,
  useGDriveBuildCustomerFolder,
  useGDriveUpload,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import {
  useJotformFormsLite,
  useJotformSubmissionsLite,
  useJotformApiSubmissions,
  useJotformApiSubmission,
  useJotformDigest,
  useLinkJotformSubmission,
  type JotformForm,
  type JotformSubmission,
} from "@hooks/useJotform";
import { JotformDigestDetailCard } from "@features/widgets/jotform/components/JotformDigestDetailCard";
import { fmtBytes, fmtDateOrDash, fmtDateSmartOrDash } from "@lib/formatters";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { resolveFunctionsBase } from "@lib/functionsBase";
import { appCheck } from "@lib/firebase";
import { getToken as getAppCheckToken } from "firebase/app-check";
import { toast } from "@lib/toast";
import { BuildFolderDialog, LinkFolderDialog } from "./CustomerFilesPanel";
import type { TCustomerFolder } from "@types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LinkedFolder = {
  id: string;
  alias?: string | null;
  name?: string | null;
};

type LinkedFormRef = {
  formId: string;
  formAlias?: string | null;
};

type LinkedSubmissionRef = {
  formId: string;
  submissionId: string;
  alias?: string | null;
  linkedAt?: string | null;
};

type DriveFile = {
  id?: string;
  name?: string;
  size?: number | string;
  modifiedTime?: string;
  webViewLink?: string;
};

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
      return {
        id,
        ...(alias ? { alias } : {}),
        ...(name ? { name } : {}),
      };
    })
    .filter((folder) => !!folder.id);
}

function scoreMatch(
  folder: TCustomerFolder,
  first: string,
  last: string,
  cwid?: string | null,
): number {
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
// IntegrationBlock — collapsible section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function IntegrationBlock({
  icon,
  title,
  summary,
  headerRight,
  open,
  onToggle,
  children,
  accentClass = "bg-slate-100 text-slate-600",
}: {
  icon: string;
  title: string;
  summary?: React.ReactNode;
  headerRight?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accentClass?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition-shadow ${open ? "border-slate-300 shadow-md" : "border-slate-200"}`}>
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 text-left transition-colors hover:bg-slate-50/80 min-w-0"
          onClick={onToggle}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base leading-none ${accentClass}`}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            {summary ? (
              <div className="mt-0.5 truncate text-xs text-slate-400">{summary}</div>
            ) : null}
          </div>
          <svg
            className="ml-1 shrink-0 text-slate-400 transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {headerRight ? (
          <div className="shrink-0 flex items-center gap-2">
            {headerRight}
          </div>
        ) : null}
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission answer helpers
// ─────────────────────────────────────────────────────────────────────────────

function answerText(entry: unknown): string {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;
  if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
  if (Array.isArray(entry)) return entry.map(answerText).filter(Boolean).join(", ");
  if (typeof entry === "object") {
    const obj = entry as Record<string, unknown>;
    const v = obj.answer ?? obj.prettyFormat ?? obj.value;
    if (v != null) return answerText(v);
    return Object.values(obj).map(answerText).filter(Boolean).join(" ");
  }
  return "";
}

function findAnswerByLabel(answers: unknown, pattern: RegExp): string {
  if (!answers || typeof answers !== "object") return "";
  for (const raw of Object.values(answers as Record<string, unknown>)) {
    const entry = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!entry) continue;
    const label = String(entry.text || entry.name || "").trim();
    if (pattern.test(label)) return answerText(entry.answer ?? entry.prettyFormat ?? entry.value ?? entry).trim();
  }
  return "";
}

function submissionDisplayName(sub: unknown): string {
  const answers = (sub as any)?.answers;
  return (
    findAnswerByLabel(answers, /head\s+of\s+household/i) ||
    findAnswerByLabel(answers, /first\s*name/i) ||
    ""
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubmissionPreviewModal
// ─────────────────────────────────────────────────────────────────────────────

function SubmissionPreviewModal({
  formId,
  submissionId,
  onClose,
}: {
  formId: string;
  submissionId: string;
  onClose: () => void;
}) {
  const subQ = useJotformApiSubmission(submissionId, { enabled: !!submissionId });
  const digestQ = useJotformDigest({ formId }, { enabled: !!formId });
  const sub = subQ.data;
  const answers = (sub as any)?.answers;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">Submission Preview</div>
            <div className="mt-0.5 font-mono text-xs text-slate-400">{submissionId}</div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://www.jotform.com/submission/${submissionId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-600 hover:underline"
            >
              Open in Jotform ↗
            </a>
            <button
              type="button"
              className="text-xl leading-none text-slate-400 hover:text-slate-700"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {subQ.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
              Loading submission…
            </div>
          ) : subQ.isError || !sub ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load submission. It may not be synced to Firestore yet.
            </div>
          ) : digestQ.data ? (
            <JotformDigestDetailCard
              submission={sub as Record<string, unknown>}
              digestMap={digestQ.data}
            />
          ) : (
            /* Fallback: raw answers table */
            <div className="space-y-1">
              {answers && typeof answers === "object"
                ? Object.entries(answers as Record<string, unknown>).map(([key, raw]) => {
                    const entry = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
                    const label = String(entry?.text || entry?.name || key).trim();
                    const value = answerText(entry?.answer ?? entry?.prettyFormat ?? entry?.value ?? raw).trim();
                    if (!value) return null;
                    return (
                      <div key={key} className="flex gap-3 rounded-lg px-3 py-2 text-sm odd:bg-slate-50">
                        <div className="w-40 shrink-0 font-medium text-slate-600">{label}</div>
                        <div className="min-w-0 text-slate-800">{value}</div>
                      </div>
                    );
                  })
                : <div className="text-sm text-slate-400">No answers available.</div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GDriveBlock helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// GDriveBlock
// ─────────────────────────────────────────────────────────────────────────────

function GDriveBlock({ customerId }: { customerId: string }) {
  const { signInWithGoogle, user } = useAuth();
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();
  const upload = useGDriveUpload();
  const [connectingGoogle, setConnectingGoogle] = React.useState(false);
  const [hasDriveToken, setHasDriveToken] = React.useState(() => !!getGoogleDriveAccessToken());
  const [diagResult, setDiagResult] = React.useState<Record<string, unknown> | null>(null);
  const [diagRunning, setDiagRunning] = React.useState(false);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      await signInWithGoogle();
      setHasDriveToken(!!getGoogleDriveAccessToken());
      toast("Google Drive connected.", { type: "success" });
    } catch (err) {
      toast(toApiError(err).error || "Google sign-in failed.", { type: "error" });
    } finally {
      setConnectingGoogle(false);
    }
  };
  const runDiagnostics = async () => {
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const idToken = await (user as any)?.getIdToken?.();
      const driveToken = getGoogleDriveAccessToken();
      const base = resolveFunctionsBase();
      let appCheckTokenStr = "";
      try { appCheckTokenStr = (await getAppCheckToken(appCheck, false)).token; } catch {}
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...(appCheckTokenStr ? { "x-firebase-appcheck": appCheckTokenStr } : {}),
        ...(driveToken ? { "x-drive-access-token": driveToken } : {}),
      };
      const folderId = firstFolder?.id || "";
      const [listRes, indexRes] = await Promise.allSettled([
        fetch(`${base}/gdriveList?${folderId ? `folderId=${folderId}&` : ""}debug=1`, { headers }).then((r) => r.json()),
        fetch(`${base}/gdriveCustomerFolderIndex?activeParentId=${ACTIVE_PARENT_ID}&exitedParentId=${EXITED_PARENT_ID}&debug=1`, { headers }).then((r) => r.json()),
      ]);
      setDiagResult({
        headerTokenSent: !!driveToken,
        gdriveList: listRes.status === "fulfilled" ? listRes.value : { error: String((listRes as any).reason) },
        gdriveIndex: indexRes.status === "fulfilled" ? indexRes.value : { error: String((indexRes as any).reason) },
      });
    } catch (e: any) {
      setDiagResult({ error: String(e?.message || e) });
    } finally {
      setDiagRunning(false);
    }
  };

  const [open, setOpen] = React.useState(false);
  const [showBuildDialog, setShowBuildDialog] = React.useState(false);
  const [showLinkDialog, setShowLinkDialog] = React.useState(false);
  const [showNewMenu, setShowNewMenu] = React.useState(false);
  const [menuFolderId, setMenuFolderId] = React.useState<string | null>(null);
  const [editingFolder, setEditingFolder] = React.useState<LinkedFolder | null>(null);
  const [editAlias, setEditAlias] = React.useState("");
  const [editLink, setEditLink] = React.useState("");
  const [editLinkError, setEditLinkError] = React.useState<string | null>(null);
  const [uploadingFolderId, setUploadingFolderId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [buildingName, setBuildingName] = React.useState<string | null>(null);
  const editFileRef = React.useRef<HTMLInputElement>(null);
  const newMenuRef = React.useRef<HTMLDivElement | null>(null);
  const actionMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  const customerFirst = String((customer as any)?.firstName || "");
  const customerLast = String((customer as any)?.lastName || "");
  const customerCwid = String((customer as any)?.cwId || (customer as any)?.hmisId || "");

  const folders = React.useMemo<LinkedFolder[]>(
    () =>
      Array.isArray((customer as any)?.meta?.driveFolders)
        ? ((customer as any).meta.driveFolders as LinkedFolder[])
            .map((f) => ({
              ...f,
              id: String(f?.id || "").trim(),
              alias: typeof f?.alias === "string" ? f.alias.trim() || null : (f?.alias ?? null),
              name: typeof f?.name === "string" ? f.name.trim() || null : (f?.name ?? null),
            }))
            .filter((f) => !!f.id)
        : [],
    [customer],
  );

  const firstFolder = folders[0] ?? null;

  const filesQ = useGDriveList(
    { folderId: firstFolder?.id },
    { enabled: open && !!firstFolder?.id && hasDriveToken, staleTime: 10_000 },
  );
  const files = readFiles(filesQ.data);

  const { data: indexData, isLoading: indexLoading } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    { enabled: (open || showBuildDialog || showLinkDialog) && hasDriveToken },
  );
  const indexFolders = indexData?.folders ?? [];

  const defaultFolderName =
    customerLast && customerFirst
      ? buildFolderName(customerLast, customerFirst, customerCwid || null)
      : "";

  const saveLinkedFolders = async (nextFolders: LinkedFolder[]) => {
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: {
        meta: { ...((customer as any)?.meta || {}), driveFolders: cleanLinkedFolders(nextFolders) },
      },
    } as any);
  };

  const buildFolder = useGDriveBuildCustomerFolder(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    {
      onSuccess: async (folder) => {
        const next = [...folders, { id: folder.id, name: folder.name, alias: null }];
        await saveLinkedFolders(next);
        setBuildingName(null);
        toast(`Folder "${folder.name}" is ready.`, { type: "success" });
      },
    },
  );

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
    setShowLinkDialog(false);
    setOpen(true);
  };

  const openEdit = (folder: LinkedFolder) => {
    setEditingFolder(folder);
    setEditAlias(folder.alias ?? folder.name ?? "");
    setEditLink(`https://drive.google.com/drive/folders/${folder.id}`);
    setEditLinkError(null);
    setMenuFolderId(null);
  };

  const onEditSave = async () => {
    if (!editingFolder) return;
    const newAlias = editAlias.trim() || null;
    const newId = parseFolderId(editLink);
    if (!newId) { setEditLinkError("Enter a valid Drive folder URL or ID."); return; }
    setEditLinkError(null);
    const next = folders.map((f) =>
      f.id === editingFolder.id ? { ...f, id: newId, alias: newAlias } : f,
    );
    await saveLinkedFolders(next);
    setEditingFolder(null);
  };

  const onRemoveFolder = async (folderId: string) => {
    const next = folders.filter((f) => f.id !== folderId);
    await saveLinkedFolders(next);
    setMenuFolderId(null);
    setEditingFolder(null);
  };

  const onUploadToFolder = async (file: File, folderId: string) => {
    if (file.size > 10 * 1024 * 1024) { setError("File must be 10 MB or less."); return; }
    setUploadingFolderId(folderId);
    setError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      await upload.mutateAsync({
        parentId: folderId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
      });
      if (folderId === firstFolder?.id) void filesQ.refetch();
      toast(`"${file.name}" uploaded.`, { type: "success" });
    } catch (err) {
      setError(toApiError(err).error || "Upload failed.");
    } finally {
      setUploadingFolderId(null);
    }
  };

  const matchCandidates = React.useMemo(() => {
    if (!indexFolders.length || !customerLast || folders.length > 0) return [];
    return indexFolders
      .map((f) => ({ folder: f, score: scoreMatch(f, customerFirst, customerLast, customerCwid || null) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.folder);
  }, [indexFolders, customerFirst, customerLast, customerCwid, folders]);

  const busy = patchCustomer.isPending || buildFolder.isPending || upload.isPending;

  const folderSummary = firstFolder
    ? (firstFolder.alias || firstFolder.name || firstFolder.id)
    : null;

  // Close "+ New" menu on outside click
  React.useEffect(() => {
    if (!showNewMenu) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && newMenuRef.current?.contains(target)) return;
      setShowNewMenu(false);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [showNewMenu]);

  // Close ⋮ menu on outside click
  React.useEffect(() => {
    if (!menuFolderId) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && actionMenuRef.current?.contains(target)) return;
      setMenuFolderId(null);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [menuFolderId]);

  const hasLoadError = filesQ.isError || !!error;

  const headerRight = (
    <div
      ref={newMenuRef}
      className="relative flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {hasLoadError && (
        <button
          type="button"
          className="btn btn-xs border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
          title="Run Drive auth diagnostics"
          onClick={(e) => { e.stopPropagation(); void runDiagnostics(); }}
          disabled={diagRunning}
        >
          {diagRunning ? "…" : "Diagnose"}
        </button>
      )}
      <button
        type="button"
        className="btn btn-xs btn-primary"
        onClick={(e) => { e.stopPropagation(); setShowNewMenu((v) => !v); }}
        disabled={busy}
      >
        + New
      </button>
      {showNewMenu && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          <button
            type="button"
            className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); setShowBuildDialog(true); setShowNewMenu(false); }}
          >
            Build New Customer Folder
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); setShowLinkDialog(true); setShowNewMenu(false); }}
          >
            Link Existing
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {portalReady && showBuildDialog && createPortal(
        <BuildFolderDialog
          defaultName={defaultFolderName}
          customerFirst={customerFirst}
          customerLast={customerLast}
          customerCwid={customerCwid || null}
          onBuild={onBuildConfirm}
          onCancel={() => setShowBuildDialog(false)}
          indexFolders={indexFolders}
          indexLoading={indexLoading}
        />,
        document.body
      )}
      {portalReady && showLinkDialog && createPortal(
        <LinkFolderDialog
          customerFirst={customerFirst}
          customerLast={customerLast}
          customerCwid={customerCwid || null}
          onLink={(id, name) => void onLinkConfirm(id, name)}
          onCancel={() => setShowLinkDialog(false)}
          busy={busy}
        />,
        document.body
      )}

      {/* Edit folder dialog */}
      {portalReady && editingFolder && createPortal(
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">Edit Folder</div>
              <button
                type="button"
                className="text-xl leading-none text-slate-400 hover:text-slate-700"
                onClick={() => setEditingFolder(null)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <label className="field block">
                <span className="label">Display alias</span>
                <input
                  className="input w-full"
                  value={editAlias}
                  onChange={(e) => setEditAlias(e.currentTarget.value)}
                  placeholder={editingFolder.name ?? editingFolder.id}
                  autoFocus
                />
                <span className="mt-1 block text-xs text-slate-400">
                  Shown instead of the folder name in this panel
                </span>
              </label>
              <label className="field block">
                <span className="label">Folder URL or ID</span>
                <input
                  className="input w-full"
                  value={editLink}
                  onChange={(e) => setEditLink(e.currentTarget.value)}
                />
                {editLinkError && (
                  <div className="mt-1 text-xs text-red-600">{editLinkError}</div>
                )}
                <span className="mt-1 block text-xs text-slate-400">
                  Change to re-link to a different folder
                </span>
              </label>
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-700">Upload file to this folder</div>
                <input
                  ref={editFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file && editingFolder) void onUploadToFolder(file, editingFolder.id);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => editFileRef.current?.click()}
                  disabled={!!uploadingFolderId || upload.isPending}
                >
                  {uploadingFolderId ? "Uploading…" : "Choose File"}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50"
                onClick={() => void onRemoveFolder(editingFolder.id)}
                disabled={busy}
              >
                Unlink
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingFolder(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void onEditSave()}
                  disabled={busy}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <IntegrationBlock
        icon="🗂"
        title="Google Drive"
        accentClass="bg-sky-100 text-sky-600"
        summary={
          buildingName
            ? `Building "${buildingName}"…`
            : folderSummary ?? "No folder linked"
        }
        headerRight={headerRight}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {!hasDriveToken && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-lg">🔑</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-amber-900">Google account not connected</div>
              <div className="text-xs text-amber-700">Connect to access your Drive folders directly.</div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
              disabled={connectingGoogle}
              onClick={() => void handleConnectGoogle()}
            >
              {connectingGoogle ? "Connecting…" : "Connect Google"}
            </button>
          </div>
        )}

        {diagResult && (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <span className="font-semibold text-slate-700">Drive Auth Diagnostics</span>
              <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setDiagResult(null)}>✕</button>
            </div>
            <div className="space-y-3 p-3">
              {(["gdriveList", "gdriveIndex"] as const).map((key) => {
                const r = diagResult[key] as any;
                if (!r) return null;
                const d = r?.debug;
                const auth = d?.auth ?? d?.diagnostics?.auth;
                const authMode = d?.authMode ?? d?.diagnostics?.authMode ?? r?.authMode;
                const hasDrive = auth?.hasDriveScope;
                const scopes = auth?.tokenScopes as string[] | undefined;
                const missing = auth?.missingExpectedScopes as string[] | undefined;
                const headerSent = d?.selection?.headerTokenPresent ?? diagResult.headerTokenSent;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                    <div className="font-semibold text-slate-600">{key === "gdriveList" ? "gdriveList" : "gdriveCustomerFolderIndex"}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>Status: <span className={r?.ok ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{r?.ok ? "OK" : `Error (${r?.error ?? "unknown"})`}</span></span>
                      {authMode && <span>Auth: <span className="font-mono text-slate-700">{authMode}</span></span>}
                      <span>Header token sent: <span className={headerSent ? "text-emerald-600" : "text-amber-600"}>{headerSent ? "yes" : "no"}</span></span>
                      {hasDrive !== undefined && <span>Drive scope: <span className={hasDrive ? "text-emerald-600" : "text-red-600 font-medium"}>{hasDrive ? "yes ✓" : "missing ✗"}</span></span>}
                    </div>
                    {missing?.length ? <div className="text-red-600">Missing scopes: {missing.join(", ")}</div> : null}
                    {scopes?.length ? <div className="text-slate-400 truncate">Scopes: {scopes.join(", ")}</div> : null}
                  </div>
                );
              })}
              <details className="text-slate-400">
                <summary className="cursor-pointer hover:text-slate-600">Raw JSON</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-100 p-2 text-[10px]">{JSON.stringify(diagResult, null, 2)}</pre>
              </details>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <span>⚠</span> {error}
          </div>
        )}

        {buildingName ? (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
            <div className="text-sm text-sky-900">
              Building <strong>{buildingName}</strong>… You can continue using the app.
            </div>
          </div>
        ) : !firstFolder ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Build a new Drive folder or link an existing one.
              {defaultFolderName ? (
                <> Suggested name: <strong className="text-slate-700">{defaultFolderName}</strong></>
              ) : null}
            </p>
            {(indexLoading || matchCandidates.length > 0) && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Possible matches in Drive
                </div>
                {indexLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    Searching Drive…
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {matchCandidates.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{f.name}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${f.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{f.status}</span>
                            {f.cwid && <span className="text-slate-400">CWID: {f.cwid}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary shrink-0"
                          disabled={busy}
                          onClick={() => void onLinkConfirm(f.id, f.name)}
                        >
                          Link
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Folder rows */}
            <div className="space-y-1.5">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-sky-400 text-sm">🗂</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {folder.alias || folder.name || folder.id}
                      </div>
                    </div>
                  </div>
                  <div
                    ref={menuFolderId === folder.id ? actionMenuRef : undefined}
                    className="relative flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`https://drive.google.com/drive/folders/${folder.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-sky-100 hover:text-sky-600 transition-colors"
                      title="Open in Drive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12h7A1.5 1.5 0 0011 10.5V8m-3-7h4m0 0v4m0-4L7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-base leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFolderId(menuFolderId === folder.id ? null : folder.id);
                      }}
                      title="Actions"
                    >
                      ⋮
                    </button>
                    {menuFolderId === folder.id && (
                      <div className="absolute right-0 bottom-full z-30 mb-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          onClick={(e) => { e.stopPropagation(); void filesQ.refetch(); setMenuFolderId(null); }}
                          disabled={filesQ.isFetching}
                        >
                          {filesQ.isFetching ? "Refreshing…" : "Refresh"}
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={(e) => { e.stopPropagation(); openEdit(folder); }}
                        >
                          Edit
                        </button>
                        <a
                          href={`https://drive.google.com/drive/folders/${folder.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex w-full items-center justify-start px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuFolderId(null)}
                        >
                          Open Link ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* File table (first folder) */}
            {filesQ.isLoading || filesQ.isFetching ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                {filesQ.isLoading ? "Loading files…" : "Refreshing…"}
              </div>
            ) : filesQ.isError ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                <span>⚠</span>
                <span className="flex-1">Could not load files — Drive token may have expired.</span>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  disabled={connectingGoogle}
                  onClick={() => void handleConnectGoogle()}
                >
                  Re-connect
                </button>
              </div>
            ) : files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                No files in this folder yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Modified</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map((f, idx) => (
                      <tr key={`${f.id || f.name || "file"}:${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2.5">
                          {f.webViewLink ? (
                            <a href={f.webViewLink} target="_blank" rel="noreferrer"
                              className="font-medium text-sky-700 hover:text-sky-900 hover:underline">
                              {f.name || "(untitled)"}
                            </a>
                          ) : (
                            <span className="font-medium text-slate-700">{f.name || "(untitled)"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{fmtDateOrDash(f.modifiedTime)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{fmtBytes(f.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </IntegrationBlock>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JotformEmbedFrame — iframe embed with postMessage submission detection
// ─────────────────────────────────────────────────────────────────────────────

function JotformEmbedFrame({
  formId,
  customerId,
  onSubmitted,
}: {
  formId: string;
  customerId: string;
  onSubmitted: (submissionId: string) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (
          data?.action === "submission-completed" &&
          data?.submissionID &&
          // Make sure it came from the right frame
          (String(data.formID || "") === formId || !data.formID)
        ) {
          onSubmitted(String(data.submissionID));
        }
      } catch {
        // Non-JSON messages can be ignored
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [formId, onSubmitted]);

  const url = `https://form.jotform.com/${formId}?isIframe=1`;

  return (
    <iframe
      ref={frameRef}
      src={url}
      title="Jotform"
      className="w-full rounded-xl border border-slate-200"
      style={{ height: 520, minHeight: 400 }}
      allowFullScreen
      sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation allow-popups"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedFormItem — single form row with expandable embed
// ─────────────────────────────────────────────────────────────────────────────

function LinkedFormItem({
  form,
  customerId,
  onUnlink,
}: {
  form: LinkedFormRef;
  customerId: string;
  onUnlink: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const linkSubmission = useLinkJotformSubmission();

  const formsQ = useJotformFormsLite(
    { limit: 500 },
    { staleTime: 300_000 },
  );
  const formMeta = (formsQ.data || []).find(
    (f) => String(f.id || "") === form.formId,
  );
  const label = form.formAlias || formMeta?.title || form.formId;

  const onSubmitted = React.useCallback(
    async (submissionId: string) => {
      setSubmitted(submissionId);
      setOpen(false);
      try {
        await linkSubmission.mutateAsync({ submissionId, customerId });
        toast(`Submission linked to customer.`, { type: "success" });
      } catch (err) {
        toast(toApiError(err).error || "Failed to link submission.", { type: "error" });
      }
    },
    [customerId, linkSubmission],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
            <span className="text-sm font-medium text-slate-900 truncate">{label}</span>
          </div>
          {submitted ? (
            <div className="ml-5 mt-0.5 text-xs text-emerald-600">
              Last submitted: {submitted}
            </div>
          ) : null}
        </button>
        <a
          href={`https://form.jotform.com/${form.formId}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs text-sky-600 hover:underline"
        >
          Open ↗
        </a>
        <button
          type="button"
          className="shrink-0 text-xs text-slate-400 hover:text-red-500"
          onClick={onUnlink}
          title="Remove this form link"
        >
          Remove
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="mb-2 text-xs text-slate-500">
            Fill out and submit below. The submission will be automatically linked to this customer.
          </div>
          <JotformEmbedFrame
            formId={form.formId}
            customerId={customerId}
            onSubmitted={(id) => void onSubmitted(id)}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JotformBlock
// ─────────────────────────────────────────────────────────────────────────────

function JotformBlock({ customerId }: { customerId: string }) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();
  const [open, setOpen] = React.useState(false);
  const [addingForm, setAddingForm] = React.useState(false);
  const [formSearch, setFormSearch] = React.useState("");

  const formsQ = useJotformFormsLite({ limit: 500 }, { enabled: open || addingForm, staleTime: 300_000 });
  const submissionsQ = useJotformSubmissionsLite(
    { customerId, limit: 50 },
    { enabled: open, staleTime: 60_000 },
  );

  const linkedForms = React.useMemo<LinkedFormRef[]>(
    () =>
      Array.isArray((customer as any)?.meta?.linkedForms)
        ? (customer as any).meta.linkedForms
        : [],
    [customer],
  );

  const saveLinkedForms = async (next: LinkedFormRef[]) => {
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: {
        meta: { ...((customer as any)?.meta || {}), linkedForms: next },
      },
    } as any);
  };

  const onAddForm = async (form: JotformForm) => {
    const formId = String(form.id || "");
    if (!formId || linkedForms.some((f) => f.formId === formId)) return;
    await saveLinkedForms([
      ...linkedForms,
      { formId, formAlias: form.alias ? String(form.alias) : null },
    ]);
    setAddingForm(false);
    setFormSearch("");
    toast(`Form linked.`, { type: "success" });
  };

  const onUnlinkForm = async (formId: string) => {
    await saveLinkedForms(linkedForms.filter((f) => f.formId !== formId));
  };

  const filteredForms = React.useMemo(() => {
    const q = formSearch.trim().toLowerCase();
    const available = (formsQ.data || []).filter(
      (f) => !linkedForms.some((lf) => lf.formId === String(f.id || "")),
    );
    if (!q) return available;
    return available.filter(
      (f) =>
        String(f.title || "").toLowerCase().includes(q) ||
        String(f.alias || "").toLowerCase().includes(q) ||
        String(f.id || "").includes(q),
    );
  }, [formsQ.data, linkedForms, formSearch]);

  const submissions = submissionsQ.data || [];

  const groupedByForm = React.useMemo(() => {
    const map = new Map<string, JotformSubmission[]>();
    for (const sub of submissions) {
      const fid = String(sub.formId || "");
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(sub);
    }
    return map;
  }, [submissions]);

  const summary = linkedForms.length
    ? `${linkedForms.length} form${linkedForms.length !== 1 ? "s" : ""} linked · ${submissions.length} submission${submissions.length !== 1 ? "s" : ""}`
    : "No forms linked";

  return (
    <IntegrationBlock
      icon="📋"
      title="Jotform"
      accentClass="bg-orange-100 text-orange-500"
      summary={open ? undefined : summary}
      headerRight={
        open ? (
          <button
            className="btn btn-xs btn-ghost border border-slate-200"
            onClick={() => setAddingForm((v) => !v)}
          >
            {addingForm ? "Cancel" : "+ Link Form"}
          </button>
        ) : undefined
      }
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {/* Add form picker */}
      {addingForm && (
        <div className="mb-4 overflow-hidden rounded-xl border border-orange-100 bg-orange-50/50">
          <div className="border-b border-orange-100 px-4 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-600">Link a Jotform form</div>
          </div>
          <div className="p-3 space-y-2">
            <input
              className="input w-full text-sm"
              placeholder="Search forms…"
              value={formSearch}
              onChange={(e) => setFormSearch(e.currentTarget.value)}
              autoFocus
            />
            {formsQ.isLoading ? (
              <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-orange-400" />
                Loading forms…
              </div>
            ) : (
              <div className="max-h-52 overflow-auto space-y-1">
                {filteredForms.length === 0 ? (
                  <div className="px-1 py-2 text-xs text-slate-400">
                    {formSearch ? `No forms match "${formSearch}".` : "No forms available."}
                  </div>
                ) : filteredForms.map((form) => (
                  <button
                    key={String(form.id)}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-orange-200 hover:bg-orange-50 transition-colors"
                    onClick={() => void onAddForm(form)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{String(form.title || form.id || "")}</div>
                      {form.alias && <div className="truncate text-xs text-slate-400">{form.alias}</div>}
                    </div>
                    <span className="shrink-0 rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Link</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Linked Forms */}
      <div className="mb-4 space-y-1.5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Linked Forms</div>
        {linkedForms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
            No forms linked yet.
          </div>
        ) : (
          linkedForms.map((lf) => (
            <LinkedFormItem key={lf.formId} form={lf} customerId={customerId} onUnlink={() => void onUnlinkForm(lf.formId)} />
          ))
        )}
      </div>

      {/* Linked Submissions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Submissions</div>
          <button
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-orange-500 transition-colors disabled:opacity-50"
            onClick={() => void submissionsQ.refetch()}
            disabled={submissionsQ.isFetching}
          >
            {submissionsQ.isFetching ? (
              <><div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-400" /> Loading…</>
            ) : "↻ Refresh"}
          </button>
        </div>

        {submissionsQ.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-orange-400" />
            Loading submissions…
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
            No submissions found for this customer.
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...groupedByForm.entries()].map(([formId, subs]) => {
              const firstSub = subs[0];
              const formTitle = String((firstSub as any)?.formTitle || (firstSub as any)?.formAlias || formId || "Unknown Form");
              return (
                <div key={formId} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">{formTitle}</div>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                      {subs.length}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {subs.map((sub) => {
                      const sid = String(sub.submissionId || sub.id || "");
                      const createdAt = (sub as any).createdAt || (sub as any).date;
                      return (
                        <div key={sid} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                          <div className="min-w-0">
                            <div className="font-mono font-medium text-slate-700 truncate">{sid || "(no ID)"}</div>
                            <div className="text-slate-400">{fmtDateSmartOrDash(createdAt)}</div>
                          </div>
                          <a
                            href={String((sub as any).submissionUrl || `https://www.jotform.com/submission/${sid}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-orange-100 hover:text-orange-700 transition-colors"
                          >
                            View ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </IntegrationBlock>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubmissionsBlock — link already-submitted Jotform submissions to a customer
// ─────────────────────────────────────────────────────────────────────────────

function SubmissionsBlock({ customerId }: { customerId: string }) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();
  const linkSubmission = useLinkJotformSubmission();

  const [open, setOpen] = React.useState(false);
  const [addMode, setAddMode] = React.useState<"manual" | "browse" | null>(null);

  // manual mode
  const [manualFormId, setManualFormId] = React.useState("");
  const [manualSubId, setManualSubId] = React.useState("");

  // browse mode
  const [browseFormId, setBrowseFormId] = React.useState("");
  const [browseSearch, setBrowseSearch] = React.useState("");

  // preview
  const [previewTarget, setPreviewTarget] = React.useState<{ formId: string; submissionId: string } | null>(null);

  const formsQ = useJotformFormsLite(
    { limit: 500 },
    { enabled: open || !!addMode, staleTime: 300_000 },
  );
  const browseQ = useJotformApiSubmissions(
    { formId: browseFormId },
    { enabled: addMode === "browse" && !!browseFormId, staleTime: 30_000 },
  );

  const linkedSubmissions = React.useMemo<LinkedSubmissionRef[]>(() => {
    const arr = (customer as any)?.meta?.linkedSubmissions;
    return Array.isArray(arr) ? arr : [];
  }, [customer]);

  const saveLinkedSubmissions = async (next: LinkedSubmissionRef[]) => {
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: { meta: { ...((customer as any)?.meta || {}), linkedSubmissions: next } },
    } as any);
  };

  const doLink = async (formId: string, submissionId: string) => {
    const fid = formId.trim();
    const sid = submissionId.trim();
    if (!fid || !sid) return;
    if (linkedSubmissions.some((s) => s.submissionId === sid)) {
      toast("Submission already linked.", { type: "error" });
      return;
    }
    try {
      await linkSubmission.mutateAsync({ submissionId: sid, customerId });
      await saveLinkedSubmissions([
        ...linkedSubmissions,
        { formId: fid, submissionId: sid, linkedAt: new Date().toISOString() },
      ]);
      toast("Submission linked.", { type: "success" });
      setAddMode(null);
      setManualFormId("");
      setManualSubId("");
      setBrowseFormId("");
      setBrowseSearch("");
    } catch (err) {
      toast(toApiError(err).error || "Failed to link submission.", { type: "error" });
    }
  };

  const doUnlink = async (submissionId: string) => {
    await saveLinkedSubmissions(linkedSubmissions.filter((s) => s.submissionId !== submissionId));
  };

  const browseSubmissions = React.useMemo(() => {
    if (!browseQ.data) return [];
    const q = browseSearch.trim().toLowerCase();
    if (!q) return browseQ.data;
    return browseQ.data.filter((s) =>
      String(s.submissionId || (s as any).id || "").toLowerCase().includes(q),
    );
  }, [browseQ.data, browseSearch]);

  const busy = patchCustomer.isPending || linkSubmission.isPending;

  const summary = linkedSubmissions.length
    ? `${linkedSubmissions.length} submission${linkedSubmissions.length !== 1 ? "s" : ""} linked`
    : "No submissions linked";

  return (
    <IntegrationBlock
      icon="📨"
      title="Submissions"
      accentClass="bg-violet-100 text-violet-600"
      summary={open ? undefined : summary}
      headerRight={
        open ? (
          <button
            className="btn btn-xs btn-ghost border border-slate-200"
            onClick={() => setAddMode(addMode ? null : "manual")}
          >
            {addMode ? "Cancel" : "+ Link"}
          </button>
        ) : undefined
      }
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {/* Add panel */}
      {addMode && (
        <div className="mb-4 overflow-hidden rounded-xl border border-violet-100 bg-violet-50/50">
          <div className="border-b border-violet-100 px-4 py-2.5">
            <div className="flex gap-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${addMode === "manual" ? "bg-violet-600 text-white" : "text-violet-700 hover:bg-violet-100"}`}
                onClick={() => setAddMode("manual")}
              >
                Manual Entry
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${addMode === "browse" ? "bg-violet-600 text-white" : "text-violet-700 hover:bg-violet-100"}`}
                onClick={() => setAddMode("browse")}
              >
                Browse
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">

          {addMode === "manual" ? (
            <div className="space-y-2">
              <input
                className="input w-full text-sm"
                placeholder="Form ID"
                value={manualFormId}
                onChange={(e) => setManualFormId(e.currentTarget.value)}
              />
              <input
                className="input w-full text-sm"
                placeholder="Submission ID"
                value={manualSubId}
                onChange={(e) => setManualSubId(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualFormId.trim() && manualSubId.trim() && !busy)
                    void doLink(manualFormId, manualSubId);
                }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!manualFormId.trim() || !manualSubId.trim() || busy}
                onClick={() => void doLink(manualFormId, manualSubId)}
              >
                {busy ? "Linking…" : "Link Submission"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Form selector */}
              {formsQ.isLoading ? (
                <div className="text-xs text-slate-500">Loading forms…</div>
              ) : (
                <select
                  className="input w-full text-sm"
                  value={browseFormId}
                  onChange={(e) => {
                    setBrowseFormId(e.currentTarget.value);
                    setBrowseSearch("");
                  }}
                >
                  <option value="">Select a form…</option>
                  {(formsQ.data || []).map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>
                      {String(f.title || f.alias || f.id)}
                    </option>
                  ))}
                </select>
              )}

              {browseFormId && (
                <>
                  <input
                    className="input w-full text-sm"
                    placeholder="Filter by submission ID…"
                    value={browseSearch}
                    onChange={(e) => setBrowseSearch(e.currentTarget.value)}
                  />
                  {browseQ.isLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                      Loading submissions…
                    </div>
                  ) : browseSubmissions.length === 0 ? (
                    <div className="py-2 text-xs text-slate-400">No submissions found.</div>
                  ) : (
                    <div className="max-h-64 overflow-auto space-y-1">
                      {browseSubmissions.map((sub) => {
                        const sid = String(sub.submissionId || (sub as any).id || "");
                        const createdAt = (sub as any).createdAt || (sub as any).date;
                        const alreadyLinked = linkedSubmissions.some((s) => s.submissionId === sid);
                        const displayName = submissionDisplayName(sub);
                        return (
                          <div
                            key={sid}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs cursor-pointer hover:bg-slate-50"
                            onClick={() => setPreviewTarget({ formId: browseFormId, submissionId: sid })}
                          >
                            <div className="min-w-0">
                              {displayName && (
                                <div className="font-semibold text-slate-900 truncate">{displayName}</div>
                              )}
                              <div className="font-mono text-slate-500 truncate">{sid}</div>
                              <div className="text-slate-400">{fmtDateSmartOrDash(createdAt)}</div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 btn btn-xs btn-primary disabled:opacity-50"
                              disabled={alreadyLinked || busy}
                              onClick={() => void doLink(browseFormId, sid)}
                            >
                              {alreadyLinked ? "Linked" : "Link"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Linked submissions list */}
      {linkedSubmissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
          No submissions linked yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {linkedSubmissions.map((ref) => (
            <div
              key={ref.submissionId}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5 text-xs hover:border-violet-200 hover:bg-violet-50 transition-colors"
              onClick={() => setPreviewTarget({ formId: ref.formId, submissionId: ref.submissionId })}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-violet-300 text-sm">📨</span>
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{ref.alias || ref.submissionId}</div>
                  <div className="flex gap-2 text-slate-400 mt-0.5">
                    <span className="truncate max-w-[110px] font-mono">Form {ref.formId}</span>
                    {ref.linkedAt && <span>{fmtDateSmartOrDash(ref.linkedAt)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 group-hover:bg-violet-200 transition-colors">
                  Preview →
                </span>
                <button
                  type="button"
                  className="text-slate-300 hover:text-red-500 disabled:opacity-50 transition-colors"
                  disabled={busy}
                  onClick={() => void doUnlink(ref.submissionId)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewTarget && (
        <SubmissionPreviewModal
          formId={previewTarget.formId}
          submissionId={previewTarget.submissionId}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </IntegrationBlock>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export function CustomerIntegrationsPanel({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-2.5 px-1 py-2">
      <GDriveBlock customerId={customerId} />
      <JotformBlock customerId={customerId} />
      <SubmissionsBlock customerId={customerId} />
    </div>
  );
}

export default CustomerIntegrationsPanel;
