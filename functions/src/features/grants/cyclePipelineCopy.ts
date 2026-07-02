import { db, FieldValue } from "../../core";

const CONFIG_FIELDS = ["name", "status", "lineItemId", "sourceFormId", "sourceFormTitle", "formSchemas", "includeGroups", "excludeGroups", "includeTree", "excludeTree"] as const;

export function cyclePipelineCopyId(sourcePipelineId: string, targetGrantId: string) {
  return `${sourcePipelineId.replace(/[^a-zA-Z0-9_-]/g, "_")}__cycle__${targetGrantId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function buildCyclePipelineCopy(sourcePipelineId: string, source: Record<string, unknown>, targetGrantId: string, orgId: string) {
  const copy: Record<string, unknown> = {
    id: cyclePipelineCopyId(sourcePipelineId, targetGrantId),
    orgId,
    grantId: targetGrantId,
    copiedFromPipelineId: sourcePipelineId,
    copiedFromGrantId: String(source.grantId || ""),
  };
  for (const field of CONFIG_FIELDS) if (source[field] !== undefined) copy[field] = structuredClone(source[field]);
  return copy;
}

/** Copies configuration only. Deterministic IDs make retries idempotent; transaction rows are never read or written. */
export async function copyCyclePipelineConfiguration(sourceGrantId: string, targetGrantId: string, orgId: string) {
  if (!sourceGrantId || !targetGrantId || sourceGrantId === targetGrantId) return 0;
  const snap = await db.collection("budgetPipelines").where("orgId", "==", orgId).where("grantId", "==", sourceGrantId).get();
  if (snap.empty) return 0;
  const writer = db.bulkWriter();
  for (const doc of snap.docs) {
    const copy = buildCyclePipelineCopy(doc.id, doc.data() || {}, targetGrantId, orgId);
    writer.set(db.collection("budgetPipelines").doc(String(copy.id)), {
      ...copy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await writer.close();
  return snap.size;
}
