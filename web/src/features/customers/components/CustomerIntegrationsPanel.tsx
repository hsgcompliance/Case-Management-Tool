// features/customers/components/CustomerIntegrationsPanel.tsx
"use client";

import React from "react";
import { toApiError } from "@client/api";
import { useCustomer, usePatchCustomers } from "@hooks/useCustomers";
import {
  useGDriveList,
  useGDriveCustomerFolderIndex,
  useGDriveBuildCustomerFolder,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import {
  useJotformFormsLite,
  useJotformSubmissionsLite,
  useLinkJotformSubmission,
  type JotformForm,
  type JotformSubmission,
} from "@hooks/useJotform";
import { fmtBytes, fmtDateOrDash, fmtDateSmartOrDash } from "@lib/formatters";
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
}: {
  icon: string;
  title: string;
  summary?: React.ReactNode;
  headerRight?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <span className="text-lg leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {summary ? (
            <div className="mt-0.5 truncate text-xs text-slate-500">{summary}</div>
          ) : null}
        </div>
        {headerRight ? (
          <div
            className="shrink-0 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {headerRight}
          </div>
        ) : null}
        <span className="shrink-0 text-slate-400 text-xs transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : undefined }}>
          ▼
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GDriveBlock
// ─────────────────────────────────────────────────────────────────────────────

function GDriveBlock({ customerId }: { customerId: string }) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const patchCustomer = usePatchCustomers();
  const [open, setOpen] = React.useState(false);
  const [showBuildDialog, setShowBuildDialog] = React.useState(false);
  const [showLinkDialog, setShowLinkDialog] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [buildingName, setBuildingName] = React.useState<string | null>(null);

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

  // File list — only fetched when expanded and folder exists
  const filesQ = useGDriveList(
    { folderId: firstFolder?.id },
    { enabled: open && !!firstFolder?.id, staleTime: 10_000 },
  );
  const files = readFiles(filesQ.data);

  const { data: indexData, isLoading: indexLoading } = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    { enabled: open || showBuildDialog || showLinkDialog },
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
        meta: { ...((customer as any)?.meta || {}), driveFolders: nextFolders },
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

  const matchCandidates = React.useMemo(() => {
    if (!indexFolders.length || !customerLast || folders.length > 0) return [];
    return indexFolders
      .map((f) => ({ folder: f, score: scoreMatch(f, customerFirst, customerLast, customerCwid || null) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.folder);
  }, [indexFolders, customerFirst, customerLast, customerCwid, folders]);

  const busy = patchCustomer.isPending || buildFolder.isPending;

  // ── Summary shown in header ──
  const folderSummary = firstFolder
    ? (firstFolder.alias || firstFolder.name || firstFolder.id)
    : null;

  const headerRight = firstFolder ? (
    <a
      href={`https://drive.google.com/drive/folders/${firstFolder.id}`}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-sky-600 hover:underline"
      title="Open in Google Drive"
    >
      Open ↗
    </a>
  ) : (
    <div className="flex gap-1.5">
      <button
        className="btn btn-xs btn-primary"
        onClick={() => setShowBuildDialog(true)}
        disabled={busy}
      >
        Build New Folder
      </button>
      <button
        className="btn btn-xs btn-ghost"
        onClick={() => setShowLinkDialog(true)}
        disabled={busy}
      >
        Link Existing
      </button>
    </div>
  );

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

      <IntegrationBlock
        icon="🗂"
        title="G Drive"
        summary={
          buildingName
            ? `Building "${buildingName}"…`
            : folderSummary
            ? folderSummary
            : "No folder linked"
        }
        headerRight={headerRight}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {buildingName ? (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            <div className="text-sm text-sky-900">
              Building <strong>{buildingName}</strong>… You can continue using the app.
            </div>
          </div>
        ) : !firstFolder ? (
          /* No folder — show smart match candidates */
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Build a new Drive folder or link an existing one.
              {defaultFolderName ? (
                <> Suggested name: <strong className="text-slate-700">{defaultFolderName}</strong>.</>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => setShowBuildDialog(true)} disabled={busy}>
                Build New Folder
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLinkDialog(true)} disabled={busy}>
                Link Existing
              </button>
            </div>
            {(indexLoading || matchCandidates.length > 0) && (
              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Possible matches in Drive
                </div>
                {indexLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching Drive…</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {matchCandidates.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{f.name}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-slate-500">
                            <span className={f.status === "active" ? "text-emerald-600" : "text-slate-400"}>{f.status}</span>
                            {f.cwid && <span>CWID: {f.cwid}</span>}
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
          /* Folder linked — show file list */
          <div className="space-y-3">
            {/* Folder header */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">
                  {firstFolder.alias || firstFolder.name || firstFolder.id}
                </div>
                {folders.length > 1 && (
                  <div className="text-xs text-slate-500">{folders.length} folders linked</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => void filesQ.refetch()}
                  disabled={filesQ.isFetching}
                >
                  {filesQ.isFetching ? "…" : "Refresh"}
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowBuildDialog(true)} disabled={busy}>
                  + New
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowLinkDialog(true)} disabled={busy}>
                  Link
                </button>
                <a
                  href={`https://drive.google.com/drive/folders/${firstFolder.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-xs"
                >
                  Open ↗
                </a>
              </div>
            </div>

            {/* File table */}
            {filesQ.isLoading ? (
              <div className="flex items-center gap-2 px-1 py-4 text-sm text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                Loading files…
              </div>
            ) : filesQ.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                Could not load files. Check Drive permissions.
              </div>
            ) : files.length === 0 ? (
              <div className="px-1 py-4 text-sm text-slate-500">
                No files found in this folder.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Modified</th>
                      <th className="px-3 py-2 text-left">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f, idx) => (
                      <tr
                        key={`${f.id || f.name || "file"}:${idx}`}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2">
                          {f.webViewLink ? (
                            <a
                              href={f.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 hover:underline"
                            >
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
      summary={open ? undefined : summary}
      headerRight={
        open ? (
          <button
            className="btn btn-xs btn-ghost"
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
      {addingForm ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Link a Jotform form
          </div>
          <input
            className="input w-full text-sm"
            placeholder="Search forms..."
            value={formSearch}
            onChange={(e) => setFormSearch(e.currentTarget.value)}
            autoFocus
          />
          {formsQ.isLoading ? (
            <div className="text-xs text-slate-500">Loading forms…</div>
          ) : (
            <div className="max-h-56 overflow-auto space-y-1">
              {filteredForms.length === 0 ? (
                <div className="text-xs text-slate-400 px-1">
                  {formSearch ? `No forms match "${formSearch}".` : "No forms available to add."}
                </div>
              ) : filteredForms.map((form) => (
                <button
                  key={String(form.id)}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-sky-50 hover:border-sky-200 transition-colors"
                  onClick={() => void onAddForm(form)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {String(form.title || form.id || "")}
                    </div>
                    {form.alias ? (
                      <div className="truncate text-xs text-slate-500">Alias: {form.alias}</div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-sky-600">Link</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Linked Forms section */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Linked Forms
        </div>
        {linkedForms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 text-center">
            No forms linked. Click "+ Link Form" to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {linkedForms.map((lf) => (
              <LinkedFormItem
                key={lf.formId}
                form={lf}
                customerId={customerId}
                onUnlink={() => void onUnlinkForm(lf.formId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Linked Submissions section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Linked Submissions
          </div>
          <button
            className="text-xs text-slate-400 hover:text-sky-600"
            onClick={() => void submissionsQ.refetch()}
            disabled={submissionsQ.isFetching}
          >
            {submissionsQ.isFetching ? "Loading…" : "Refresh"}
          </button>
        </div>

        {submissionsQ.isLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
            Loading submissions…
          </div>
        ) : submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 text-center">
            No submissions found for this customer.
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...groupedByForm.entries()].map(([formId, subs]) => {
              const firstSub = subs[0];
              const formTitle = String(
                (firstSub as any)?.formTitle ||
                (firstSub as any)?.formAlias ||
                formId ||
                "Unknown Form",
              );
              return (
                <div key={formId} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">{formTitle}</div>
                    <div className="text-[11px] text-slate-400">{subs.length} submission{subs.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {subs.map((sub) => {
                      const sid = String(sub.submissionId || sub.id || "");
                      const createdAt = (sub as any).createdAt || (sub as any).date;
                      return (
                        <div key={sid} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {sid || "(no ID)"}
                            </div>
                            <div className="text-slate-500">{fmtDateSmartOrDash(createdAt)}</div>
                          </div>
                          <a
                            href={String((sub as any).submissionUrl || `https://www.jotform.com/submission/${sid}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-sky-600 hover:underline"
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
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export function CustomerIntegrationsPanel({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-3 p-1">
      <GDriveBlock customerId={customerId} />
      <JotformBlock customerId={customerId} />
    </div>
  );
}

export default CustomerIntegrationsPanel;
