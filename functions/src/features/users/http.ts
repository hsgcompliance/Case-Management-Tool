// functions/src/features/users/http.ts
import {
  secureHandler,
  tryDecodeBearer,
  db,
  authAdmin,
  orgIdFromClaims,
  teamIdsFromClaims,
  topRoleFromClaims,
  roleTagsFromClaims,
  isDev,
  isSuperDev,
} from "../../core";
import type { Claims } from "../../core";
import type { AuthedRequest } from "../../core";
import * as logger from "firebase-functions/logger";

import {
  CreateUserBody,
  InviteUserBody,
  SetRoleBody,
  SetActiveBody,
  RevokeSessionsBody,
  ListUsersBody,
  OrgManagerListOrgsBody,
  OrgManagerUpsertOrgBody,
  OrgManagerPatchTeamsBody,
  UpdateMeBody,
} from "./schemas";
import {
  createUserService,
  inviteUserService,
  setUserRoleService,
  setUserActiveService,
  revokeUserSessionsService,
  listUsersService,
  listDevOrgsService,
  upsertDevOrgService,
  patchDevOrgTeamsService,
  updateMeExtrasService,
} from "./service";

function normalizeTeamIds(raw: unknown): string[] | undefined {
  const arr = Array.isArray(raw) ? raw : [];
  const out = Array.from(
    new Set(
      arr
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
  return out.length ? out : undefined;
}

function scopeForManagedUser(caller: Claims, src: { orgId?: unknown; teamIds?: unknown }) {
  const callerOrg = orgIdFromClaims(caller);
  const callerTeams = teamIdsFromClaims(caller);
  const elevated = isDev(caller) || isSuperDev(caller);

  if (!elevated) {
    const orgId = callerOrg || undefined;
    const teamIds = normalizeTeamIds([...(callerTeams || []), ...(callerOrg ? [callerOrg] : [])]);
    return { orgId, teamIds };
  }

  const orgId =
    typeof src.orgId === "string" && src.orgId.trim()
      ? src.orgId.trim()
      : callerOrg || undefined;
  const teamIds = normalizeTeamIds([
    ...(Array.isArray(src.teamIds) ? src.teamIds : []),
    ...(callerOrg ? [callerOrg] : []),
    ...(orgId ? [orgId] : []),
  ]);
  return { orgId, teamIds };
}

function canAssignElevatedTopRole(caller: Claims, topRole?: unknown) {
  const top = String(topRole || "").trim().toLowerCase();
  if (!top) return true;
  if (top === "user" || top === "admin") return true;
  return isSuperDev(caller);
}

// POST /usersCreate (admin)
export const usersCreate = secureHandler(
  async (req, res) => {
    const body = CreateUserBody.parse(req.body);
    const caller: Claims = req.user || {};
    if (!canAssignElevatedTopRole(caller, body.topRole)) {
      res.status(403).json({ ok: false, error: "forbidden_top_role" });
      return;
    }
    const scoped = scopeForManagedUser(caller, body);

    const out = await createUserService({
      ...body,
      orgId: scoped.orgId,
      teamIds: scoped.teamIds,
    });

    res.status(201).json({ ok: true, user: out });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

// POST /usersInvite (admin)
export const usersInvite = secureHandler(
  async (req, res) => {
    const body = InviteUserBody.parse(req.body);
    const caller: Claims = req.user || {};
    if (!canAssignElevatedTopRole(caller, body.topRole)) {
      res.status(403).json({ ok: false, error: "forbidden_top_role" });
      return;
    }
    const scoped = scopeForManagedUser(caller, body);

    const out = await inviteUserService({
      ...body,
      orgId: scoped.orgId,
      teamIds: scoped.teamIds,
    });

    res.status(200).json({ ok: true, user: out });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

// POST /usersSetRole (admin)
export const usersSetRole = secureHandler(
  async (req, res) => {
    const body = SetRoleBody.parse(req.body ?? {});
    const caller: Claims = req.user || {};
    const callerUid = caller?.uid;
    if (!canAssignElevatedTopRole(caller, body.topRole)) {
      res.status(403).json({ ok: false, error: "forbidden_top_role" });
      return;
    }

    // Prevent an admin from demoting themselves out of admin.
    if (callerUid && body.uid === callerUid) {
      const currentTop = topRoleFromClaims(caller);
      const nextTop = body.topRole ?? currentTop;
      if (currentTop === "admin" && nextTop !== "admin") {
        res.status(400).json({ ok: false, error: "cannot_remove_own_admin" });
        return;
      }
      if (currentTop === "super_dev" && nextTop !== "super_dev") {
        res.status(400).json({ ok: false, error: "cannot_remove_own_super_dev" });
        return;
      }
    }

    const out = await setUserRoleService(
      isSuperDev(caller) ? body : { ...body, orgId: undefined, teamIds: undefined }
    );
    res.status(200).json({ ok: true, user: out });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

// POST /usersSetActive (admin)
export const usersSetActive = secureHandler(
  async (req, res) => {
    const body = SetActiveBody.parse(req.body);
    const user = await setUserActiveService(body);
    res.status(200).json({ ok: true, user });
  },
  { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

// POST /usersRevokeSessions (admin, org-scoped unless super_dev)
export const usersRevokeSessions = secureHandler(
  async (req, res) => {
    const body = RevokeSessionsBody.parse(req.body || {});
    const caller: Claims = req.user || {};
    const callerOrgId = orgIdFromClaims(caller);
    const elevated = isSuperDev(caller);

    if (!elevated && !callerOrgId) {
      res.status(403).json({ ok: false, error: "missing_org" });
      return;
    }

    if (!elevated && body.orgId && body.orgId !== callerOrgId) {
      res.status(403).json({ ok: false, error: "forbidden_org_scope" });
      return;
    }

    const out = await revokeUserSessionsService(body, {
      callerOrgId,
      canAccessAllOrgs: elevated,
    });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

// GET|POST /usersList (user, org-scoped)
export const usersList = secureHandler(
  async (req, res) => {
    const src = req.method === "GET" ? req.query : req.body;
    const body = ListUsersBody.parse({
      limit: src?.limit ? Number(src.limit) : undefined,
      pageToken: src?.pageToken,
      status: src?.status,
    });

    const caller: Claims = req.user || {};
    const callerOrg = orgIdFromClaims(caller);
    const requestedOrgId =
      typeof src?.orgId === "string" && src.orgId.trim() ? String(src.orgId).trim() : null;
    const orgId = isSuperDev(caller) ? requestedOrgId : callerOrg;

    const out = await listUsersService(body, { orgId });
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "user", requireOrg: true, methods: ["POST", "GET", "OPTIONS"] }
);

// GET|POST /devOrgsList (super_dev)
export const devOrgsList = secureHandler(
  async (req, res) => {
    const caller: Claims = req.user || {};
    if (!isSuperDev(caller)) {
      res.status(403).json({ ok: false, error: "forbidden_super_dev" });
      return;
    }
    const src = req.method === "GET" ? req.query : req.body;
    const body = OrgManagerListOrgsBody.parse({
      includeInactive:
        src && "includeInactive" in (src as Record<string, unknown>)
          ? String((src as Record<string, unknown>).includeInactive) !== "false"
          : undefined,
    });
    const out = await listDevOrgsService(body);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "admin", methods: ["POST", "GET", "OPTIONS"] }
);

// POST /devOrgsUpsert (super_dev)
export const devOrgsUpsert = secureHandler(
  async (req, res) => {
    const caller: Claims = req.user || {};
    if (!isSuperDev(caller)) {
      res.status(403).json({ ok: false, error: "forbidden_super_dev" });
      return;
    }
    const body = OrgManagerUpsertOrgBody.parse(req.body || {});
    const org = await upsertDevOrgService(body);
    res.status(200).json({ ok: true, org });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

// POST /devOrgsPatchTeams (super_dev)
export const devOrgsPatchTeams = secureHandler(
  async (req, res) => {
    const caller: Claims = req.user || {};
    if (!isSuperDev(caller)) {
      res.status(403).json({ ok: false, error: "forbidden_super_dev" });
      return;
    }
    const body = OrgManagerPatchTeamsBody.parse(req.body || {});
    const org = await patchDevOrgTeamsService(body);
    res.status(200).json({ ok: true, org });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

// GET /usersMe (public, bearer optional)
export const usersMe = secureHandler(
  async (req, res) => {
    const authed = req as AuthedRequest<Claims>;
    const asStr = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v : undefined;
    const authHeader = String(authed.headers?.authorization || "");
    const hasBearer = /^Bearer\s+\S+$/i.test(authHeader.trim());
    const dec: Partial<Claims> =
      (authed.user as Partial<Claims> | undefined) ||
      ((await tryDecodeBearer(authed)) as Partial<Claims> | null) ||
      {};

    const uid = asStr(dec?.uid) || asStr(dec?.user_id) || asStr(dec?.sub);
    if (!uid) {
      if (!hasBearer) {
        res.status(200).json({ ok: true, user: null });
        return;
      }
      const revoked = authed.__revoked === true;
      res
        .status(401)
        .json({ ok: false, error: revoked ? "token_revoked" : "unauthenticated" });
      return;
    }

    // Pull extras + *fresh* claims from Admin
    const [snap, rec] = await Promise.all([
      db.doc(`userExtras/${uid}`).get().catch(() => null),
      authAdmin.getUser(uid).catch(() => null),
    ]);

    const extra = (snap?.exists ? snap.data() : {}) as Record<string, unknown>;
    const ccRaw = (rec?.customClaims || {}) as Partial<Claims>;

    // Build canonical Claims for RBAC
    const claims: Claims = {
      ...ccRaw,
      uid,
      orgId: ccRaw.orgId ?? extra.orgId ?? null,
      teamIds: Array.isArray(ccRaw.teamIds)
        ? ccRaw.teamIds
        : Array.isArray(extra.teamIds)
        ? extra.teamIds
        : undefined,
      caps: Array.isArray(ccRaw.caps)
        ? ccRaw.caps
        : Array.isArray(extra.caps)
        ? extra.caps
        : undefined,
    };

    const topRole = topRoleFromClaims(claims);
    const roles = roleTagsFromClaims(claims); // tags only, ladder stripped
    const orgId = claims.orgId || null;

    const teamIds =
      Array.isArray(claims.teamIds) && claims.teamIds.length
        ? claims.teamIds
        : teamIdsFromClaims({ ...claims, orgId });

    const active =
      Object.prototype.hasOwnProperty.call(extra, "active")
        ? extra.active !== false
        : rec
        ? !rec.disabled
        : true;

    const profile = {
      ...(extra || {}),
      extras: extra,
      uid,
      email: rec?.email || extra.email || null,
      displayName: rec?.displayName || extra.displayName || null,
      photoURL: rec?.photoURL || extra.photoURL || null,
      topRole,
      roles,
      orgId,
      teamIds,
      active,
    };

    logger.info("usersMe_ok", {
      uid,
      topRole,
      rolesLen: roles.length,
      orgId,
      teamIdsLen: teamIds.length,
      active,
    });

    res.json({ ok: true, user: profile });
  },
  { auth: "public", methods: ["GET", "OPTIONS"] }
);

// POST /usersMeUpdate (user)
export const usersMeUpdate = secureHandler(
  async (req, res) => {
    const uid = String(req.user?.uid || "");
    if (!uid) {
      res.status(401).json({ ok: false, error: "auth_required" });
      return;
    }
    const body = UpdateMeBody.parse(req.body || {});
    const out = await updateMeExtrasService(uid, body.updates);
    res.status(200).json({ ok: true, ...out });
  },
  { auth: "authed", methods: ["POST", "OPTIONS"] }
);
