// src/features/grants/GrantModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { qk } from "@hooks/queryKeys";
import {
  useGrants,
  useGrant,
  useFetchGrantById,
  useUpsertGrants,
  usePatchGrants,
  useDeleteGrants,
  useAdminDeleteGrants,
} from "@hooks/useGrants";
import { useEnrollments } from "@hooks/useEnrollments";
import { useTasksAdminRegenerateForGrant } from "@hooks/useTasks";
import { Modal } from "@entities/ui/Modal";
import { META_KEYS } from "@entities/ui/DynamicFormFields";
import { TasksGrantRegenDialog } from "@entities/dialogs/tasks/TasksGrantRegenDialog";
import { toast } from "@lib/toast";
import { noUndefined } from "@lib/safeData";
import { parseISO10, safeISODate10, toISODate } from "@lib/date";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { isAdminLike, isViewerLike } from "@lib/roles";
import { toApiError } from "@client/api";
import type { TGrant as Grant, ISODate } from "@types";
import { DetailsTab, ConfigTab, BudgetActivityTab, TasksTab, AssessmentsTab, AllocationTab, AdminTab } from "./tabs";
import { useTogglePinnedGrant, usePinnedGrantIds } from "./PinnedGrantCards";
import { useTogglePinnedItem, usePinnedItems } from "@entities/pinned/PinnedItemsSection";
import { GrantAdminMenu } from "./GrantAdminMenu";
import { getGrantFinancialVisibility, shouldRetainBudgetForGrantForm } from "./financialVisibility";
import { GrantDigestSubscribeButton } from "./GrantDigestSubscribeButton";

const num = (n: unknown, fallback = 0) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
};

const DEFAULT_FINANCIAL_CONFIG = {
  grant: {
    model: "budgeted",
    budgetEnabled: true,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: true,
    ledgerMode: "spendDown",
  },
  program: {
    model: "serviceOnly",
    budgetEnabled: false,
    billingEnabled: false,
    allocationEnabled: false,
    ledgerEnabled: false,
    ledgerMode: "none",
  },
} as const;

const currency = (x: number) => fmtCurrencyUSD(x);

function toCents(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

const toISOOrEmpty = (x: unknown): ISODate | "" => {
  if (!x) return "";
  if (typeof x === "string") {
    const d = parseISO10(x) ?? new Date(x);
    return Number.isNaN(d.getTime()) ? "" : toISODate(d);
  }
  if (x instanceof Date || typeof x === "number")
    return toISODate(x as Date | number);
  if (
    typeof x === "object" &&
    x &&
    "toMillis" in x &&
    typeof (x as { toMillis?: unknown }).toMillis === "function"
  ) {
    return toISODate((x as { toMillis: () => number }).toMillis());
  }
  return "";
};

const normalizeGrantForForm = (g: Partial<Grant>) => ({
  ...g,
  startDate: toISOOrEmpty(g.startDate),
  endDate: toISOOrEmpty(g.endDate),
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function seedFinancialConfigForEdit(grant: Partial<Grant> | Record<string, unknown>) {
  const next = deepClone((grant || {}) as Record<string, unknown>);
  if (!isPlainObject(next.financialConfig)) {
    next.financialConfig = getGrantFinancialVisibility(next as Partial<Grant>).capabilities.config;
  }
  if (
    shouldRetainBudgetForGrantForm(next as Partial<Grant>) &&
    !isPlainObject(next.budget)
  ) {
    next.budget = { total: 0, lineItems: [] };
  }
  return next;
}

function recomputeBudgetTotals(budget: unknown) {
  const b = deepClone((budget || {}) as Record<string, unknown>);
  const total = num((b.total as unknown) ?? (b.startAmount as unknown), 0);
  const lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
  const normalized = lineItems.map((it) => {
    const item = (it || {}) as Record<string, unknown>;
    return {
      ...item,
      spent: num(item.spent, 0),
      projected: num(item.projected, num(item.future, 0)),
    };
  });
  const totalCents = toCents(total);
  const spentCents = normalized.reduce(
    (acc, it) => acc + toCents((it as { spent?: unknown }).spent),
    0,
  );
  const projectedCents = normalized.reduce(
    (acc, it) => acc + toCents((it as { projected?: unknown }).projected),
    0,
  );
  const spent = fromCents(spentCents);
  const projected = fromCents(projectedCents);

  return {
    ...b,
    total: fromCents(totalCents),
    lineItems: normalized,
    totals: {
      ...((b.totals || {}) as Record<string, unknown>),
      spent,
      projected,
      balance: fromCents(totalCents - spentCents),
      projectedBalance: fromCents(totalCents - spentCents - projectedCents),
    },
  };
}

function sanitizeBudgetForWrite(budget: unknown) {
  const b = deepClone((budget || {}) as Record<string, unknown>);
  delete b.createdAt;
  delete b.updatedAt;
  if (b.totals && typeof b.totals === "object") {
    delete (b.totals as Record<string, unknown>).spent;
  }
  return b;
}

function deriveBudget(budget: unknown) {
  const b = (budget || {}) as Record<string, unknown>;
  const lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
  const total = num(b.total ?? b.startAmount, 0);
  const spent = num(
    (b.totals as Record<string, unknown> | undefined)?.spent,
    0,
  );
  const projected = num(
    (b.totals as Record<string, unknown> | undefined)?.projected,
    0,
  );
  return {
    total,
    spent,
    projected,
    balance: fromCents(toCents(total) - toCents(spent)),
    projectedBalance: fromCents(toCents(total) - toCents(spent) - toCents(projected)),
    lineItems,
  };
}

const stripId = (obj: Record<string, unknown>) => {
  const next = deepClone(obj);
  delete (next as Record<string, unknown>).id;
  return next;
};

const stripIdsAndMeta = (obj: Record<string, unknown>) => {
  const clone = deepClone(obj);
  delete (clone as Record<string, unknown>).id;
  delete (clone as Record<string, unknown>).createdAt;
  delete (clone as Record<string, unknown>).updatedAt;
  delete (clone as Record<string, unknown>).deleted;
  delete (clone as Record<string, unknown>).orgId;
  return clone;
};

const stripServerManagedForWrite = (obj: Record<string, unknown>) => {
  const out = deepClone(obj);
  delete out.id;
  delete out.createdAt;
  delete out.updatedAt;
  delete out.deleted;
  delete out.orgId;
  return out;
};

const isReservedRouteId = (value: unknown) => {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
};

const pickNonMeta = (obj: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (META_KEYS.has(k)) continue;
    if (k === "budget" || k === "assessments" || k === "tasks" || k === "invoicing") continue;
    if (k === "orgId" || k === "kind" || k === "deleted") continue;
    if (
      k === "tags" ||
      k === "linking" ||
      k === "eligibility" ||
      k === "lengthOfAssistance" ||
      k === "invoiceDocuments" ||
      k === "levelOfAssistance" ||
      k === "Invoice Docs" ||
      k === "Invoice Documents" ||
      k === "Level of Assistance" ||
      k === "Maximum Length of Assistance"
    ) continue;
    out[k] = v;
  }
  return out;
};

const OPTIONAL_UNSET_FIELDS = [
  "description",
  "eligibility",
  "levelOfAssistance",
  "invoiceDocuments",
  "lengthOfAssistance",
  "maxLengthOfAssistance",
  "maximumLengthOfAssistance",
  "servicesOffered",
  "tags",
  "invoicing",
  "linking",
] as const;

function isEmptyOptionalValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isEmptyOptionalValue);
  }
  return false;
}

function cleanOptionalUnsetFields(
  updates: Record<string, unknown>,
  previous: Record<string, unknown> | null | undefined,
) {
  const unset = new Set<string>();
  for (const field of OPTIONAL_UNSET_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
    if (!isEmptyOptionalValue(updates[field])) continue;
    delete updates[field];
    if (previous && Object.prototype.hasOwnProperty.call(previous, field)) {
      unset.add(field);
    }
  }
  return Array.from(unset);
}

const grantKindOf = (row: Record<string, unknown>): "grant" | "program" => {
  const explicit = String(row?.kind || "").toLowerCase();
  if (explicit === "program") return "program";
  if (explicit === "grant") return "grant";
  const total = Number(
    (row?.budget as Record<string, unknown> | undefined)?.total ??
      (row?.budget as Record<string, unknown> | undefined)?.startAmount ??
      0,
  );
  return total <= 0 ? "program" : "grant";
};

type GrantTab = "details" | "config" | "budget" | "tasks" | "assessments" | "allocation" | "admin";

const tabFromQuery = (tab: string | null): GrantTab => {
  if (tab === "config") return "config";
  if (tab === "budget" || tab === "activity") return "budget";
  if (tab === "tasks") return "tasks";
  if (tab === "assessments") return "assessments";
  if (tab === "allocation") return "allocation";
  if (tab === "admin") return "admin";
  return "details";
};

type Props = {
  grantId: string | null;
  onClose: () => void;
  initialCreateData?: Partial<Grant>;
  canAdminDelete?: boolean;
  pageMode?: boolean;
  /** Called with the new grant ID after creation, instead of navigating to Budget. */
  onCreated?: (id: string) => void;
};

const STATUS_OPTS = ["active", "draft", "closed"] as const;

/**
 * GrantDetailModal — grant/program detail + edit surface
 * (Details, Config, Budget & Activity, Allocation, Tasks, Assessments, Admin tabs).
 *
 * ── MOUNTING ──────────────────────────────────────────────────────────────────
 * This component is NOT opened directly anywhere in the app shell. It is always
 * rendered through GrantWorkspaceModal (in `pageMode`) — the surface actually
 * opened from the Budget/Programs pages, pinned grant cards, RentalAssistanceTool,
 * and the intercepting /grants/[grantId] route — plus the full-page
 * /grants/[grantId] route. The standalone <Modal> branch below is effectively
 * legacy and is not the live surface.
 *
 * NEW grant/program CREATION does not use this component at all: it uses
 * creation/NewGrantProgramFlow (the multi-step "grant workspace" builder that
 * GrantWorkspaceModal renders when grantId is null/"new").
 *
 * ⚠️ KEEP THE TWO IN SYNC: any config control added to the tabs here
 * (e.g. Tags, Links, Line item / Invoice config) must be mirrored into
 * creation/NewGrantProgramFlow so the create path stays equivalent.
 */
export default function GrantDetailModal({
  grantId,
  onClose,
  initialCreateData = {},
  canAdminDelete = true,
  pageMode = false,
  onCreated,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchId =
    typeof grantId === "string" &&
    !isReservedRouteId(grantId) &&
    grantId !== "undefined"
      ? grantId
      : undefined;
  const isCreate = !fetchId;
  const requestedKind = searchParams.get("kind");
  const requestedPreset = searchParams.get("preset");
  const { profile } = useAuth();

  const qc = useQueryClient();

  const { data: grant, isLoading: loadingGrant } = useGrant(fetchId, {
    enabled: !!fetchId,
  });
  const { data: activeGrants = [] } = useGrants(
    { active: true, limit: 200 },
    { enabled: true },
  );
  const { data: inactiveGrants = [] } = useGrants(
    { active: false, limit: 200 },
    { enabled: true },
  );
  const allGrants: Grant[] = useMemo(
    () => [...(activeGrants as Grant[]), ...(inactiveGrants as Grant[])],
    [activeGrants, inactiveGrants],
  );

  const { data: affectedEnrollments = [] } = useEnrollments(
    grant?.id ? { grantId: grant.id, active: true, limit: 500 } : undefined,
    { enabled: !!grant?.id },
  );

  const upsert = useUpsertGrants();
  const patch = usePatchGrants();
  const softDel = useDeleteGrants();
  const hardDel = useAdminDeleteGrants();
  const fetchGrantById = useFetchGrantById();
  const regenTasks = useTasksAdminRegenerateForGrant();

  const [editing, setEditing] = useState<boolean>(isCreate);
  const [model, setModel] = useState<Record<string, unknown>>(() =>
    isCreate
      ? {
          name: "",
          startDate: "",
          endDate: "",
          status: "draft",
          active: false,
          kind: requestedKind === "program" ? "program" : "grant",
          financialConfig:
            requestedKind === "program"
              ? DEFAULT_FINANCIAL_CONFIG.program
              : DEFAULT_FINANCIAL_CONFIG.grant,
          ...(requestedKind === "program" ? { budget: { total: 0, lineItems: [] } } : {}),
          ...(requestedPreset === "credit-card"
            ? {
                budget: {
                  total: 0,
                  lineItems: [
                    {
                      id: `cc_${Date.now().toString(36)}`,
                      label: "Credit Card",
                      cardName: "New Card",
                      last4: "",
                      amount: 0,
                      spent: 0,
                      projected: 0,
                      type: null,
                    },
                  ],
                },
              }
            : {}),
          ...initialCreateData,
        }
      : {},
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [kindDialogOpen, setKindDialogOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<"grant" | "program" | null>(null);
  useEffect(() => {
    if (isCreate || !grant || editing) return;
    const next = deepClone(normalizeGrantForForm(grant));
    setModel((prev) => {
      const prevJson = JSON.stringify(prev || {});
      const nextJson = JSON.stringify(next || {});
      return prevJson === nextJson ? prev : next;
    });
  }, [isCreate, grant, editing]);

  const derived = useMemo(
    () => deriveBudget((editing ? model : grant)?.budget),
    [editing, model, grant],
  );
  const currentKind = useMemo(
    () => grantKindOf((isCreate ? model : (grant as Record<string, unknown> | null)) || model),
    [isCreate, model, grant],
  );
  const financialVisibility = useMemo(
    () => getGrantFinancialVisibility((editing ? model : grant) as Partial<Grant> | null | undefined),
    [editing, model, grant],
  );
  const showBudgetTab =
    financialVisibility.showBudgetEditor ||
    financialVisibility.showBillingActivity ||
    financialVisibility.showLedgerActivity;

  // Show allocation tab when the grant/budget has allocationEnabled, or any line item has capEnabled
  const showAllocationTab = React.useMemo(() => {
    const b = (editing ? model : grant)?.budget as Record<string, unknown> | undefined;
    if (financialVisibility.showAllocation) return true;
    if (!b) return false;
    const lineItems = Array.isArray(b.lineItems) ? b.lineItems as Record<string, unknown>[] : [];
    return lineItems.some((li) => li.capEnabled === true);
  }, [editing, financialVisibility.showAllocation, model, grant]);
  const roleProfile = profile as { topRole?: unknown; role?: unknown; roles?: unknown } | null;
  const isViewer = isViewerLike(roleProfile);
  const isAdminRole = isAdminLike(roleProfile);
  const canEditGrant = !isViewer;
  const canEditKind = isAdminRole && !isViewer;
  const canUseAdminTools = !isCreate && !!fetchId && isAdminRole && !isViewer;

  const { data: pinnedIds = [] } = usePinnedGrantIds();
  const togglePin = useTogglePinnedGrant();
  const isPinned = fetchId ? pinnedIds.includes(fetchId) : false;
  const { data: dashPinnedItems = [] } = usePinnedItems();
  const toggleDashPin = useTogglePinnedItem();
  const isDashPinned = fetchId
    ? dashPinnedItems.some((x) => x.type === "grant" && x.id === fetchId)
    : false;

  const baseline = useMemo(
    () => JSON.stringify(isCreate ? { ...initialCreateData } : grant || {}),
    [isCreate, initialCreateData, grant],
  );
  const dirty = editing && baseline !== JSON.stringify(model);

  const affected = useMemo(
    () =>
      (affectedEnrollments || []).map((e) => {
        const row = e as Record<string, unknown>;
        const isoStart = toISOOrEmpty(row.startDate);
        return {
          enrollmentId: String(row.id || ""),
          clientName: String(
            row.clientName || row.clientId || row.customerId || row.id || "",
          ),
          startDate: isoStart || null,
        };
      }),
    [affectedEnrollments],
  );

  const requestClose = async () => {
    if (!dirty || savedOnce) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  };

  const saveDisabled = !String(model?.name ?? "").trim();

  const toggleEditing = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    setModel((prev) => seedFinancialConfigForEdit(prev && Object.keys(prev).length ? prev : grant || {}));
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      if (!canEditGrant) return;
      if (saveDisabled) {
        toast("Name is required.", { type: "error" });
        return;
      }
      setSaving(true);

      const clean = stripServerManagedForWrite(stripId(model));
      const updates: Record<string, unknown> = {
        ...clean,
        startDate: safeISODate10(clean.startDate) || null,
        endDate: safeISODate10(clean.endDate) || null,
      };
      if (!canEditKind && !isCreate && grant?.kind) {
        updates.kind = grant.kind;
      }
      const unset = isCreate
        ? []
        : cleanOptionalUnsetFields(updates, grant as Record<string, unknown> | null | undefined);

      const budget = recomputeBudgetTotals(updates.budget);
      if (!shouldRetainBudgetForGrantForm(updates as Partial<Grant>)) {
        updates.budget = sanitizeBudgetForWrite({ total: 0, lineItems: [] });
      } else {
        updates.budget = sanitizeBudgetForWrite(budget);
      }
      const safe = noUndefined(updates);

      if (isCreate) {
        const resp = await upsert.mutateAsync(safe as Grant);
        const createdId =
          resp && typeof resp === "object" && Array.isArray((resp as { ids?: unknown[] }).ids)
            ? String(((resp as { ids?: unknown[] }).ids || [])[0] || "").trim()
            : "";

        if (createdId) {
          qc.setQueryData(qk.grants.detail(createdId), (prev: unknown) =>
            prev && typeof prev === "object"
              ? { ...(safe as Record<string, unknown>), ...(prev as Record<string, unknown>), id: createdId }
              : { ...(safe as Record<string, unknown>), id: createdId }
          );
          await fetchGrantById(createdId).catch(() => null);
          if (onCreated) {
            onCreated(createdId);
          } else {
            router.replace(`/budget?grantId=${encodeURIComponent(createdId)}`);
          }
          return;
        }
      } else {
        await patch.mutateAsync({
          id: String(model.id),
          patch: safe,
          ...(unset.length ? { unset } : {}),
        });
      }

      toast("Grant saved successfully", { type: "success" });
      setSavedOnce(true);
      setEditing(false);
      onClose();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Persist budget changes made from view mode (line item config, add/move
  // funds, caps, locks). Edit mode keeps the explicit Save flow instead.
  const persistBudget = async (budget: unknown) => {
    if (!fetchId || !canEditGrant) return;
    try {
      const updates: Record<string, unknown> = {
        budget: sanitizeBudgetForWrite(recomputeBudgetTotals(budget)),
      };
      await patch.mutateAsync({ id: fetchId, patch: noUndefined(updates) });
      toast("Budget updated", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!canEditGrant) return;
    const id = String(grantId || model?.id || "");
    if (!id) return;
    if (!window.confirm("Delete this grant?")) return;
    try {
      setDeleting(true);
      await softDel.mutateAsync(id);
      toast("Grant deleted", { type: "success" });
      onClose();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!canUseAdminTools) return;
    const id = String(grantId || model?.id || "");
    if (!id) return;
    if (window.prompt("Type DELETE to confirm permanent delete") !== "DELETE")
      return;
    try {
      setDeleting(true);
      await hardDel.mutateAsync(id);
      toast("Grant permanently deleted", { type: "warn" });
      onClose();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  async function confirmGrantRegen(opts: {
    enrollmentIds: string[];
    mode: "replaceManaged" | "mergeManaged";
    keepManual: boolean;
    preserveCompletedManaged: boolean;
    pinCompletedManaged: boolean;
    startDate?: string | null;
    endDate?: string | null;
  }) {
    if (!canUseAdminTools) return;
    if (!opts.enrollmentIds.length) {
      toast("Select at least one enrollment.", { type: "error" });
      return;
    }
    const currentGrantId = String(grant?.id ?? model?.id ?? "");
    if (!currentGrantId) return;

    try {
      // Endpoint is grant-scoped today; enrollment/date UI inputs are forward-compatible.
      await regenTasks.mutateAsync({
        grantId: currentGrantId,
        mode: opts.mode,
        keepManual: opts.keepManual,
        preserveCompletedManaged: opts.preserveCompletedManaged,
        pinCompletedManaged: opts.pinCompletedManaged,
        activeOnly: true,
        pageSize: 200,
        dryRun: false,
      });
      toast("Managed tasks regenerated for this grant.", { type: "success" });
      setRegenOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.enrollments.root }),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
        qc.invalidateQueries({ queryKey: qk.grants.detail(currentGrantId) }),
      ]);
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  }

  const readInput = (e: React.ChangeEvent<HTMLInputElement>) =>
    e.currentTarget.value;
  const readSelect = (e: React.ChangeEvent<HTMLSelectElement>) =>
    e.currentTarget.value;
  const readChecked = (e: React.ChangeEvent<HTMLInputElement>) =>
    !!e.currentTarget.checked;
  const requestKindChange = (nextKind: "grant" | "program") => {
    if (!canEditKind) return;
    if (nextKind === currentKind) return;
    setPendingKind(nextKind);
    setKindDialogOpen(true);
  };
  const confirmKindChange = () => {
    if (!canEditKind) return;
    const nextKind = pendingKind;
    if (!nextKind) return;
    setModel((m) => {
      const nextModel = {
        ...m,
        kind: nextKind,
        financialConfig:
          m.financialConfig ??
          (nextKind === "program" ? DEFAULT_FINANCIAL_CONFIG.program : DEFAULT_FINANCIAL_CONFIG.grant),
      };
      return shouldRetainBudgetForGrantForm(nextModel as Partial<Grant>)
        ? nextModel
        : { ...nextModel, budget: { total: 0, lineItems: [] } };
    });
    setKindDialogOpen(false);
    setPendingKind(null);
  };

  // ── Pin dropdown state ────────────────────────────────────────────────────
  const [pinOpen, setPinOpen] = useState(false);
  const pinRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!pinOpen) return;
    function onDown(e: MouseEvent) {
      if (pinRef.current && !pinRef.current.contains(e.target as Node)) setPinOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pinOpen]);

  const pageLabel = currentKind === "program" ? "Programs Page" : "Grants Page";
  const anyPinned = isPinned || isDashPinned;

  const titleText = isCreate
    ? currentKind === "program" ? "New Program" : "New Grant"
    : editing
      ? `Edit: ${String(model.name || grant?.name || "(Unnamed)")}`
      : String(grant?.name || grant?.id || "Grant");
  const title = !isCreate && fetchId ? (
    <div className="flex min-w-0 items-center gap-3">
      <span className="truncate">{titleText}</span>
      <GrantDigestSubscribeButton grantId={fetchId} compact />
    </div>
  ) : titleText;

  const statusText = String(model?.status || grant?.status || "draft");
  const startText = String(model?.startDate || grant?.startDate || "");
  const endText = String(model?.endDate || grant?.endDate || "");

  const panel = (
    <>
      {pageMode ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-500">
                  {isCreate ? (currentKind === "program" ? "New Program" : "New Grant") : currentKind === "program" ? "Program" : "Grant"}
                </span>
                <span className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  {statusText}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {String(model?.name || grant?.name || (isCreate ? "Untitled Grant" : "Grant"))}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  Start: {fmtDateOrDash(startText)}
                </span>
                <span className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  End: {fmtDateOrDash(endText)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {editing
                  ? "Editing — changes apply across all tabs when you save."
                  : "Click Edit to make changes."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canUseAdminTools && fetchId && (
                <GrantAdminMenu grantId={fetchId} />
              )}
              {!isCreate && fetchId && (
                <div ref={pinRef} className="relative">
                  <button
                    type="button"
                    className={["btn btn-ghost btn-sm gap-1", anyPinned ? "text-amber-600" : ""].join(" ")}
                    onClick={() => setPinOpen((v) => !v)}
                  >
                    {anyPinned ? "★" : "☆"} Pin ▾
                  </button>
                  {pinOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-[14px] border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => { togglePin.mutate(fetchId); setPinOpen(false); }}
                      >
                        <span className={`text-base ${isPinned ? "text-amber-500" : "text-slate-300"}`}>{isPinned ? "★" : "☆"}</span>
                        <span className="flex-1 text-left text-slate-800 dark:text-slate-200">
                          {isPinned ? `Unpin from ${pageLabel}` : `Pin to ${pageLabel}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => { toggleDashPin.mutate({ type: "grant", id: fetchId }); setPinOpen(false); }}
                      >
                        <span className={`text-base ${isDashPinned ? "text-sky-500" : "text-slate-300"}`}>{isDashPinned ? "◆" : "◇"}</span>
                        <span className="flex-1 text-left text-slate-800 dark:text-slate-200">
                          {isDashPinned ? "Unpin from Metrics" : "Pin to Metrics"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!isCreate && canEditGrant && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={toggleEditing}
                >
                  {editing ? "Cancel" : "Edit"}
                </button>
              )}
              {editing && canEditGrant && (
                <button
                  className="btn btn-sm"
                  onClick={handleSave}
                  disabled={saveDisabled || saving}
                >
                  {saving ? "Saving..." : isCreate ? "Create" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {isCreate
              ? "Fill out details then Create."
              : "Click Edit to modify fields."}
          </div>
          <div className="flex items-center gap-2">
            {canUseAdminTools && fetchId && (
              <GrantAdminMenu grantId={fetchId} />
            )}
            {!isCreate && fetchId && (
              <div ref={pinRef} className="relative">
                <button
                  type="button"
                  className={["btn btn-ghost btn-sm gap-1 text-xs", anyPinned ? "text-amber-600" : ""].join(" ")}
                  onClick={() => setPinOpen((v) => !v)}
                  title="Pin options"
                >
                  {anyPinned ? "★" : "☆"} Pin ▾
                </button>
                {pinOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-[14px] border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => { togglePin.mutate(fetchId); setPinOpen(false); }}
                    >
                      <span className={`text-base ${isPinned ? "text-amber-500" : "text-slate-300"}`}>{isPinned ? "★" : "☆"}</span>
                      <span className="flex-1 text-left text-slate-800 dark:text-slate-200">
                        {isPinned ? `Unpin from ${pageLabel}` : `Pin to ${pageLabel}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => { toggleDashPin.mutate({ type: "grant", id: fetchId }); setPinOpen(false); }}
                    >
                      <span className={`text-base ${isDashPinned ? "text-sky-500" : "text-slate-300"}`}>{isDashPinned ? "◆" : "◇"}</span>
                      <span className="flex-1 text-left text-slate-800 dark:text-slate-200">
                        {isDashPinned ? "Unpin from Metrics" : "Pin to Metrics"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isCreate && canEditGrant && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleEditing}
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            )}
            {editing && canEditGrant && (
              <button
                className="btn btn-sm"
                onClick={handleSave}
                disabled={saveDisabled || saving}
              >
                {saving ? "Saving..." : isCreate ? "Create" : "Save"}
              </button>
            )}
          </div>
        </div>
      )}

      {isCreate && (
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-slate-600 dark:text-slate-300">Prefill from grant:</label>
          <select
            className="select"
            onChange={async (e) => {
              const prefillId = e.currentTarget.value;
              if (!prefillId) return;
              try {
                const source = await fetchGrantById(prefillId);
                if (!source) return;
                const stripped = stripIdsAndMeta(
                  source as Record<string, unknown>,
                );
                if (stripped.budget) {
                  const b = stripped.budget as Record<string, unknown>;
                  const lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
                  stripped.budget = {
                    ...b,
                    total: 0,
                    // Fresh line-item ids and zeroed activity: ledger rows
                    // reference lineItemId, so the copy must not inherit them.
                    lineItems: lineItems.map((li, index) => ({
                      ...((li || {}) as Record<string, unknown>),
                      id: `li_${Date.now().toString(36)}_${index + 1}`,
                      spent: 0,
                      projected: 0,
                    })),
                  };
                }
                setModel((prev) => ({ ...prev, ...stripped }));
                toast("Grant fields prefilled", { type: "success" });
              } catch (err) {
                toast(toApiError(err).error, { type: "error" });
              }
            }}
          >
            <option value="">Select grant</option>
            {allGrants.map((g) => (
              <option key={String(g.id)} value={String(g.id)}>
                {String(g.name || g.id)}
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingGrant && !isCreate && (
        <div className="text-sm text-slate-600 dark:text-slate-400">Loading grant...</div>
      )}

      {(isCreate || grant) && (
        <TabsRouter
          showBudgetTab={showBudgetTab}
          showAllocationTab={showAllocationTab}
          isAdmin={canUseAdminTools}
          pageMode={pageMode}
          editing={editing}
          model={model}
          setModel={setModel}
          grant={grant ?? null}
          grantId={fetchId}
          derived={derived}
          onOpenRegen={() => setRegenOpen(true)}
          affected={affected}
          readInput={readInput}
          readSelect={readSelect}
          readChecked={readChecked}
          canEditKind={canEditKind}
          onRequestKindChange={requestKindChange}
          currency={currency}
          STATUS_OPTS={STATUS_OPTS}
          financialCapabilities={financialVisibility.capabilities}
          allGrants={allGrants}
          canEditBudget={canEditGrant && !isCreate}
          onPersistBudget={persistBudget}
        />
      )}

      {!isCreate && editing && !pageMode && canEditGrant && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-red-700 dark:text-red-300">
              Delete removes from lists. Admin Delete is permanent.
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDelete}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              {canAdminDelete && (
                <button
                  className="btn btn-sm bg-red-600 hover:bg-red-700"
                  onClick={handleAdminDelete}
                >
                  {deleting ? "Deleting..." : "Admin Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <TasksGrantRegenDialog
        open={regenOpen}
        grantName={String(grant?.name || grant?.id || "Grant")}
        affected={affected}
        onCancel={() => setRegenOpen(false)}
        onConfirm={confirmGrantRegen}
        defaults={{
          mode: "replaceManaged",
          keepManual: true,
          preserveCompletedManaged: true,
          pinCompletedManaged: true,
        }}
      />

      <Modal
        isOpen={kindDialogOpen}
        onClose={() => {
          setKindDialogOpen(false);
          setPendingKind(null);
        }}
        onBeforeClose={() => true}
        title="Change Grant Kind?"
        widthClass="max-w-lg"
        footer={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setKindDialogOpen(false);
                setPendingKind(null);
              }}
            >
              Cancel
            </button>
            <button className="btn btn-sm" onClick={confirmKindChange}>
              Confirm Change
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-700">
          Changing kind to <b>{pendingKind || "-"}</b> may change budget behavior and reporting.
          Financial settings determine whether budget, billing, allocation, and ledger controls remain available.
        </div>
      </Modal>
    </>
  );

  if (pageMode) {
    return <section className="space-y-4">{panel}</section>;
  }

  return (
    <Modal
      isOpen={isCreate || !!grantId}
      onClose={onClose}
      onBeforeClose={requestClose}
      title={title}
      widthClass="max-w-5xl"
    >
      {panel}
    </Modal>
  );
}

function TabsRouter(props: {
  showBudgetTab: boolean;
  showAllocationTab: boolean;
  isAdmin?: boolean;
  pageMode?: boolean;
  editing: boolean;
  grantId?: string;
  model: Record<string, unknown>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  grant: Grant | null;
  derived: ReturnType<typeof deriveBudget>;
  onOpenRegen: () => void;
  affected: ReadonlyArray<{
    clientName: string;
    startDate: string | null;
    enrollmentId: string;
  }>;
  readInput: (e: React.ChangeEvent<HTMLInputElement>) => string;
  readSelect: (e: React.ChangeEvent<HTMLSelectElement>) => string;
  readChecked: (e: React.ChangeEvent<HTMLInputElement>) => boolean;
  canEditKind: boolean;
  onRequestKindChange: (nextKind: "grant" | "program") => void;
  currency: (n: number) => string;
  STATUS_OPTS: readonly string[];
  financialCapabilities: ReturnType<typeof getGrantFinancialVisibility>["capabilities"];
  allGrants: Grant[];
  canEditBudget: boolean;
  onPersistBudget: (budget: unknown) => Promise<void> | void;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<GrantTab>(tabFromQuery(searchParams.get("tab")));

  useEffect(() => {
    const next = tabFromQuery(searchParams.get("tab"));
    if (next === "budget" && !props.showBudgetTab) setTab("details");
    else if (next === "allocation" && !props.showAllocationTab) setTab("details");
    else if (next === "admin" && !props.isAdmin) setTab("details");
    else setTab(next);
  }, [searchParams, props.showBudgetTab, props.showAllocationTab, props.isAdmin]);

  const dynamicValue = useMemo(() => pickNonMeta(props.model), [props.model]);

  const TAB_LABELS: Record<GrantTab, string> = {
    details:     "Details",
    config:      "Config",
    budget:      "Budget & Activity",
    tasks:       "Tasks",
    assessments: "Assessments",
    allocation:  "Allocation",
    admin:       "Admin",
  };

  return (
    <>
      <div className="tabs mt-4" data-tour="grant-tabs">
        {(["details", "config", "budget", "allocation", "tasks", "assessments", "admin"] as const)
          .filter((t) => {
            if (t === "budget")     return props.showBudgetTab;
            if (t === "allocation") return props.showAllocationTab;
            if (t === "admin")      return !!props.isAdmin;
            return true;
          })
          .map((t) => (
            <button
              key={t}
              className={["tab", tab === t ? "tab-active" : "", t === "admin" ? "text-orange-600 dark:text-orange-400" : ""].join(" ")}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
      </div>

      {tab === "details" && (
        <DetailsTab
          editing={props.editing}
          model={props.model}
          setModel={props.setModel}
          grant={props.grant}
          pageMode={props.pageMode}
          dynamicValue={dynamicValue}
          readInput={props.readInput}
          readSelect={props.readSelect}
          canEditKind={props.canEditKind}
          onRequestKindChange={props.onRequestKindChange}
          STATUS_OPTS={props.STATUS_OPTS}
          derived={props.derived}
          showBudgetStrip={props.showBudgetTab}
          currency={props.currency}
        />
      )}

      {tab === "config" && (
        <ConfigTab
          editing={props.editing}
          model={props.model}
          setModel={props.setModel}
          grant={props.grant}
          allGrants={props.allGrants}
        />
      )}

      {tab === "budget" && props.showBudgetTab && (
        <BudgetActivityTab
          editing={props.editing}
          model={props.model}
          setModel={props.setModel}
          derived={props.derived}
          currency={props.currency}
          recomputeBudgetTotals={recomputeBudgetTotals}
          num={num}
          grantId={props.grantId}
          drawsDownBudget={props.financialCapabilities.drawsDownBudget}
          canManageBudget={!!props.isAdmin}
          canEditBudget={props.canEditBudget}
          onPersistBudget={props.onPersistBudget}
        />
      )}

      {tab === "tasks" && (
        <TasksTab
          editing={props.editing}
          model={props.model}
          setModel={props.setModel}
          grant={props.grant}
          onOpenRegen={props.onOpenRegen}
          affected={props.affected}
        />
      )}

      {tab === "assessments" && (
        <AssessmentsTab
          editing={props.editing}
          model={props.model}
          setModel={props.setModel}
          grant={props.grant}
          affected={props.affected}
        />
      )}

      {tab === "allocation" && props.grant?.id && (
        <AllocationTab
          grantId={String(props.grant.id)}
          perCustomerCap={(props.grant?.budget as Record<string, unknown> | undefined)?.perCustomerCap as number | null | undefined}
          lineItems={Array.isArray((props.grant?.budget as Record<string, unknown> | undefined)?.lineItems)
            ? ((props.grant?.budget as Record<string, unknown>).lineItems as any)
            : []}
        />
      )}

      {tab === "admin" && props.isAdmin && props.grantId && (
        <AdminTab
          grantId={props.grantId}
          grant={props.grant}
        />
      )}
    </>
  );
}
