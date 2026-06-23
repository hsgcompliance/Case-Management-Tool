// functions/src/features/gdrive/folderIndexSync.ts
//
// Triggers that keep the cached customer-folder index fresh:
//   • customerFolderIndexSync   — nightly cron, syncs every org that has a sheet
//   • customerFolderIndexRefresh — on-demand HTTP (current org), for a "Refresh
//     index" button. Uses the caller's OAuth (falls back to shared) so it works
//     even if the shared credential can't see the sheet.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  RUNTIME,
  db,
  secureHandler,
  requireOrg,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} from "../../core";
import { getOrgGDriveConfig } from "./orgConfig";
import { syncOrgFolderIndex } from "./folderIndexCache";

const GOOGLE_SECRETS = [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN];

/** Org ids that have a customer index sheet configured. */
async function orgsWithIndexSheet(): Promise<string[]> {
  const snap = await db.collection("orgs").get();
  const out: string[] = [];
  for (const doc of snap.docs) {
    try {
      const config = await getOrgGDriveConfig(doc.id);
      if (String(config.customerFolderIndex.sheetId || "").trim()) out.push(doc.id);
    } catch {
      // skip orgs whose config can't be read
    }
  }
  return out;
}

// ── Nightly cron ──────────────────────────────────────────────────────────────
export const customerFolderIndexSync = onSchedule(
  {
    region: RUNTIME.region,
    schedule: "30 2 * * *", // 2:30am MT, after the GAS nightly index job
    timeZone: "America/Denver",
    secrets: GOOGLE_SECRETS,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const orgs = await orgsWithIndexSheet();
    const results: Array<Record<string, unknown>> = [];
    for (const orgId of orgs) {
      try {
        const r = await syncOrgFolderIndex(orgId); // no user → shared refresh token
        results.push({ orgId, ...r });
      } catch (err) {
        logger.error("customerFolderIndexSync_org_error", { orgId, err: String((err as Error)?.message || err) });
        results.push({ orgId, error: String((err as Error)?.message || err) });
      }
    }
    logger.info("customerFolderIndexSync_done", { orgs: orgs.length, results });
  },
);

// ── On-demand refresh ─────────────────────────────────────────────────────────
export const customerFolderIndexRefresh = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);
    try {
      const result = await syncOrgFolderIndex(orgId, uid);
      res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
      const msg = String(e?.message || e || "folder_index_refresh_failed");
      const code = msg.includes("not_configured") ? 400 : msg.includes("permission") || msg.includes("not found") ? 403 : 500;
      res.status(code).json({ ok: false, error: msg });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: GOOGLE_SECRETS,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
);
