// functions/src/core/utils.ts
import { toUtcIso } from "./dates";

export const isoNow = () => toUtcIso(new Date());

export const isPlainObject = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

export function deepMerge<T extends object, U extends object>(a: T, b: U): T & U {
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const av = (a as any)[k];
    out[k] = (isPlainObject(av) && isPlainObject(v)) ? deepMerge(av, v) : v;
  }
  return out;
}

export function addSubfield<T extends object>(obj: T, parent: string, key: string, val: unknown) {
  return {...(obj as any), [parent]: {...((obj as any)[parent] || {}), [key]: val}};
}
