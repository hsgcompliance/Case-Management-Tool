import {db} from '../../core';

type EnrollmentCollection = 'customerEnrollments' | 'clientEnrollments';

export type DigestEnrollmentDoc = {
  id: string;
  sourceCollection: EnrollmentCollection;
  customerId: string;
  grantId: string;
  status: string;
  active: boolean;
  deleted: boolean;
  caseManagerId: string;
  startDate: string;
  endDate: string;
  grantName: string;
  customerName: string;
  clientName: string;
  raw: Record<string, unknown>;
};

const CUSTOMER_ID_FIELDS = ['customerId', 'clientId'] as const;
const ENROLLMENT_COLLECTIONS: EnrollmentCollection[] = ['customerEnrollments', 'clientEnrollments'];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return String(value || '').trim();
}

function enrollmentDeleted(raw: Record<string, unknown>): boolean {
  const status = text(raw.status).toLowerCase();
  return raw.deleted === true || status === 'deleted';
}

function enrollmentActive(raw: Record<string, unknown>): boolean {
  const status = text(raw.status).toLowerCase();
  if (enrollmentDeleted(raw)) return false;
  if (raw.active === true) return true;
  return status === 'active' || status === 'open';
}

function normalizeEnrollmentDoc(
    sourceCollection: EnrollmentCollection,
    doc: FirebaseFirestore.QueryDocumentSnapshot,
): DigestEnrollmentDoc | null {
  const raw = asRecord(doc.data());
  const customerId = text(raw.customerId) || text(raw.clientId);
  const grantId = text(raw.grantId);
  if (!customerId || !grantId) return null;
  return {
    id: text(raw.id) || doc.id,
    sourceCollection,
    customerId,
    grantId,
    status: text(raw.status).toLowerCase(),
    active: enrollmentActive(raw),
    deleted: enrollmentDeleted(raw),
    caseManagerId: text(raw.caseManagerId),
    startDate: text(raw.startDate),
    endDate: text(raw.endDate),
    grantName: text(raw.grantName),
    customerName: text(raw.customerName),
    clientName: text(raw.clientName),
    raw,
  };
}

function enrollmentLogicalKey(row: DigestEnrollmentDoc): string {
  return [
    row.customerId,
    row.grantId,
    row.startDate || '_',
    row.endDate || '_',
    row.status || '_',
  ].join('|');
}

function uniqueByLogicalKey(rows: DigestEnrollmentDoc[]): DigestEnrollmentDoc[] {
  const seen = new Set<string>();
  const out: DigestEnrollmentDoc[] = [];
  for (const row of rows) {
    const key = enrollmentLogicalKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function queryEnrollmentsByCustomerIds(
    sourceCollection: EnrollmentCollection,
    field: 'customerId' | 'clientId',
    customerIds: string[],
): Promise<DigestEnrollmentDoc[]> {
  if (!customerIds.length) return [];
  const snap = await db.collection(sourceCollection).where(field, 'in', customerIds).get();
  return snap.docs
      .map((doc) => normalizeEnrollmentDoc(sourceCollection, doc))
      .filter((row): row is DigestEnrollmentDoc => !!row);
}

export async function loadActiveEnrollmentsForCustomers(args: {
  customerIds: string[];
  caseManagerId?: string;
}): Promise<Map<string, DigestEnrollmentDoc[]>> {
  return loadEnrollmentsForCustomers({...args, activeOnly: true});
}

export async function loadEnrollmentsForCustomers(args: {
  customerIds: string[];
  caseManagerId?: string;
  activeOnly?: boolean;
}): Promise<Map<string, DigestEnrollmentDoc[]>> {
  const requestedIds = Array.from(new Set(args.customerIds.map((id) => text(id)).filter(Boolean)));
  const grouped = new Map<string, DigestEnrollmentDoc[]>();
  if (!requestedIds.length) return grouped;

  const allRows: DigestEnrollmentDoc[] = [];
  for (let i = 0; i < requestedIds.length; i += 30) {
    const chunk = requestedIds.slice(i, i + 30);
    for (const sourceCollection of ENROLLMENT_COLLECTIONS) {
      for (const field of CUSTOMER_ID_FIELDS) {
        const rows = await queryEnrollmentsByCustomerIds(sourceCollection, field, chunk);
        allRows.push(...rows);
      }
    }
  }

  const filtered = uniqueByLogicalKey(allRows).filter((row) => {
    if (row.deleted) return false;
    if (args.activeOnly === true && !row.active) return false;
    if (args.activeOnly === false && row.active) return false;
    if (args.caseManagerId && row.caseManagerId !== args.caseManagerId) return false;
    return requestedIds.includes(row.customerId);
  });

  for (const row of filtered) {
    const current = grouped.get(row.customerId) || [];
    current.push(row);
    grouped.set(row.customerId, current);
  }

  return grouped;
}

async function queryEnrollmentsForDigest(
    sourceCollection: EnrollmentCollection,
    caseManagerId?: string,
): Promise<DigestEnrollmentDoc[]> {
  let query: FirebaseFirestore.Query = db.collection(sourceCollection);
  if (caseManagerId) {
    query = query.where('caseManagerId', '==', caseManagerId);
  }
  const snap = await query.get();
  return snap.docs
      .map((doc) => normalizeEnrollmentDoc(sourceCollection, doc))
      .filter((row): row is DigestEnrollmentDoc => !!row);
}

export async function loadDigestEnrollments(args: {
  caseManagerId?: string;
  activeOnly?: boolean;
}): Promise<DigestEnrollmentDoc[]> {
  const rows = (
    await Promise.all(ENROLLMENT_COLLECTIONS.map((sourceCollection) => queryEnrollmentsForDigest(sourceCollection, args.caseManagerId)))
  ).flat();

  return uniqueByLogicalKey(rows).filter((row) => {
    if (row.deleted) return false;
    if (args.activeOnly === true) return row.active;
    if (args.activeOnly === false) return !row.active;
    return true;
  });
}
