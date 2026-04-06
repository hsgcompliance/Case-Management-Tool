// functions/src/features/inbox/digestSubs.ts
// Subscription management for digest emails.
// Subscriptions stored in userExtras/{uid}.digestSubs
import { z } from "zod";
import { secureHandler, db, authAdmin, isoNow, requireLevel } from "../../core";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DigestType = "caseload" | "budget" | "enrollments" | "caseManagers";
export const ALL_DIGEST_TYPES: DigestType[] = ["caseload", "budget", "enrollments", "caseManagers"];

export type DigestSubs = Partial<Record<DigestType, boolean>>;

export type DigestSubRecord = {
  uid: string;
  email: string;
  displayName?: string;
  roles: string[];
  topRole: string;
  subs: DigestSubs;
};

// ── Default subscriptions ─────────────────────────────────────────────────────

/**
 * Returns whether a user is subscribed to a digest type by default
 * (before any explicit preference is set).
 */
export function defaultSubFor(type: DigestType, roles: string[], topRole: string): boolean {
  const isCM      = roles.includes("casemanager");
  const isAdmin   = topRole === "admin" || topRole === "dev" || topRole === "org_dev";
  const isCompliance = roles.includes("compliance");

  switch (type) {
    case "caseload":     return isCM;
    case "budget":       return isAdmin || isCompliance;
    case "enrollments":  return isCM || isAdmin;
    case "caseManagers": return isAdmin || isCompliance;
  }
}

export function isSubscribed(
  type: DigestType,
  subs: DigestSubs,
  roles: string[],
  topRole: string
): boolean {
  if (type in subs) return !!subs[type];
  return defaultSubFor(type, roles, topRole);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildSubRecord(u: {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: Record<string, unknown>;
}): Promise<DigestSubRecord> {
  const roles   = (u.customClaims?.roles as string[]) || [];
  const topRole = String(u.customClaims?.topRole || "user");
  const extrasSnap = await db.collection("userExtras").doc(u.uid).get();
  const subs: DigestSubs = extrasSnap.exists
    ? ((extrasSnap.data() as any)?.digestSubs || {})
    : {};
  return {
    uid: u.uid,
    email: u.email || "",
    displayName: u.displayName,
    roles,
    topRole,
    subs,
  };
}

// ── GET /inboxDigestSubsGet ───────────────────────────────────────────────────

export const inboxDigestSubsGet = secureHandler(
  async (req, res) => {
    const { users } = await authAdmin.listUsers();

    // Filter to users who have at least one relevant role
    const relevant = users.filter((u) => {
      const roles = (u.customClaims?.roles as string[]) || [];
      const topRole = String(u.customClaims?.topRole || "user");
      return (
        roles.includes("casemanager") ||
        roles.includes("compliance") ||
        topRole === "admin" ||
        topRole === "dev" ||
        topRole === "org_dev"
      );
    });

    const records = await Promise.all(relevant.map(buildSubRecord));

    // Annotate each record with its effective subscription per type
    const annotated = records.map((r) => ({
      ...r,
      effective: Object.fromEntries(
        ALL_DIGEST_TYPES.map((t) => [t, isSubscribed(t, r.subs, r.roles, r.topRole)])
      ) as Record<DigestType, boolean>,
    }));

    annotated.sort((a, b) =>
      (a.displayName || a.email).localeCompare(b.displayName || b.email)
    );

    res.status(200).json({ ok: true, records: annotated });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

// ── POST /inboxDigestSubUpdate ────────────────────────────────────────────────

const SubUpdateBody = z.object({
  uid:        z.string().min(1),
  digestType: z.enum(["caseload", "budget", "enrollments", "caseManagers"]),
  subscribed: z.boolean(),
});

export const inboxDigestSubUpdate = secureHandler(
  async (req, res) => {
    const { uid, digestType, subscribed } = SubUpdateBody.parse(req.body || {});
    const caller = (req as any).user;
    const callerUid = String(caller?.uid || "");

    // Users can update their own; admins can update anyone
    if (uid !== callerUid) {
      requireLevel(caller, "admin");
    }

    const ref = db.collection("userExtras").doc(uid);
    await ref.set(
      { digestSubs: { [digestType]: subscribed }, updatedAt: isoNow() },
      { merge: true }
    );

    res.status(200).json({ ok: true, uid, digestType, subscribed });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
