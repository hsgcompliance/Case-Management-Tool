import type { MinigameMountContext, SecretGameDefinition, SecretPersistenceScope } from "./types";

export const SECRET_STORAGE_PREFIX = "secretArcade:v1";

type SecretStorageScopeSegment = "session" | "user" | "customer" | "user-customer";

export type SecretStorageEntry<T = unknown> = {
  key: string;
  parsed: T | null;
  raw: string | null;
};

function resolveScopeSegment(scope: SecretPersistenceScope): SecretStorageScopeSegment {
  switch (scope) {
    case "session":
      return "session";
    case "user":
      return "user";
    case "customer":
      return "customer";
    case "user+customer":
      return "user-customer";
    default:
      return "session";
  }
}

function buildScopeSubject(scope: SecretPersistenceScope, mountContext: MinigameMountContext): string | null {
  const userId = String(mountContext.userId || "").trim();
  const customerId = String(mountContext.customerId || "").trim();

  switch (scope) {
    case "session":
      return mountContext.routeKind;
    case "user":
      return userId || null;
    case "customer":
      return customerId || null;
    case "user+customer":
      if (!userId || !customerId) return null;
      return `${userId}:${customerId}`;
    default:
      return null;
  }
}

export function buildSecretStorageKey(args: {
  game: Pick<SecretGameDefinition, "id" | "persistenceScope">;
  mountContext: MinigameMountContext;
}): string | null {
  const scopeSegment = resolveScopeSegment(args.game.persistenceScope);
  const subject = buildScopeSubject(args.game.persistenceScope, args.mountContext);
  if (!subject) return null;
  return `${SECRET_STORAGE_PREFIX}:${args.game.id}:${scopeSegment}:${subject}`;
}

export function readSecretStorage<T>(key: string | null, fallback: T): T {
  if (!key || typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSecretStorage<T>(key: string | null, value: T): void {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in the sandbox path.
  }
}

export function clearSecretStorageKey(key: string | null): void {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in the sandbox path.
  }
}

export function listSecretStorageEntries(): SecretStorageEntry[] {
  if (typeof window === "undefined") return [];

  const entries: SecretStorageEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(SECRET_STORAGE_PREFIX)) continue;

    const raw = window.localStorage.getItem(key);
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }

    entries.push({ key, parsed, raw });
  }

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export function clearAllSecretStorage(): void {
  if (typeof window === "undefined") return;

  const keys = listSecretStorageEntries().map((entry) => entry.key);
  keys.forEach((key) => clearSecretStorageKey(key));
}
