// functions/src/core/triggerDebug.ts
import type { FirestoreEvent } from "firebase-functions/v2/firestore";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
export const TRIGGER_DEBUG = TRUE_VALUES.has(
  String(process.env.TRIGGER_DEBUG || process.env.DEBUG_TRIGGER_LOOPS || "").toLowerCase()
);

export function changedTopLevelKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): string[] {
  const b = before && typeof before === "object" ? before : {};
  const a = after && typeof after === "object" ? after : {};
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!deepEqualDeterministic((b as any)[k], (a as any)[k])) out.push(k);
  }
  return out.sort();
}

export function eventIdOf(event: FirestoreEvent<any>): string | null {
  return (
    (event as any)?.id ||
    (event as any)?.eventId ||
    (event as any)?.context?.eventId ||
    null
  );
}

export function topLevelMetadataOnly(
  changedKeys: string[],
  extras: string[] = []
): boolean {
  const allowed = new Set(["updatedAt", "createdAt", "deletedAt", "system", ...extras]);
  return changedKeys.length > 0 && changedKeys.every((k) => allowed.has(k));
}

export function selfWriteMetadataOnly(
  fnName: string,
  after: any,
  changedKeys: string[],
  extras: string[] = []
): boolean {
  const writer = String(after?.system?.lastWriter || "");
  if (writer !== fnName) return false;
  return topLevelMetadataOnly(changedKeys, extras);
}

export function debugTriggerEvent(args: {
  fn: string;
  event: FirestoreEvent<any>;
  beforeRefPath?: string | null;
  afterRefPath?: string | null;
  changedKeys: string[];
}) {
  if (!TRIGGER_DEBUG) return;
  const onlyMeta = topLevelMetadataOnly(args.changedKeys);
  console.log(
    `[trigger-debug] fn=${args.fn} eventId=${eventIdOf(args.event) || "n/a"} beforePath=${args.beforeRefPath || "n/a"} afterPath=${args.afterRefPath || "n/a"} changedKeys=${JSON.stringify(args.changedKeys)} metadataOnly=${onlyMeta}`
  );
}

export function debugWrite(args: {
  fn: string;
  path: string;
  write: Record<string, unknown>;
}) {
  if (!TRIGGER_DEBUG) return;
  const topKeys = Object.keys(args.write).sort();
  const timestampish = hasTimestampishWrite(args.write);
  console.log(
    `[trigger-debug] fn=${args.fn} writePath=${args.path} writeKeys=${JSON.stringify(topKeys)} writesTimestampFields=${timestampish}`
  );
}

export function deepEqualDeterministic(a: unknown, b: unknown): boolean {
  return stableSerialize(a) === stableSerialize(b);
}

function stableSerialize(v: unknown): string {
  return JSON.stringify(stableNormalize(v));
}

function stableNormalize(v: any): any {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map((x) => stableNormalize(x));
  if (typeof v !== "object") return v;
  if (typeof v?.toMillis === "function") return { __ts: v.toMillis() };
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) out[k] = stableNormalize(v[k]);
  return out;
}

function hasTimestampishWrite(v: unknown, path = ""): boolean {
  if (!v || typeof v !== "object") return false;
  for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
    const keyPath = path ? `${path}.${k}` : k;
    if (/(^|\.)(updatedAt|createdAt|deletedAt|lastWriteAt|needsRecalcAt|lastRecalcAt)$/i.test(keyPath)) {
      return true;
    }
    if (child && typeof child === "object" && hasTimestampishWrite(child, keyPath)) {
      return true;
    }
  }
  return false;
}
