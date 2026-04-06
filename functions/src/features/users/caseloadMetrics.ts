import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, RUNTIME } from "../../core";

type CaseloadContrib = {
  cmUid: string;
  caseloadActive: number;
  enrollmentCount: number;
} | null;

function enrollmentState(row: any): { active: boolean; deleted: boolean } {
  const status = String(row?.status || (row?.active ? "active" : "closed")).toLowerCase();
  const deleted = row?.deleted === true || status === "deleted";
  const active = !deleted && (row?.active === true || status === "active");
  return { active, deleted };
}

function contribution(row: any): CaseloadContrib {
  if (!row) return null;
  const cmUid = String(row?.caseManagerId || "").trim() || null;
  if (!cmUid) return null;
  const { active, deleted } = enrollmentState(row);
  return {
    cmUid,
    caseloadActive: active ? 1 : 0,
    enrollmentCount: deleted ? 0 : 1,
  };
}

async function applyDelta(contrib: CaseloadContrib, sign: 1 | -1) {
  if (!contrib) return;
  const { cmUid, caseloadActive, enrollmentCount } = contrib;
  const write: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (caseloadActive !== 0) write.caseloadActive = FieldValue.increment(caseloadActive * sign);
  if (enrollmentCount !== 0) write.enrollmentCount = FieldValue.increment(enrollmentCount * sign);
  if (Object.keys(write).length <= 1) return; // nothing meaningful to write
  await db.collection("userExtras").doc(cmUid).set(write, { merge: true });
}

/**
 * Keeps userExtras.caseloadActive and userExtras.enrollmentCount up to date
 * when a customerEnrollment is created, updated, or deleted.
 *
 * Uses delta increments — no reads required. Early-exit when nothing relevant changed.
 */
export const onCaseloadMetrics = onDocumentWritten(
  { region: RUNTIME.region, document: "customerEnrollments/{id}" },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const b = contribution(before);
    const a = contribution(after);

    // No change in any tracked field — skip entirely
    if (
      b?.cmUid === a?.cmUid &&
      (b?.caseloadActive ?? 0) === (a?.caseloadActive ?? 0) &&
      (b?.enrollmentCount ?? 0) === (a?.enrollmentCount ?? 0)
    ) return;

    // Remove old contribution, add new — works for same-CM and CM-change cases
    if (b) await applyDelta(b, -1);
    if (a) await applyDelta(a, +1);
  }
);
