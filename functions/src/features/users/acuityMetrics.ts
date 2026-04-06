import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME } from "../../core";

type AcuityContrib = { cmUid: string; score: number; countWeight: number };

function contributions(row: any): AcuityContrib[] {
  if (!row) return [];
  const primaryUid = String(row?.caseManagerId || "").trim() || null;
  const secondaryUid = String(row?.secondaryCaseManagerId || "").trim() || null;
  // Support both flat acuityScore and nested acuity.score
  const raw = row?.acuityScore ?? row?.acuity?.score;
  const score = Number(raw);
  if (!Number.isFinite(score)) return [];

  const out: AcuityContrib[] = [];
  if (primaryUid) out.push({ cmUid: primaryUid, score, countWeight: 1 });
  if (secondaryUid && secondaryUid !== primaryUid) {
    out.push({ cmUid: secondaryUid, score: score * 0.5, countWeight: 0.5 });
  }
  return out;
}

/**
 * Keeps userExtras.acuityScoreSum / acuityScoreCount / acuityScoreAvg
 * current whenever a customer's acuityScore or caseManagerId changes.
 *
 * Uses a transaction so sum/count/avg stay consistent.
 * Fires only when acuityScore or caseManagerId actually changes — exit early otherwise.
 */
export const onAcuityMetrics = onDocumentWritten(
  { region: RUNTIME.region, document: "customers/{id}" },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const b = contributions(before);
    const a = contributions(after);

    // No change in score or CM assignment
    if (JSON.stringify(b) === JSON.stringify(a)) return;

    // Collect distinct CMs that need updating (may be 1 or 2)
    const affected = new Set<string>();
    for (const contrib of b) affected.add(contrib.cmUid);
    for (const contrib of a) affected.add(contrib.cmUid);

    for (const uid of affected) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection("userExtras").doc(uid);
        const snap = await tx.get(ref);
        const extras = snap.exists ? (snap.data() || {}) : {};

        let sum = Number(extras.acuityScoreSum) || 0;
        let count = Number(extras.acuityScoreCount) || 0;

        // Remove this customer's old contribution for this CM
        for (const contrib of b) {
          if (contrib.cmUid !== uid) continue;
          sum -= contrib.score;
          count -= contrib.countWeight;
        }
        // Add this customer's new contribution for this CM
        for (const contrib of a) {
          if (contrib.cmUid !== uid) continue;
          sum += contrib.score;
          count += contrib.countWeight;
        }

        // Clamp against float drift
        sum = Math.max(0, Math.round(sum * 10000) / 10000);
        count = Math.max(0, Math.round(count * 10000) / 10000);
        const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : null;

        tx.set(
          ref,
          {
            acuityScoreSum: sum,
            acuityScoreCount: count,
            acuityScoreAvg: avg,
            lastAcuityUpdatedAt: new Date().toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    }
  }
);
