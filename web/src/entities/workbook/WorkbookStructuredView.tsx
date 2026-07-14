"use client";

// Read-only native render of extracted TSS workbook content (Slice A).
// Supports coverSheet (keyValueCard) + progressNotes (dataTable). Other entities
// report status (unsupported/missing_*) and are shown gently, never as failures.
//
// Presentation is driven by the resolved config (field labels/display) joined to
// the lean extract (fieldId → cell) by fieldId — the extract carries data only.

import React from "react";
import api from "@client/api";
import { useWorkbookData } from "@hooks/useWorkbookData";
import { useResolvedTssConfig } from "@hooks/useTssConfig";
import { useGoogleIntegrationConnect } from "@hooks/useGoogleIntegrations";
import { DriveAuthBanner } from "@entities/gdrive/DriveAuthBanner";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import { AddRowForm } from "./AddRowForm";
import { AddSessionForm, type GoalOption } from "./AddSessionForm";
import { GoalForm } from "./GoalForm";
import { GoalsList } from "./HousingPlan/GoalsList";
import { NotesList } from "./ProgressNotes/NotesList";
import type { tss as TssNS } from "@hdb/contracts";

// The companion mobile app (same data, same pushes) — linked from the header.
const MOBILE_APP_URL = "https://housing-db-mobile.web.app";

type SuggestedIdentity = {
  clientName?: string;
  dob?: string;
  hmisCwId?: string;
};

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

function rowExpectedValues(row: TssNS.TssExtractedRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [fieldId, cell] of Object.entries(row.values ?? {})) {
    const value = String(cell?.displayValue ?? cell?.value ?? "").trim();
    if (value) out[fieldId] = value;
  }
  return out;
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusNote({ tone, children }: { tone: "slate" | "amber"; children: React.ReactNode }) {
  const cls = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-500";
  return <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}

// ── keyValueCard renderer ───────────────────────────────────────────────────

function KeyValueCard({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  const keyValues = cfgEntity?.source.keyValues ?? [];
  const values = entity.values ?? {};
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {keyValues.map((kv) => {
        const cell = values[kv.id];
        const display = cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
        return (
          <div key={kv.id} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kv.label}</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900" title={display}>
              {display || <span className="text-slate-300">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function coverDisplay(entity: TssNS.TssExtractedEntity, fieldId: keyof SuggestedIdentity): string {
  const cell = entity.values?.[fieldId];
  return String(cell?.displayValue ?? cell?.value ?? "").trim();
}

function CoverIdentityEditor({
  customerId,
  entity,
  suggestedIdentity,
  onSaved,
}: {
  customerId: string;
  entity: TssNS.TssExtractedEntity;
  suggestedIdentity?: SuggestedIdentity;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<SuggestedIdentity>(() => ({
    clientName: coverDisplay(entity, "clientName"),
    dob: coverDisplay(entity, "dob"),
    hmisCwId: coverDisplay(entity, "hmisCwId"),
  }));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValues({
      clientName: coverDisplay(entity, "clientName"),
      dob: coverDisplay(entity, "dob"),
      hmisCwId: coverDisplay(entity, "hmisCwId"),
    });
  }, [entity]);

  const fillSuggested = () => {
    setValues((cur) => ({
      clientName: String(cur.clientName || "").trim() ? cur.clientName : suggestedIdentity?.clientName ?? "",
      dob: String(cur.dob || "").trim() ? cur.dob : suggestedIdentity?.dob ?? "",
      hmisCwId: String(cur.hmisCwId || "").trim() ? cur.hmisCwId : suggestedIdentity?.hmisCwId ?? "",
    }));
  };

  const hasSuggestion = !!(suggestedIdentity?.clientName || suggestedIdentity?.dob || suggestedIdentity?.hmisCwId);

  const save = async () => {
    setSaving(true);
    try {
      const resp = (await (api as any).postWith(
        "patchCustomerWorkbookScaffold",
        { customerId, cover: values },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (!resp?.ok) {
        toast(String(resp?.error || "Could not save workbook details."), { type: "error" });
        return;
      }
      toast("Workbook details saved.", { type: "success" });
      onSaved();
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      toast(String(body?.error || (e as Error)?.message || "Could not save workbook details."), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Name
          <input className="input mt-1 w-full text-sm" value={values.clientName ?? ""} onChange={(e) => setValues((cur) => ({ ...cur, clientName: e.target.value }))} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          DOB
          <input className="input mt-1 w-full text-sm" value={values.dob ?? ""} onChange={(e) => setValues((cur) => ({ ...cur, dob: e.target.value }))} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          CW ID
          <input className="input mt-1 w-full text-sm" value={values.hmisCwId ?? ""} onChange={(e) => setValues((cur) => ({ ...cur, hmisCwId: e.target.value }))} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={fillSuggested} disabled={!hasSuggestion || saving}>
          Fill suggested
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save details"}
        </button>
      </div>
    </div>
  );
}

function SummaryBoxEditor({
  customerId,
  entity,
  onSaved,
}: {
  customerId: string;
  entity: TssNS.TssExtractedEntity;
  onSaved: () => void;
}) {
  const current = String(entity.values?.clientStrengths?.displayValue ?? entity.values?.clientStrengths?.value ?? "").trim();
  const [clientStrengths, setClientStrengths] = React.useState(current);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setClientStrengths(current), [current]);

  const save = async () => {
    setSaving(true);
    try {
      const resp = (await (api as any).postWith(
        "patchCustomerWorkbookScaffold",
        { customerId, strengths: { clientStrengths } },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (!resp?.ok) {
        toast(String(resp?.error || "Could not save client strengths."), { type: "error" });
        return;
      }
      toast("Client strengths saved.", { type: "success" });
      onSaved();
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      toast(String(body?.error || (e as Error)?.message || "Could not save client strengths."), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <label className="text-xs font-medium text-slate-600">
        Client Strengths
        <textarea
          className="textarea mt-1 min-h-24 w-full text-sm"
          value={clientStrengths}
          onChange={(e) => setClientStrengths(e.target.value)}
        />
      </label>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save strengths"}
        </button>
      </div>
    </div>
  );
}

// ── dataTable renderer ──────────────────────────────────────────────────────

function DataTable({
  entity,
  cfgEntity,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
}) {
  const fields = cfgEntity?.fields ?? [];
  const rows = entity.rows ?? [];
  // Columns: prefer compactFields ordering when present, else all fields.
  const compact = cfgEntity?.display?.compactFields;
  const columns = compact?.length
    ? fields.filter((f) => compact.includes(f.id))
    : fields.filter((f) => !f.display?.hideInCompact);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((f) => (
              <th key={f.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                {f.display?.label ?? f.expected}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey} className="border-t border-slate-100 align-top hover:bg-slate-50">
              {columns.map((f) => {
                const cell = row.values[f.id];
                const display = cell?.displayValue ?? (cell?.value != null ? String(cell.value) : "");
                const multiline = f.display?.multiline;
                return (
                  <td
                    key={f.id}
                    className={`px-3 py-2 text-slate-700 ${multiline ? "whitespace-pre-wrap min-w-[200px]" : "whitespace-nowrap"}`}
                  >
                    {display || <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Per-entity block ─────────────────────────────────────────────────────────

function EntityBlock({
  entity,
  cfgEntity,
  customerId,
  customerName,
  suggestedIdentity,
  config,
  goalsForLinking,
  onSaved,
}: {
  entity: TssNS.TssExtractedEntity;
  cfgEntity: TssNS.TssDisplayEntityConfig | undefined;
  customerId: string;
  customerName?: string;
  suggestedIdentity?: SuggestedIdentity;
  config: TssNS.TssWorksheetConfig;
  /** Numbered goals from the extract — offered as link targets on new sessions. */
  goalsForLinking: GoalOption[];
  onSaved: () => void;
}) {
  const [adding, setAdding] = React.useState(false);
  // Goals only: edit an extracted row in place (mobile GoalEditSheet parity).
  const [editingGoalRow, setEditingGoalRow] = React.useState<TssNS.TssExtractedRow | null>(null);
  const [deletingRowKey, setDeletingRowKey] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    row: TssNS.TssExtractedRow;
    fingerprint?: { date?: string; startTime?: string; endTime?: string; summary?: string };
  } | null>(null);
  const [deleteCalendarEvent, setDeleteCalendarEvent] = React.useState(false);

  // Goals and progress notes get dedicated forms that mirror the mobile app's
  // Add Goal / Log Session workflows; other writable tables keep the generic form.
  const isGoals = entity.entityId === "goals";
  const isNotes = entity.entityId === "progressNotes";
  const isCover = entity.entityId === "coverSheet";
  const isStrengths = entity.entityId === "customerStrengths";

  // Append is available for writable dataTable entities that resolved their
  // layout (extracted or empty — both have a known table to append into).
  const canAdd =
    !!cfgEntity &&
    cfgEntity.renderKind === "dataTable" &&
    cfgEntity.direction !== "worksheetToApp" &&
    (entity.status === "extracted" || entity.status === "empty");

  const requestDeleteRow = (
    row: TssNS.TssExtractedRow,
    fingerprint?: { date?: string; startTime?: string; endTime?: string; summary?: string },
  ) => {
    setDeleteCalendarEvent(false);
    setPendingDelete({ row, fingerprint });
  };

  const confirmDeleteRow = async () => {
    if (!cfgEntity || !pendingDelete) return;
    const label = isGoals ? "goal" : isNotes ? "progress note" : "row";
    const { row, fingerprint } = pendingDelete;

    setDeletingRowKey(row.rowKey);
    try {
      const resp = (await (api as any).postWith(
        "deleteCustomerWorkbookRow",
        {
          customerId,
          entityId: cfgEntity.id,
          rowKey: row.rowKey,
          expectedValues: rowExpectedValues(row),
          ...(isNotes ? { deleteCalendarEvent, rowFingerprint: fingerprint ?? {} } : {}),
        },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (!resp?.ok) {
        const manual = resp?.manualActionRequired
          ? "The workbook changed since this page loaded. Open the workbook and make this change manually so the wrong row is not deleted."
          : String(resp?.error || `Could not delete the ${label}.`);
        toast(manual, { type: "error" });
        return;
      }
      toast(isGoals ? "Goal deleted." : isNotes ? "Progress note deleted." : "Row deleted.", { type: "success" });
      setPendingDelete(null);
      onSaved();
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      const manual = (body as { manualActionRequired?: boolean } | undefined)?.manualActionRequired
        ? "The workbook changed since this page loaded. Open the workbook and make this change manually so the wrong row is not deleted."
        : String(body?.error || (e as Error)?.message || `Could not delete the ${label}.`);
      toast(manual, { type: "error" });
    } finally {
      setDeletingRowKey(null);
    }
  };

  let body: React.ReactNode;

  switch (entity.status) {
    case "unsupported":
      body = <StatusNote tone="slate">Open the Sheet view to see this section.</StatusNote>;
      break;
    case "missing_sheet":
      body = <StatusNote tone="amber">This sheet wasn’t found in the workbook.</StatusNote>;
      break;
    case "missing_headers":
      body = <StatusNote tone="amber">Couldn’t locate this section’s columns in the sheet.</StatusNote>;
      break;
    case "error":
      body = <StatusNote tone="amber">Couldn’t read this section.</StatusNote>;
      break;
    case "empty":
      body = isStrengths
        ? <SummaryBoxEditor customerId={customerId} entity={entity} onSaved={onSaved} />
        : <StatusNote tone="slate">No entries yet.</StatusNote>;
      break;
    case "extracted":
      body = isCover
        ? (
            <div className="space-y-2">
              <KeyValueCard entity={entity} cfgEntity={cfgEntity} />
              <CoverIdentityEditor customerId={customerId} entity={entity} suggestedIdentity={suggestedIdentity} onSaved={onSaved} />
            </div>
          )
        : isStrengths
          ? <SummaryBoxEditor customerId={customerId} entity={entity} onSaved={onSaved} />
          : entity.renderKind === "keyValueCard"
            ? <KeyValueCard entity={entity} cfgEntity={cfgEntity} />
            : entity.renderKind === "dataTable"
              ? (entity.section === "notes"
                  ? <NotesList entity={entity} cfgEntity={cfgEntity} onDeleteRow={canAdd ? requestDeleteRow : undefined} />
                  : isGoals
                    ? <GoalsList
                        entity={entity}
                        onEditRow={canAdd ? (row) => { setEditingGoalRow(row); setAdding(false); } : undefined}
                        onDeleteRow={canAdd ? requestDeleteRow : undefined}
                      />
                    : <DataTable entity={entity} cfgEntity={cfgEntity} />)
              : <StatusNote tone="slate">Open the Sheet view to see this section.</StatusNote>;
      break;
    default:
      body = null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entity.label}</h5>
        {canAdd && !adding && !editingGoalRow ? (
          <button
            type="button"
            className="rounded-md px-2 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
            onClick={() => setAdding(true)}
          >
            {isGoals ? "+ Add goal" : isNotes ? "+ Add session" : "+ Add"}
          </button>
        ) : null}
      </div>
      {body}
      {deletingRowKey ? (
        <div className="text-[11px] text-slate-400">Deleting row {deletingRowKey.replace("row-", "")}...</div>
      ) : null}
      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
            <div className="font-semibold text-red-900">Are you sure?</div>
            <p className="mt-1 text-xs text-slate-600">
              This will clear the {isGoals ? "goal" : isNotes ? "progress note" : "row"} cells only if the workbook still matches the row shown here.
              If it changed, deletion will stop and you will need to update the workbook manually.
            </p>
            {isNotes ? (
              <label className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={deleteCalendarEvent}
                  onChange={(e) => setDeleteCalendarEvent(e.target.checked)}
                />
                Delete the linked calendar event if one exists
              </label>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDelete(null)} disabled={!!deletingRowKey}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm bg-red-600 text-white hover:bg-red-700" onClick={() => void confirmDeleteRow()} disabled={!!deletingRowKey}>
                {deletingRowKey ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {canAdd && adding && cfgEntity ? (
        isNotes ? (
          <AddSessionForm
            customerId={customerId}
            customerName={customerName}
            goals={goalsForLinking}
            onSaved={() => { setAdding(false); onSaved(); }}
            onCancel={() => setAdding(false)}
          />
        ) : isGoals ? (
          <GoalForm
            customerId={customerId}
            cfgEntity={cfgEntity}
            config={config}
            goalRow={null}
            onSaved={() => { setAdding(false); onSaved(); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <AddRowForm
            customerId={customerId}
            customerName={customerName}
            entityId={entity.entityId}
            cfgEntity={cfgEntity}
            config={config}
            allowCalendarPush={entity.section === "notes"}
            onSaved={() => { setAdding(false); onSaved(); }}
            onCancel={() => setAdding(false)}
          />
        )
      ) : null}
      {isGoals && editingGoalRow && cfgEntity ? (
        <GoalForm
          customerId={customerId}
          cfgEntity={cfgEntity}
          config={config}
          goalRow={editingGoalRow}
          onSaved={() => { setEditingGoalRow(null); onSaved(); }}
          onCancel={() => setEditingGoalRow(null)}
        />
      ) : null}
    </section>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function WorkbookStructuredView({
  customerId,
  customerName,
  suggestedIdentity,
  onOpenSheet,
}: {
  customerId: string;
  customerName?: string;
  suggestedIdentity?: SuggestedIdentity;
  /** Switch back to the iframe/Sheet view (used as the fallback affordance). */
  onOpenSheet?: () => void;
}) {
  const dataQ = useWorkbookData(customerId);
  const { config } = useResolvedTssConfig();
  const driveConnect = useGoogleIntegrationConnect("googleDrive");
  const result = dataQ.data;
  const issue = result?.issue ?? null;
  const extract = result?.extract ?? null;

  React.useEffect(() => {
    if (!extract?.spreadsheetId || issue || dataQ.isLoading) return;
    const key = `hdb:tss-scaffold:${customerId}:${extract.spreadsheetId}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");

    void (api as any).postWith(
      "patchCustomerWorkbookScaffold",
      { customerId, fillPageNames: true, planDate: "createdAt", seedDefaults: true },
      driveHeaders(),
    ).then((resp: Record<string, unknown>) => {
      if (Number(resp?.updated ?? 0) > 0) void dataQ.refetch();
    }).catch(() => null);
  }, [customerId, dataQ, dataQ.isLoading, extract?.spreadsheetId, issue]);

  if (dataQ.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        Reading workbook…
      </div>
    );
  }

  // Auth / scope / not-linked → banner + keep Sheet view available.
  if (issue) {
    return (
      <div className="space-y-3">
        <DriveAuthBanner
          issue={issue}
          onReauthorize={() => void driveConnect.mutateAsync().catch(() => null)}
          onConnectPermanent={() => void driveConnect.mutateAsync().catch(() => null)}
          reauthorizing={driveConnect.isPending}
        />
        {onOpenSheet ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSheet}>
            View the sheet instead
          </button>
        ) : null}
      </div>
    );
  }

  if (!extract) return null;

  const cfgById = new Map(Object.values(config.entities).map((e) => [e.id, e]));
  // Section order: cover → notes → others (config section grouping is enough for slice A).
  const ordered = [...extract.entities].sort((a, b) => {
    const rank = (s: string) => (s === "cover" ? 0 : s === "notes" ? 1 : s === "housingPlan" ? 2 : 3);
    return rank(a.section) - rank(b.section);
  });

  // Structured goals, numbered by table position — progress notes reference
  // them by that position ("Goal #2"), same convention as the mobile app.
  const goalRows = extract.entities.find((e) => e.entityId === "goals")?.rows ?? [];
  const goalsForLinking: GoalOption[] = goalRows.map((row, i) => {
    const cell = row.values?.goalSmart;
    const label = cell ? String(cell.displayValue ?? cell.value ?? "").trim() : "";
    return { n: i + 1, label: label || `Goal ${i + 1}` };
  });

  return (
    <div className="space-y-5">
      {/* Companion mobile app — same data entry, streamlined for the field. */}
      <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2">
        <span aria-hidden>📱</span>
        <a
          href={MOBILE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="This small app was designed to streamline case manager data entry and may be easier to manage than the website."
          className="text-xs font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
        >
          Mobile app
        </a>
        <span className="rounded-full border border-indigo-300 bg-white px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
          Beta
        </span>
        <span className="hidden text-[11px] text-indigo-700/70 sm:inline">
          Streamlined case manager data entry — sessions and goals sync to this same workbook.
        </span>
      </div>

      {ordered.map((entity) => (
        <EntityBlock
          key={entity.entityId}
          entity={entity}
          cfgEntity={cfgById.get(entity.entityId)}
          customerId={customerId}
          customerName={customerName}
          suggestedIdentity={suggestedIdentity}
          config={config}
          goalsForLinking={goalsForLinking}
          onSaved={() => void dataQ.refetch()}
        />
      ))}

      <div className="flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        <span>
          Read from the sheet {new Date(extract.extractedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </span>
        <button
          type="button"
          className="text-sky-600 underline hover:text-sky-800"
          onClick={() => void dataQ.refetch()}
          disabled={dataQ.isFetching}
        >
          {dataQ.isFetching ? "Refreshing…" : "Refresh from Sheet"}
        </button>
      </div>
    </div>
  );
}
