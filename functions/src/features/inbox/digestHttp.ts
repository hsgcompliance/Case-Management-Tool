// functions/src/features/inbox/digestHttp.ts
import { z } from "zod";
import { secureHandler, authAdmin, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN } from "../../core";
import { buildAndSendDigest } from "./digestCore";
import { buildAndSendBudgetDigest } from "./digestBudget";
import { buildAndSendEnrollmentDigest } from "./digestEnrollments";
import { buildAndSendCaseManagerDigest } from "./digestCaseManagers";
import { DigestSendNowBody } from "./schemas";
import { getDigestEnabledFlags } from "./digestOrgConfig";

const DigestTypeSchema = z.enum(["caseload", "budget", "enrollments", "caseManagers"]).optional();

async function getAllUsersMap() {
  const { users } = await authAdmin.listUsers();
  const out = new Map<string, { email: string; displayName?: string; roles: string[]; topRole: string; claims: Record<string, unknown> }>();
  users.forEach((u) => {
    if (!u.email) return;
    const roles   = (u.customClaims?.roles as string[]) || [];
    const topRole = String(u.customClaims?.topRole || "user");
    out.set(u.uid, { email: u.email, displayName: u.displayName, roles, topRole, claims: (u.customClaims || {}) as Record<string, unknown> });
  });
  return out;
}

export const inboxSendDigestNow = secureHandler(
  async (req, res) => {
    const { months, cmUid, subject, subjectTemplate, message } =
      DigestSendNowBody.parse(req.body || {});

    // digestType is extra — not in vendored contracts schema, parse separately
    const digestType = DigestTypeSchema.parse((req.body as any)?.digestType) ?? "caseload";

    const usersMap = await getAllUsersMap();

    // For caseload, target CMs only; for others, target all relevant users unless cmUid specified
    const targets: Array<{ uid: string; email: string; displayName?: string; roles: string[]; topRole: string; claims: Record<string, unknown> }> =
      (() => {
        if (cmUid) {
          const u = usersMap.get(cmUid);
          return u ? [{ uid: cmUid, ...u }] : [];
        }
        return Array.from(usersMap.entries()).map(([uid, v]) => ({ uid, ...v })).filter((u) => {
          const isCM       = u.roles.includes("casemanager");
          const isAdmin    = u.topRole === "admin" || u.topRole === "dev" || u.topRole === "org_dev";
          const isCompliance = u.roles.includes("compliance");
          if (digestType === "caseload")     return isCM;
          if (digestType === "budget")       return isAdmin || isCompliance;
          if (digestType === "enrollments")  return isCM || isAdmin;
          if (digestType === "caseManagers") return isAdmin || isCompliance;
          return false;
        });
      })();

    if (!targets.length) {
      res.status(400).json({ ok: false, error: "no_targets" });
      return;
    }

    const results: Array<{ uid: string; email: string; month: string; ok: boolean; skipped?: boolean; error?: string }> = [];

    for (const u of targets) {
      const digestFlags = await getDigestEnabledFlags(u.claims);
      const digestDisabled = digestFlags[digestType] === false;
      for (const month of months) {
        try {
          if (digestDisabled) {
            results.push({ uid: u.uid, email: u.email, month, ok: true, skipped: true, error: "digest_disabled" });
            continue;
          }
          let r: { ok: boolean; skipped?: boolean };
          const name = u.displayName || u.email;
          const isCM    = u.roles.includes("casemanager");
          const isAdmin = u.topRole === "admin" || u.topRole === "dev" || u.topRole === "org_dev";

          if (digestType === "caseload") {
            r = await buildAndSendDigest(u.email, { month, forUid: u.uid, cmName: name, subject, subjectTemplate, message });
          } else if (digestType === "budget") {
            r = await buildAndSendBudgetDigest(u.email, { month, forUid: u.uid, recipientName: name });
          } else if (digestType === "enrollments") {
            r = await buildAndSendEnrollmentDigest(u.email, {
              month,
              forUid: isCM && !isAdmin ? u.uid : undefined,
              recipientName: name,
            });
          } else {
            r = await buildAndSendCaseManagerDigest(u.email, { month, recipientName: name });
          }

          results.push({ uid: u.uid, email: u.email, month, ok: r.ok, skipped: r.skipped });
        } catch (err: any) {
          results.push({ uid: u.uid, email: u.email, month, ok: false, error: err?.message || "send_failed" });
        }
      }
    }

    const sent    = results.filter((r) => r.ok && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed  = results.filter((r) => !r.ok).length;

    res.status(200).json({ ok: true, sent, skipped, failed, results });
  },
  {
    auth: "admin",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
    memory: "512MiB",
  }
);
