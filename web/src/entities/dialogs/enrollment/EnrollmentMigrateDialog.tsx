//web/src/entities/dialogs/EnrollmentMigrateDialog.tsx
"use client";

import React from "react";
import { Modal } from "@entities/ui/Modal";
import type { ISODate } from "@types";
import type { EnrollmentsMigrateReq } from "@types";
import { toISODate } from "@lib/date";
import { useMigrateEnrollment } from "@hooks/useEnrollments";
import { toast } from "@lib/toast";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { toApiError } from "@client/api";
import type { Enrollment } from "@client/enrollments";

type SourceLineItem = { id: string; label?: string };

export type EnrollmentMigrateGrantOption = {
  id: string;
  name?: string;
  code?: string;
  budget?: { lineItems?: Array<{ id: string; name?: string; label?: string }> };
};

type Defaults = Partial<{
  toGrantId: string;
  cutoverDate: ISODate;
  lineItemMap: Record<string, string>;
  moveSpends: boolean;
  moveAssessments: boolean;
  preserveAssessmentIds: boolean;
  rebuildScheduleMeta: boolean;
  closeSourceTaskMode: "complete" | "delete";
  closeSourcePaymentMode: "spendUnpaid" | "deleteUnpaid" | "keep";
}>;

type ConfirmPayload = {
  toGrantId: string;
  cutoverDate: ISODate;
  lineItemMap: Record<string, string>;
  moveSpends: boolean;
  moveAssessments: boolean;
  preserveAssessmentIds: boolean;
  rebuildScheduleMeta: boolean;
  migratePaid: boolean;
  closeSourceTaskMode: "complete" | "delete";
  closeSourcePaymentMode: "spendUnpaid" | "deleteUnpaid" | "keep";
};

// ─── Pure UI (internal) ───────────────────────────────────────────────────────

function EnrollmentMigrateDialogUI({
  open,
  enrollmentLabel,
  sourceLineItems,
  grants,
  defaults,
  confirmDisabled = false,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  enrollmentLabel: string;
  sourceLineItems: SourceLineItem[];
  grants: EnrollmentMigrateGrantOption[];
  defaults?: Defaults;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (opts: ConfirmPayload) => void;
}) {
  const today10 = React.useMemo(
    () => toISODate(new Date()) as ISODate,
    [],
  );

  const [toGrantId, setToGrantId] = React.useState<string>(defaults?.toGrantId ?? "");
  const [cutoverDate, setCutoverDate] = React.useState<ISODate>(
    (defaults?.cutoverDate ?? today10) as ISODate,
  );

  const [moveSpends, setMoveSpends] = React.useState<boolean>(defaults?.moveSpends ?? true);
  const [moveAssessments, setMoveAssessments] = React.useState<boolean>(defaults?.moveAssessments ?? true);
  const [preserveAssessmentIds, setPreserveAssessmentIds] = React.useState<boolean>(
    defaults?.preserveAssessmentIds ?? false,
  );
  const [rebuildScheduleMeta, setRebuildScheduleMeta] = React.useState<boolean>(
    defaults?.rebuildScheduleMeta ?? true,
  );
  const [closeSourceTaskMode, setCloseSourceTaskMode] = React.useState<"complete" | "delete">(
    defaults?.closeSourceTaskMode ?? "complete",
  );
  const [closeSourcePaymentMode, setCloseSourcePaymentMode] = React.useState<"spendUnpaid" | "deleteUnpaid" | "keep">(
    defaults?.closeSourcePaymentMode ?? "deleteUnpaid",
  );

  const [migratePaidChoice, setMigratePaidChoice] = React.useState<"" | "yes" | "no">("");

  const destGrant = React.useMemo(
    () => grants.find((g) => String(g.id) === String(toGrantId)) || null,
    [toGrantId, grants],
  );

  const destLineItems = React.useMemo(
    () =>
      Array.isArray(destGrant?.budget?.lineItems)
        ? (destGrant!.budget!.lineItems as NonNullable<EnrollmentMigrateGrantOption["budget"]>["lineItems"])
        : [],
    [destGrant],
  );

  const destLineItemIdSet = React.useMemo(() => {
    return new Set((destLineItems ?? []).map((li: { id: string }) => String(li.id)));
  }, [destLineItems]);

  const identityMap = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of sourceLineItems || []) {
      const sid = String(s.id);
      map[sid] = destLineItemIdSet.has(sid) ? sid : "";
    }
    return map;
  }, [sourceLineItems, destLineItemIdSet]);

  const normalizeMap = React.useCallback(
    (incoming?: Record<string, string> | null): Record<string, string> => {
      const base = incoming && typeof incoming === "object" ? incoming : {};
      const out: Record<string, string> = {};

      for (const s of sourceLineItems || []) {
        const sid = String(s.id);
        const desired = String((base as any)[sid] ?? identityMap[sid] ?? "");
        out[sid] = destLineItemIdSet.has(desired) ? desired : "";
      }

      return out;
    },
    [sourceLineItems, identityMap, destLineItemIdSet],
  );

  const [liMap, setLiMap] = React.useState<Record<string, string>>(() =>
    normalizeMap(defaults?.lineItemMap ?? identityMap),
  );

  const [jsonText, setJsonText] = React.useState<string>(() =>
    JSON.stringify(normalizeMap(defaults?.lineItemMap ?? identityMap), null, 2),
  );
  const [jsonError, setJsonError] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;

    setToGrantId(defaults?.toGrantId ?? "");
    setCutoverDate(((defaults?.cutoverDate ?? today10) as ISODate) || today10);

    setMoveSpends(defaults?.moveSpends ?? true);
    setMoveAssessments(defaults?.moveAssessments ?? true);
    setPreserveAssessmentIds(defaults?.preserveAssessmentIds ?? false);
    setRebuildScheduleMeta(defaults?.rebuildScheduleMeta ?? true);
    setCloseSourceTaskMode(defaults?.closeSourceTaskMode ?? "complete");
    setCloseSourcePaymentMode(defaults?.closeSourcePaymentMode ?? "deleteUnpaid");

    setMigratePaidChoice("");
    setJsonError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    defaults?.toGrantId,
    defaults?.cutoverDate,
    defaults?.moveSpends,
    defaults?.moveAssessments,
    defaults?.preserveAssessmentIds,
    defaults?.rebuildScheduleMeta,
    defaults?.closeSourceTaskMode,
    defaults?.closeSourcePaymentMode,
    today10,
  ]);

  React.useEffect(() => {
    if (!open) return;
    const base = normalizeMap(defaults?.lineItemMap ?? identityMap);
    setLiMap(base);
    setJsonText(JSON.stringify(base, null, 2));
    setJsonError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, toGrantId, identityMap, normalizeMap]);

  React.useEffect(() => {
    setJsonText(JSON.stringify(liMap, null, 2));
  }, [liMap]);

  function updateMap(srcId: string, destId: string) {
    const sid = String(srcId);
    const did = String(destId || "");
    setLiMap((prev) => {
      const next = { ...prev, [sid]: destLineItemIdSet.has(did) ? did : "" };
      return next;
    });
  }

  function applyJsonMapping() {
    try {
      const obj = JSON.parse(jsonText || "{}");
      if (!obj || typeof obj !== "object") throw new Error('JSON must be an object: { "srcId": "destId" }');
      const clean: Record<string, string> = {};
      for (const k of Object.keys(obj)) clean[String(k)] = String((obj as any)[k]);
      const next = normalizeMap(clean);
      setLiMap(next);
      setJsonError("");
    } catch (e: any) {
      setJsonError(e?.message || "Invalid JSON");
    }
  }

  const hasAllMappings =
    !!toGrantId &&
    (sourceLineItems || []).length > 0 &&
    (sourceLineItems || []).every((s) => {
      const v = liMap[String(s.id)];
      return !!v && destLineItemIdSet.has(String(v));
    });

  const locked = confirmDisabled;
  const canSubmit =
    !!toGrantId &&
    !!cutoverDate &&
    migratePaidChoice !== "" &&
    (sourceLineItems?.length ? hasAllMappings : true) &&
    !jsonError &&
    !locked;

  return (
    <Modal
      isOpen={open}
      title={`Migrate enrollment — ${enrollmentLabel}`}
      onClose={onCancel}
      onBeforeClose={() => true}
      widthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-secondary btn-sm" onClick={onCancel} disabled={locked}>
            Cancel
          </button>
          <button
            className="btn btn-sm disabled:opacity-50"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm({
                toGrantId,
                cutoverDate: String(cutoverDate).slice(0, 10) as ISODate,
                lineItemMap: liMap,
                moveSpends,
                moveAssessments,
                preserveAssessmentIds,
                rebuildScheduleMeta,
                migratePaid: migratePaidChoice === "yes",
                closeSourceTaskMode,
                closeSourcePaymentMode,
              });
            }}
            title={
              !toGrantId
                ? "Select a destination grant."
                : migratePaidChoice === ""
                ? "Choose whether to migrate paid items."
                : sourceLineItems?.length && !hasAllMappings
                ? "Map all source line items."
                : jsonError
                ? "Fix JSON mapping errors."
                : undefined
            }
          >
            {confirmLabel || "Migrate"}
          </button>
        </div>
      }
    >
      <div className="relative space-y-5 text-sm">
        {locked ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/80 backdrop-blur-[1px]">
            <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              Migrating enrollment...
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-0.5 text-slate-600">To grant</div>
            <select
              className="w-full rounded border px-2 py-1"
              value={toGrantId}
              onChange={(e) => setToGrantId(e.currentTarget.value)}
              disabled={locked}
            >
              <option value="">Select…</option>
              {(grants || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || g.code || g.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-0.5 text-slate-600">Cutover date (inclusive)</div>
            <input
              type="date"
              className="w-full rounded border px-2 py-1"
              value={cutoverDate ?? ""}
              onChange={(e) => setCutoverDate((e.currentTarget.value || today10) as ISODate)}
              disabled={locked}
            />
          </label>
        </div>

        {/* REQUIRED: migrate paid items? */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Paid items</div>
          <div className="mb-2 text-slate-600">
            Do you also want to migrate already-paid items <b>on/after</b> the cutover date?
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="migratePaid"
                checked={migratePaidChoice === "yes"}
                onChange={() => setMigratePaidChoice("yes")}
                disabled={locked}
              />
              <span>Yes — reverse on source and recreate on destination</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="migratePaid"
                checked={migratePaidChoice === "no"}
                onChange={() => setMigratePaidChoice("no")}
                disabled={locked}
              />
              <span>No — keep paid items on the original grant</span>
            </label>
          </div>

          {migratePaidChoice === "" && (
            <div className="mt-2 text-xs text-red-600">
              You must choose Yes or No before migrating.
            </div>
          )}
        </div>

        {/* Options */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Options</div>

          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={moveSpends}
              onChange={(e) => setMoveSpends(e.currentTarget.checked)}
              disabled={locked}
            />
            <span>Move future spends (ledger rows) on/after cutover</span>
          </label>

          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={moveAssessments}
              onChange={(e) => setMoveAssessments(e.currentTarget.checked)}
              disabled={locked}
            />
            <span>Move future tasks on/after cutover</span>
          </label>

          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={preserveAssessmentIds}
              onChange={(e) => setPreserveAssessmentIds(e.currentTarget.checked)}
              disabled={locked}
            />
            <span>Preserve task IDs (advanced)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rebuildScheduleMeta}
              onChange={(e) => setRebuildScheduleMeta(e.currentTarget.checked)}
              disabled={locked}
            />
            <span>Rebuild schedule meta for destination</span>
          </label>
        </div>

        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Source close policy (at cutover)</div>
          <div className="mb-2 text-xs text-slate-600">
            Applies when source enrollment is closed at the cutover date. If source still has payments after cutover, migration close will be blocked.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-0.5 text-slate-600">Future tasks after cutover</div>
              <select
                className="w-full rounded border px-2 py-1"
                value={closeSourceTaskMode}
                onChange={(e) => setCloseSourceTaskMode(e.currentTarget.value as "complete" | "delete")}
                disabled={locked}
              >
                <option value="complete">Close completed (mark done)</option>
                <option value="delete">Close delete (remove future tasks)</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-0.5 text-slate-600">Future projections after cutover</div>
              <select
                className="w-full rounded border px-2 py-1"
                value={closeSourcePaymentMode}
                onChange={(e) =>
                  setCloseSourcePaymentMode(e.currentTarget.value as "spendUnpaid" | "deleteUnpaid" | "keep")
                }
                disabled={locked}
              >
                <option value="spendUnpaid">Close projection paid (run spend)</option>
                <option value="deleteUnpaid">Close projections unpaid (delete future projections)</option>
                <option value="keep">Keep remaining source payments</option>
              </select>
            </label>
          </div>

          {closeSourcePaymentMode === "spendUnpaid" ? (
            <div className="mt-2 text-xs text-amber-700">
              Migration usually moves future unpaid projections to the destination. Source &quot;run spend&quot; is only relevant if unpaid projections remain on source.
            </div>
          ) : null}
        </div>

        {/* Line item mapping */}
        <div className="rounded border p-3">
          <div className="mb-2 font-medium">Line item mapping</div>
          <div className="mb-2 text-xs text-slate-600">
            Map source line items to destination line items. Defaults to same IDs when available.
          </div>

          <div className="max-h-44 overflow-auto rounded border divide-y">
            {sourceLineItems.length === 0 ? (
              <div className="px-2 py-2 text-slate-500">No source line items detected.</div>
            ) : (
              sourceLineItems.map((src) => {
                const sid = String(src.id);
                const destId = liMap[sid] ?? "";
                const missing = !!toGrantId && (!destId || !destLineItemIdSet.has(String(destId)));

                return (
                  <div key={sid} className="flex items-center justify-between gap-3 px-2 py-1.5">
                    <div className="min-w-0 truncate">
                      <div className="font-medium">{src.label || sid}</div>
                      <div className="text-xs text-slate-500">{sid}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        className={[
                          "min-w-[14rem] rounded border px-2 py-1",
                          missing ? "border-red-300" : "border-slate-200",
                        ].join(" ")}
                        value={destId}
                        onChange={(e) => updateMap(sid, e.currentTarget.value)}
                        disabled={!toGrantId || locked}
                        title={!toGrantId ? "Select destination grant first" : undefined}
                      >
                        <option value="">
                          {toGrantId ? "Select destination line item…" : "Select grant first"}
                        </option>
                        {(destLineItems ?? []).map((li: { id: string; name?: string; label?: string }) => (
                          <option key={li.id} value={li.id}>
                            {li.name || li.label || li.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer select-none text-slate-700">
              Advanced: edit JSON
            </summary>

            <textarea
              className="mt-2 w-full rounded border px-2 py-1 font-mono text-xs"
              rows={6}
              value={jsonText}
              onChange={(e) => setJsonText(e.currentTarget.value)}
              placeholder='{"oldLineItemId":"newLineItemId"}'
              disabled={locked}
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Only keys matching source line item IDs will be used. Invalid destination IDs are cleared.
              </div>
              <button className="btn-secondary" type="button" onClick={applyJsonMapping} disabled={locked}>
                Apply JSON
              </button>
            </div>

            {jsonError && <div className="mt-1 text-xs text-red-600">{jsonError}</div>}
          </details>

          {!!toGrantId && sourceLineItems.length > 0 && !hasAllMappings && (
            <div className="mt-2 text-xs text-red-600">
              Please map all source line items to destination line items.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Connected component ──────────────────────────────────────────────────────

export function EnrollmentMigrateDialog({
  open,
  enrollment,
  grants,
  onClose,
  onDone,
}: {
  open: boolean;
  enrollment: Enrollment | null;
  grants: Array<
    EnrollmentMigrateGrantOption & {
      status?: string;
      budget?: { lineItems?: Array<{ id: string; name?: string; label?: string } & Record<string, unknown>> | null } | null;
    }
  >;
  onClose: () => void;
  onDone: () => void;
}) {
  const migrateMutation = useMigrateEnrollment();

  const sourceLineItems = React.useMemo(() => {
    const payments = Array.isArray(enrollment?.payments) ? enrollment.payments : [];
    const map = new Map<string, { id: string; label: string }>();
    for (const p of payments) {
      const id = String((p as Record<string, unknown>)?.lineItemId || "").trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, { id, label: id });
    }
    return Array.from(map.values());
  }, [enrollment]);

  const grantOptions = React.useMemo<EnrollmentMigrateGrantOption[]>(
    () =>
      (grants || [])
        .filter((g) => String(g.status || "").toLowerCase() !== "deleted")
        .map((g) => ({
          id: String(g.id || ""),
          name: g.name ? String(g.name) : undefined,
          code: g.code ? String(g.code) : undefined,
          budget: {
            lineItems: Array.isArray(g?.budget?.lineItems)
              ? g.budget.lineItems.map((li) => ({
                  id: String(li.id || ""),
                  ...(li.name ? { name: String(li.name) } : {}),
                  ...(li.label ? { label: String(li.label) } : {}),
                }))
              : [],
          },
        })),
    [grants],
  );

  return (
    <EnrollmentMigrateDialogUI
      open={open && !!enrollment}
      enrollmentLabel={formatEnrollmentLabel(enrollment, { fallback: String(enrollment?.id || "") })}
      sourceLineItems={sourceLineItems}
      grants={grantOptions}
      defaults={{
        toGrantId: "",
        cutoverDate: toISODate(new Date()) as ISODate,
        moveSpends: true,
        moveAssessments: true,
        preserveAssessmentIds: false,
        rebuildScheduleMeta: true,
        closeSourceTaskMode: "complete",
        closeSourcePaymentMode: "deleteUnpaid",
      }}
      confirmDisabled={migrateMutation.isPending}
      confirmLabel={migrateMutation.isPending ? "Migrating..." : "Migrate"}
      onCancel={onClose}
      onConfirm={(opts) => {
        if (!enrollment || migrateMutation.isPending) return;
        const body = {
          enrollmentId: enrollment.id,
          toGrantId: opts.toGrantId,
          cutoverDate: String(opts.cutoverDate).slice(0, 10),
          lineItemMap: opts.lineItemMap,
          moveSpends: opts.moveSpends,
          moveTasks: opts.moveAssessments,
          preserveTaskIds: opts.preserveAssessmentIds,
          closeSource: true,
          movePaidPayments: opts.migratePaid,
          rebuildScheduleMeta: opts.rebuildScheduleMeta,
          closeSourceTaskMode: opts.closeSourceTaskMode,
          closeSourcePaymentMode: opts.closeSourcePaymentMode,
        } as EnrollmentsMigrateReq & {
          closeSourceTaskMode?: "complete" | "delete";
          closeSourcePaymentMode?: "spendUnpaid" | "deleteUnpaid" | "keep";
        };
        migrateMutation.mutate(
          { ...body, customerId: String(enrollment.customerId || "") } as EnrollmentsMigrateReq,
          {
            onSuccess: () => {
              toast("Enrollment migrated.", { type: "success" });
              onDone();
              onClose();
            },
            onError: (e: unknown) => {
              toast(toApiError(e).error, { type: "error" });
            },
          },
        );
      }}
    />
  );
}

export default EnrollmentMigrateDialog;
