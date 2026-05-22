"use client";

// features/admin/OrgConfigPage.tsx
// Org configuration editor — any verified org user can view/edit config docs.
// org_dev can also create/delete org docs.
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@app/auth/AuthProvider";
import { Orgs, type OrgConfigDoc } from "@client/orgs";
import { toast } from "@lib/toast";
import GDriveConfigPanel from "./GDriveConfigPanel";
import { RichTextEditor } from "@entities/help/RichTextEditor";

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

type DigestBoxKey = "rentalAssistance" | "customer" | "budget";

type DigestStructure = {
  version: number;
  digestType: string;
  editorNotesHtml: string;
  subject: { template: string; description: string };
  intro: { enabled: boolean; html: string; description: string };
  boxes: Record<DigestBoxKey, {
    enabled: boolean;
    title: string;
    description: string;
    fields: Array<{ key: string; label: string; enabled: boolean; description: string }>;
  }>;
  footer: { enabled: boolean; html: string; description: string };
};

const DIGEST_TEMPLATE_TYPE_BY_DOC_ID: Record<string, string> = {
  CustomerEmailTemplate: "caseload",
  CaseManagersEmailTemplate: "caseManagers",
  BudgetEmailTemplate: "budget",
  EnrollmentsEmailTemplate: "enrollments",
  RentalAssistanceEmailTemplate: "rentalAssistance",
};

const DIGEST_BOX_LABELS: Record<DigestBoxKey, string> = {
  rentalAssistance: "Rental assistance box",
  customer: "Customer box",
  budget: "Budget box",
};

const DEFAULT_DIGEST_NOTES = [
  "<h2>Digest structure build notes</h2>",
  "<p>This scaffold is saved with the org config doc so the next implementation pass has durable product notes beside the editable structure.</p>",
  "<ul>",
  "<li>Backend renderers should read <code>value.digestStructure</code> and fall back to current hard-coded digest sections when fields are missing.</li>",
  "<li>Keep the real email preview sourced from <code>inboxDigestHtmlPreview</code>; avoid a second incompatible frontend renderer.</li>",
  "<li>Fields should become selectable from real digest data keys after the backend exposes a digest schema endpoint.</li>",
  "</ul>",
].join("");

function defaultDigestStructure(doc: OrgConfigDoc): DigestStructure {
  const digestType = DIGEST_TEMPLATE_TYPE_BY_DOC_ID[doc.id] || doc.id;
  return {
    version: 1,
    digestType,
    editorNotesHtml: DEFAULT_DIGEST_NOTES,
    subject: {
      template: String(doc.subject || `${doc.label} - {{monthLabel}}`),
      description: "Subject line used by scheduled and manual digest sends.",
    },
    intro: {
      enabled: true,
      html: String(doc.bodyHtml || "<p>Monthly digest summary.</p>"),
      description: "Optional copy shown above the digest boxes.",
    },
    boxes: {
      rentalAssistance: {
        enabled: digestType === "rentalAssistance",
        title: "Rental Assistance",
        description: "Grant rental assistance metrics, household activity, payments, and upcoming pressure points.",
        fields: [
          { key: "totalAssistance", label: "Total assistance", enabled: true, description: "Total rental assistance for the digest period." },
          { key: "householdsServed", label: "Households served", enabled: true, description: "Count of unique households assisted." },
        ],
      },
      customer: {
        enabled: true,
        title: "Customers",
        description: "Customer-level activity, enrollment status, and compliance follow-up signals.",
        fields: [
          { key: "activeCustomers", label: "Active customers", enabled: true, description: "Customers active in the digest scope." },
          { key: "newCustomers", label: "New customers", enabled: true, description: "Customers created during the digest period." },
        ],
      },
      budget: {
        enabled: digestType === "budget" || digestType === "rentalAssistance",
        title: "Budget",
        description: "Budget total, spent, projected, remaining funds, and pinned grant rollups.",
        fields: [
          { key: "budgetTotal", label: "Budget total", enabled: true, description: "Total budget in digest scope." },
          { key: "remaining", label: "Remaining", enabled: true, description: "Remaining funds after spend and projections." },
        ],
      },
    },
    footer: {
      enabled: true,
      html: "<p>Generated by Households DB.</p>",
      description: "Footer copy appended to the email.",
    },
  };
}

function normalizeDigestStructure(doc: OrgConfigDoc): DigestStructure {
  const base = defaultDigestStructure(doc);
  const rawValue = doc.value && typeof doc.value === "object" ? doc.value : {};
  const saved = rawValue.digestStructure && typeof rawValue.digestStructure === "object"
    ? (rawValue.digestStructure as Partial<DigestStructure>)
    : {};
  return {
    ...base,
    ...saved,
    subject: { ...base.subject, ...(saved.subject || {}) },
    intro: { ...base.intro, ...(saved.intro || {}) },
    boxes: {
      rentalAssistance: { ...base.boxes.rentalAssistance, ...(saved.boxes?.rentalAssistance || {}) },
      customer: { ...base.boxes.customer, ...(saved.boxes?.customer || {}) },
      budget: { ...base.boxes.budget, ...(saved.boxes?.budget || {}) },
    },
    footer: { ...base.footer, ...(saved.footer || {}) },
  };
}

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

function DigestScaffoldEditor({
  doc,
  onSave,
  saving,
}: {
  doc: OrgConfigDoc;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = React.useState(doc.subject || "");
  const [bodyText, setBodyText] = React.useState(doc.bodyText || "");
  const [bodyHtml, setBodyHtml] = React.useState(doc.bodyHtml || "");
  const [structure, setStructure] = React.useState<DigestStructure>(() => normalizeDigestStructure(doc));

  const dirty =
    subject !== (doc.subject || "") ||
    bodyText !== (doc.bodyText || "") ||
    bodyHtml !== (doc.bodyHtml || "") ||
    JSON.stringify(structure) !== JSON.stringify(normalizeDigestStructure(doc));

  const patchBox = (key: DigestBoxKey, patch: Partial<DigestStructure["boxes"][DigestBoxKey]>) => {
    setStructure((current) => ({
      ...current,
      boxes: {
        ...current.boxes,
        [key]: { ...current.boxes[key], ...patch },
      },
    }));
  };

  const save = () => {
    onSave({
      subject,
      bodyText,
      bodyHtml,
      value: {
        ...(doc.value || {}),
        digestStructure: {
          ...structure,
          subject: { ...structure.subject, template: subject },
          intro: { ...structure.intro, html: structure.intro.html || bodyHtml },
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        Scaffold mode: this saves a structured digest object on the org config doc. Backend digest renderers still need the next pass to consume it.
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Digest type</span>
          <input
            className="input"
            value={structure.digestType}
            onChange={(event) => setStructure((current) => ({ ...current, digestType: event.currentTarget.value }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject template</span>
          <input
            className="input"
            value={subject}
            onChange={(event) => {
              setSubject(event.currentTarget.value);
              setStructure((current) => ({ ...current, subject: { ...current.subject, template: event.currentTarget.value } }));
            }}
            placeholder="Digest subject line..."
          />
        </label>
      </section>

      <section className="space-y-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Implementation notes</div>
          <div className="text-xs text-slate-500">Durable build notes, assumptions, and migration reminders saved with this template.</div>
        </div>
        <RichTextEditor
          value={structure.editorNotesHtml}
          onChange={(html) => setStructure((current) => ({ ...current, editorNotesHtml: html }))}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Intro block</div>
            <div className="text-xs text-slate-500">{structure.intro.description}</div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={structure.intro.enabled}
              onChange={(event) => setStructure((current) => ({ ...current, intro: { ...current.intro, enabled: event.currentTarget.checked } }))}
            />
            Enabled
          </label>
        </div>
        <RichTextEditor
          value={structure.intro.html}
          onChange={(html) => {
            setBodyHtml(html);
            setStructure((current) => ({ ...current, intro: { ...current.intro, html } }));
          }}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(structure.boxes) as DigestBoxKey[]).map((key) => {
          const box = structure.boxes[key];
          return (
            <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{DIGEST_BOX_LABELS[key]}</span>
                  <span className="block text-xs text-slate-500">{box.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={box.enabled}
                  onChange={(event) => patchBox(key, { enabled: event.currentTarget.checked })}
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
                <input className="input" value={box.title} onChange={(event) => patchBox(key, { title: event.currentTarget.value })} />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                <textarea className="input min-h-20" value={box.description} onChange={(event) => patchBox(key, { description: event.currentTarget.value })} />
              </label>
              <div className="mt-3 space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Field scaffold</div>
                {box.fields.map((field) => (
                  <label key={field.key} className="flex items-start gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={field.enabled}
                      onChange={(event) => {
                        const fields = box.fields.map((item) => item.key === field.key ? { ...item, enabled: event.currentTarget.checked } : item);
                        patchBox(key, { fields });
                      }}
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">{field.label}</span>
                      <span className="block text-[11px] text-slate-500">{field.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-semibold text-slate-500 mb-1">Plain text fallback</label>
        <textarea
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
          rows={4}
          value={bodyText}
          onChange={(event) => setBodyText(event.currentTarget.value)}
          placeholder="Plain text body..."
        />
      </section>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Advanced raw HTML / object preview</summary>
        <label className="mt-3 block">
          <span className="block text-xs font-semibold text-slate-500 mb-1">Body HTML</span>
          <textarea
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
            rows={8}
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.currentTarget.value)}
            placeholder="<html>..."
          />
        </label>
        <pre className="mt-3 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify({ digestStructure: structure }, null, 2)}
        </pre>
      </details>

      <button
        type="button"
        disabled={!dirty || saving}
        className="btn btn-sm btn-primary"
        onClick={save}
      >
        {saving ? "Saving..." : "Save Digest Scaffold"}
      </button>
    </div>
  );
}

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
            <DigestScaffoldEditor doc={doc} onSave={handleSave} saving={saving} />
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
  const [driveExpanded, setDriveExpanded] = React.useState(false);

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

      {/* Google Drive config panel */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setDriveExpanded((x) => !x)}
          className="w-full flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
        >
          <div>
            <span className="font-semibold text-slate-900 text-sm">Google Drive</span>
            <span className="ml-2 text-xs text-slate-400">System</span>
          </div>
          <span className="text-slate-400 text-xs">{driveExpanded ? "▲" : "▼"}</span>
        </button>
        {driveExpanded && (
          <div className="px-4 py-4">
            <GDriveConfigPanel />
          </div>
        )}
      </div>

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
