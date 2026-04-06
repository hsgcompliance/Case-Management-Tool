// functions/src/features/jotform/triggers.ts
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { db, RUNTIME, isoNow } from "../../core";

const FN_JOTFORM_INDEXER = "onJotformSubmissionIndexer";
const SPENDING_FORM_IDS = new Set(["251878265158166", "252674777246167"]);

type DigestTaskConfig = {
  enabled: boolean;
  assignedToGroup: "admin" | "compliance" | "casemanager";
  titlePrefix: string | null;
  titleFieldKeys: string[];
  subtitleFieldKeys: string[];
};

function jotformUtid(id: string) {
  return `jotform|${id}`;
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("answer" in obj) return asText(obj.answer);
    if ("prettyFormat" in obj) return asText(obj.prettyFormat);
    if ("value" in obj) return asText(obj.value);
    return Object.values(obj).map(asText).filter(Boolean).join(" ");
  }
  return "";
}

function readAnswer(sub: any, key: string): string {
  const answers = (sub?.answers || {}) as Record<string, unknown>;
  return asText(answers[key]).trim();
}

async function closeJotformInboxItem(id: string) {
  const ref = db.collection("userTasks").doc(jotformUtid(id));
  const existing = await ref.get();
  // Only close if the item exists and is currently open — never re-close already-done items
  if (existing.exists && existing.data()?.status === "open") {
    await ref.set(
      { status: "done", completedAtISO: isoNow(), updatedAtISO: isoNow() },
      { merge: true }
    );
  }
}

async function loadDigestTaskConfig(sub: any): Promise<DigestTaskConfig> {
  const formId = String(sub?.formId || "").trim();
  const formAlias = String(sub?.formAlias || "").trim().toLowerCase();

  let map: any = null;
  if (formId) {
    const byId = await db.collection("jotformDigestMaps").doc(formId).get().catch(() => null);
    if (byId?.exists) map = byId.data() || null;
  }
  if (!map && formAlias) {
    const q = await db
      .collection("jotformDigestMaps")
      .where("formAlias", "==", formAlias)
      .limit(1)
      .get()
      .catch((err) => {
        logger.warn(FN_JOTFORM_INDEXER + "_digest_alias_lookup_failed", { formAlias, err });
        return null;
      });
    if (q?.docs?.[0]) map = q.docs[0].data() || null;
  }

  const task = map?.options?.task || {};
  const groupRaw = String(task?.assignedToGroup || "admin").toLowerCase();
  const assignedToGroup =
    groupRaw === "compliance" || groupRaw === "casemanager" ? groupRaw : "admin";

  return {
    enabled: task?.enabled === true,
    assignedToGroup,
    titlePrefix: String(task?.titlePrefix || "").trim() || null,
    titleFieldKeys: Array.isArray(task?.titleFieldKeys)
      ? task.titleFieldKeys.map((k: unknown) => String(k || "").trim()).filter(Boolean)
      : [],
    subtitleFieldKeys: Array.isArray(task?.subtitleFieldKeys)
      ? task.subtitleFieldKeys.map((k: unknown) => String(k || "").trim()).filter(Boolean)
      : [],
  };
}

async function upsertJotformInboxItem(id: string, sub: any) {
  const active = sub?.active !== false && String(sub?.status || "active") !== "deleted";

  if (!active) {
    await closeJotformInboxItem(id);
    return;
  }

  const orgId = String(sub?.orgId || "") || null;
  const enrollmentId = String(sub?.enrollmentId || "") || null;
  const customerId = String(sub?.customerId || "") || null;
  const grantId = String(sub?.grantId || "") || null;
  const formId = String(sub?.formId || "").trim();

  const isSpendingForm = SPENDING_FORM_IDS.has(formId);
  const digestTask = await loadDigestTaskConfig(sub);
  const taskEnabled = isSpendingForm || digestTask.enabled;

  if (!taskEnabled) {
    await closeJotformInboxItem(id);
    return;
  }

  // Only create actionable inbox items when the submission is linked or has an org.
  if (!enrollmentId && !customerId && !orgId) return;

  // Fetch enrollment context for richer inbox metadata
  let customerName: string | null = null;
  let caseManagerName: string | null = null;
  let cmUid: string | null = null;
  let enrollmentName: string | null = null;
  let grantName: string | null = null;
  let teamIds: string[] = orgId ? [orgId] : [];

  if (enrollmentId) {
    try {
      const enrSnap = await db.collection("customerEnrollments").doc(enrollmentId).get();
      if (enrSnap.exists) {
        const enr = enrSnap.data() || {};
        customerName =
          String((enr as any).customerName || (enr as any).clientName || "") || null;
        caseManagerName = String((enr as any).caseManagerName || "") || null;
        cmUid = String((enr as any).caseManagerId || "") || null;
        enrollmentName = String((enr as any).name || "") || null;
        grantName = String((enr as any).grantName || "") || null;
        const enrTeamIds: string[] = Array.isArray((enr as any).teamIds)
          ? (enr as any).teamIds
          : [];
        teamIds = Array.from(
          new Set([...enrTeamIds, ...(orgId ? [orgId] : [])].filter(Boolean))
        );
      }
    } catch (err) {
      logger.warn(FN_JOTFORM_INDEXER + "_enrollment_lookup_failed", { enrollmentId, err });
    }
  }

  const formTitle =
    String(sub?.formTitle || sub?.formAlias || "Jotform Submission") || "Jotform Submission";
  const amount = Number(sub?.calc?.amount || 0);
  const amountStr = amount > 0 ? ` - $${amount.toLocaleString()}` : "";

  const mappedTitleParts = digestTask.titleFieldKeys
    .map((k) => readAnswer(sub, k))
    .filter(Boolean);
  const mappedSubtitleParts = digestTask.subtitleFieldKeys
    .map((k) => readAnswer(sub, k))
    .filter(Boolean);
  const mappedTitleBase = mappedTitleParts.length ? mappedTitleParts.join(" - ") : "";
  const titlePrefix = digestTask.titlePrefix || formTitle;
  const title = mappedTitleBase
    ? `${titlePrefix}: ${mappedTitleBase}${amountStr}`
    : `${titlePrefix}${amountStr} - ${customerName || customerId || "New Submission"}`;

  const defaultSubtitle =
    [
      grantName ? `Grant: ${grantName}` : null,
      enrollmentName ? `Enrollment: ${enrollmentName}` : null,
      caseManagerName ? `CM: ${caseManagerName}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;
  const mappedSubtitle = mappedSubtitleParts.length ? mappedSubtitleParts.join(" | ") : null;
  const subtitle = [mappedSubtitle, defaultSubtitle].filter(Boolean).join(" | ") || null;

  const due = String(sub?.jotformCreatedAt || sub?.createdAt || "").slice(0, 10) || null;
  const dueMonth = due ? due.slice(0, 7) : null;
  const assignedToGroup = digestTask.enabled
    ? digestTask.assignedToGroup
    : isSpendingForm
      ? "compliance"
      : "admin";

  const ref = db.collection("userTasks").doc(jotformUtid(id));
  const existing = await ref.get();
  const isNew = !existing.exists;

  await ref.set(
    {
      utid: jotformUtid(id),
      source: "jotform",
      // Only (re-)open on creation; never overwrite a manually-closed item
      ...(isNew ? { status: "open" } : {}),
      orgId,
      teamIds,
      enrollmentId,
      clientId: customerId,
      grantId,
      sourcePath: `jotformSubmissions/${id}`,
      sourceId: id,
      dueDate: due,
      dueMonth,
      assignedToUid: null,
      assignedToGroup,
      cmUid,
      notify: true,
      title,
      subtitle,
      labels: ["jotform", sub?.formAlias || ""].filter(Boolean),
      // Only set these timestamps on creation; never overwrite on update
      ...(isNew ? { completedAtISO: null, createdAtISO: isoNow() } : {}),
      customerName,
      grantName,
      caseManagerName,
      enrollmentName,
      updatedAtISO: isoNow(),
      system: {
        lastWriter: FN_JOTFORM_INDEXER,
        lastWriteAt: isoNow(),
      },
    },
    { merge: true }
  );
}

/**
 * When a new Jotform submission lands in Firestore, index into userTasks.
 */
export const onJotformSubmissionCreate = onDocumentCreated(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    const sub = (event.data?.data() as any) || {};
    logger.info("jotform_submission_created", { id, enrollmentId: sub?.enrollmentId });
    await upsertJotformInboxItem(id, sub);
  }
);

/**
 * When a Jotform submission is updated, sync inbox item.
 */
export const onJotformSubmissionUpdate = onDocumentUpdated(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    const sub = (event.data?.after?.data() as any) || {};
    logger.info("jotform_submission_updated", { id, active: sub?.active });
    await upsertJotformInboxItem(id, sub);
  }
);

/**
 * When a Jotform submission is hard-deleted, close the inbox item.
 */
export const onJotformSubmissionDelete = onDocumentDeleted(
  { region: RUNTIME.region, document: "jotformSubmissions/{id}" },
  async (event) => {
    const id = String(event.params.id);
    logger.info("jotform_submission_deleted", { id });
    await closeJotformInboxItem(id);
  }
);
