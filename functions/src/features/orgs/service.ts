// functions/src/features/orgs/service.ts
// Shared org utilities — config seeding, normalization.
import { db, FieldValue } from "../../core";
import type { DocumentReference } from "firebase-admin/firestore";

export const ORG_CONFIG_DEFAULTS = [
  {
    id: "GrantDisplay",
    label: "Grant Display",
    kind: "display",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "CmDisplay",
    label: "CM Display",
    kind: "display",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "SystemConfig",
    label: "System Config",
    kind: "system",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "CustomerEmailTemplate",
    label: "Customer Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
  {
    id: "CaseManagersEmailTemplate",
    label: "Case Managers Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
  {
    id: "BudgetEmailTemplate",
    label: "Budget Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
  {
    id: "EnrollmentsEmailTemplate",
    label: "Enrollments Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
] as const;

export type OrgConfigId = typeof ORG_CONFIG_DEFAULTS[number]["id"];

/**
 * Idempotently seeds all Config subcollection docs for an org.
 * Safe to call on every upsert — only writes missing fields on existing docs.
 */
export async function ensureOrgConfigDefaults(orgRef: DocumentReference, orgId: string) {
  const configRefs = ORG_CONFIG_DEFAULTS.map((item) => orgRef.collection("Config").doc(item.id));
  const configSnaps = await db.getAll(...configRefs);
  const batch = db.batch();

  ORG_CONFIG_DEFAULTS.forEach((item, idx) => {
    const snap = configSnaps[idx];
    batch.set(
      configRefs[idx],
      {
        orgId,
        id: item.id,
        label: item.label,
        kind: item.kind,
        active: true,
        ...(snap?.exists ? {} : item.defaults),
        ...(snap?.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}
