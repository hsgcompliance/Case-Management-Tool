import { shouldUseEmulators } from './runtimeEnv';

//web/src/lib/stable.ts
/* Deterministic stringify & object sort, so query keys never flap */
export function stableSortObject<T = any>(o: T): T {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(stableSortObject) as any;
  const keys = Object.keys(o as any).sort();
  const out: any = {};
  for (const k of keys) {
    const v = (o as any)[k];
    if (v === undefined) continue;
    out[k] = stableSortObject(v);
  }
  return out;
}

export function stableStringify(o: any): string {
  return JSON.stringify(stableSortObject(o));
}

export const isEmu = () => shouldUseEmulators();
