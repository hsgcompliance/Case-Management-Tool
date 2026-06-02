/**
 * Client-side duplicate customer scoring.
 * Pure functions — no side effects, no imports from the app.
 */

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const matchDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1m = new Array(s1.length).fill(false);
  const s2m = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, s2.length);
    for (let j = lo; j < hi; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = true;
      s2m[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

function jaroWinkler(s1: string, s2: string): number {
  const j = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

function n(s?: string | null): string {
  return String(s ?? "").toLowerCase().trim();
}

function dobYear(dob: string): string {
  return dob.slice(0, 4);
}

export type DupTier =
  | "exact-cwid"
  | "exact-all"
  | "name-dob-year"
  | "name-only"
  | "last-dob"
  | "first-dob"
  | "dob-only"
  | "fuzzy-name";

export interface DupCandidate {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  dob?: string | null;
  cwId?: string | null;
  [key: string]: unknown;
}

export interface DupMatch<T extends DupCandidate = DupCandidate> {
  customer: T;
  score: number;
  tier: DupTier;
  reasons: string[];
}

export function scoreDuplicate<T extends DupCandidate>(
  candidate: T,
  query: { firstName: string; lastName: string; dob: string; cwId: string },
): DupMatch<T> | null {
  const qFirst = n(query.firstName);
  const qLast  = n(query.lastName);
  const qDob   = n(query.dob);
  const qCwId  = n(query.cwId);

  const cFirst = n(candidate.firstName);
  const cLast  = n(candidate.lastName);
  const cDob   = n(candidate.dob);
  const cCwId  = n(candidate.cwId);

  if (qCwId && cCwId && qCwId === cCwId) {
    return { customer: candidate, score: 100, tier: "exact-cwid", reasons: ["CW ID matches exactly"] };
  }

  const firstExact = !!(qFirst && cFirst && qFirst === cFirst);
  const lastExact  = !!(qLast  && cLast  && qLast  === cLast);
  const dobExact   = !!(qDob   && cDob   && qDob   === cDob);

  if (firstExact && lastExact && dobExact) {
    return { customer: candidate, score: 95, tier: "exact-all", reasons: ["First name, last name, and date of birth all match"] };
  }

  if (firstExact && lastExact && qDob && cDob && dobYear(qDob) === dobYear(cDob)) {
    return { customer: candidate, score: 85, tier: "name-dob-year", reasons: ["First name, last name, and birth year match"] };
  }

  if (firstExact && lastExact) {
    return { customer: candidate, score: 78, tier: "name-only", reasons: ["First name and last name match"] };
  }

  if (lastExact && dobExact) {
    return { customer: candidate, score: 70, tier: "last-dob", reasons: ["Last name and date of birth match"] };
  }

  if (firstExact && dobExact) {
    return { customer: candidate, score: 62, tier: "first-dob", reasons: ["First name and date of birth match"] };
  }

  if (dobExact) {
    return { customer: candidate, score: 50, tier: "dob-only", reasons: ["Date of birth matches"] };
  }

  if (qFirst && qLast && cFirst && cLast) {
    const fullQ = `${qFirst} ${qLast}`;
    const fullC = `${cFirst} ${cLast}`;
    const sim = jaroWinkler(fullQ, fullC);
    const simReversed = jaroWinkler(`${qLast} ${qFirst}`, fullC);
    const best = Math.max(sim, simReversed);
    if (best >= 0.82) {
      return { customer: candidate, score: Math.round(best * 80), tier: "fuzzy-name", reasons: ["Name is similar"] };
    }
  }

  return null;
}

export function findDuplicates<T extends DupCandidate>(
  candidates: T[],
  query: { firstName: string; lastName: string; dob: string; cwId: string },
  opts?: { limit?: number },
): DupMatch<T>[] {
  const results: DupMatch<T>[] = [];
  for (const candidate of candidates) {
    const match = scoreDuplicate(candidate, query);
    if (match) results.push(match);
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, opts?.limit ?? 50);
}

export const DUP_WARN_THRESHOLD = 85;
