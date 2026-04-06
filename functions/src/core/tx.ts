// functions/src/core/tx.ts
import { db, FieldValue } from "./admin";
import crypto from "node:crypto";

export function makeIdempoKey(parts: unknown[] = []) {
  const s = parts.map((x) => String(x ?? "")).join("|");
  return crypto.createHash("sha1").update(s).digest("hex");
}

export async function withTxn<T>(
  fn: (trx: FirebaseFirestore.Transaction) => Promise<T>,
  label = "txn"
) {
  return db.runTransaction(async (trx) => {
    try {
      return await fn(trx);
    } catch (e: any) {
      console.error(`[${label}]`, e?.message || e);
      throw e;
    }
  });
}

export async function ensureIdempotent(
  trx: FirebaseFirestore.Transaction,
  key: string,
  payload: Record<string, unknown> = {}
) {
  const ref = db.collection("idempotency").doc(key);
  const snap = await trx.get(ref);
  if (snap.exists) return { already: true, doc: snap.data() };
  trx.set(ref, { createdAt: FieldValue.serverTimestamp(), ...payload });
  return { already: false };
}
