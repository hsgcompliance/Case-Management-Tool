// src/lib/emitter.ts
/*a tiny pub/sub you put inside a store so React components can re-render exactly when the store changes—no polling.*/

export type Listener = () => void;

export function createEmitter() {
  const subs = new Set<Listener>();
  return {
    subscribe(fn: Listener) { subs.add(fn); return () => subs.delete(fn); },
    emit() { for (const fn of subs) { try { fn(); } catch {} } },
    get size() { return subs.size; },
  };
}
