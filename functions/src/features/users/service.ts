// functions/src/features/users/service.ts
import { authAdmin, db, FieldValue, orgIdFromClaims, WEB_BASE_URL, newBulkWriter} from "../../core";
import type { UserRecord } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";
import { ensureOrgConfigDefaults } from "../orgs/service";
import {
  CreateUserBody,
  InviteUserBody,
  SetRoleBody,
  SetActiveBody,
  UpdateUserProfileBody,
  ResendInviteBody,
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
  UpdateUserProfileBodyIn,
  ResendInviteBodyIn,
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

function inviteContinueUrl(input?: string | null) {
  if (input) return input;
  const base = String(WEB_BASE_URL.value() || "https://housing-db-v2.web.app").replace(/\/+$/, "");
  return `${base}/login`;
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
    case "viewer":
      return "viewer";
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

const DOTTED_PAYMENT_FIELDS = [
  "paymentMetrics.amountNextMonth",
  "paymentMetrics.amountThisMonth",
  "paymentMetrics.amountTotal",
  "paymentMetrics.unpaidNextMonth",
  "paymentMetrics.unpaidThisMonth",
  "paymentMetrics.unpaidTotal",
  "paymentMetrics.updatedAt",
  "paymentMetrics.reconciledAt",
] as const;

const DOTTED_TASK_FIELDS = [
  "taskMetrics.openThisMonth",
  "taskMetrics.openNextMonth",
  "taskMetrics.updatedAt",
  "taskMetrics.reconciledAt",
  "taskMetrics.byType.assessment.thisMonth",
  "taskMetrics.byType.assessment.nextMonth",
  "taskMetrics.byType.compliance.thisMonth",
  "taskMetrics.byType.compliance.nextMonth",
  "taskMetrics.byType.other.thisMonth",
  "taskMetrics.byType.other.nextMonth",
] as const;

const DOTTED_CORRUPT_FIELDS = [
  ...DOTTED_PAYMENT_FIELDS,
  ...DOTTED_TASK_FIELDS,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function withoutCorruptDottedFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!DOTTED_CORRUPT_FIELDS.includes(key as (typeof DOTTED_CORRUPT_FIELDS)[number])) {
      out[key] = value;
    }
  }
  return out;
}

function dottedPrefixToNested(input: Record<string, unknown>, prefix: string, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const parts = field.slice(prefix.length + 1).split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      cur[key] = isRecord(cur[key]) ? cur[key] : {};
      cur = cur[key] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = input[field];
  }
  return out;
}

function mergeRecordsDeep(left: Record<string, unknown>, right: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    out[key] = isRecord(out[key]) && isRecord(value)
      ? mergeRecordsDeep(out[key] as Record<string, unknown>, value)
      : value;
  }
  return out;
}

function trimOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function contactCaseManagerIdsFromCustomer(input: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const add = (value: unknown) => {
    const id = trimOrNull(value);
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(input.caseManagerId);
  add(input.secondaryCaseManagerId);
  if (Array.isArray(input.otherContacts)) {
    for (const contact of input.otherContacts) add((contact as Record<string, unknown> | null)?.uid);
  }
  return ids.slice(0, 5);
}

async function cascadeInactiveUserOffPrimaryCustomers(uid: string): Promise<{
  scanned: number;
  updated: number;
  promoted: number;
  unassigned: number;
}> {
  const userId = trimOrNull(uid);
  if (!userId) return { scanned: 0, updated: 0, promoted: 0, unassigned: 0 };

  const snap = await db
    .collection("customers")
    .where("caseManagerId", "==", userId)
    .where("active", "==", true)
    .get();

  if (snap.empty) return { scanned: 0, updated: 0, promoted: 0, unassigned: 0 };

  const writer = newBulkWriter(2);
  let scanned = 0;
  let updated = 0;
  let promoted = 0;
  let unassigned = 0;

  snap.forEach((doc) => {
    scanned += 1;
    const row = (doc.data() || {}) as Record<string, unknown>;
    const secondaryId = trimOrNull(row.secondaryCaseManagerId);
    const secondaryName = trimOrNull(row.secondaryCaseManagerName);
    const patch: Record<string, unknown> = {
      caseManagerId: secondaryId,
      caseManagerName: secondaryName,
      secondaryCaseManagerId: null,
      secondaryCaseManagerName: null,
      updatedAt: FieldValue.serverTimestamp(),
      system: {
        lastWriter: "usersSetActive",
        lastWriteAt: FieldValue.serverTimestamp(),
      },
    };
    patch.contactCaseManagerIds = contactCaseManagerIdsFromCustomer({
      ...row,
      ...patch,
    });

    writer.set(doc.ref, patch, { merge: true });
    updated += 1;
    if (secondaryId) promoted += 1;
    else unassigned += 1;
  });

  if (updated) await writer.close();
  logger.info("usersSetActive_cascade_primary_customers", {
    uid: userId,
    scanned,
    updated,
    promoted,
    unassigned,
  });
  return { scanned, updated, promoted, unassigned };
}

export function normalizeUserExtrasForRead(rawExtras: unknown): Record<string, unknown> {
  const raw = isRecord(rawExtras) ? rawExtras : {};
  const cleaned = withoutCorruptDottedFields(raw);
  const settings = isRecord(cleaned.settings) ? cleaned.settings : {};
  const paymentMetrics = {
    amountNextMonth: 0,
    amountThisMonth: 0,
    amountTotal: 0,
    unpaidNextMonth: 0,
    unpaidThisMonth: 0,
    unpaidTotal: 0,
    ...dottedPrefixToNested(raw, "paymentMetrics", DOTTED_PAYMENT_FIELDS),
    ...(isRecord(cleaned.paymentMetrics) ? cleaned.paymentMetrics : {}),
  };
  const taskMetrics = mergeRecordsDeep(
    dottedPrefixToNested(raw, "taskMetrics", DOTTED_TASK_FIELDS),
    isRecord(cleaned.taskMetrics) ? cleaned.taskMetrics : {},
  );

  return {
    ...cleaned,
    meta: isRecord(cleaned.meta) ? cleaned.meta : {},
    digestSubs: isRecord(cleaned.digestSubs) ? cleaned.digestSubs : {},
    paymentMetrics,
    ...(Object.keys(taskMetrics).length ? { taskMetrics } : {}),
    settings: {
      ...settings,
      pageLayouts: isRecord(settings.pageLayouts) ? settings.pageLayouts : {},
      dashboardPrefs: isRecord(settings.dashboardPrefs) ? settings.dashboardPrefs : {},
      toolsPrefs: isRecord(settings.toolsPrefs) ? settings.toolsPrefs : {},
      spendingViews: isRecord(settings.spendingViews) ? settings.spendingViews : {},
    },
  };
}

export async function getUserComposite(u: UserRecord) {
  const extraSnap = await db.collection("userExtras").doc(u.uid).get().catch(() => null);
  const extras = normalizeUserExtrasForRead(extraSnap?.exists ? extraSnap.data() || {} : {});

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
    try {
      const resetLink = await authAdmin.generatePasswordResetLink(body.email, {
        url: inviteContinueUrl(body.continueUrl),
        handleCodeInApp: false,
      });
      const { sendInviteService } = await import("../inbox/emailer.js");
      sent = await sendInviteService({
        to: body.email,
        name: body.name || "",
        resetLink,
      });
    } catch (err: any) {
      logger.warn("usersInvite_email_failed", {
        email: body.email,
        code: err?.code || null,
        message: err?.message || String(err || "unknown_error"),
      });
      sent = {
        ok: false,
        error: "invite_email_failed",
        message: err?.message || "Invite email was not sent.",
      };
    }
  }

  const composite = await toComposite(rec.uid);
  return { ...composite, inviteEmail: sent };
}

export async function updateUserProfileService(input: UpdateUserProfileBodyIn) {
  const body = UpdateUserProfileBody.parse(input);
  const displayName =
    body.displayName == null || String(body.displayName).trim() === ""
      ? null
      : String(body.displayName).trim();

  await authAdmin.updateUser(body.uid, { displayName });
  await db.collection("userExtras").doc(body.uid).set(
    {
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return toComposite(body.uid);
}

export async function resendInviteService(input: ResendInviteBodyIn) {
  const body = ResendInviteBody.parse(input);
  const rec = body.uid
    ? await authAdmin.getUser(body.uid)
    : await authAdmin.getUserByEmail(body.email!);

  if (!rec.email) {
    const e = new Error("missing_email") as Error & { code: number };
    e.code = 400;
    throw e;
  }

  let sent: any;
  try {
    const resetLink = await authAdmin.generatePasswordResetLink(rec.email, {
      url: inviteContinueUrl(body.continueUrl),
      handleCodeInApp: false,
    });
    const { sendInviteService } = await import("../inbox/emailer.js");
    sent = await sendInviteService({
      to: rec.email,
      name: rec.displayName || "",
      resetLink,
    });
  } catch (err: any) {
    logger.warn("usersResendInvite_email_failed", {
      uid: rec.uid,
      email: rec.email,
      code: err?.code || null,
      message: err?.message || String(err || "unknown_error"),
    });
    sent = {
      ok: false,
      error: "invite_email_failed",
      message: err?.message || "Invite email was not sent.",
    };
  }

  const user = await toComposite(rec.uid);
  return { user, inviteEmail: sent };
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
      : prevCC.topRole === "viewer"
      ? "viewer"
      : "user";

  const nextClaims = claimsFromShape({
    topRole: nextTop,
    tags: nextTags,
    orgId,
    teamIds,
  });

  await setClaimsMerged(body.uid, nextClaims);

  if ("displayName" in body) {
    const displayName =
      body.displayName == null || String(body.displayName).trim() === ""
        ? null
        : String(body.displayName).trim();
    await authAdmin.updateUser(body.uid, { displayName });
    await db.collection("userExtras").doc(body.uid).set(
      {
        displayName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

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

  if (!active) {
    await cascadeInactiveUserOffPrimaryCustomers(uid);
  }

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
  return { uid, extras: normalizeUserExtrasForRead(snap.data() || {}) };
}
