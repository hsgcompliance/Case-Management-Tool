// functions/src/features/orgs/http.ts
// Org config CRUD:
//   GET  /orgGet          — caller's org doc + all Config subcollection docs
//   GET  /orgConfigGet    — single Config doc by id
//   POST /orgConfigPatch  — update fields on a Config doc (any verified org user)
//   POST /orgCreate       — create an org doc + seed Config defaults (org_dev+)
//   POST /orgDelete       — delete an org doc (org_dev+)
import { z } from "zod";
import {
  secureHandler,
  db,
  isoNow,
  FieldValue,
  requireOrg,
  orgIdFromClaims,
  requireLevel,
  isDev,
  isOrgDev,
  isSuperDev,
} from "../../core";
import { ensureOrgConfigDefaults } from "./service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireOrgAccess(caller: Record<string, unknown>, orgId: string) {
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg !== orgId && !isDev(caller) && !isOrgDev(caller) && !isSuperDev(caller)) {
    const e: any = new Error("forbidden");
    e.code = 403;
    throw e;
  }
}

async function readOrgWithConfig(orgId: string) {
  const orgRef = db.collection("orgs").doc(orgId);
  const [orgSnap, configSnap] = await Promise.all([
    orgRef.get(),
    orgRef.collection("Config").get(),
  ]);

  if (!orgSnap.exists) return null;

  const config = Object.fromEntries(
    configSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }])
  );

  return { id: orgId, ...orgSnap.data(), config };
}

// ── GET /orgGet ───────────────────────────────────────────────────────────────

export const orgGet = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const rawOrgId = (req.query?.orgId as string | undefined)?.trim();
    const orgId = rawOrgId || requireOrg(caller);

    requireOrgAccess(caller, orgId);

    const org = await readOrgWithConfig(orgId);
    if (!org) {
      res.status(404).json({ ok: false, error: "org_not_found" });
      return;
    }
    res.status(200).json({ ok: true, org });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

// ── GET /orgConfigGet ─────────────────────────────────────────────────────────

export const orgConfigGet = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const orgId  = requireOrg(caller);
    const configId = (req.query?.configId as string | undefined)?.trim();

    if (!configId) {
      res.status(400).json({ ok: false, error: "configId required" });
      return;
    }

    requireOrgAccess(caller, orgId);

    const snap = await db.collection("orgs").doc(orgId).collection("Config").doc(configId).get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "config_not_found" });
      return;
    }
    res.status(200).json({ ok: true, config: { id: snap.id, ...snap.data() } });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

// ── POST /orgConfigPatch ──────────────────────────────────────────────────────

const OrgConfigPatchBody = z.object({
  configId: z.string().min(1),
  patch:    z.record(z.string(), z.unknown()),
  orgId:    z.string().optional(), // devs can specify an explicit orgId
});

const PROTECTED_FIELDS = new Set(["id", "orgId", "kind", "createdAt", "updatedAt"]);

export const orgConfigPatch = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const { configId, patch, orgId: explicitOrgId } = OrgConfigPatchBody.parse(req.body || {});

    const orgId = explicitOrgId && (isDev(caller) || isSuperDev(caller))
      ? explicitOrgId
      : requireOrg(caller);

    requireOrgAccess(caller, orgId);

    // Strip protected fields from the patch
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([k]) => !PROTECTED_FIELDS.has(k))
    );

    const ref = db.collection("orgs").doc(orgId).collection("Config").doc(configId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "config_not_found" });
      return;
    }

    await ref.set({ ...safePatch, updatedAt: isoNow(), updatedBy: (caller as any).uid || null }, { merge: true });

    const updated = await ref.get();
    res.status(200).json({ ok: true, config: { id: updated.id, ...updated.data() } });
  },
  { auth: "user", methods: ["POST", "PATCH", "OPTIONS"] }
);

// ── POST /orgCreate ───────────────────────────────────────────────────────────

const OrgCreateBody = z.object({
  id:   z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(120),
});

export const orgCreate = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;

    // org_dev or super_dev only
    if (!isOrgDev(caller) && !isSuperDev(caller)) {
      res.status(403).json({ ok: false, error: "requires_org_dev" });
      return;
    }

    const { id, name } = OrgCreateBody.parse(req.body || {});

    const ref = db.collection("orgs").doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      res.status(409).json({ ok: false, error: "org_already_exists" });
      return;
    }

    await ref.set({
      id,
      orgId: id,
      name,
      active: true,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });

    await ensureOrgConfigDefaults(ref, id);

    const org = await readOrgWithConfig(id);
    res.status(200).json({ ok: true, org });
  },
  { auth: "dev", methods: ["POST", "OPTIONS"] }
);

// ── POST /orgDelete ───────────────────────────────────────────────────────────

const OrgDeleteBody = z.object({
  orgId: z.string().min(1),
});

export const orgDelete = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;

    if (!isOrgDev(caller) && !isSuperDev(caller)) {
      res.status(403).json({ ok: false, error: "requires_org_dev" });
      return;
    }

    const { orgId } = OrgDeleteBody.parse(req.body || {});
    requireOrgAccess(caller, orgId);

    const ref = db.collection("orgs").doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ ok: false, error: "org_not_found" });
      return;
    }

    // Delete all Config subcollection docs first
    const configSnap = await ref.collection("Config").get();
    const batch = db.batch();
    configSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();

    res.status(200).json({ ok: true, deleted: orgId });
  },
  { auth: "dev", methods: ["POST", "OPTIONS"] }
);
