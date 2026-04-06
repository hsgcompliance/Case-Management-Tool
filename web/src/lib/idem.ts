//lib/idem.ts
export function idemKey(parts: unknown, ns = 'v2') {
  const stable = (v: any): any =>
    v && typeof v === 'object'
      ? Array.isArray(v)
        ? v.map(stable)
        : Object.keys(v).sort().reduce((a, k) => ((a[k] = stable(v[k])), a), {} as any)
      : v;
  const s = JSON.stringify({ ns, p: stable(parts) });
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `idem:${ns}:${(h >>> 0).toString(16)}:${s.length}`;
}
