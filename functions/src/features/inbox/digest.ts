import { onSchedule } from "firebase-functions/v2/scheduler";
import { authAdmin, db, isoNow, RUNTIME } from "../../core";
import { monthKey } from "./utils";
import { isSubscribed, type DigestSubs } from "./digestSubs";
import { getDigestEnabledFlags } from "./digestOrgConfig";

type DigestType = "caseload" | "budget" | "enrollments" | "caseManagers";

type QueuedDigestJob = {
  digestType: DigestType;
  uid: string;
  email: string;
  recipientName: string;
  forUid?: string;
};

const DIGEST_WAVE_SIZE = 8;
const DIGEST_WAVE_MINUTES = 15;

async function listAllUsers() {
  const { users } = await authAdmin.listUsers();
  return users;
}

async function getExtras(uid: string): Promise<Record<string, unknown>> {
  const snap = await db.collection("userExtras").doc(uid).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : {};
}

function makeAutoDigestDocId(month: string, digestType: DigestType, uid: string): string {
  return `auto_${month}_${digestType}_${uid}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function waveSendAt(base: Date, waveIndex: number): string {
  return new Date(base.getTime() + waveIndex * DIGEST_WAVE_MINUTES * 60_000).toISOString();
}

async function enqueueAutoDigest(month: string, job: QueuedDigestJob, sendAt: string): Promise<boolean> {
  const ref = db.collection("scheduledDigests").doc(makeAutoDigestDocId(month, job.digestType, job.uid));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const current = snap.data() as Record<string, unknown>;
      const status = String(current.status || "");
      if (status === "pending" || status === "processing" || status === "sent") {
        return false;
      }
    }

    tx.set(
      ref,
      {
        type: "monthlyDigest",
        digestType: job.digestType,
        status: "pending",
        cmUid: job.uid,
        forUid: job.forUid ?? null,
        targetEmail: job.email,
        recipientName: job.recipientName,
        months: [month],
        combine: false,
        subject: null,
        subjectTemplate: null,
        message: null,
        sendAt,
        autoScheduled: true,
        createdAt: isoNow(),
        createdByUid: null,
        sentAt: null,
        error: null,
      },
      { merge: true }
    );
    return true;
  });
}

export const sendMonthlyDigests = onSchedule(
  {
    region: RUNTIME.region,
    schedule: "0 7 1 * *",
    timeZone: "America/Denver",
  },
  async () => {
    const month = monthKey();
    const users = (await listAllUsers()).sort((a, b) => {
      const aKey = String(a.email || a.uid || "");
      const bKey = String(b.email || b.uid || "");
      return aKey.localeCompare(bKey);
    });
    const jobs: QueuedDigestJob[] = [];

    for (const u of users) {
      if (!u.email) continue;
      const roles = (u.customClaims?.roles as string[]) || [];
      const topRole = String(u.customClaims?.topRole || "user");
      const isCM = roles.includes("casemanager");
      const isAdmin = topRole === "admin" || topRole === "dev" || topRole === "org_dev";
      const isCompliance = roles.includes("compliance");

      if (!isCM && !isAdmin && !isCompliance) continue;

      const extras = await getExtras(u.uid);
      if (extras?.digestOptOut === true || extras?.digestFrequency === "off") continue;

      const subs = ((extras?.digestSubs as DigestSubs) || {}) as DigestSubs;
      const name = u.displayName || u.email;
      const claims = (u.customClaims || {}) as Record<string, unknown>;
      const digestFlags = await getDigestEnabledFlags(claims);

      if (
        isCM &&
        isSubscribed("caseload", subs, roles, topRole) &&
        digestFlags.caseload !== false
      ) {
        jobs.push({
          digestType: "caseload",
          uid: u.uid,
          email: u.email,
          recipientName: name,
          forUid: u.uid,
        });
      }

      if (
        isSubscribed("budget", subs, roles, topRole) &&
        digestFlags.budget !== false
      ) {
        jobs.push({
          digestType: "budget",
          uid: u.uid,
          email: u.email,
          recipientName: name,
        });
      }

      if (
        isSubscribed("enrollments", subs, roles, topRole) &&
        digestFlags.enrollments !== false
      ) {
        jobs.push({
          digestType: "enrollments",
          uid: u.uid,
          email: u.email,
          recipientName: name,
          forUid: isCM && !isAdmin ? u.uid : undefined,
        });
      }

      if (
        isSubscribed("caseManagers", subs, roles, topRole) &&
        digestFlags.caseManagers !== false
      ) {
        jobs.push({
          digestType: "caseManagers",
          uid: u.uid,
          email: u.email,
          recipientName: name,
        });
      }
    }

    const baseTime = new Date();
    baseTime.setSeconds(0, 0);

    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const waveIndex = Math.floor(index / DIGEST_WAVE_SIZE);
      const sendAt = waveSendAt(baseTime, waveIndex);

      try {
        await enqueueAutoDigest(month, job, sendAt);
      } catch (error: unknown) {
        console.error(`digest queue failed for ${job.digestType}:${job.uid}`, error);
      }
    }
  }
);
