import type { QueryClient } from "@tanstack/react-query";
import type { PaymentQueueItem } from "@client/paymentQueue";
import { qk } from "./queryKeys";

type OptimisticPatch = {
  key: unknown[] | ReadonlyArray<unknown> | ReadonlyArray<unknown>[];
  update: (prev: unknown) => unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function queueItemMatches(item: PaymentQueueItem, predicate: (item: PaymentQueueItem) => boolean) {
  try {
    return predicate(item);
  } catch {
    return false;
  }
}

export function findCachedPaymentQueueItem(
  qc: QueryClient,
  predicate: (item: PaymentQueueItem) => boolean,
): PaymentQueueItem | null {
  const queueRows = qc.getQueriesData<PaymentQueueItem[]>({ queryKey: qk.paymentQueue.root });
  for (const [, rows] of queueRows) {
    if (!Array.isArray(rows)) continue;
    const found = rows.find((item) => item && queueItemMatches(item, predicate));
    if (found) return found;
  }

  const detailRows = qc.getQueriesData<PaymentQueueItem | null>({ queryKey: qk.paymentQueue.root });
  for (const [, row] of detailRows) {
    if (!row || Array.isArray(row)) continue;
    if (queueItemMatches(row, predicate)) return row;
  }

  return null;
}

export function findCachedPaymentQueueItemById(qc: QueryClient, id: string) {
  const queueId = String(id || "").trim();
  if (!queueId) return null;
  const detail = qc.getQueryData<PaymentQueueItem | null>(qk.paymentQueue.detail(queueId));
  if (detail) return detail;
  return findCachedPaymentQueueItem(qc, (item) => String(item?.id || "").trim() === queueId);
}

function removeQueueItem(prev: unknown, queueId: string) {
  if (Array.isArray(prev)) {
    return prev.filter((item) => String(asRecord(item).id || "") !== queueId);
  }
  const prevObj = asRecord(prev);
  if (Array.isArray(prevObj.items)) {
    return {
      ...prevObj,
      items: prevObj.items.filter((item) => String(asRecord(item).id || "") !== queueId),
    };
  }
  return prev;
}

function toOptimisticGrantActivity(
  item: PaymentQueueItem,
  overrides?: Partial<PaymentQueueItem>,
) {
  const merged = { ...item, ...(overrides || {}) } as PaymentQueueItem;
  const queueId = String(merged.id || item.id || "").trim();
  const amount = Number(merged.amount ?? merged.amountAbs ?? item.amount ?? item.amountAbs ?? 0);
  const note = String(merged.note || merged.notes || merged.purpose || merged.merchant || "Posted payment").trim();
  const date = new Date().toISOString();

  return {
    id: `optimistic:${queueId || `${merged.enrollmentId || "queue"}:${merged.paymentId || Date.now()}`}`,
    grantId: String(merged.grantId || ""),
    lineItemId: String(merged.lineItemId || ""),
    enrollmentId: String(merged.enrollmentId || ""),
    paymentId: String(merged.paymentId || merged.submissionId || queueId || ""),
    customerId: String(merged.customerId || ""),
    customerName: String(merged.customer || merged.merchant || ""),
    customerNameAtSpend: String(merged.customer || merged.merchant || ""),
    note,
    amount,
    ts: date,
    date,
    by: String(merged.postedBy || merged.localModifiedBy || ""),
    compliance: { hmisComplete: true, caseworthyComplete: true },
    paymentQueueItemId: queueId,
    optimistic: true,
  };
}

function grantIdFromActivityKey(key: unknown[]) {
  const last = key[2];
  if (!last || typeof last !== "object") return "";
  return String((last as Record<string, unknown>).grantId || "").trim();
}

function addOptimisticGrantActivity(prev: unknown, activity: Record<string, unknown>) {
  if (!Array.isArray(prev)) return prev;
  const optimisticId = String(activity.id || "");
  const queueId = String(activity.paymentQueueItemId || "");
  const paymentId = String(activity.paymentId || "");
  const exists = prev.some((row) => {
    const raw = asRecord(row);
    return String(raw.id || "") === optimisticId ||
      (!!queueId && String(raw.paymentQueueItemId || "") === queueId) ||
      (!!paymentId && String(raw.paymentId || "") === paymentId && String(raw.optimistic || "") === "true");
  });
  if (exists) return prev;
  return [activity, ...prev];
}

export function optimisticPostPaymentQueuePatches(
  qc: QueryClient,
  item: PaymentQueueItem | null | undefined,
  overrides?: Partial<PaymentQueueItem>,
): OptimisticPatch[] {
  if (!item?.id) return [];
  const queueId = String(item.id || "").trim();
  const grantId = String(overrides?.grantId || item.grantId || "").trim();
  const patches: OptimisticPatch[] = [];

  const listKeys = qc
    .getQueriesData({ queryKey: qk.paymentQueue.root })
    .map(([key]) => key as unknown[])
    .filter((key) => Array.isArray(key) && key[0] === "paymentQueue" && key[1] === "list");

  if (listKeys.length) {
    patches.push({
      key: listKeys,
      update: (prev) => removeQueueItem(prev, queueId),
    });
  }

  patches.push({
    key: qk.paymentQueue.detail(queueId),
    update: (prev) => prev ? { ...asRecord(prev), queueStatus: "posted" } : prev,
  });

  if (!grantId) return patches;
  const activity = toOptimisticGrantActivity(item, overrides);
  const activityKeys = qc
    .getQueriesData({ queryKey: qk.grants.root })
    .map(([key]) => key as unknown[])
    .filter((key) =>
      Array.isArray(key) &&
      key[0] === "grants" &&
      key[1] === "activity" &&
      grantIdFromActivityKey(key) === grantId
    );

  if (activityKeys.length) {
    patches.push({
      key: activityKeys,
      update: (prev) => addOptimisticGrantActivity(prev, activity),
    });
  }

  return patches;
}
