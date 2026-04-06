"use client";

// features/admin/OrgConfigPage.tsx
// Org configuration editor — any verified org user can view/edit config docs.
// org_dev can also create/delete org docs.
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { Orgs, type OrgConfigDoc } from "@client/orgs";
import { toast } from "@lib/toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDevLike(profile: any) {
  const tr = String(profile?.topRole || profile?.role || "").toLowerCase();
  return tr === "org_dev" || tr === "dev" || tr === "super_dev";
}

const ORG_QK = (orgId: string) => ["orgs", orgId] as const;

// ── Config doc kinds ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  display:        "Display",
  system:         "System",
  email_template: "Email Template",
};

// ── Email template editor ─────────────────────────────────────────────────────

function EmailTemplateEditor({
  doc,
  onSave,
  saving,
}: {
  doc: OrgConfigDoc;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [subject,  setSubject]  = React.useState(doc.subject  || "");
  const [bodyText, setBodyText] = React.useState(doc.bodyText || "");
  const [bodyHtml, setBodyHtml] = React.useState(doc.bodyHtml || "");

  const dirty =
    subject  !== (doc.subject  || "") ||
    bodyText !== (doc.bodyText || "") ||
    bodyHtml !== (doc.bodyHtml || "");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Subject</label>
        <input
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          placeholder="Email subject line…"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Body (plain text)</label>
        <textarea
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
          rows={4}
          value={bodyText}
          onChange={(e) => setBodyText(e.currentTarget.value)}
          placeholder="Plain text body…"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Body (HTML)</label>
        <textarea
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
          rows={8}
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.currentTarget.value)}
          placeholder="<html>…"
        />
      </div>
      <button
        type="button"
        disabled={!dirty || saving}
        className="btn btn-sm btn-primary"
        onClick={() => onSave({ subject, bodyText, bodyHtml })}
      >
        {saving ? "Saving…" : "Save Template"}
      </button>
    </div>
  );
}

// ── JSON value editor (for display / system configs) ──────────────────────────

function JsonValueEditor({
  doc,
  onSave,
  saving,
}: {
  doc: OrgConfigDoc;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(doc.value ?? {}, null, 2));
  const [parseError, setParseError] = React.useState<string | null>(null);

  const dirty = text !== JSON.stringify(doc.value ?? {}, null, 2);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      onSave({ value: parsed });
    } catch (e: any) {
      setParseError(e.message || "Invalid JSON");
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-500">Value (JSON)</label>
      <textarea
        className={[
          "w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300",
          parseError ? "border-red-400 bg-red-50" : "border-slate-300 bg-white",
        ].join(" ")}
        rows={10}
        value={text}
        onChange={(e) => { setText(e.currentTarget.value); setParseError(null); }}
      />
      {parseError && <div className="text-xs text-red-600">{parseError}</div>}
      <button
        type="button"
        disabled={!dirty || saving}
        className="btn btn-sm btn-primary"
        onClick={handleSave}
      >
        {saving ? "Saving…" : "Save Config"}
      </button>
    </div>
  );
}

// ── Config doc card ───────────────────────────────────────────────────────────

function ConfigDocCard({
  doc,
  orgId,
  onRefresh,
}: {
  doc: OrgConfigDoc;
  orgId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [saving, setSaving]     = React.useState(false);

  const handleSave = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await Orgs.configPatch(doc.id, patch, orgId);
      toast(`${doc.label} saved.`, { type: "success" });
      onRefresh();
    } catch (e: any) {
      toast(e?.message || "Save failed.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
      >
        <div>
          <span className="font-semibold text-slate-900 text-sm">{doc.label}</span>
          <span className="ml-2 text-xs text-slate-400">{KIND_LABELS[doc.kind] ?? doc.kind}</span>
        </div>
        <div className="flex items-center gap-2">
          {doc.updatedAt && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
          )}
          <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4">
          {doc.kind === "email_template" ? (
            <EmailTemplateEditor doc={doc} onSave={handleSave} saving={saving} />
          ) : (
            <JsonValueEditor doc={doc} onSave={handleSave} saving={saving} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrgConfigPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isDev = isDevLike(profile);

  // org_dev can specify an org; other users use their own
  const [targetOrgId, setTargetOrgId] = React.useState("");
  const [createId,   setCreateId]     = React.useState("");
  const [createName, setCreateName]   = React.useState("");
  const [creating,   setCreating]     = React.useState(false);
  const [deleting,   setDeleting]     = React.useState(false);

  const orgQ = useQuery({
    queryKey: [...ORG_QK(targetOrgId || "my"), targetOrgId],
    queryFn: () => Orgs.get(targetOrgId || undefined),
    select: (r) => r.org,
    retry: false,
  });

  const org = orgQ.data;
  const configDocs = org?.config ? Object.values(org.config).sort((a, b) => a.label.localeCompare(b.label)) : [];

  const handleCreate = async () => {
    const id   = createId.trim();
    const name = createName.trim();
    if (!id || !name) { toast("Org ID and name are required.", { type: "error" }); return; }
    setCreating(true);
    try {
      const r = await Orgs.create(id, name);
      toast(`Org ${r.org.id} created.`, { type: "success" });
      setCreateId("");
      setCreateName("");
      setTargetOrgId(r.org.id);
      qc.invalidateQueries({ queryKey: ["orgs"] });
    } catch (e: any) {
      toast(e?.message || "Create failed.", { type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!org) return;
    if (!confirm(`Delete org "${org.id}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Orgs.delete(org.id);
      toast(`Org ${org.id} deleted.`, { type: "success" });
      setTargetOrgId("");
      qc.invalidateQueries({ queryKey: ["orgs"] });
    } catch (e: any) {
      toast(e?.message || "Delete failed.", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Org Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage display settings, system config, and email templates for your organization.
          All org members can edit; only org admins can create or delete orgs.
        </p>
      </div>

      {/* Org selector (org_dev only) */}
      {isDev && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Org Dev Controls</div>
          <div className="flex gap-2 flex-wrap">
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="org ID to view (empty = own org)"
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.currentTarget.value)}
            />
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-500">Create New Org</div>
            <div className="flex gap-2 flex-wrap">
              <input
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="org ID (e.g. HRDC_IX)"
                value={createId}
                onChange={(e) => setCreateId(e.currentTarget.value)}
              />
              <input
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="org name"
                value={createName}
                onChange={(e) => setCreateName(e.currentTarget.value)}
              />
              <button
                type="button"
                disabled={creating || !createId || !createName}
                className="btn btn-sm btn-primary"
                onClick={handleCreate}
              >
                {creating ? "Creating…" : "Create Org"}
              </button>
            </div>
          </div>

          {org && (
            <button
              type="button"
              disabled={deleting}
              className="btn btn-sm border border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : `Delete Org "${org.id}"`}
            </button>
          )}
        </div>
      )}

      {/* Org header */}
      {org && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-900">{org.name}</div>
            <div className="text-xs text-slate-500 font-mono">{org.id}</div>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-ghost border border-slate-300"
            onClick={() => orgQ.refetch()}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Config docs */}
      {orgQ.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : orgQ.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(orgQ.error as any)?.message || "Failed to load org config."}
        </div>
      ) : configDocs.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">No config docs found.</div>
      ) : (
        <div className="space-y-3">
          {configDocs.map((doc) => (
            <ConfigDocCard
              key={doc.id}
              doc={doc}
              orgId={org!.id}
              onRefresh={() => orgQ.refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
