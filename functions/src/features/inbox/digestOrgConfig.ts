import { db, orgIdFromClaims } from "../../core";
import type { DigestType } from "./digestSubs";

type DisplayConfigDoc = {
  id: string;
  kind?: unknown;
  active?: unknown;
  label?: unknown;
  value?: unknown;
};

async function resolveImplicitOrgId(): Promise<string | null> {
  const snap = await db.collection("orgs").limit(2).get();
  if (snap.size !== 1) return null;
  return String(snap.docs[0]?.id || "").trim() || null;
}

export async function getDigestEnabledFlags(
  claimsOrOrgId?: Record<string, unknown> | string | null,
): Promise<Partial<Record<DigestType, boolean>>> {
  const explicitOrgId =
    typeof claimsOrOrgId === "string"
      ? String(claimsOrOrgId || "").trim() || null
      : orgIdFromClaims((claimsOrOrgId || {}) as any);

  const orgId = explicitOrgId || (await resolveImplicitOrgId());
  if (!orgId) return {};

  const snap = await db.collection("orgs").doc(orgId).collection("Config").get();
  const docs: DisplayConfigDoc[] = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as DisplayConfigDoc))
    .filter((doc) => doc.kind === "display" && doc.active !== false);

  const displayDoc =
    docs.find((doc) => /grant|budget|display/i.test(String(doc.label || ""))) ??
    docs[0] ??
    null;

  const value =
    displayDoc && typeof displayDoc.value === "object" && displayDoc.value && !Array.isArray(displayDoc.value)
      ? (displayDoc.value as Record<string, unknown>)
      : {};

  const digestsEnabled =
    typeof value.digestsEnabled === "object" && value.digestsEnabled && !Array.isArray(value.digestsEnabled)
      ? (value.digestsEnabled as Partial<Record<DigestType, boolean>>)
      : {};
  return digestsEnabled;
}

export async function isDigestDisabledForOrg(
  digestType: DigestType,
  claimsOrOrgId?: Record<string, unknown> | string | null,
): Promise<boolean> {
  const digestsEnabled = await getDigestEnabledFlags(claimsOrOrgId);
  return digestsEnabled[digestType] === false;
}
