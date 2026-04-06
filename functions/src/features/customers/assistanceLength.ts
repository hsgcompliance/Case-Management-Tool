import {
  db,
  FieldValue,
  isDev,
  newBulkWriter,
  requireOrgId,
  type Claims,
} from "../../core";

type AssistanceLengthValue = {
  firstDateOfAssistance: string | null;
  lastExpectedDateOfAssistance: string | null;
} | null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normId(value: unknown): string {
  return String(value || "").trim();
}

function asIsoDate(value: unknown): string | null {
  const text = String(value || "").trim().slice(0, 10);
  return DATE_RE.test(text) ? text : null;
}

function normalizeAssistanceLength(value: unknown): AssistanceLengthValue {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const firstDateOfAssistance = asIsoDate(row.firstDateOfAssistance);
  const lastExpectedDateOfAssistance = asIsoDate(row.lastExpectedDateOfAssistance);
  if (!firstDateOfAssistance && !lastExpectedDateOfAssistance) return null;
  return {
    firstDateOfAssistance,
    lastExpectedDateOfAssistance,
  };
}

function sameAssistanceLength(
  a: AssistanceLengthValue,
  b: AssistanceLengthValue,
): boolean {
  const left = normalizeAssistanceLength(a);
  const right = normalizeAssistanceLength(b);
  return (
    (left?.firstDateOfAssistance ?? null) ===
      (right?.firstDateOfAssistance ?? null) &&
    (left?.lastExpectedDateOfAssistance ?? null) ===
      (right?.lastExpectedDateOfAssistance ?? null)
  );
}

function isDeletedEnrollment(row: Record<string, unknown>): boolean {
  const status = String(row.status || "").trim().toLowerCase();
  return row.deleted === true || status === "deleted";
}

function isActiveEnrollment(row: Record<string, unknown>): boolean {
  if (isDeletedEnrollment(row)) return false;
  const status = String(row.status || "").trim().toLowerCase();
  if (row.active === true || status === "active") return true;
  if (row.active === false || status === "closed") return false;
  return true;
}

function collectPaymentDates(payments: unknown): string[] {
  if (!Array.isArray(payments)) return [];
  const dates: string[] = [];
  for (const raw of payments) {
    const payment = raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : null;
    if (!payment) continue;
    if (payment.void === true) continue;
    const amount = Number(payment.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const dueDate = asIsoDate(payment.dueDate ?? payment.date);
    if (!dueDate) continue;
    dates.push(dueDate);
  }
  return dates;
}

export function deriveCustomerAssistanceLength(
  enrollments: Array<Record<string, unknown>>,
): AssistanceLengthValue {
  const nonDeleted = enrollments.filter((row) => !isDeletedEnrollment(row));
  const sourceRows = nonDeleted.some((row) => isActiveEnrollment(row))
    ? nonDeleted.filter((row) => isActiveEnrollment(row))
    : nonDeleted;

  let firstDateOfAssistance: string | null = null;
  let lastExpectedDateOfAssistance: string | null = null;

  for (const row of sourceRows) {
    for (const dueDate of collectPaymentDates(row.payments)) {
      if (!firstDateOfAssistance || dueDate < firstDateOfAssistance) {
        firstDateOfAssistance = dueDate;
      }
      if (!lastExpectedDateOfAssistance || dueDate > lastExpectedDateOfAssistance) {
        lastExpectedDateOfAssistance = dueDate;
      }
    }
  }

  if (!firstDateOfAssistance && !lastExpectedDateOfAssistance) return null;
  return {
    firstDateOfAssistance,
    lastExpectedDateOfAssistance,
  };
}

async function loadEnrollmentsForCustomer(
  customerId: string,
): Promise<Array<Record<string, unknown>>> {
  if (!customerId) return [];
  const [customerSnaps, clientSnaps] = await Promise.all([
    db.collection("customerEnrollments").where("customerId", "==", customerId).get(),
    db.collection("customerEnrollments").where("clientId", "==", customerId).get(),
  ]);

  const seen = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];

  for (const snap of [customerSnaps, clientSnaps]) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      rows.push((doc.data() || {}) as Record<string, unknown>);
    }
  }

  return rows;
}

export async function syncCustomerAssistanceLength(customerIdRaw: unknown): Promise<{
  customerId: string | null;
  updated: boolean;
  assistanceLength: AssistanceLengthValue;
}> {
  const customerId = normId(customerIdRaw);
  if (!customerId) {
    return { customerId: null, updated: false, assistanceLength: null };
  }

  const customerRef = db.collection("customers").doc(customerId);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) {
    return { customerId, updated: false, assistanceLength: null };
  }

  const enrollments = await loadEnrollmentsForCustomer(customerId);
  const next = deriveCustomerAssistanceLength(enrollments);
  const prev = normalizeAssistanceLength(customerSnap.get("assistanceLength"));

  if (sameAssistanceLength(prev, next)) {
    return { customerId, updated: false, assistanceLength: next };
  }

  await customerRef.set(
    {
      assistanceLength: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { customerId, updated: true, assistanceLength: next };
}

export async function backfillCustomerAssistanceLength(
  caller: Claims,
  opts?: { limit?: number; allOrgs?: boolean; dryRun?: boolean },
) {
  const orgId = requireOrgId(caller);
  const allowAll = !!opts?.allOrgs && isDev(caller);
  const limit = Math.max(1, Math.min(5000, Number(opts?.limit ?? 1000)));
  const dryRun = opts?.dryRun !== false;

  let customersQ: FirebaseFirestore.Query = db.collection("customers");
  let enrollmentsQ: FirebaseFirestore.Query = db.collection("customerEnrollments");
  if (!allowAll) {
    customersQ = customersQ.where("orgId", "==", orgId);
    enrollmentsQ = enrollmentsQ.where("orgId", "==", orgId);
  }
  customersQ = customersQ.limit(limit);

  const [customersSnap, enrollmentsSnap] = await Promise.all([
    customersQ.get(),
    enrollmentsQ.get(),
  ]);

  const customerIds = new Set(customersSnap.docs.map((doc) => doc.id));
  const enrollmentsByCustomer = new Map<string, Array<Record<string, unknown>>>();

  for (const doc of enrollmentsSnap.docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const customerId = normId(data.customerId) || normId(data.clientId);
    if (!customerId || !customerIds.has(customerId)) continue;
    const rows = enrollmentsByCustomer.get(customerId) || [];
    rows.push(data);
    enrollmentsByCustomer.set(customerId, rows);
  }

  const writer = dryRun ? null : newBulkWriter(2);
  let updated = 0;
  const ids: string[] = [];

  for (const doc of customersSnap.docs) {
    const prev = normalizeAssistanceLength(doc.get("assistanceLength"));
    const next = deriveCustomerAssistanceLength(
      enrollmentsByCustomer.get(doc.id) || [],
    );
    if (sameAssistanceLength(prev, next)) continue;

    updated += 1;
    ids.push(doc.id);

    if (writer) {
      writer.set(
        doc.ref,
        {
          assistanceLength: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  if (writer) await writer.close();

  return {
    scanned: customersSnap.size,
    updated,
    ids,
    dryRun,
    scopedToOrg: allowAll ? null : orgId,
    enrollmentsScanned: enrollmentsSnap.size,
  };
}
