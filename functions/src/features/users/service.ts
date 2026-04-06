// functions/src/features/users/service.ts
import { authAdmin, db, FieldValue, orgIdFromClaims} from "../../core";
import type { UserRecord } from "firebase-admin/auth";
import { ensureOrgConfigDefaults } from "../orgs/service";
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
  UserExtras,
  RolesArray,
} from "./schemas";

import type {
  CreateUserBodyIn,
  InviteUserBodyIn,
  SetRoleBodyIn,
  SetActiveBodyIn,
  RevokeSessionsBodyIn,
  ListUsersBodyIn,
  OrgManagerOrgT,
  OrgManagerListOrgsBodyIn,
  OrgManagerUpsertOrgBodyIn,
  OrgManagerPatchTeamsBodyIn,
  TUserExtras,
  TRoleTag,
  TTopRole,
  TTopRoleLadder,
} from "./schemas";

/* -------------------------------------------
   Claims shaping
-------------------------------------------- */
type Tag = TRoleTag;

function normalizeTags(input?: unknown): Tag[] {
  const arr = Array.isArray(input) ? input : input != null ? [input] : undefined;
  const parsed = RolesArray.parse(arr as any); // default handles undefined
  return Array.from(new Set(parsed)) as Tag[];
}

function claimsFromShape(shape: {
  topRole: TTopRoleLadder | TTopRole;
  tags: Tag[];
  orgId?: string | null;
  teamIds?: string[];
}) {
  const orgId = shape.orgId || null;
  const teamIds = Array.from(
    new Set([...(shape.teamIds || []), ...(orgId ? [orgId] : [])])
  ).slice(0, 10);

  return {
    topRole: shape.topRole,
    roles: shape.tags, // FE tags only
    orgId,
    teamIds,
  };
}

async function setClaimsMerged(uid: string, nextClaims: Record<string, any>, revoke = true) {
  const rec = await authAdmin.getUser(uid);
  const existing = (rec.customClaims || {}) as Record<string, unknown>;
  const merged = { ...existing, ...nextClaims };
  await authAdmin.setCustomUserClaims(uid, merged);
  if (revoke) await authAdmin.revokeRefreshTokens(uid);
}

function canonTopRole(topRole?: TTopRole): TTopRoleLadder {
  switch (topRole) {
    case "admin":
      return "admin";
    case "dev":
      return "dev";
    case "org_dev":
      return "org_dev";
    case "super_dev":
      return "super_dev";
    case "user":
    default:
      return "user";
  }
}

/* -------------------------------------------
   Utilities
-------------------------------------------- */

export async function getUserComposite(u: UserRecord) {
  const extraSnap = await db.collection("userExtras").doc(u.uid).get().catch(() => null);
  const extras = extraSnap?.exists ? extraSnap.data() || {} : {};

  const cc: any = u.customClaims || {};
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.displayName || null,
    photoURL: u.photoURL || null,
    phone: u.phoneNumber || null,
    disabled: u.disabled,
    active: !u.disabled,

    topRole: cc.topRole || "unverified",
    roles: Array.isArray(cc.roles) ? cc.roles : [],
    orgId: cc.orgId || null,
    teamIds: Array.isArray(cc.teamIds) ? cc.teamIds : [],

    createdAt: u.metadata?.creationTime || null,
    lastLogin: u.metadata?.lastSignInTime || null,
    extras,
  };
}

export async function toComposite(uid: string) {
  const fresh = await authAdmin.getUser(uid);
  return getUserComposite(fresh);
}

/* -------------------------------------------
   Create / Invite
-------------------------------------------- */

export async function createUserService(input: CreateUserBodyIn) {
  const body = CreateUserBody.parse(input);

  const tags = normalizeTags(body.roles);
  const topRole: TTopRoleLadder = canonTopRole(body.topRole);

  const rec = await authAdmin.createUser({
    email: body.email,
    password: body.password,
    displayName: body.name || undefined,
  });

  const nextClaims = claimsFromShape({
    topRole,
    tags,
    orgId: body.orgId,
    teamIds: body.teamIds,
  });

  await setClaimsMerged(rec.uid, nextClaims);

  await db.collection("userExtras").doc(rec.uid).set(
    { createdAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  return toComposite(rec.uid);
}

export async function inviteUserService(input: InviteUserBodyIn) {
  const body = InviteUserBody.parse(input);

  const tags = normalizeTags(body.roles);
  const topRole: TTopRoleLadder = canonTopRole(body.topRole);

  let rec: UserRecord;
  try {
    rec = await authAdmin.getUserByEmail(body.email);
  } catch {
    rec = await authAdmin.createUser({
      email: body.email,
      displayName: body.name || undefined,
    });
  }

  const nextClaims = claimsFromShape({
    topRole,
    tags,
    orgId: body.orgId,
    teamIds: body.teamIds,
  });

  await setClaimsMerged(rec.uid, nextClaims);

  await db.collection("userExtras").doc(rec.uid).set(
    { invitedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  let sent: any = null;
  if (body.sendEmail) {
    const resetLink = await authAdmin.generatePasswordResetLink(body.email, {
      url: body.continueUrl || "https://household-database.app/login",
      handleCodeInApp: false,
    });
    const { sendInviteService } = await import("../inbox/emailer.js");
    sent = await sendInviteService({
      to: body.email,
      name: body.name || "",
      resetLink,
    });
  }

  const composite = await toComposite(rec.uid);
  return { ...composite, inviteEmail: sent };
}

/* -------------------------------------------
   Roles / org / teams
-------------------------------------------- */

export async function setUserRoleService(input: SetRoleBodyIn) {
  const body = SetRoleBody.parse(input);

  const prev = await authAdmin.getUser(body.uid);
  const prevCC: any = prev.customClaims || {};

  const nextTags =
    body.roles != null ? normalizeTags(body.roles) : normalizeTags(prevCC.roles);

  const orgId = body.orgId ?? prevCC.orgId ?? null;
  const teamIds = body.teamIds ?? prevCC.teamIds ?? [];

  // Only allow canonical ladder from this endpoint:
  // - if provided: admin|user
  // - else: preserve admin if already admin, otherwise user
  const nextTop: TTopRoleLadder =
    body.topRole != null
      ? canonTopRole(body.topRole)
      : prevCC.topRole === "admin"
      ? "admin"
      : prevCC.topRole === "dev"
      ? "dev"
      : prevCC.topRole === "org_dev"
      ? "org_dev"
      : prevCC.topRole === "super_dev"
      ? "super_dev"
      : "user";

  const nextClaims = claimsFromShape({
    topRole: nextTop,
    tags: nextTags,
    orgId,
    teamIds,
  });

  await setClaimsMerged(body.uid, nextClaims);

  await db.collection("userTasks").doc(`userverify|${body.uid}`).delete().catch(() => {});
  return toComposite(body.uid);
}

/* -------------------------------------------
   Active
-------------------------------------------- */

export async function setUserActiveService(input: SetActiveBodyIn) {
  const { uid, active } = SetActiveBody.parse(input);

  await authAdmin.updateUser(uid, { disabled: !active });
  await authAdmin.revokeRefreshTokens(uid);

  if (active) {
    await db.collection("userTasks").doc(`userverify|${uid}`).delete().catch(() => {});
  }

  return toComposite(uid);
}

export async function revokeUserSessionsService(
  input: RevokeSessionsBodyIn,
  opts: { callerOrgId?: string | null; canAccessAllOrgs?: boolean } = {}
) {
  const body = RevokeSessionsBody.parse(input || {});
  const callerOrgId = String(opts.callerOrgId || "").trim() || null;
  const canAccessAllOrgs = opts.canAccessAllOrgs === true;
  const requestedOrgId = String(body.orgId || "").trim() || null;

  if (!canAccessAllOrgs && requestedOrgId && requestedOrgId !== callerOrgId) {
    const e = new Error("forbidden_org_scope") as Error & { code: number };
    e.code = 403;
    throw e;
  }

  const effectiveOrgId = canAccessAllOrgs ? requestedOrgId : callerOrgId;

  let pageToken: string | undefined;
  let pages = 0;
  let scanned = 0;
  let revoked = 0;

  do {
    const page = await authAdmin.listUsers(1000, pageToken);
    pageToken = page.pageToken || undefined;
    pages += 1;

    const matches = page.users.filter((u) => {
      if (!effectiveOrgId) return true;
      const userOrgId = orgIdFromClaims((u.customClaims || {}) as Record<string, unknown>);
      return userOrgId === effectiveOrgId;
    });

    scanned += matches.length;
    await Promise.all(matches.map((u) => authAdmin.revokeRefreshTokens(u.uid)));
    revoked += matches.length;
  } while (pageToken);

  return {
    orgId: effectiveOrgId,
    scope: effectiveOrgId ? "org" as const : "all" as const,
    scanned,
    revoked,
    pages,
  };
}

/* -------------------------------------------
   List (ADMIN ONLY)
-------------------------------------------- */

export async function listUsersService(
  input: ListUsersBodyIn,
  opts?: { orgId?: string | null }
) {
  const { limit, pageToken, status } = ListUsersBody.parse(input || {});
  const res = await authAdmin.listUsers(limit, pageToken);

  const orgId = opts?.orgId || null;
  let users = res.users.map((u) => {
    const cc: any = u.customClaims || {};
    return {
      uid: u.uid,
      email: u.email || null,
      displayName: u.displayName || null,
      photoURL: u.photoURL || null,
      phone: u.phoneNumber || null,
      disabled: u.disabled,
      active: !u.disabled,
      topRole: cc.topRole || "unverified",
      roles: Array.isArray(cc.roles) ? cc.roles : [],
      orgId: cc.orgId || null,
      teamIds: Array.isArray(cc.teamIds) ? cc.teamIds : [],
      createdAt: u.metadata?.creationTime || null,
      lastLogin: u.metadata?.lastSignInTime || null,
    };
  });

  if (orgId) users = users.filter((u) => u.orgId === orgId);
  if (status === "active") users = users.filter((u) => u.active);
  if (status === "inactive") users = users.filter((u) => !u.active);

  return { users, nextPageToken: res.pageToken || null };
}

/* -------------------------------------------
   Dev Org Manager (SUPER DEV)
-------------------------------------------- */

function normalizeOrgId(v: unknown) {
  return String(v || "").trim();
}

function normalizeTeamRow(v: unknown): { id: string; name?: string; active: boolean } | null {
  if (typeof v === "string") {
    const id = normalizeOrgId(v);
    return id ? { id, active: true } : null;
  }
  if (!v || typeof v !== "object") return null;
  const row = v as Record<string, unknown>;
  const id = normalizeOrgId(row.id);
  if (!id) return null;
  const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : undefined;
  const active = row.active !== false;
  return { id, ...(name ? { name } : {}), active };
}

function normalizeOrgDoc(id: string, raw: Record<string, unknown> | undefined | null): OrgManagerOrgT {
  const teams = Array.isArray(raw?.teams)
    ? (raw?.teams as unknown[])
        .map(normalizeTeamRow)
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];

  return {
    ...(raw || {}),
    id,
    name: String(raw?.name || id).trim() || id,
    active: raw?.active !== false,
    teams,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

// ensureOrgConfigDefaults is imported from ../orgs/service

export async function listDevOrgsService(input: OrgManagerListOrgsBodyIn) {
  const { includeInactive } = OrgManagerListOrgsBody.parse(input || {});
  const snap = await db.collection("orgs").get();
  let items = snap.docs.map((d) => normalizeOrgDoc(d.id, d.data() || {}));
  if (!includeInactive) items = items.filter((o) => o.active !== false);
  items.sort((a, b) => a.id.localeCompare(b.id));
  return { items };
}

export async function upsertDevOrgService(input: OrgManagerUpsertOrgBodyIn) {
  const body = OrgManagerUpsertOrgBody.parse(input || {});
  const ref = db.collection("orgs").doc(body.id);
  const prev = await ref.get();
  const prevData = (prev.exists ? prev.data() : null) as Record<string, unknown> | null;

  await ref.set(
    {
      ...(prevData || {}),
      id: body.id,
      orgId: body.id,
      name: body.name,
      active: body.active !== false,
      ...(prev.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await ensureOrgConfigDefaults(ref, body.id);

  const next = await ref.get();
  return normalizeOrgDoc(body.id, (next.data() || {}) as Record<string, unknown>);
}

export async function patchDevOrgTeamsService(input: OrgManagerPatchTeamsBodyIn) {
  const body = OrgManagerPatchTeamsBody.parse(input || {});
  const ref = db.collection("orgs").doc(body.orgId);
  const snap = await ref.get();
  const raw = (snap.exists ? snap.data() : null) as Record<string, unknown> | null;
  const currentTeams = Array.isArray(raw?.teams)
    ? (raw!.teams as unknown[]).map(normalizeTeamRow).filter((x): x is NonNullable<typeof x> => !!x)
    : [];

  const byId = new Map(currentTeams.map((t) => [t.id, t]));

  for (const item of body.add || []) {
    const next = normalizeTeamRow(item);
    if (!next) continue;
    const prev = byId.get(next.id);
    byId.set(next.id, { ...prev, ...next, id: next.id, active: next.active !== false });
  }

  for (const idRaw of body.remove || []) {
    const id = normalizeOrgId(idRaw);
    if (!id) continue;
    byId.delete(id);
  }

  const teams = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));

  await ref.set(
    {
      id: body.orgId,
      orgId: body.orgId,
      name: String(raw?.name || body.orgId).trim() || body.orgId,
      active: raw?.active !== false,
      teams,
      ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await ensureOrgConfigDefaults(ref, body.orgId);

  const next = await ref.get();
  return normalizeOrgDoc(body.orgId, (next.data() || {}) as Record<string, unknown>);
}

/* -------------------------------------------
   Me / Extras
-------------------------------------------- */

export async function updateMeExtrasService(
  uid: string,
  updates: TUserExtras,
  opts?: { remove?: string[] }
) {
  const clean = UserExtras.parse(updates || {});
  const ref = db.collection("userExtras").doc(uid);

  const toSet: Record<string, unknown> = {
    ...clean,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (opts?.remove?.length) {
    for (const path of opts.remove) (toSet as any)[path] = FieldValue.delete();
  }

  await ref.set(toSet, { merge: true });
  const snap = await ref.get();
  return { uid, extras: snap.data() || {} };
}
