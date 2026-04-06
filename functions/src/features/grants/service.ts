// functions/src/features/grants/service.ts
import { randomUUID as uuid } from "node:crypto";
import {
  db,
  FieldValue,
  withTxn,
  sanitizeNestedObject,
  stripReservedFields,
  normId,
  orgIdFromClaims,
  requireOrg,
  isDev,
  newBulkWriter,
  type Claims,
} from "../../core";
import {
  Grant,
  GrantPatchBody,
  GrantUpsertBody,
  TGrant,
  TGrantBudget,
  toArray,
} from "./schemas";

/* ---------------- Budget helpers (server-derived totals) ---------------- */

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function normalizeBudget(
  input?: TGrantBudget | null,
): TGrantBudget | null {
  if (!input) return null;

  const items = (Array.isArray(input.lineItems) ? input.lineItems : []).map(
    (li) => ({
      id: li.id || uuid(),
      label: li.label ?? null,
      amount: Number(li.amount || 0),

      // totals across all time (these are inputs here; rollups may overwrite elsewhere)
      projected: Number(li.projected || 0),
      spent: Number(li.spent || 0),

      // windowed tallies default to 0 if missing
      projectedInWindow: Number(li.projectedInWindow || 0),
      spentInWindow: Number(li.spentInWindow || 0),

      locked: li.locked ?? null,

      // per-customer cap (optional, pass through as-is)
      ...(li.capEnabled !== undefined ? { capEnabled: li.capEnabled } : { capEnabled: false }),
      ...(li.perCustomerCap != null ? { perCustomerCap: Number(li.perCustomerCap) } : {}),
    }),
  );

  const capFromItems = sum(items.map((i) => i.amount));
  const total = Number(input.total ?? NaN);
  const totalCap = Number.isFinite(total) && total >= 0 ? total : capFromItems;

  const projected = sum(items.map((i) => i.projected));
  const spent = sum(items.map((i) => i.spent));
  const balance = totalCap - spent;
  const projectedBalance = totalCap - (spent + projected);

  const projectedInWindow = sum(items.map((i) => i.projectedInWindow || 0));
  const spentInWindow = sum(items.map((i) => i.spentInWindow || 0));
  const windowBalance = totalCap - spentInWindow;
  const windowProjectedBalance = totalCap - (spentInWindow + projectedInWindow);

  const totals = {
    total: totalCap,
    projected,
    spent,
    balance,
    projectedBalance,
    projectedSpend: spent + projected,
    remaining: balance, // compat alias
    projectedInWindow,
    spentInWindow,
    windowBalance,
    windowProjectedBalance,
  };

  return {
    total: totalCap,
    totals,
    lineItems: items,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

const cleanExtras = (v: Record<string, unknown> | null | undefined) =>
  v
    ? sanitizeNestedObject(stripReservedFields(v as Record<string, unknown>))
    : null;

/* ---------------- Reserved keys (server-owned / protected) ---------------- */

const RESERVED = new Set<string>([
  "id",
  "orgId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "_tags",
  "active",
  "deleted",
]);

function isReserved(k: string) {
  return RESERVED.has(k) || k.startsWith("_");
}

function hasOwn(obj: unknown, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isReservedRouteId(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "new") return true;
  if (s.startsWith("(") && s.endsWith(")new")) return true;
  return false;
}

/* ---------------- Program/Grant coherence ---------------- */

type Kind = "grant" | "program";

/** Canonicalize kind (default to grant if not specified). */
function canonicalKind(prev: Partial<TGrant>, patch: Partial<TGrant>): Kind {
  const rawKind = String(patch?.kind ?? prev?.kind ?? "")
    .trim()
    .toLowerCase();
  return rawKind === "program" ? "program" : "grant";
}

/* ---------------- Org access helpers ---------------- */

function assertTargetOrgAllowed(caller: Claims, targetOrg: string) {
  const callerOrg = orgIdFromClaims(caller);
  const t = normId(targetOrg);

  if (callerOrg && normId(callerOrg) !== t && !isDev(caller)) {
    const e = new Error("forbidden_cross_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { callerOrg: normId(callerOrg), targetOrg: t };
    throw e;
  }

  // Non-devs must have an org. (Dev may pass explicit targetOrg.)
  if (!callerOrg && !isDev(caller)) {
    requireOrg(caller);
  }
}

function assertDocOrgWritable(
  caller: Claims,
  targetOrg: string,
  doc: { orgId?: unknown } | null | undefined,
) {
  const docOrg = normId(doc?.orgId);
  const t = normId(targetOrg);

  if (docOrg && docOrg !== t && !isDev(caller)) {
    const e = new Error("forbidden_org") as Error & {
      code: number;
      meta?: Record<string, unknown>;
    };
    e.code = 403;
    e.meta = { docOrg, targetOrg: t };
    throw e;
  }
}

/* ---------------- Patch sanitizer ---------------- */

function sanitizeGrantPatch(patch: Partial<TGrant>): Partial<TGrant> {
  const out: Partial<TGrant> = { ...(patch || {}) };

  // Strip server-owned / protected keys
  for (const k of Object.keys(out)) {
    if (isReserved(k)) delete out[k];
  }

  // Never accept client-set createdAt/updatedAt (even if not caught above)
  if ("createdAt" in out) delete out.createdAt;
  if ("updatedAt" in out) delete out.updatedAt;

  if (out.tasks !== undefined) out.tasks = cleanExtras(out.tasks);
  if (out.meta !== undefined) out.meta = cleanExtras(out.meta);

  return out;
}

/* ---------------- Normalize single grant for storage ---------------- */

export function normalizeOne(input: TGrant, caller: Claims, targetOrg: string) {
  const parsed = Grant.parse(input);

  if (parsed.id && isReservedRouteId(parsed.id)) {
    const e = new Error("invalid_reserved_id") as Error & { code: number };
    e.code = 400;
    throw e;
  }

  const id = parsed.id || uuid();
  const status = (parsed.status || "draft") as TGrant["status"];

  const active = status === "active";
  const deleted = status === "deleted";

  const kind = canonicalKind({}, parsed);

  const budget =
    kind === "program" ? null : normalizeBudget(parsed.budget ?? null);

  const tasks = cleanExtras(parsed.tasks);
  const meta = cleanExtras(parsed.meta);

  return {
    id,
    orgId: normId(targetOrg),

    name: parsed.name,
    status,
    active,
    deleted,

    kind,

    duration: parsed.duration ?? null,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,

    budget,
    taskTypes: parsed.taskTypes ?? null,
    tasks,
    meta,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* ---------------- Upsert (bulk) ---------------- */

export async function upsertGrants(
  body: unknown,
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const items = toArray(GrantUpsertBody.parse(body)).map((g) =>
    normalizeOne(g, caller, targetOrg),
  );

  // Prevent cross-org "ID takeover" and migrate legacy orgId if missing.
  const refs = items.map((g) => db.collection("grants").doc(g.id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) return;
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  for (let i = 0; i < items.length; i++) {
    writer.set(refs[i], items[i], { merge: true });
  }
  await writer.close();

  return { ids: items.map((i) => i.id) };
}

/* ---------------- Patch (bulk; supports unset[]; budget-aware merges) ---------------- */

export async function patchGrants(
  body: unknown,
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const rows = toArray(GrantPatchBody.parse(body));
  const ids = rows.map((r) => r.id);

  const refs = ids.map((id) => db.collection("grants").doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  snaps.forEach((snap) => {
    if (!snap.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, snap.data() || {});
  });

  const writer = newBulkWriter(2);
  const budgetRows: Array<{
    id: string;
    patch: Partial<TGrant>;
    unset?: string[];
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { id, patch, unset } = rows[i];
    const prev = (snaps[i].data() || {}) as Partial<TGrant>;

    const safePatch = sanitizeGrantPatch(patch as Partial<TGrant>);

    const touchesBudget = hasOwn(safePatch, "budget");

    if (touchesBudget) {
      budgetRows.push({ id, patch: safePatch, unset });
      continue;
    }

    // status coherence
    const nextStatus = (safePatch.status ??
      prev.status ??
      "draft") as TGrant["status"];
    const active = nextStatus === "active";
    const deleted = nextStatus === "deleted";

    // program/grant coherence
    const kind = canonicalKind(prev, safePatch);
    const mustClearBudget = kind === "program";

    const data: Record<string, unknown> = {
      ...safePatch,
      status: nextStatus,
      active,
      deleted,
      kind,
      ...(mustClearBudget ? { budget: null } : {}),
      ...(normId(prev.orgId) ? {} : { orgId: normId(targetOrg) }), // migrate legacy
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = db.collection("grants").doc(id);
    writer.set(ref, data, { merge: true });

    if (Array.isArray(unset) && unset.length) {
      const delMap: Record<string, FirebaseFirestore.FieldValue> = {};
      for (const path of unset) delMap[path] = FieldValue.delete();
      writer.set(ref, delMap, { merge: true });
    }
  }

  await writer.close();

  // Budget patches: transact per-doc for deterministic merge + re-derive totals.
  for (const row of budgetRows) {
    const { id, patch, unset } = row;

    await withTxn(async (tx) => {
      const ref = db.collection("grants").doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) {
        const e = new Error("not_found") as Error & { code: number };
        e.code = 404;
        throw e;
      }

      const prev = snap.data() || {};
      assertDocOrgWritable(caller, targetOrg, prev);

      // status coherence
      const prevObj = prev as Partial<TGrant>;
      const nextStatus = (patch.status ??
        prevObj.status ??
        "draft") as TGrant["status"];
      const active = nextStatus === "active";
      const deleted = nextStatus === "deleted";

      // kind coherence
      const kind = canonicalKind(prev, patch);
      const mustClearBudget = kind === "program";

      // budget merge
      let nextBudget: TGrantBudget | null = null;

      if (mustClearBudget) {
        nextBudget = null;
      } else if (hasOwn(patch, "budget") && patch.budget === null) {
        nextBudget = null;
      } else {
        const prevBudget = (prevObj.budget || {}) as Partial<TGrantBudget>;
        const patchBudget = (patch.budget || {}) as Partial<TGrantBudget>;

        // When line items are patched, preserve spent/projected/windowed tallies from
        // the stored Firestore doc so a budget edit cannot zero out real spend history.
        let mergedLineItems = prevBudget.lineItems;
        if (Array.isArray(patchBudget.lineItems)) {
          const prevById: Record<string, any> = Object.fromEntries(
            (prevBudget.lineItems ?? []).map((li: any) => [String(li.id || ""), li])
          );
          mergedLineItems = patchBudget.lineItems.map((pli: any) => {
            const stored = prevById[String(pli.id || "")] ?? {};
            return {
              ...pli,
              // Never let patch input overwrite these — they are owned by the spend system
              spent: stored.spent ?? 0,
              projected: stored.projected ?? 0,
              spentInWindow: stored.spentInWindow ?? 0,
              projectedInWindow: stored.projectedInWindow ?? 0,
            };
          });
        }

        const mergedInput: Partial<TGrantBudget> = {
          ...prevBudget,
          ...patchBudget,
          lineItems: mergedLineItems,
        };
        nextBudget = normalizeBudget(
          Object.keys(mergedInput).length
            ? (mergedInput as TGrantBudget)
            : null,
        );
      }

      const data: Record<string, unknown> = {
        ...patch,
        status: nextStatus,
        active,
        deleted,
        kind,
        budget: nextBudget,
        ...(normId(prevObj.orgId) ? {} : { orgId: normId(targetOrg) }), // migrate legacy
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(ref, data, { merge: true });

      if (Array.isArray(unset) && unset.length) {
        const delMap: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const path of unset) delMap[path] = FieldValue.delete();
        tx.set(ref, delMap, { merge: true });
      }
    }, "grants_patch_with_budget");
  }

  return { ids };
}

/* ---------------- Delete (soft) ---------------- */

export async function softDeleteGrants(
  ids: string | string[],
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const arr = toArray(ids);
  const snaps = await Promise.all(
    arr.map((id) => db.collection("grants").doc(id).get()),
  );

  snaps.forEach((s) => {
    if (!s.exists) {
      const e = new Error("not_found") as Error & { code: number };
      e.code = 404;
      throw e;
    }
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  const writer = newBulkWriter(2);
  for (const id of arr) {
    writer.set(
      db.collection("grants").doc(id),
      {
        status: "deleted",
        active: false,
        deleted: true,
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
        ...(normId(
          (
            snaps.find((s) => s.id === id)?.data() as
              | { orgId?: unknown }
              | undefined
          )?.orgId,
        )
          ? {}
          : { orgId: normId(targetOrg) }),
      },
      { merge: true },
    );
  }
  await writer.close();

  return { ids: arr, deleted: true as const };
}

/* ---------------- Delete (hard) ---------------- */

export async function hardDeleteGrants(
  ids: string | string[],
  caller: Claims,
  targetOrg: string,
) {
  assertTargetOrgAllowed(caller, targetOrg);

  const arr = toArray(ids);
  const snaps = await Promise.all(
    arr.map((id) => db.collection("grants").doc(id).get()),
  );

  snaps.forEach((s) => {
    if (!s.exists) return;
    assertDocOrgWritable(caller, targetOrg, s.data() || {});
  });

  const batch = db.batch();
  for (const id of arr) {
    batch.delete(db.collection("grants").doc(id));
  }
  await batch.commit();

  return { ids: arr, deleted: true };
}
