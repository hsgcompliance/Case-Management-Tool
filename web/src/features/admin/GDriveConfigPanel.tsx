"use client";

// features/admin/GDriveConfigPanel.tsx
// Org-level Google Drive configuration: folder index, file templates, build settings.
//
// ─────────────────────────────────────────────────────────────────────────────
// TODO (future agent): TSS Workbook Override Editor
// ─────────────────────────────────────────────────────────────────────────────
// This panel needs a new section that authors the per-org TSS worksheet override
// (`worksheetConfig`), completing the "adjust baseline entity configs via org
// config" loop. ALL the plumbing already exists — this is a UI-only task.
//
// Context docs (read first):
//   docs/active-projects.local/google-integrations/WORKBOOK_SYSTEM.md  (config layer + override semantics table)
//   docs/active-projects.local/org-config/current-state.local-only.md  (this panel's conventions)
//
// What to build — a section that edits `TssOrgConfigOverride` from @hdb/contracts:
//   import { tss } from "@hdb/contracts";              // schema + resolver + baseline
//   import { useResolvedTssConfig } from "@hooks/useTssConfig";  // effective (merged) config to preview
//
//   The baseline entities/fields come from tss.TSS_WORKSHEET_CONFIG.entities — render
//   them as the editable surface, and let the admin author overrides on top:
//     • disabledEntityIds        → checkbox per entity (enabled/disabled)
//     • forceVariant             → select: auto | payer | nonPayer
//     • entityLabelOverrides     → text input per entity label
//     • entityEmptyStateOverrides→ text input per entity empty-state
//     • sheetAliasExtensions     → tag input per sheet id (reuse <SubfolderTagInput/> pattern below)
//     • fieldAliasExtensions     → tag input per entity→field
//     • fieldDisplayOverrides    → label/width/badge/hideInCompact controls per entity→field
//
// Wiring (mirror the existing draft → handleSave → patch.mutateAsync flow):
//   1. Add `worksheetConfig: TssOrgConfigOverride` to ConfigDraft + configToDraft()
//      (read from `config?.worksheetConfig`).
//   2. Add the section JSX where the placeholder comment is in the render below.
//   3. In handleSave(), include `worksheetConfig: <sparse override or null to clear>`
//      in the patch.mutateAsync({...}) call. Validate with
//      tss.TssOrgConfigOverrideSchema.safeParse() before sending; send `null` to
//      revert an org to the baseline.
//   4. The backend (gdriveConfigPatch → patchOrgGDriveConfig) already validates,
//      stores, and the resolver merges it — no backend work needed.
//
// Keep the override SPARSE: only emit keys the admin actually changed, so an
// untouched org stays on the pure baseline. Show a live preview of the merged
// result with useResolvedTssConfig() so admins see the effect before saving.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { useGDriveConfig, useGDriveConfigPatch } from "@hooks/useGDrive";
import { toast } from "@lib/toast";
import type { TGDriveTemplate, TGDriveTemplateType, TGDriveBuildSettings, TGDriveOrgConfig } from "@types";

const GDRIVE_TEMPLATE_TYPES = ["doc", "sheet", "pdf", "folder", "other"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DIRECT_ID_RE = /^[-\w]{20,}$/;

function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const byFolder = s.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolder) return byFolder;
  const bySheet = s.match(/\/spreadsheets\/d\/([-\w]{20,})/i)?.[1];
  if (bySheet) return bySheet;
  const byDoc = s.match(/\/document\/d\/([-\w]{20,})/i)?.[1];
  if (byDoc) return byDoc;
  const byQuery = s.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  return DIRECT_ID_RE.test(s) ? s : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || `tpl_${Date.now()}`;
}

function typeLabel(type: TGDriveTemplateType): string {
  const labels: Record<TGDriveTemplateType, string> = {
    doc: "Doc",
    sheet: "Sheet",
    pdf: "PDF",
    folder: "Folder",
    other: "Other",
  };
  return labels[type];
}

function typeBadgeClass(type: TGDriveTemplateType): string {
  const classes: Record<TGDriveTemplateType, string> = {
    doc: "bg-blue-100 text-blue-700",
    sheet: "bg-emerald-100 text-emerald-700",
    pdf: "bg-red-100 text-red-700",
    folder: "bg-amber-100 text-amber-700",
    other: "bg-slate-100 text-slate-600",
  };
  return classes[type];
}

// ─────────────────────────────────────────────────────────────────────────────
// Template form (add / edit)
// ─────────────────────────────────────────────────────────────────────────────

type TemplateDraft = {
  key: string;
  fileInput: string; // URL or ID
  type: TGDriveTemplateType;
  alias: string;
  description: string;
  defaultChecked: boolean;
  // When true the source file is chosen by Medicaid status (payer / non-payer)
  // and `fileInput` may be left blank.
  useVariants: boolean;
  payerInput: string;
  nonpayerInput: string;
};

function blankTemplateDraft(): TemplateDraft {
  return {
    key: "",
    fileInput: "",
    type: "sheet",
    alias: "",
    description: "",
    defaultChecked: false,
    useVariants: false,
    payerInput: "",
    nonpayerInput: "",
  };
}

function draftFromTemplate(t: TGDriveTemplate): TemplateDraft {
  return {
    key: t.key,
    fileInput: t.fileUrl || (t.fileId ? `https://drive.google.com/file/d/${t.fileId}` : ""),
    type: t.type,
    alias: t.alias,
    description: t.description ?? "",
    defaultChecked: t.defaultChecked ?? false,
    useVariants: !!t.variants,
    payerInput: t.variants?.payer ?? "",
    nonpayerInput: t.variants?.nonpayer ?? "",
  };
}

function TemplateForm({
  draft,
  onChange,
  onSave,
  onCancel,
  isEdit,
  existingKeys,
}: {
  draft: TemplateDraft;
  onChange: (d: TemplateDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
  existingKeys: Set<string>;
}) {
  const fileId = parseDriveId(draft.fileInput);
  const payerId = parseDriveId(draft.payerInput);
  const nonpayerId = parseDriveId(draft.nonpayerInput);
  const aliasError = !draft.alias.trim() ? "Alias is required." : null;
  // In variant mode the single file is optional; otherwise it is required.
  const fileError = draft.useVariants
    ? null
    : !draft.fileInput.trim()
    ? "URL or ID is required."
    : !fileId
    ? "Could not extract a Drive file ID from this URL."
    : null;
  const variantError =
    draft.useVariants && !payerId && !nonpayerId
      ? "Add at least one variant file (payer or non-payer)."
      : null;
  const keyError =
    !isEdit && draft.key && existingKeys.has(draft.key)
      ? "A template with this key already exists."
      : null;
  const canSave = !aliasError && !fileError && !variantError && !keyError;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
      <div className="text-sm font-semibold text-slate-800">
        {isEdit ? "Edit Template" : "Add Template"}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field block sm:col-span-2">
          <span className="label">File URL or ID</span>
          <input
            className={`input w-full ${fileError && draft.fileInput ? "border-red-400" : ""}`}
            value={draft.fileInput}
            onChange={(e) => onChange({ ...draft, fileInput: e.currentTarget.value })}
            placeholder="https://docs.google.com/spreadsheets/d/… or file ID"
            autoFocus={!isEdit}
          />
          {fileError && draft.fileInput ? (
            <div className="mt-0.5 text-xs text-red-600">{fileError}</div>
          ) : fileId ? (
            <div className="mt-0.5 text-xs text-slate-400">ID: {fileId}</div>
          ) : null}
        </label>

        <label className="field block">
          <span className="label">Alias (display name)</span>
          <input
            className="input w-full"
            value={draft.alias}
            onChange={(e) => {
              const alias = e.currentTarget.value;
              onChange({
                ...draft,
                alias,
                key: isEdit ? draft.key : slugify(alias),
              });
            }}
            placeholder="e.g. TSS Workbook"
          />
          {aliasError && draft.alias !== "" ? (
            <div className="mt-0.5 text-xs text-red-600">{aliasError}</div>
          ) : null}
        </label>

        <label className="field block">
          <span className="label">Type</span>
          <select
            className="input w-full"
            value={draft.type}
            onChange={(e) => onChange({ ...draft, type: e.currentTarget.value as TGDriveTemplateType })}
          >
            {GDRIVE_TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
          </select>
        </label>

        <label className="field block sm:col-span-2">
          <span className="label">Description <span className="text-slate-400 font-normal">(optional)</span></span>
          <input
            className="input w-full"
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.currentTarget.value })}
            placeholder="Brief description shown in build dialog"
          />
        </label>

        <label className="field block sm:col-span-2">
          <span className="label text-xs font-medium text-slate-500">Key</span>
          <input
            className="input w-full font-mono text-xs bg-slate-50"
            value={draft.key}
            onChange={(e) => onChange({ ...draft, key: e.currentTarget.value })}
            placeholder="auto-generated from alias"
          />
          {keyError ? <div className="mt-0.5 text-xs text-red-600">{keyError}</div> : null}
          <span className="mt-0.5 block text-xs text-slate-400">Stable identifier used in build settings</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={draft.defaultChecked}
          onChange={(e) => onChange({ ...draft, defaultChecked: e.currentTarget.checked })}
        />
        Check this template by default in Build Folder dialog
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={draft.useVariants}
          onChange={(e) => onChange({ ...draft, useVariants: e.currentTarget.checked })}
        />
        Pick the source file by Medicaid status (payer / non-payer)
      </label>

      {draft.useVariants && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          <DriveRefInput
            label="Payer file (Medicaid enrolled)"
            hint="Copied when the customer is enrolled in Medicaid"
            value={draft.payerInput}
            onChange={(v) => onChange({ ...draft, payerInput: v })}
            kind={draft.type === "sheet" ? "sheet" : "file"}
          />
          <DriveRefInput
            label="Non-payer file (not enrolled / not sure)"
            hint="Copied otherwise; the single file above is optional in this mode"
            value={draft.nonpayerInput}
            onChange={(v) => onChange({ ...draft, nonpayerInput: v })}
            kind={draft.type === "sheet" ? "sheet" : "file"}
          />
          {variantError ? (
            <div className="sm:col-span-2 text-xs text-red-600">{variantError}</div>
          ) : null}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={!canSave}
        >
          {isEdit ? "Update" : "Add Template"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subfolder tag input
// ─────────────────────────────────────────────────────────────────────────────

function SubfolderTagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = React.useState("");

  const add = () => {
    const clean = input.trim();
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((sub) => (
            <span
              key={sub}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-700"
            >
              {sub}
              <button
                type="button"
                className="ml-0.5 text-slate-400 hover:text-red-500"
                onClick={() => onChange(value.filter((s) => s !== sub))}
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
          placeholder="Add subfolder name…"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={add}
          disabled={!input.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DriveRefInput — URL or ID input with ID preview
// ─────────────────────────────────────────────────────────────────────────────

function DriveRefInput({
  label,
  hint,
  value,
  onChange,
  kind,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  kind: "folder" | "sheet" | "file";
}) {
  const id = parseDriveId(value);
  const driveUrl =
    id && kind === "folder"
      ? `https://drive.google.com/drive/folders/${id}`
      : id && kind === "sheet"
      ? `https://docs.google.com/spreadsheets/d/${id}/edit`
      : id
      ? `https://drive.google.com/file/d/${id}/view`
      : null;

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={`Paste ${kind} URL or ID`}
        />
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm shrink-0"
          >
            Open ↗
          </a>
        )}
      </div>
      {id ? (
        <div className="mt-0.5 text-xs text-slate-400">ID: {id}</div>
      ) : value.trim() ? (
        <div className="mt-0.5 text-xs text-red-500">Could not extract a Drive ID from this value.</div>
      ) : hint ? (
        <div className="mt-0.5 text-xs text-slate-400">{hint}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

type FolderIndexDraft = {
  activeParent: string;
  exitedParent: string;
  sheet: string;
};

type ConfigDraft = {
  folderIndex: FolderIndexDraft;
  templates: TGDriveTemplate[];
  buildSettings: TGDriveBuildSettings;
};

function configToDraft(config: TGDriveOrgConfig | undefined): ConfigDraft {
  const fi = config?.customerFolderIndex ?? {};
  return {
    folderIndex: {
      activeParent: fi.activeParentUrl ?? fi.activeParentId ?? "",
      exitedParent: fi.exitedParentUrl ?? fi.exitedParentId ?? "",
      sheet: fi.sheetUrl ?? fi.sheetId ?? "",
    },
    templates: config?.templates ?? [],
    buildSettings: {
      defaultSubfolders: config?.buildSettings?.defaultSubfolders ?? [],
      defaultTemplateKeys: config?.buildSettings?.defaultTemplateKeys ?? [],
    },
  };
}

export default function GDriveConfigPanel() {
  const configQ = useGDriveConfig();
  const patch = useGDriveConfigPatch();

  const savedConfig = configQ.data?.config;
  const [draft, setDraft] = React.useState<ConfigDraft>(() => configToDraft(undefined));
  const [addingTemplate, setAddingTemplate] = React.useState(false);
  const [editingTemplateKey, setEditingTemplateKey] = React.useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = React.useState<TemplateDraft>(blankTemplateDraft);

  React.useEffect(() => {
    if (savedConfig) setDraft(configToDraft(savedConfig));
  }, [savedConfig]);

  const isDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(configToDraft(savedConfig)),
    [draft, savedConfig],
  );

  const existingKeys = React.useMemo(
    () => new Set(draft.templates.map((t) => t.key)),
    [draft.templates],
  );

  // ── Template actions ──

  const startAdd = () => {
    setAddingTemplate(true);
    setEditingTemplateKey(null);
    setTemplateDraft(blankTemplateDraft());
  };

  const startEdit = (key: string) => {
    const t = draft.templates.find((t) => t.key === key);
    if (!t) return;
    setEditingTemplateKey(key);
    setAddingTemplate(false);
    setTemplateDraft(draftFromTemplate(t));
  };

  const cancelTemplateForm = () => {
    setAddingTemplate(false);
    setEditingTemplateKey(null);
  };

  const saveTemplateDraft = () => {
    const fileId = parseDriveId(templateDraft.fileInput) || "";
    const payer = templateDraft.useVariants ? parseDriveId(templateDraft.payerInput) || "" : "";
    const nonpayer = templateDraft.useVariants ? parseDriveId(templateDraft.nonpayerInput) || "" : "";
    const hasVariants = !!(payer || nonpayer);
    // Valid with either a direct file or at least one variant file.
    if ((!fileId && !hasVariants) || !templateDraft.alias.trim() || !templateDraft.key.trim()) return;
    const resolved: TGDriveTemplate = {
      key: templateDraft.key.trim() || slugify(templateDraft.alias),
      fileId,
      fileUrl:
        fileId && templateDraft.fileInput.trim().startsWith("http")
          ? templateDraft.fileInput.trim()
          : undefined,
      type: templateDraft.type,
      alias: templateDraft.alias.trim(),
      ...(templateDraft.description.trim() ? { description: templateDraft.description.trim() } : {}),
      defaultChecked: templateDraft.defaultChecked,
      ...(hasVariants ? { variants: { payer, nonpayer } } : {}),
    };
    if (editingTemplateKey) {
      setDraft((d) => ({
        ...d,
        templates: d.templates.map((t) => (t.key === editingTemplateKey ? resolved : t)),
      }));
    } else {
      setDraft((d) => ({ ...d, templates: [...d.templates, resolved] }));
    }
    cancelTemplateForm();
  };

  const removeTemplate = (key: string) => {
    setDraft((d) => ({
      ...d,
      templates: d.templates.filter((t) => t.key !== key),
      buildSettings: {
        ...d.buildSettings,
        defaultTemplateKeys: (d.buildSettings.defaultTemplateKeys ?? []).filter((k) => k !== key),
      },
    }));
    if (editingTemplateKey === key) cancelTemplateForm();
  };

  const moveTemplate = (key: string, dir: -1 | 1) => {
    const idx = draft.templates.findIndex((t) => t.key === key);
    if (idx < 0) return;
    const next = [...draft.templates];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDraft((d) => ({ ...d, templates: next }));
  };

  // ── Save ──

  const handleSave = async () => {
    try {
      const activeId = parseDriveId(draft.folderIndex.activeParent);
      const exitedId = parseDriveId(draft.folderIndex.exitedParent);
      const sheetId = parseDriveId(draft.folderIndex.sheet);

      await patch.mutateAsync({
        ...(draft.folderIndex.activeParent.trim()
          ? { activeParent: activeId ? draft.folderIndex.activeParent.trim() : null }
          : {}),
        ...(draft.folderIndex.exitedParent.trim()
          ? { exitedParent: exitedId ? draft.folderIndex.exitedParent.trim() : null }
          : {}),
        ...(draft.folderIndex.sheet.trim()
          ? { customerIndexSheet: sheetId ? draft.folderIndex.sheet.trim() : null }
          : {}),
        templates: draft.templates,
        buildSettings: draft.buildSettings,
        // TODO (future agent): add `worksheetConfig: <sparse TssOrgConfigOverride>`
        // here once the override editor section exists. Send `null` to clear an
        // org back to the contracts baseline. Validate with
        // tss.TssOrgConfigOverrideSchema.safeParse() before including it.
      } as any);
      toast("Drive configuration saved.", { type: "success" });
    } catch (e: any) {
      toast(e?.message || "Save failed.", { type: "error" });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (configQ.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">Loading Drive configuration…</div>
    );
  }

  if (configQ.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {(configQ.error as any)?.message || "Failed to load Drive configuration."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Google Drive Configuration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure folder index roots, file templates, and build-folder defaults for your org.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isDirty && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setDraft(configToDraft(savedConfig))}
              disabled={patch.isPending}
            >
              Discard
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={!isDirty || patch.isPending}
          >
            {patch.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Folder Index ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Folder Index
        </div>
        <p className="text-xs text-slate-500">
          These folder IDs are used to browse and index existing customer Drive folders. Accept
          full URLs or bare IDs.
        </p>
        <div className="space-y-3">
          <DriveRefInput
            label="Active customers parent folder"
            hint="Folder containing all active customer folders"
            value={draft.folderIndex.activeParent}
            onChange={(v) =>
              setDraft((d) => ({ ...d, folderIndex: { ...d.folderIndex, activeParent: v } }))
            }
            kind="folder"
          />
          <DriveRefInput
            label="Exited customers parent folder"
            hint="Folder containing folders for exited customers"
            value={draft.folderIndex.exitedParent}
            onChange={(v) =>
              setDraft((d) => ({ ...d, folderIndex: { ...d.folderIndex, exitedParent: v } }))
            }
            kind="folder"
          />
          <DriveRefInput
            label="Customer index sheet"
            hint="Optional Google Sheet used as a customer directory"
            value={draft.folderIndex.sheet}
            onChange={(v) =>
              setDraft((d) => ({ ...d, folderIndex: { ...d.folderIndex, sheet: v } }))
            }
            kind="sheet"
          />
        </div>
      </section>

      {/* ── Section 2: File Templates ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              File Templates
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Files that can be copied into new customer folders. Ordered — drag or use arrows to
              reorder.
            </p>
          </div>
          {!addingTemplate && !editingTemplateKey && (
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={startAdd}
            >
              + Add
            </button>
          )}
        </div>

        {/* Template list */}
        {draft.templates.length > 0 && (
          <div className="space-y-1.5">
            {draft.templates.map((tmpl, idx) => {
              const isEditing = editingTemplateKey === tmpl.key;
              return (
                <div key={tmpl.key}>
                  {isEditing ? (
                    <TemplateForm
                      draft={templateDraft}
                      onChange={setTemplateDraft}
                      onSave={saveTemplateDraft}
                      onCancel={cancelTemplateForm}
                      isEdit
                      existingKeys={existingKeys}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      {/* Reorder arrows */}
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          className="text-slate-300 hover:text-slate-600 leading-none text-xs"
                          onClick={() => moveTemplate(tmpl.key, -1)}
                          disabled={idx === 0}
                          title="Move up"
                        >▲</button>
                        <button
                          type="button"
                          className="text-slate-300 hover:text-slate-600 leading-none text-xs"
                          onClick={() => moveTemplate(tmpl.key, 1)}
                          disabled={idx === draft.templates.length - 1}
                          title="Move down"
                        >▼</button>
                      </div>

                      {/* Type badge */}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeClass(tmpl.type)}`}
                      >
                        {typeLabel(tmpl.type)}
                      </span>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {tmpl.alias}
                          </span>
                          {tmpl.defaultChecked && (
                            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              default
                            </span>
                          )}
                          {tmpl.variants && (
                            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              payer / non-payer
                            </span>
                          )}
                        </div>
                        {tmpl.description && (
                          <div className="truncate text-xs text-slate-500">{tmpl.description}</div>
                        )}
                        <div className="font-mono text-[10px] text-slate-400">
                          {tmpl.variants
                            ? `payer:${tmpl.variants.payer || "—"} · non-payer:${tmpl.variants.nonpayer || "—"}`
                            : tmpl.fileId}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-1">
                        {(tmpl.fileUrl || tmpl.fileId) && (
                          <a
                            href={
                              tmpl.fileUrl ||
                              `https://drive.google.com/file/d/${tmpl.fileId}/view`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-xs"
                          >
                            Open ↗
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => startEdit(tmpl.key)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50"
                          onClick={() => removeTemplate(tmpl.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {draft.templates.length === 0 && !addingTemplate && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            No templates yet. Click <strong>+ Add</strong> to create one.
          </div>
        )}

        {/* Add form */}
        {addingTemplate && (
          <TemplateForm
            draft={templateDraft}
            onChange={setTemplateDraft}
            onSave={saveTemplateDraft}
            onCancel={cancelTemplateForm}
            isEdit={false}
            existingKeys={existingKeys}
          />
        )}
      </section>

      {/* ── Section 3: Build New Folder Defaults ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Build New Folder — Defaults
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Pre-select templates and subfolders that appear checked/present by default when staff
            open the Build Folder dialog.
          </p>
        </div>

        {/* Default templates */}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-600">
            Templates checked by default
          </div>
          {draft.templates.length === 0 ? (
            <div className="text-xs text-slate-400">
              Add templates above to configure defaults.
            </div>
          ) : (
            <div className="space-y-1.5">
              {draft.templates.map((tmpl) => {
                const checked = (draft.buildSettings.defaultTemplateKeys ?? []).includes(tmpl.key);
                return (
                  <label
                    key={tmpl.key}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-600"
                      checked={checked}
                      onChange={(e) => {
                        const keys = draft.buildSettings.defaultTemplateKeys ?? [];
                        const next = e.currentTarget.checked
                          ? [...keys, tmpl.key]
                          : keys.filter((k) => k !== tmpl.key);
                        setDraft((d) => ({
                          ...d,
                          buildSettings: { ...d.buildSettings, defaultTemplateKeys: next },
                        }));
                      }}
                    />
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeClass(tmpl.type)}`}>
                      {typeLabel(tmpl.type)}
                    </span>
                    <span className="font-medium text-slate-900">{tmpl.alias}</span>
                    {tmpl.description && (
                      <span className="text-slate-500 text-xs truncate">{tmpl.description}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Default subfolders */}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-600">
            Default subfolders to create
          </div>
          <SubfolderTagInput
            value={draft.buildSettings.defaultSubfolders ?? []}
            onChange={(next) =>
              setDraft((d) => ({
                ...d,
                buildSettings: { ...d.buildSettings, defaultSubfolders: next },
              }))
            }
          />
        </div>
      </section>

      {/*
        TODO (future agent): TSS Workbook Override Editor section goes HERE.
        Render baseline entities from tss.TSS_WORKSHEET_CONFIG.entities and let the
        admin author a sparse TssOrgConfigOverride on top (disable entities, force
        variant, label/empty-state/alias/display overrides). See the directive
        block at the top of this file for the full build plan and wiring steps.
        Add `worksheetConfig` to ConfigDraft + handleSave's patch.mutateAsync call.
      */}

      {/* Sticky save bar when dirty */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-lg">
          <span className="mr-auto text-sm text-sky-800 font-medium">Unsaved changes</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft(configToDraft(savedConfig))}
            disabled={patch.isPending}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={patch.isPending}
          >
            {patch.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
