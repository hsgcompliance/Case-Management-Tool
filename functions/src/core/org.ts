// functions/src/core/org.ts
import type {Claims} from './rbac';
import {isSuperDev} from './rbac';
import {normId} from './norm';

const norm = normId;

const nestedClaimObjects = (c: Claims): Record<string, unknown>[] => {
  const anyC = c as any;
  const candidates = [
    anyC?.claims,
    anyC?.customClaims,
    anyC?.customClaims?.claims,
    anyC?.userExtras,
  ];

  return candidates.filter(
      (value): value is Record<string, unknown> =>
        !!value && typeof value === 'object' && !Array.isArray(value),
  );
};

/** Home org. Required for org-scoped endpoints. Legacy keys tolerated. */
export function orgIdFromClaims(c: Claims): string | null {
  const anyC = c as any;
  const directId = norm(
      anyC?.orgId ||
    anyC?.orgID ||
    anyC?.organizationId ||
    anyC?.org ||
    null,
  );
  if (directId) return directId;

  for (const nested of nestedClaimObjects(c)) {
    const nestedId = norm(
        nested.orgId ||
      nested.orgID ||
      nested.organizationId ||
      nested.org ||
      null,
    );
    if (nestedId) return nestedId;
  }

  return null;
}

/**
 * User team ids. Always includes orgId as default team.
 * Supports legacy teamId and teamIds[].
 * Enforces max 10 teams.
 */
export function teamIdsFromClaims(c: Claims): string[] {
  const orgId = orgIdFromClaims(c);
  const rawTeamValues: unknown[] = [];

  const pushTeamValue = (value: unknown) => {
    if (Array.isArray(value)) {
      rawTeamValues.push(...value);
      return;
    }
    rawTeamValues.push(value);
  };

  pushTeamValue((c as any)?.teamIds);
  pushTeamValue((c as any)?.teamId);

  for (const nested of nestedClaimObjects(c)) {
    pushTeamValue(nested.teamIds);
    pushTeamValue(nested.teamId);
  }

  const out = new Set<string>();
  if (orgId) out.add(orgId);

  for (const t of rawTeamValues) {
    const id = norm(t);
    if (id) out.add(id);
  }

  return Array.from(out).slice(0, 10);
}

export function requireOrg(c: Claims) {
  const orgId = orgIdFromClaims(c);
  if (!orgId) {
    const e: any = new Error('missing_org');
    e.code = 403;
    e.meta = {need: 'orgId'};
    throw e;
  }
  return orgId;
}

export function requireTeams(c: Claims) {
  const teams = teamIdsFromClaims(c);
  if (!teams.length) {
    const e: any = new Error('missing_team');
    e.code = 403;
    e.meta = {need: 'teamIds'};
    throw e;
  }
  return teams;
}

/** True if doc teams overlap user teams OR owned by user org. */
export function hasTeamAccess(
    c: Claims,
    docTeamIds: unknown,
    docOrgId?: unknown,
) {
  if (isSuperDev(c)) return true;

  const userOrg = orgIdFromClaims(c);
  const userTeams = new Set(teamIdsFromClaims(c));

  if (userOrg && norm(docOrgId) === userOrg) return true;

  const teams = Array.isArray(docTeamIds) ?
    docTeamIds.map(norm).filter(Boolean) :
    [];

  for (const t of teams) {
    if (userTeams.has(t)) return true;
  }
  return false;
}

export function requireTeamAccess(
    c: Claims,
    docTeamIds: unknown,
    docOrgId?: unknown,
) {
  if (hasTeamAccess(c, docTeamIds, docOrgId)) return;

  const e: any = new Error('forbidden');
  e.code = 403;
  e.meta = {need: 'team_overlap_or_owner_org'};
  throw e;
}
