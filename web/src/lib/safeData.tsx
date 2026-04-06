// src/lib/safeData.ts
//avoid undefined result send to firebase, it doesnt like that.
export function noUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    // keep array shape; replace undefined entries with null, and clean nested values
    return input.map((v: any) => (v === undefined ? null : noUndefined(v))) as any;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as any)) {
      if (v === undefined) {
        out[k] = null;                  // Firestore-friendly
      } else {
        out[k] = noUndefined(v as any); // recurse
      }
    }
    return out as T;
  }
  return (input === undefined ? (null as any) : input) as T;
}
