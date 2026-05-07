import {randomUUID, timingSafeEqual} from "node:crypto";
import {
  db,
  FieldValue,
  SHEETS_BRIDGE_SHARED_SECRET,
  isoNow,
  removeUndefinedDeep,
  toUtcIso,
} from "../../core";
import {normalizeBudget} from "../grants/service";
import type {TGrantBudgetLineItem} from "../grants/schemas";
import {
  getPaymentQueueItem,
  listPaymentQueueItems,
  patchPaymentQueueItem,
  postPaymentQueueToLedger,
  reopenPaymentQueueItem,
} from "../paymentQueue/service";
import type {TPaymentQueueItem} from "../paymentQueue/schemas";
import type {
  TSheetsBridgeInterfaceId,
  TSheetsBridgePullQuery,
  TSheetsBridgePushBody,
  TSheetsBridgePushOperation,
  TSheetsGrantLineItemPatch,
  TSheetsGrantPatch,
} from "./schemas";

type GrantDoc = Record<string, unknown> & {
  id?: string;
  orgId?: string;
  name?: string;
  status?: string;
  active?: boolean;
  deleted?: boolean;
  kind?: string;
  duration?: string | null;
  startDate?: unknown;
  endDate?: unknown;
  updatedAt?: unknown;
  budget?: {
    total?: number;
    totals?: {
      total?: number;
      projected?: number;
      spent?: number;
      balance?: number;
      projectedBalance?: number;
      remaining?: number;
    } | null;
    lineItems?: Array<Record<string, unknown>>;
  } | null;
};

type ManifestColumn = {
  key: string;
  label: string;
  editable: boolean;
  required?: boolean;
  notes?: string;
};

function normalizeLineItemsForBudget(items: Array<Record<string, unknown>>): TGrantBudgetLineItem[] {
  return items.map((lineItem) => ({
    ...lineItem,
    id: str(lineItem.id) || randomUUID(),
    label: lineItem.label == null ? null : str(lineItem.label),
    amount: num(lineItem.amount),
    projected: num(lineItem.projected),
    spent: num(lineItem.spent),
    projectedInWindow: num(lineItem.projectedInWindow),
    spentInWindow: num(lineItem.spentInWindow),
    locked: boolOrNull(lineItem.locked),
    capEnabled: typeof lineItem.capEnabled === "boolean" ? lineItem.capEnabled : false,
    ...(lineItem.perCustomerCap != null ? {perCustomerCap: num(lineItem.perCustomerCap)} : {}),
  })) as TGrantBudgetLineItem[];
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableStr(value: unknown): string | null {
  const text = str(value);
  return text || null;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function iso(value: unknown): string | null {
  const parsed = toUtcIso(value as string | number | Date);
  if (parsed) return parsed;
  const raw = str(value);
  return raw || null;
}

function iso10(value: unknown): string | null {
  const parsed = iso(value);
  return parsed ? parsed.slice(0, 10) : null;
}

function safeSecretEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertSheetsBridgeSecret(candidate: string): void {
  const expected = str(SHEETS_BRIDGE_SHARED_SECRET.value());
  if (!expected) {
    const err = new Error("sheets_bridge_secret_not_configured") as Error & {code?: number};
    err.code = 500;
    throw err;
  }
  if (!candidate || !safeSecretEquals(candidate, expected)) {
    const err = new Error("forbidden") as Error & {code?: number};
    err.code = 403;
    throw err;
  }
}

function manifestColumns(): Record<TSheetsBridgeInterfaceId, ManifestColumn[]> {
  return {
    grants: [
      {key: "grantId", label: "Grant ID", editable: false, required: true},
      {key: "name", label: "Name", editable: true, required: true},
      {key: "status", label: "Status", editable: true},
      {key: "kind", label: "Kind", editable: true},
      {key: "duration", label: "Duration", editable: true},
      {key: "startDate", label: "Start Date", editable: true},
      {key: "endDate", label: "End Date", editable: true},
      {key: "budgetTotal", label: "Budget Total", editable: true},
      {key: "budgetProjected", label: "Budget Projected", editable: false},
      {key: "budgetSpent", label: "Budget Spent", editable: false},
      {key: "budgetBalance", label: "Budget Balance", editable: false},
      {key: "updatedAt", label: "Updated At", editable: false},
    ],
    grantLineItems: [
      {key: "grantId", label: "Grant ID", editable: false, required: true},
      {key: "grantName", label: "Grant Name", editable: false},
      {key: "lineItemId", label: "Line Item ID", editable: false, required: true},
      {key: "label", label: "Label", editable: true},
      {key: "amount", label: "Budget Amount", editable: true},
      {key: "projected", label: "Projected", editable: false},
      {key: "spent", label: "Spent", editable: false},
      {key: "locked", label: "Locked", editable: true},
      {key: "capEnabled", label: "Cap Enabled", editable: true},
      {key: "perCustomerCap", label: "Per Customer Cap", editable: true},
      {key: "grantStatus", label: "Grant Status", editable: false},
      {key: "updatedAt", label: "Updated At", editable: false},
    ],
    paymentQueue: [
      {key: "id", label: "Queue ID", editable: false, required: true},
      {key: "queueStatus", label: "Queue Status", editable: false},
      {key: "source", label: "Source", editable: false},
      {key: "month", label: "Month", editable: false},
      {key: "dueDate", label: "Due Date", editable: false},
      {key: "amount", label: "Amount", editable: false},
      {key: "merchant", label: "Merchant", editable: false},
      {key: "customer", label: "Customer", editable: false},
      {key: "grantId", label: "Grant ID", editable: true},
      {key: "lineItemId", label: "Line Item ID", editable: true},
      {key: "customerId", label: "Customer ID", editable: true},
      {key: "enrollmentId", label: "Enrollment ID", editable: true},
      {key: "creditCardId", label: "Credit Card ID", editable: true},
      {key: "invoiceStatus", label: "Invoice Status", editable: true},
      {key: "invoiceRef", label: "Invoice Ref", editable: true},
      {key: "okUnassigned", label: "OK Unassigned", editable: true},
      {key: "postedAt", label: "Posted At", editable: false},
      {key: "updatedAtISO", label: "Updated At", editable: false},
    ],
  };
}

export function getSheetsBridgeManifest() {
  const columns = manifestColumns();
  const generatedAt = isoNow();
  return {
    version: "v1",
    generatedAt,
    interfaces: [
      {
        id: "grants",
        label: "Grants",
        sheetName: "Grants",
        supports: ["pull", "push"],
        primaryKey: "grantId",
        columns: columns.grants,
      },
      {
        id: "grantLineItems",
        label: "Grant Line Items",
        sheetName: "Grant Line Items",
        supports: ["pull", "push"],
        primaryKey: "lineItemId",
        columns: columns.grantLineItems,
      },
      {
        id: "paymentQueue",
        label: "Payment Queue",
        sheetName: "Payment Queue",
        supports: ["pull", "push"],
        primaryKey: "id",
        columns: columns.paymentQueue,
      },
    ],
  };
}

function toGrantRow(grant: GrantDoc) {
  const totals = grant.budget?.totals || {};
  return {
    grantId: str(grant.id),
    name: str(grant.name),
    status: str(grant.status),
    kind: str(grant.kind || "grant"),
    duration: nullableStr(grant.duration),
    startDate: iso10(grant.startDate),
    endDate: iso10(grant.endDate),
    active: Boolean(grant.active),
    deleted: Boolean(grant.deleted),
    budgetTotal: num(grant.budget?.total ?? totals.total),
    budgetProjected: num(totals.projected),
    budgetSpent: num(totals.spent),
    budgetBalance: num(totals.balance ?? totals.remaining),
    updatedAt: iso(grant.updatedAt),
  };
}

function toGrantLineItemRows(grant: GrantDoc) {
  const items = Array.isArray(grant.budget?.lineItems) ? grant.budget?.lineItems : [];
  return items.map((lineItem) => ({
    grantId: str(grant.id),
    grantName: str(grant.name),
    lineItemId: str(lineItem.id),
    label: nullableStr(lineItem.label),
    amount: num(lineItem.amount),
    projected: num(lineItem.projected),
    spent: num(lineItem.spent),
    projectedInWindow: num(lineItem.projectedInWindow),
    spentInWindow: num(lineItem.spentInWindow),
    locked: boolOrNull(lineItem.locked),
    capEnabled: Boolean(lineItem.capEnabled),
    perCustomerCap: lineItem.perCustomerCap == null ? null : num(lineItem.perCustomerCap),
    grantStatus: str(grant.status),
    grantKind: str(grant.kind || "grant"),
    updatedAt: iso(grant.updatedAt),
  }));
}

function toPaymentQueueRow(item: TPaymentQueueItem) {
  return {
    id: str(item.id),
    baseId: str(item.baseId),
    source: str(item.source),
    queueStatus: str(item.queueStatus),
    month: str(item.month),
    dueDate: nullableStr(item.dueDate),
    amount: num(item.amount),
    merchant: str(item.merchant),
    expenseType: str(item.expenseType),
    program: str(item.program),
    purpose: str(item.purpose),
    descriptor: str(item.descriptor),
    customer: str(item.customer),
    customerId: nullableStr(item.customerId),
    enrollmentId: nullableStr(item.enrollmentId),
    grantId: nullableStr(item.grantId),
    lineItemId: nullableStr(item.lineItemId),
    creditCardId: nullableStr(item.creditCardId),
    invoiceStatus: nullableStr(item.invoiceStatus),
    invoiceRef: nullableStr(item.invoiceRef),
    okUnassigned: Boolean(item.okUnassigned),
    postedAt: nullableStr(item.postedAt),
    reopenedAt: nullableStr(item.reopenedAt),
    updatedAtISO: nullableStr(item.updatedAtISO),
  };
}

async function listGrantDocs(query: TSheetsBridgePullQuery): Promise<GrantDoc[]> {
  if (query.grantId) {
    const snap = await db.collection("grants").doc(query.grantId).get();
    if (!snap.exists) return [];
    const grant = {id: snap.id, ...(snap.data() || {})} as GrantDoc;
    if (str(grant.orgId) !== str(query.orgId)) return [];
    if (query.status && str(grant.status) !== str(query.status)) return [];
    if (typeof query.active === "boolean" && Boolean(grant.active) !== query.active) return [];
    if (!query.includeDeleted && (Boolean(grant.deleted) || str(grant.status) === "deleted")) return [];
    return [grant];
  }

  let ref: FirebaseFirestore.Query = db.collection("grants").where("orgId", "==", query.orgId);

  if (query.status) ref = ref.where("status", "==", query.status);
  if (typeof query.active === "boolean") ref = ref.where("active", "==", query.active);

  ref = ref.orderBy("updatedAt", "desc").limit(query.limit);

  if (query.cursor) {
    const cursorSnap = await db.collection("grants").doc(query.cursor).get();
    if (cursorSnap.exists) ref = ref.startAfter(cursorSnap);
  }

  const snap = await ref.get();
  const items = snap.docs.map((doc) => ({id: doc.id, ...(doc.data() || {})} as GrantDoc));
  return query.includeDeleted ?
    items :
    items.filter((grant) => !Boolean(grant.deleted) && str(grant.status) !== "deleted");
}

export async function pullSheetsBridgeRows(query: TSheetsBridgePullQuery) {
  if (query.interfaceId === "paymentQueue") {
    const result = await listPaymentQueueItems(query.orgId, {
      orgId: query.orgId,
      grantId: query.grantId,
      month: query.month,
      queueStatus: query.queueStatus,
      source: query.source,
      limit: query.limit,
      cursor: query.cursor,
    });
    return {
      interfaceId: query.interfaceId,
      generatedAt: isoNow(),
      count: result.items.length,
      cursor: result.hasMore && result.items.length ? result.items[result.items.length - 1].id : null,
      rows: result.items.map(toPaymentQueueRow),
    };
  }

  const grants = await listGrantDocs(query);
  if (query.interfaceId === "grants") {
    return {
      interfaceId: query.interfaceId,
      generatedAt: isoNow(),
      count: grants.length,
      cursor: grants.length ? str(grants[grants.length - 1].id) : null,
      rows: grants.map(toGrantRow),
    };
  }

  const rows = grants.flatMap(toGrantLineItemRows);
  return {
    interfaceId: query.interfaceId,
    generatedAt: isoNow(),
    count: rows.length,
    cursor: grants.length ? str(grants[grants.length - 1].id) : null,
    rows,
  };
}

async function getGrantDocForWrite(orgId: string, grantId: string, tx?: FirebaseFirestore.Transaction) {
  const ref = db.collection("grants").doc(grantId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) {
    const err = new Error("grant_not_found") as Error & {code?: number};
    err.code = 404;
    throw err;
  }
  const grant = {id: snap.id, ...(snap.data() || {})} as GrantDoc;
  if (str(grant.orgId) !== str(orgId)) {
    const err = new Error("forbidden_org") as Error & {code?: number};
    err.code = 403;
    throw err;
  }
  return {ref, grant};
}

function buildGrantPatchPayload(grant: GrantDoc, patch: TSheetsGrantPatch) {
  const nextStatus = patch.status ?? (str(grant.status || "draft") || "draft");
  const nextKind = patch.kind ?? (str(grant.kind || "grant") || "grant");
  const prevBudget = grant.budget ?? null;
  const nextBudget = nextKind === "program" ?
    null :
    normalizeBudget({
      ...(prevBudget || {total: 0, lineItems: []}),
      total: num(prevBudget?.total),
      totals: undefined,
      ...(patch.budgetTotal !== undefined ? {total: patch.budgetTotal ?? 0} : {}),
      lineItems: normalizeLineItemsForBudget(Array.isArray(prevBudget?.lineItems) ? prevBudget.lineItems : []),
    });

  return removeUndefinedDeep({
    ...(patch.name !== undefined ? {name: patch.name} : {}),
    ...(patch.duration !== undefined ? {duration: patch.duration} : {}),
    ...(patch.startDate !== undefined ? {startDate: patch.startDate} : {}),
    ...(patch.endDate !== undefined ? {endDate: patch.endDate} : {}),
    status: nextStatus,
    kind: nextKind,
    active: nextStatus === "active",
    deleted: nextStatus === "deleted",
    budget: nextBudget,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function applyGrantPatch(orgId: string, grantId: string, patch: TSheetsGrantPatch, dryRun: boolean) {
  const {ref, grant} = await getGrantDocForWrite(orgId, grantId);
  const data = buildGrantPatchPayload(grant, patch);
  if (!dryRun) await ref.set(data as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>, {merge: true});
  return {grantId, patch: data};
}

function buildNextLineItems(
  current: Array<Record<string, unknown>>,
  lineItemId: string | undefined,
  patch: TSheetsGrantLineItemPatch,
) {
  const nextId = str(lineItemId) || randomUUID();
  let found = false;

  const nextItems = current.map((lineItem) => {
    if (str(lineItem.id) !== nextId) return lineItem;
    found = true;
    return {
      ...lineItem,
      ...(patch.label !== undefined ? {label: patch.label} : {}),
      ...(patch.amount !== undefined ? {amount: patch.amount} : {}),
      ...(patch.locked !== undefined ? {locked: patch.locked} : {}),
      ...(patch.capEnabled !== undefined ? {capEnabled: patch.capEnabled} : {}),
      ...(patch.perCustomerCap !== undefined ? {perCustomerCap: patch.perCustomerCap} : {}),
    };
  });

  if (!found) {
    nextItems.push({
      id: nextId,
      label: patch.label ?? null,
      amount: patch.amount ?? 0,
      projected: 0,
      spent: 0,
      projectedInWindow: 0,
      spentInWindow: 0,
      locked: patch.locked ?? null,
      capEnabled: patch.capEnabled ?? false,
      perCustomerCap: patch.perCustomerCap ?? null,
    });
  }

  return {nextId, nextItems: normalizeLineItemsForBudget(nextItems)};
}

async function applyGrantLineItemUpsert(
  orgId: string,
  grantId: string,
  lineItemId: string | undefined,
  patch: TSheetsGrantLineItemPatch,
  dryRun: boolean,
) {
  return db.runTransaction(async (tx) => {
    const {ref, grant} = await getGrantDocForWrite(orgId, grantId, tx);
    const currentItems = Array.isArray(grant.budget?.lineItems) ? grant.budget?.lineItems : [];
    const {nextId, nextItems} = buildNextLineItems(currentItems, lineItemId, patch);
    const budget = normalizeBudget({
      ...(grant.budget || {total: 0}),
      total: num(grant.budget?.total),
      totals: undefined,
      lineItems: nextItems,
    });
    if (!dryRun) {
      tx.set(ref, {
        budget,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    return {grantId, lineItemId: nextId, budget};
  });
}

async function applyGrantLineItemDelete(orgId: string, grantId: string, lineItemId: string, dryRun: boolean) {
  return db.runTransaction(async (tx) => {
    const {ref, grant} = await getGrantDocForWrite(orgId, grantId, tx);
    const currentItems = Array.isArray(grant.budget?.lineItems) ? grant.budget?.lineItems : [];
    const nextItems = normalizeLineItemsForBudget(
      currentItems.filter((lineItem) => str(lineItem.id) !== str(lineItemId)),
    );
    const budget = normalizeBudget({
      ...(grant.budget || {total: 0}),
      total: num(grant.budget?.total),
      totals: undefined,
      lineItems: nextItems,
    });
    if (!dryRun) {
      tx.set(ref, {
        budget,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    return {grantId, lineItemId, deleted: true, budget};
  });
}

async function assertPaymentQueueOrg(orgId: string, itemId: string) {
  const item = await getPaymentQueueItem(itemId);
  if (!item) {
    const err = new Error("payment_queue_not_found") as Error & {code?: number};
    err.code = 404;
    throw err;
  }
  if (str(item.orgId) !== str(orgId)) {
    const err = new Error("forbidden_org") as Error & {code?: number};
    err.code = 403;
    throw err;
  }
  return item;
}

async function applyPushOperation(orgId: string, operation: TSheetsBridgePushOperation, dryRun: boolean) {
  if (operation.kind === "grant.patch") {
    return applyGrantPatch(orgId, operation.grantId, operation.patch, dryRun);
  }

  if (operation.kind === "grant.lineItem.upsert") {
    return applyGrantLineItemUpsert(orgId, operation.grantId, operation.lineItemId, operation.patch, dryRun);
  }

  if (operation.kind === "grant.lineItem.delete") {
    return applyGrantLineItemDelete(orgId, operation.grantId, operation.lineItemId, dryRun);
  }

  if (operation.kind === "paymentQueue.patch") {
    await assertPaymentQueueOrg(orgId, operation.id);
    if (dryRun) return {id: operation.id, patch: operation.patch};
    const item = await patchPaymentQueueItem(operation.id, operation.patch, operation.actorUid);
    return {id: operation.id, item};
  }

  if (operation.kind === "paymentQueue.post") {
    await assertPaymentQueueOrg(orgId, operation.id);
    if (dryRun) return {id: operation.id, action: "post"};
    return postPaymentQueueToLedger(operation.id, {postedBy: operation.actorUid}, operation.actorUid);
  }

  await assertPaymentQueueOrg(orgId, operation.id);
  if (dryRun) return {id: operation.id, action: "reopen", reason: operation.reason || null};
  return reopenPaymentQueueItem(
    operation.id,
    {reason: operation.reason, reopenedBy: operation.actorUid},
    operation.actorUid,
  );
}

export async function pushSheetsBridgeChanges(body: TSheetsBridgePushBody) {
  const results: Array<{
    index: number;
    kind: TSheetsBridgePushOperation["kind"];
    ok: boolean;
    result?: unknown;
    error?: string;
    code?: number;
  }> = [];

  for (let index = 0; index < body.operations.length; index += 1) {
    const operation = body.operations[index];
    try {
      const result = await applyPushOperation(body.orgId, operation, body.dryRun);
      results.push({
        index,
        kind: operation.kind,
        ok: true,
        result,
      });
    } catch (error) {
      const err = error as Error & {code?: number};
      results.push({
        index,
        kind: operation.kind,
        ok: false,
        error: err.message || "sheets_bridge_push_failed",
        code: err.code || 500,
      });
    }
  }

  return {
    generatedAt: isoNow(),
    dryRun: body.dryRun,
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    failureCount: results.filter((item) => !item.ok).length,
    results,
  };
}
