// functions/src/features/customers/service.ts
import { randomUUID as uuid } from "node:crypto";
import type { CustomerInput } from "./schemas";
import { toArray, CustomerStatus, z } from "./schemas"
import {
  db,
  authAdmin,
  FieldValue,
  normId,
  sanitizeNestedObject,
  canAccessDoc,
  requireOrgId,
  isAdmin,
  isDev,
  newBulkWriter,
  type Claims,
} from "../../core";

/* -------------------------------------------
   Reserved keys (server-owned / protected)
-------------------------------------------- */

const RESERVED = new Set<string>([
  "id",
  "orgId",
  "teamId",
  "teamIds",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "deleted",
  "_tags",
  "closedAt",
  "by",
  "createdBy",
  "updatedBy",
  "status",
]);

const isReserved = (k: string) => RESERVED.has(k) || k.startsWith("_");

function isReservedRouteId(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  // Next.js intercepted route segment forms, e.g. "(.)new"
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
}

/* -------------------------------------------
   Canonical keys (known schema fields)
-------------------------------------------- */

const CANONICAL = new Set<string>([
  "firstName",
  "lastName",
  "fullName",
  "name",
  "dob",
  "caseManagerId",
  "caseManagerName",
  "secondaryCaseManagerId",
  "secondaryCaseManagerName",
  "otherContacts",
  "contactCaseManagerIds",
  "population",
  "assistanceLength",
  "acuityScore",
  "acuity",
  "meta",
  "status",
  "active",
  "deleted",
  "enrolled",
]);

type CustomerStatus = Exclude<z.infer<typeof CustomerStatus>, null>;

const trimOrNull = (v: any): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

type OtherContact = {
  uid: string;
  name: string | null;
  role: string | null;
};

function sanitizeOtherContacts(
  raw: unknown,
  opts?: { excludeIds?: Array<string | null | undefined> }
): OtherContact[] {
  if (!Array.isArray(raw)) return [];
  const exclude = new Set(
    (opts?.excludeIds || []).map((value) => trimOrNull(value)).filter(Boolean) as string[]
  );
  const out: OtherContact[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    const uid = trimOrNull((entry as any)?.uid);
    if (!uid || exclude.has(uid) || seen.has(uid)) continue;
    seen.add(uid);
    out.push({
      uid,
      name: trimOrNull((entry as any)?.name),
      role: trimOrNull((entry as any)?.role),
    });
    if (out.length >= 3) break;
  }

  return out;
}

function buildContactCaseManagerIds(
  primaryUid: string | null | undefined,
  secondaryUid: string | null | undefined,
  otherContacts: OtherContact[] = []
): string[] {
  const out: string[] = [];
  for (const uid of [
    trimOrNull(primaryUid),
    trimOrNull(secondaryUid),
    ...otherContacts.map((contact) => trimOrNull(contact.uid)),
  ]) {
    if (!uid || out.includes(uid)) continue;
    out.push(uid);
  }
  return out.slice(0, 5);
}

function sameOtherContacts(a: OtherContact[], b: OtherContact[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      entry.uid === other?.uid &&
      entry.name === other?.name &&
      entry.role === other?.role
    );
  });
}

function splitNameParts(full: string | null): { firstName: string | null; lastName: string | null } {
  const raw = String(full || "").trim();
  if (!raw) return { firstName: null, lastName: null };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function shapeCustomerNames(input: {
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  name?: unknown;
}) {
  let firstName = trimOrNull(input.firstName);
  let lastName = trimOrNull(input.lastName);
  const providedFull = trimOrNull(input.fullName);
  const providedName = trimOrNull(input.name);

  if ((!firstName && !lastName) && (providedFull || providedName)) {
    const parsed = splitNameParts(providedFull ?? providedName);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
  }

  const combined = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const fullName = providedFull ?? combined ?? providedName ?? null;
  const name = providedName ?? fullName ?? combined ?? null;

  return { firstName, lastName, fullName, name };
}

function coerceStatus(v: any): CustomerStatus | null {
  const out = CustomerStatus.safeParse(typeof v === "string" ? v.trim() : v);
  return out.success && out.data ? out.data : null;
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/* -------------------------------------------
   Normalize one input to stored FS shape
-------------------------------------------- */

export function normalizeOne(input: CustomerInput, caller: Claims) {
  const orgId = requireOrgId(caller);

  // Peel off reserved/core fields, keep dynamic remainder.
  const {
    id: inId,
    orgId: _orgIgnore,
    teamIds: _teamsIgnore,
    createdAt: _createdIgnore,
    updatedAt: _updatedIgnore,
    _tags: _tagsIgnore,
    deletedAt: _deletedAtIgnore,
    closedAt: _closedAtIgnore,
    ...rest
  } = (input || {}) as any;

  if (inId != null && isReservedRouteId(inId)) {
    const e: any = new Error("invalid_reserved_id");
    e.code = 400;
    throw e;
  }

  const id = inId ?? uuid();

  // Name shaping
  const names = shapeCustomerNames(input as any);
  const first = names.firstName;
  const last = names.lastName;
  const fullName = names.fullName;
  const name = names.name;

  // Robust: do not allow nameless customers (prevents empty shells / UI breakage).
  if (!name) {
    const e: any = new Error("customer_name_required");
    e.code = 400;
    throw e;
  }

  // Status shaping (whitelist)
  let status: CustomerStatus =
    coerceStatus((input as any)?.status) ??
    ((input as any)?.active === false ? "inactive" : "active");

  // Treat deleted=true as authoritative
  if ((input as any)?.deleted === true) status = "deleted";

  const deleted = status === "deleted";
  const active = status === "active" && !deleted;

  const enrolled =
    deleted
      ? false
      : hasOwn(input, "enrolled")
      ? !!(input as any).enrolled
      : true;
  const caseManagerId = trimOrNull((input as any).caseManagerId);
  const secondaryCaseManagerId = trimOrNull((input as any).secondaryCaseManagerId);
  const otherContacts = sanitizeOtherContacts((input as any).otherContacts, {
    excludeIds: [caseManagerId, secondaryCaseManagerId],
  });

  // teamIds default to [orgId]; only admin/dev may preserve extras
  let teamIds: string[] = [orgId];
  if (isAdmin(caller) || isDev(caller)) {
    const rawTeams = Array.isArray((input as any).teamIds) ? (input as any).teamIds : [];
    const cleanTeams = rawTeams.map((t: any) => normId(t)).filter(Boolean);
    teamIds = Array.from(new Set([orgId, ...cleanTeams])).slice(0, 10);
  }

  // Dynamic fields (non-canonical, non-reserved), sanitized.
  const dynRaw: Record<string, any> = {};
  for (const [k, v] of Object.entries(rest || {})) {
    if (isReserved(k)) continue;
    if (CANONICAL.has(k)) continue;
    if (v !== undefined) dynRaw[k] = v;
  }
  const dyn = sanitizeNestedObject(dynRaw || {});
  const meta = (input as any).meta ? sanitizeNestedObject((input as any).meta) : {};

  return {
    id,
    orgId,
    teamIds,

    firstName: first,
    lastName: last,
    fullName,
    name,

    dob: (input as any).dob ?? null,
    caseManagerId,
    caseManagerName: (input as any).caseManagerName ?? null,
    secondaryCaseManagerId,
    secondaryCaseManagerName: (input as any).secondaryCaseManagerName ?? null,
    otherContacts,
    contactCaseManagerIds: buildContactCaseManagerIds(
      caseManagerId,
      secondaryCaseManagerId,
      otherContacts
    ),

    status,
    active,
    deleted,
    enrolled,

    population: (input as any).population ?? null,
    acuityScore: (input as any).acuityScore ?? null,
    acuity: (input as any).acuity ?? null,
    meta,

    ...dyn,

    // createdAt set only on create trigger
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* -------------------------------------------
   Upsert (POST) - org/team gated
   NOTE: merge semantics (does NOT remove unspecified fields).
   Use PATCH + unset[] for removals.
-------------------------------------------- */
export async function upsertCustomers(
  body: CustomerInput | CustomerInput[],
  caller: Claims
) {
  const items = toArray(body).map((b) => normalizeOne(b, caller));

  // If an ID already exists, require access (prevents cross-org "ID takeover").
  const refs = items.map((c) => db.collection("customers").doc(c.id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (!canAccessDoc(caller, data)) {
      const e: any = new Error("forbidden");
      e.code = 403;
      throw e;
    }
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < items.length; i++) {
    writer.set(refs[i], items[i], { merge: true });
  }

  await writer.close();
  return { ids: items.map((i) => i.id) };
}

/* -------------------------------------------
   Patch (PATCH) - org/team gated + dynamic
-------------------------------------------- */

export async function patchCustomers(
  body:
    | { id: string; patch: Partial<CustomerInput>; unset?: string[]; coerceNulls?: boolean }
    | Array<{ id: string; patch: Partial<CustomerInput>; unset?: string[]; coerceNulls?: boolean }>,
  caller: Claims
) {
  const rows = toArray(body);
  const cmNameCache = new Map<string, string | null>();

  const snaps = await Promise.all(rows.map(({ id }) => db.collection("customers").doc(id).get()));

  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e: any = new Error("not_found");
      e.code = 404;
      throw e;
    }
    if (!canAccessDoc(caller, snap.data() || {})) {
      const e: any = new Error("forbidden");
      e.code = 403;
      throw e;
    }
  });

  const writer = newBulkWriter(2);

  for (let i = 0; i < rows.length; i++) {
    const { id, patch = {}, unset, coerceNulls } = rows[i];

    if (!isAdmin(caller) && !isDev(caller)) {
      if ("orgId" in (patch as any) || "teamIds" in (patch as any)) {
        const e: any = new Error("forbidden_org_team_patch");
        e.code = 403;
        throw e;
      }
    }

    const snap = snaps[i];
    const prev = (snap.data() || {}) as any;

    const data: any = { updatedAt: FieldValue.serverTimestamp() };
    const safePatch = patch as any;

    // Canonical field handling
    if ("firstName" in safePatch) data.firstName = safePatch.firstName ?? null;
    if ("lastName" in safePatch) data.lastName = safePatch.lastName ?? null;
    if ("fullName" in safePatch) data.fullName = safePatch.fullName ?? null;
    if ("name" in safePatch) data.name = safePatch.name ?? null;
    if ("dob" in safePatch) data.dob = safePatch.dob ?? null;

    if ("caseManagerId" in safePatch) {
      const nextCmUid = trimOrNull(safePatch.caseManagerId);
      data.caseManagerId = nextCmUid;

      if (!nextCmUid) {
        data.caseManagerName = null;
      } else {
        if (!cmNameCache.has(nextCmUid)) {
          const rec = await authAdmin.getUser(nextCmUid).catch(() => null);
          const display =
            trimOrNull(rec?.displayName) ??
            trimOrNull(rec?.email) ??
            null;
          cmNameCache.set(nextCmUid, display);
        }
        data.caseManagerName = cmNameCache.get(nextCmUid) ?? null;
      }
    } else if ("caseManagerName" in safePatch) {
      data.caseManagerName = safePatch.caseManagerName ?? null;
    }

    if ("secondaryCaseManagerId" in safePatch) {
      const nextCmUid = trimOrNull(safePatch.secondaryCaseManagerId);
      data.secondaryCaseManagerId = nextCmUid;

      if (!nextCmUid) {
        data.secondaryCaseManagerName = null;
      } else {
        if (!cmNameCache.has(nextCmUid)) {
          const rec = await authAdmin.getUser(nextCmUid).catch(() => null);
          const display =
            trimOrNull(rec?.displayName) ??
            trimOrNull(rec?.email) ??
            null;
          cmNameCache.set(nextCmUid, display);
        }
        data.secondaryCaseManagerName = cmNameCache.get(nextCmUid) ?? null;
      }
    } else if ("secondaryCaseManagerName" in safePatch) {
      data.secondaryCaseManagerName = safePatch.secondaryCaseManagerName ?? null;
    }

    const nextPrimaryId =
      "caseManagerId" in safePatch ? trimOrNull(safePatch.caseManagerId) : trimOrNull(prev.caseManagerId);
    const nextSecondaryId =
      "secondaryCaseManagerId" in safePatch
        ? trimOrNull(safePatch.secondaryCaseManagerId)
        : trimOrNull(prev.secondaryCaseManagerId);
    const nextOtherContacts = sanitizeOtherContacts(
      "otherContacts" in safePatch ? safePatch.otherContacts : prev.otherContacts,
      { excludeIds: [nextPrimaryId, nextSecondaryId] }
    );

    if ("otherContacts" in safePatch || !sameOtherContacts(nextOtherContacts, sanitizeOtherContacts(prev.otherContacts, {
      excludeIds: [trimOrNull(prev.caseManagerId), trimOrNull(prev.secondaryCaseManagerId)],
    }))) {
      data.otherContacts = nextOtherContacts;
    }

    if (
      "caseManagerId" in safePatch ||
      "secondaryCaseManagerId" in safePatch ||
      "otherContacts" in safePatch ||
      "contactCaseManagerIds" in safePatch
    ) {
      data.contactCaseManagerIds = buildContactCaseManagerIds(
        nextPrimaryId,
        nextSecondaryId,
        nextOtherContacts
      );
    }

    if ("population" in safePatch) data.population = safePatch.population ?? null;
    if ("acuityScore" in safePatch) data.acuityScore = safePatch.acuityScore ?? null;
    if ("acuity" in safePatch) data.acuity = safePatch.acuity ?? null;
    if ("meta" in safePatch) data.meta = sanitizeNestedObject(safePatch.meta ?? {});

    // -------- status / active / deleted / enrolled coherence --------

    const wantStatus = "status" in safePatch ? coerceStatus(safePatch.status) : null;
    const wantDeleted = "deleted" in safePatch ? !!safePatch.deleted : null;
    const wantActive = "active" in safePatch ? !!safePatch.active : null;
    const wantEnrolled = "enrolled" in safePatch ? !!safePatch.enrolled : null;

    // Start from previous, then apply requested changes
    let status: CustomerStatus =
      wantStatus ??
      coerceStatus(prev.status) ??
      (prev.active === false ? "inactive" : "active");

    // Treat deleted=true as authoritative
    if (wantDeleted === true) status = "deleted";

    // If status explicitly set active/inactive, clear deleted unless they also asked deleted=true
    if ((wantStatus === "active" || wantStatus === "inactive") && wantDeleted !== true) {
      // undelete via status
      // (we do NOT clear deletedAt automatically; audit-friendly)
    }

    // Apply active -> status mapping if status not explicitly set
    if (!("status" in safePatch) && "active" in safePatch) {
      status = wantActive ? "active" : "inactive";
    }

    const deleted = status === "deleted";
    const active = deleted ? false : wantActive ?? (status === "active");
    const enrolled = deleted ? false : wantEnrolled ?? (prev.enrolled ?? true);

    data.status = status;
    data.deleted = deleted;
    data.active = active;
    data.enrolled = enrolled;

    // deletedAt stamping (only on delete transitions / explicit delete intent)
    if (deleted && prev.status !== "deleted") {
      data.deletedAt = FieldValue.serverTimestamp();
    }
    if (wantDeleted === true && prev.status !== "deleted") {
      data.deletedAt = FieldValue.serverTimestamp();
    }
    if (wantStatus === "deleted" && prev.status !== "deleted") {
      data.deletedAt = FieldValue.serverTimestamp();
    }

    // Keep first/last/fullName/name coherent from any name field input.
    const touchedFirst = hasOwn(safePatch, "firstName");
    const touchedLast = hasOwn(safePatch, "lastName");
    const touchedFull = hasOwn(safePatch, "fullName");
    const touchedName = hasOwn(safePatch, "name");
    if (touchedFirst || touchedLast || touchedFull || touchedName) {
      const names = shapeCustomerNames({
        firstName: touchedFirst ? safePatch.firstName : prev.firstName,
        lastName: touchedLast ? safePatch.lastName : prev.lastName,
        fullName: touchedFull ? safePatch.fullName : prev.fullName,
        name: touchedName ? safePatch.name : prev.name,
      });
      data.firstName = names.firstName;
      data.lastName = names.lastName;
      data.fullName = names.fullName;
      data.name = names.name;
    }

    // Dynamic fields: apply everything else except reserved and canonical keys
    const dyn: Record<string, any> = {};
    for (const [k, vRaw] of Object.entries(safePatch || {})) {
      if (isReserved(k)) continue;
      if (CANONICAL.has(k)) continue;

      const v =
        vRaw === undefined ? (coerceNulls ? null : undefined) : (vRaw as any);
      if (v !== undefined) dyn[k] = v;
    }
    const dynSafe = sanitizeNestedObject(dyn);
    Object.assign(data, dynSafe);

    const ref = db.collection("customers").doc(id);
    writer.set(ref, data, { merge: true });

    if (Array.isArray(unset) && unset.length) {
      const delMap: Record<string, any> = {};
      for (const path of unset) delMap[path] = FieldValue.delete();
      writer.set(ref, delMap, { merge: true });
    }
  }

  await writer.close();
  return { ids: rows.map((r) => r.id) };
}

/* -------------------------------------------
   One-time name backfill (admin/dev)
-------------------------------------------- */

export async function backfillCustomerNames(
  caller: Claims,
  opts?: { limit?: number; allOrgs?: boolean; dryRun?: boolean }
) {
  const orgId = requireOrgId(caller);
  const allowAll = !!opts?.allOrgs && isDev(caller);
  const limit = Math.max(1, Math.min(5000, Number(opts?.limit ?? 1000)));
  const dryRun = opts?.dryRun !== false;

  let q: FirebaseFirestore.Query = db.collection("customers");
  if (!allowAll) q = q.where("orgId", "==", orgId);
  q = q.limit(limit);

  const snap = await q.get();
  const writer = dryRun ? null : newBulkWriter(2);
  let scanned = 0;
  let updated = 0;
  const ids: string[] = [];

  for (const doc of snap.docs) {
    scanned++;
    const prev = (doc.data() || {}) as any;
    const names = shapeCustomerNames(prev);
    const currentFirst = trimOrNull(prev.firstName);
    const currentLast = trimOrNull(prev.lastName);
    const currentFull = trimOrNull(prev.fullName);
    const currentName = trimOrNull(prev.name);

    const changed =
      currentFirst !== names.firstName ||
      currentLast !== names.lastName ||
      currentFull !== names.fullName ||
      currentName !== names.name;

    if (!changed) continue;
    updated++;
    ids.push(doc.id);

    if (writer) {
      writer.set(
        doc.ref,
        {
          firstName: names.firstName,
          lastName: names.lastName,
          fullName: names.fullName,
          name: names.name,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  if (writer) await writer.close();
  return { scanned, updated, ids, dryRun, scopedToOrg: allowAll ? null : orgId };
}

/* -------------------------------------------
   One-time case manager name backfill (admin/dev)
   Updates both customers and customerEnrollments
-------------------------------------------- */

function caseManagerDisplayFromAuthUser(rec: any): string | null {
  return (
    trimOrNull(rec?.displayName) ??
    trimOrNull(rec?.email) ??
    null
  );
}

export async function backfillCaseManagerNames(
  caller: Claims,
  opts?: { limit?: number; allOrgs?: boolean; dryRun?: boolean }
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
  enrollmentsQ = enrollmentsQ.limit(limit);

  const [customersSnap, enrollmentsSnap] = await Promise.all([customersQ.get(), enrollmentsQ.get()]);

  const cmNameCache = new Map<string, string | null>();
  const missingUserIds = new Set<string>();
  const writer = dryRun ? null : newBulkWriter(2);

  const resolveCaseManagerName = async (uidRaw: unknown): Promise<string | null> => {
    const uid = trimOrNull(uidRaw);
    if (!uid) return null;
    if (cmNameCache.has(uid)) return cmNameCache.get(uid) ?? null;
    const rec = await authAdmin.getUser(uid).catch(() => null);
    if (!rec) missingUserIds.add(uid);
    const display = caseManagerDisplayFromAuthUser(rec);
    cmNameCache.set(uid, display);
    return display;
  };

  let customersScanned = 0;
  let customersUpdated = 0;
  const customerIds: string[] = [];

  for (const doc of customersSnap.docs) {
    customersScanned++;
    const prev = (doc.data() || {}) as any;
    const primaryId = trimOrNull(prev.caseManagerId);
    const secondaryId = trimOrNull(prev.secondaryCaseManagerId);
    if (!primaryId && !secondaryId) continue;

    const nextName = primaryId ? await resolveCaseManagerName(primaryId) : null;
    const nextSecondaryName = secondaryId ? await resolveCaseManagerName(secondaryId) : null;
    const nextOtherContacts = sanitizeOtherContacts(prev.otherContacts, {
      excludeIds: [primaryId, secondaryId],
    });
    const currentName = trimOrNull(prev.caseManagerName);
    const currentSecondaryName = trimOrNull(prev.secondaryCaseManagerName);
    const nextContactIds = buildContactCaseManagerIds(primaryId, secondaryId, nextOtherContacts);
    const currentContactIds = Array.isArray(prev.contactCaseManagerIds)
      ? prev.contactCaseManagerIds.map((v: unknown) => String(v || "")).filter(Boolean)
      : [];
    const currentOtherContactsRaw = Array.isArray(prev.otherContacts) ? prev.otherContacts : [];
    const contactIdsChanged =
      currentContactIds.length !== nextContactIds.length ||
      currentContactIds.some((value, index) => value !== nextContactIds[index]);
    const otherContactsChanged =
      JSON.stringify(currentOtherContactsRaw) !== JSON.stringify(nextOtherContacts);
    if (
      currentName === nextName &&
      currentSecondaryName === nextSecondaryName &&
      !otherContactsChanged &&
      !contactIdsChanged
    ) continue;

    customersUpdated++;
    customerIds.push(doc.id);
    if (writer) {
      writer.set(
        doc.ref,
        {
          caseManagerName: nextName,
          secondaryCaseManagerName: nextSecondaryName,
          otherContacts: nextOtherContacts,
          contactCaseManagerIds: nextContactIds,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  let enrollmentsScanned = 0;
  let enrollmentsUpdated = 0;
  const enrollmentIds: string[] = [];

  for (const doc of enrollmentsSnap.docs) {
    enrollmentsScanned++;
    const prev = (doc.data() || {}) as any;
    if (!trimOrNull(prev.caseManagerId)) continue;

    const nextName = await resolveCaseManagerName(prev.caseManagerId);
    const currentName = trimOrNull(prev.caseManagerName);
    if (currentName === nextName) continue;

    enrollmentsUpdated++;
    enrollmentIds.push(doc.id);
    if (writer) {
      writer.set(
        doc.ref,
        {
          caseManagerName: nextName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  if (writer) await writer.close();

  return {
    dryRun,
    scopedToOrg: allowAll ? null : orgId,
    limitPerCollection: limit,
    customers: { scanned: customersScanned, updated: customersUpdated, ids: customerIds },
    enrollments: { scanned: enrollmentsScanned, updated: enrollmentsUpdated, ids: enrollmentIds },
    missingUsers: Array.from(missingUserIds).sort(),
    resolvedUsers: cmNameCache.size,
  };
}

/* -------------------------------------------
   Soft delete (POST) - org/team gated
-------------------------------------------- */

export async function softDeleteCustomers(
  ids: string | string[],
  caller: Claims,
  opts?: { cascadeEnrollments?: boolean }
) {
  const arr = toArray(ids);

  const snaps = await Promise.all(arr.map((id) => db.collection("customers").doc(id).get()));
  snaps.forEach((s) => {
    if (!s.exists) {
      const e: any = new Error("not_found");
      e.code = 404;
      throw e;
    }
    if (!canAccessDoc(caller, s.data() || {})) {
      const e: any = new Error("forbidden");
      e.code = 403;
      throw e;
    }
  });

  const writer = newBulkWriter(2);

  for (const id of arr) {
    const cref = db.collection("customers").doc(id);
    writer.set(
      cref,
      {
        deleted: true,
        active: false,
        enrolled: false,
        status: "deleted",
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (opts?.cascadeEnrollments !== false) {
      const esnap = await db
        .collection("customerEnrollments")
        .where("customerId", "==", id)
        .get();

      for (const d of esnap.docs) {
        writer.set(
          d.ref,
          {
            deleted: true,
            enrolled: false,
            status: "closed",
            updatedAt: FieldValue.serverTimestamp(),
            closedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  }

  await writer.close();
  return { ids: arr, active: false, deleted: true };
}

/* -------------------------------------------
   Hard delete (admin) - still org-scoped unless dev
-------------------------------------------- */

export async function hardDeleteCustomers(ids: string | string[], caller: Claims) {
  const arr = toArray(ids);
  const orgId = requireOrgId(caller);

  const snaps = await Promise.all(arr.map((id) => db.collection("customers").doc(id).get()));
  snaps.forEach((s) => {
    if (!s.exists) return;
    const d = s.data() || {};
    if (!isDev(caller) && normId((d as any).orgId) !== orgId) {
      const e: any = new Error("forbidden_cross_org_delete");
      e.code = 403;
      throw e;
    }
  });

  const batch = db.batch();
  for (const id of arr) {
    batch.delete(db.collection("customers").doc(id));
  }
  await batch.commit();
  return { ids: arr, deleted: true };
}
