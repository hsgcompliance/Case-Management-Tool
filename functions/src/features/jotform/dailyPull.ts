// functions/src/features/jotform/dailyPull.ts
//
// Midnight (America/Denver) incremental pull of new spending-form submissions.
//
// Strategy ("sort new + existing by date, pull new, run pipeline"):
//   For each spending form, self-derive the owning org(s) from existing
//   submissions, compute the latest createdAt we already have (high-water mark,
//   minus a 1-day overlap for boundary safety), then pull only newer submissions
//   from the Jotform API via the canonical `syncJotformSubmissions` path. That
//   path upserts jotformSubmissions + extracts, and the create-trigger
//   (onPaymentQueueItemCreate) classifies — so new spend flows end-to-end with
//   no admin action. Upsert is idempotent, so the overlap re-pull is harmless.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db, RUNTIME, JOTFORM_API_KEY_SECRET, type Claims } from "../../core";
import { JOTFORM_SPENDING_FORM_IDS, syncJotformSubmissions } from "./service";

// Dev-level synthetic caller: passes assertTargetOrgAllowed for any org.
const SYSTEM_CALLER = { uid: "system:jotformDailyPull", topRole: "super_dev" } as unknown as Claims;

const OVERLAP_DAYS = 1;
const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

/** Distinct orgIds that already own submissions for this form. */
async function orgsForForm(formId: string): Promise<string[]> {
  const snap = await db
    .collection("jotformSubmissions")
    .where("formId", "==", formId)
    .select("orgId")
    .limit(1000)
    .get();
  const orgs = new Set<string>();
  for (const d of snap.docs) {
    const o = String((d.data() || {}).orgId || "").trim();
    if (o) orgs.add(o);
  }
  return [...orgs];
}

/** Latest createdAt we already have for (org, form), minus an overlap window. */
async function sinceForForm(formId: string, orgId: string): Promise<string | undefined> {
  const snap = await db
    .collection("jotformSubmissions")
    .where("orgId", "==", orgId)
    .where("formId", "==", formId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const latest = snap.docs[0]?.data()?.createdAt;
  if (!latest) return undefined; // no prior submissions → full pull (most-recent pages)
  const d = new Date(String(latest));
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() - OVERLAP_DAYS);
  return d.toISOString();
}

export const jotformDailyPull = onSchedule(
  {
    region: RUNTIME.region,
    schedule: "0 0 * * *",
    timeZone: "America/Denver",
    secrets: [JOTFORM_API_KEY_SECRET],
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const results: Array<Record<string, unknown>> = [];

    for (const formId of JOTFORM_SPENDING_FORM_IDS) {
      let orgs: string[] = [];
      try {
        orgs = await orgsForForm(formId);
      } catch (err) {
        logger.error("jotformDailyPull_orgs_error", { formId, err: String((err as Error)?.message || err) });
        continue;
      }
      if (orgs.length === 0) {
        logger.info("jotformDailyPull_no_orgs", { formId });
        continue;
      }

      for (const orgId of orgs) {
        try {
          const since = await sinceForForm(formId, orgId);
          const out = await syncJotformSubmissions(
            { formId, since, limit: PAGE_LIMIT, maxPages: MAX_PAGES, includeRaw: false },
            SYSTEM_CALLER,
            orgId,
          );
          results.push({ formId, orgId, since: since ?? null, count: out.count, hasMore: out.hasMore });
        } catch (err) {
          logger.error("jotformDailyPull_form_error", {
            formId,
            orgId,
            err: String((err as Error)?.message || err),
          });
        }
      }
    }

    logger.info("jotformDailyPull_done", { results });
  },
);
