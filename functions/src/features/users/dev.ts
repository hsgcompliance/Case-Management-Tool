// functions/src/features/users/dev.ts
import { onRequest } from "firebase-functions/v2/https";
import { authAdmin, roleTagsFromClaims } from "../../core";
import type { Claims } from "../../core";

function cors(req: any, res: any) {
  const o = req.headers.origin || "";
  const allow = new Set([
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5000", "http://127.0.0.1:5000",
    "http://localhost:5173", "http://127.0.0.1:5173",
  ]);
  if (allow.has(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
}

const isEmu =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

type DevGrantBody = {
  uid?: string;
  email?: string;
  orgId?: string;
  teamIds?: string[];
  /** Optional – defaults to "admin" if not provided/invalid */
  topRole?: "unverified" | "public_user" | "user" | "admin" | "dev" | "org_dev" | "super_dev";
  /** FE tags only, e.g. ["casemanager", "compliance"] */
  roles?: string[];
};

const ALLOWED_TOP_ROLES: DevGrantBody["topRole"][] = [
  "unverified",
  "public_user",
  "user",
  "admin",
  "dev",
  "org_dev",
  "super_dev",
];

export const devGrantAdmin = onRequest({ region: "us-central1" }, async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!isEmu) {
    res.status(403).json({ ok: false, error: "dev_only" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "use_post" });
    return;
  }

  try {
    const b = (req.body || {}) as DevGrantBody;
    let uid = b.uid;

    // 1) Try bearer token → uid
    if (!uid) {
      const m = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
      if (m) {
        try {
          const dec = await authAdmin.verifyIdToken(m[1]);
          uid = dec.uid;
        } catch {
          // ignore
        }
      }
    }

    // 2) Fallback: email lookup
    if (!uid && b.email) {
      try {
        const rec = await authAdmin.getUserByEmail(b.email);
        uid = rec.uid;
      } catch {
        // ignore
      }
    }

    if (!uid) {
      res.status(400).json({ ok: false, error: "uid_or_email_required" });
      return;
    }

    const u = await authAdmin.getUser(uid);
    const prev = (u.customClaims || {}) as Claims;

    // --- topRole: authoritative ladder value ---
    const requestedTop = b.topRole || (prev.topRole as DevGrantBody["topRole"]) || "admin";
    const topRole = ALLOWED_TOP_ROLES.includes(requestedTop) ? requestedTop : "admin";

    // --- org / teams ---
    const orgId = String(b.orgId || prev.orgId || "emu_org").trim() || "emu_org";

    const prevTeams = Array.isArray(prev.teamIds) ? prev.teamIds.map(String) : [];
    const extraTeams = Array.isArray(b.teamIds) ? b.teamIds.map(String) : [];
    const teamIds = Array.from(new Set([...prevTeams, ...extraTeams, orgId]))
      .filter(Boolean)
      .slice(0, 10);

    // --- roles: FE tags only (no ladder) ---
    const prevTags = roleTagsFromClaims({ ...prev, uid } as Claims);
    const extraTags = Array.isArray(b.roles)
      ? b.roles
          .map((r) => String(r || "").toLowerCase().trim())
          .filter(Boolean)
      : [];

    const roles = Array.from(new Set([...prevTags, ...extraTags]));

    const claims: Claims = {
      ...prev,
      topRole,
      roles,
      orgId,
      teamIds,
    };

    await authAdmin.setCustomUserClaims(uid, claims);

    // Emulator DX: no revoke, so current token stays valid
    res.json({
      ok: true,
      uid,
      claims,
      hint: "no-revoke-in-emulator",
      needRefresh: false,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
