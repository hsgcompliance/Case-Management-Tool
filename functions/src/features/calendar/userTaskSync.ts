import { createHash, randomUUID } from "node:crypto";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
  authAdmin,
  db,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  HSG_COMPLIANCE_CALENDAR_EMAIL,
  isoNow,
  RUNTIME,
} from "../../core";
import { createCalendarEvent, deleteCalendarEvent } from "./calendarApi";

type TaskData = Record<string, any>;
type CalendarOperation = "upsert" | "delete";

type CalendarClaim = {
  lockId: string;
  sourceHash: string;
  operation: CalendarOperation;
  eventId: string;
  task: TaskData;
  attempts: number;
};

type AttendeeResolution = {
  uid: string | null;
  status: "included" | "none" | "opted_out" | "missing_email" | "disabled" | "org_mismatch";
  attendees: Array<{ email: string; displayName?: string }>;
};

const COLLECTION = "userTasks";
const CALENDAR_SYNC_VERSION = 1;
const LOCK_MS = 90_000;
const RETRY_LIMIT = 50;
const MAX_SYNC_PASSES = 3;

let writerCache: { email: string; uid: string; expiresAt: number } | null = null;

function complianceCalendarEmail(): string {
  return String(HSG_COMPLIANCE_CALENDAR_EMAIL.value() || "hsgcompliance@hrdc.org")
    .trim()
    .toLowerCase();
}

async function complianceWriter(): Promise<{ email: string; uid: string }> {
  const email = complianceCalendarEmail();
  if (writerCache && writerCache.email === email && writerCache.expiresAt > Date.now()) {
    return { email, uid: writerCache.uid };
  }
  const user = await authAdmin.getUserByEmail(email);
  writerCache = { email, uid: user.uid, expiresAt: Date.now() + 10 * 60_000 };
  return { email, uid: user.uid };
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deterministicEventId(utid: string): string {
  // Google event IDs accept lower-case base32hex characters. Hex is a safe subset.
  return `hdb${createHash("sha256").update(utid).digest("hex").slice(0, 40)}`;
}

function effectiveCalendarEnabled(task: TaskData): boolean {
  const policy = task.calendar && typeof task.calendar === "object" ? task.calendar : {};
  const enabled =
    typeof policy.enabled === "boolean"
      ? policy.enabled
      : policy.defaultEnabled === true;
  return enabled && policy.centralOwner !== false;
}

function shouldCalendarExist(task: TaskData): boolean {
  const dueDate = String(task.dueDate || "").slice(0, 10);
  return (
    effectiveCalendarEnabled(task) &&
    task.status === "open" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
  );
}

function sourceHash(task: TaskData): string {
  return stableHash({
    status: String(task.status || ""),
    source: String(task.source || ""),
    dueDate: String(task.dueDate || "").slice(0, 10),
    title: String(task.title || ""),
    subtitle: String(task.subtitle || ""),
    actionUrl: String(task.actionUrl || ""),
    assignedToUid: String(task.assignedToUid || ""),
    cmUid: String(task.cmUid || ""),
    orgId: String(task.orgId || ""),
    calendar: {
      defaultEnabled: task.calendar?.defaultEnabled === true,
      enabled:
        typeof task.calendar?.enabled === "boolean"
          ? task.calendar.enabled
          : null,
      centralOwner: task.calendar?.centralOwner !== false,
    },
  });
}

function lockIsActive(sync: TaskData): boolean {
  const expiresAt = Date.parse(String(sync?.lockExpiresAt || ""));
  return !!sync?.lockId && Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function retryAt(attempts: number): string {
  const minutes = Math.min(360, Math.max(2, 2 ** Math.min(attempts, 8)));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function safeErrorMessage(value: unknown): string {
  return String((value as any)?.message || value || "calendar_sync_failed")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function resolveAssignedCaseManager(task: TaskData): Promise<AttendeeResolution> {
  // Enrollment work can be operationally assigned to compliance while the
  // Calendar attendee remains the enrollment's case manager.
  const uid = String(task.cmUid || task.assignedToUid || "").trim();
  if (!uid) return { uid: null, status: "none", attendees: [] };

  const [user, extrasSnap] = await Promise.all([
    authAdmin.getUser(uid).catch(() => null),
    db.collection("userExtras").doc(uid).get().catch(() => null),
  ]);
  if (!user) return { uid, status: "missing_email", attendees: [] };
  if (user.disabled) return { uid, status: "disabled", attendees: [] };

  const expectedOrg = String(task.orgId || "").trim();
  const actualOrg = String(user.customClaims?.orgId || user.customClaims?.org || "").trim();
  if (expectedOrg && actualOrg && expectedOrg !== actualOrg) {
    return { uid, status: "org_mismatch", attendees: [] };
  }

  const settings = extrasSnap?.data()?.settings;
  if (settings?.calendarWorkItemsEnabled === false) {
    return { uid, status: "opted_out", attendees: [] };
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return { uid, status: "missing_email", attendees: [] };

  return {
    uid,
    status: "included",
    attendees: [{ email, displayName: user.displayName || undefined }],
  };
}

function eventDescription(task: TaskData): string {
  return [
    String(task.subtitle || "").trim(),
    task.actionUrl ? `Open in Households DB: ${String(task.actionUrl).trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

async function claimSync(utid: string): Promise<CalendarClaim | null> {
  const ref = db.collection(COLLECTION).doc(utid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;

    const task = snap.data() as TaskData;
    const sync = task.calendarSync && typeof task.calendarSync === "object"
      ? task.calendarSync
      : {};
    const currentHash = sourceHash(task);
    const operation: CalendarOperation = shouldCalendarExist(task) ? "upsert" : "delete";

    // Calendar-disabled tasks that never produced an event require no external call.
    if (operation === "delete" && !sync.eventId && sync.status !== "synced") {
      return null;
    }

    if (
      sync.requestedHash === currentHash &&
      ((operation === "upsert" && sync.status === "synced") ||
        (operation === "delete" && sync.status === "deleted"))
    ) {
      return null;
    }

    if (lockIsActive(sync)) {
      if (sync.requestedHash !== currentHash) {
        tx.set(
          ref,
          {
            calendarSync: {
              ...sync,
              version: CALENDAR_SYNC_VERSION,
              status: "pending",
              requestedHash: currentHash,
              operation,
              nextRetryAt: isoNow(),
              updatedAt: isoNow(),
            },
          },
          { merge: true },
        );
      }
      return null;
    }

    const lockId = randomUUID();
    const attempts = Number(sync.attempts || 0) + 1;
    const eventId = String(sync.eventId || deterministicEventId(utid));
    tx.set(
      ref,
      {
        calendarSync: {
          ...sync,
          version: CALENDAR_SYNC_VERSION,
          status: operation === "delete" ? "deleting" : "syncing",
          operation,
          eventId,
          requestedHash: currentHash,
          attempts,
          nextRetryAt: null,
          lastAttemptAt: isoNow(),
          lastErrorCode: null,
          lastErrorMessage: null,
          lockId,
          lockExpiresAt: new Date(Date.now() + LOCK_MS).toISOString(),
          updatedAt: isoNow(),
        },
      },
      { merge: true },
    );
    return { lockId, sourceHash: currentHash, operation, eventId, task, attempts };
  });
}

async function finishSync(
  utid: string,
  claim: CalendarClaim,
  result:
    | {
        ok: true;
        eventId: string | null;
        payloadHash: string | null;
        attendeeHash: string | null;
        attendee: AttendeeResolution;
      }
    | { ok: false; code: string; error: string },
): Promise<boolean> {
  const ref = db.collection(COLLECTION).doc(utid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const task = snap.data() as TaskData;
    const sync = task.calendarSync && typeof task.calendarSync === "object"
      ? task.calendarSync
      : {};
    if (sync.lockId !== claim.lockId) return false;

    const latestHash = sourceHash(task);
    if (latestHash !== claim.sourceHash) {
      tx.set(
        ref,
        {
          calendarSync: {
            ...sync,
            status: "pending",
            requestedHash: latestHash,
            nextRetryAt: isoNow(),
            lockId: null,
            lockExpiresAt: null,
            updatedAt: isoNow(),
          },
        },
        { merge: true },
      );
      return true;
    }

    if (result.ok) {
      tx.set(
        ref,
        {
          calendarSync: {
            ...sync,
            version: CALENDAR_SYNC_VERSION,
            status: claim.operation === "delete" ? "deleted" : "synced",
            operation: claim.operation,
            eventId: result.eventId,
            payloadHash: result.payloadHash,
            attendeeHash: result.attendeeHash,
            attendeeUid: result.attendee.uid,
            attendeeStatus: result.attendee.status,
            attempts: 0,
            nextRetryAt: null,
            lastSuccessAt: isoNow(),
            lastErrorCode: null,
            lastErrorMessage: null,
            lockId: null,
            lockExpiresAt: null,
            updatedAt: isoNow(),
          },
        },
        { merge: true },
      );
      return false;
    }

    tx.set(
      ref,
      {
        calendarSync: {
          ...sync,
          version: CALENDAR_SYNC_VERSION,
          status: "failed",
          operation: claim.operation,
          attempts: claim.attempts,
          nextRetryAt: retryAt(claim.attempts),
          lastErrorCode: result.code,
          lastErrorMessage: result.error,
          lockId: null,
          lockExpiresAt: null,
          updatedAt: isoNow(),
        },
      },
      { merge: true },
    );
    return false;
  });
}

async function runClaim(utid: string, claim: CalendarClaim): Promise<boolean> {
  try {
    const writer = await complianceWriter();
    if (claim.operation === "delete") {
      const result = await deleteCalendarEvent(writer.uid, claim.eventId, writer.email);
      if (!result.ok) {
        return finishSync(utid, claim, {
          ok: false,
          code: result.code,
          error: result.error,
        });
      }
      return finishSync(utid, claim, {
        ok: true,
        eventId: null,
        payloadHash: null,
        attendeeHash: null,
        attendee: { uid: null, status: "none", attendees: [] },
      });
    }

    const attendee = await resolveAssignedCaseManager(claim.task);
    const dueDate = String(claim.task.dueDate || "").slice(0, 10);
    const title = String(claim.task.title || "Households DB task").trim().slice(0, 250);
    const description = eventDescription(claim.task);
    const payloadHash = stableHash({ title, description, dueDate });
    const attendeeHash = stableHash(attendee.attendees.map((entry) => entry.email));
    const result = await createCalendarEvent(writer.uid, {
      calendarId: writer.email,
      eventId: claim.eventId,
      summary: title,
      description,
      date: dueDate,
      attendees: attendee.attendees,
      transparency: "transparent",
      sendUpdates: "none",
      privateProperties: {
        hdbUtid: utid,
        hdbSource: String(claim.task.source || "").slice(0, 100),
        hdbEnrollmentId: String(claim.task.enrollmentId || "").slice(0, 200),
        hdbOrgId: String(claim.task.orgId || "").slice(0, 200),
      },
    });
    if (!result.ok) {
      return finishSync(utid, claim, {
        ok: false,
        code: result.code,
        error: result.error,
      });
    }
    return finishSync(utid, claim, {
      ok: true,
      eventId: result.eventId,
      payloadHash,
      attendeeHash,
      attendee,
    });
  } catch (error) {
    logger.warn("userTaskCalendarSync_failed", {
      utid,
      operation: claim.operation,
      error: safeErrorMessage(error),
    });
    return finishSync(utid, claim, {
      ok: false,
      code: "calendar_sync_exception",
      error: safeErrorMessage(error),
    });
  }
}

/**
 * Synchronize only the Calendar projection. This never replays or mutates the
 * source task/payment/enrollment operation that produced the userTasks row.
 */
export async function syncUserTaskCalendar(utid: string): Promise<void> {
  for (let pass = 0; pass < MAX_SYNC_PASSES; pass += 1) {
    const claim = await claimSync(utid);
    if (!claim) return;
    const sourceChangedWhileSyncing = await runClaim(utid, claim);
    if (!sourceChangedWhileSyncing) return;
  }
}

export const onUserTaskCalendarSync = onDocumentWritten(
  {
    region: RUNTIME.region,
    document: "userTasks/{utid}",
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async (event) => {
    const utid = String(event.params.utid || "");
    if (!utid) return;

    // Calendar-managed rows are soft-closed before removal. This fallback still
    // attempts cleanup for an unexpected hard delete when an event ID is present.
    if (!event.data?.after.exists) {
      const before = (event.data?.before.data() || {}) as TaskData;
      const eventId = String(before.calendarSync?.eventId || "");
      if (!eventId) return;
      try {
        const writer = await complianceWriter();
        const result = await deleteCalendarEvent(writer.uid, eventId, writer.email);
        if (!result.ok) {
          logger.error("userTaskCalendarSync_hard_delete_cleanup_failed", {
            utid,
            code: result.code,
          });
        }
      } catch (error) {
        logger.error("userTaskCalendarSync_hard_delete_cleanup_exception", {
          utid,
          error: safeErrorMessage(error),
        });
      }
      return;
    }

    try {
      await syncUserTaskCalendar(utid);
    } catch (error) {
      // The source userTasks write is already durable. Never propagate Calendar
      // failures back into task/payment behavior.
      logger.error("userTaskCalendarSync_trigger_exception", {
        utid,
        error: safeErrorMessage(error),
      });
    }
  },
);

export const retryUserTaskCalendarSync = onSchedule(
  {
    region: RUNTIME.region,
    schedule: "every 10 minutes",
    timeZone: "America/Denver",
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const now = isoNow();
    const due = await db
      .collection(COLLECTION)
      .where("calendarSync.nextRetryAt", "<=", now)
      .orderBy("calendarSync.nextRetryAt", "asc")
      .limit(RETRY_LIMIT)
      .get();

    for (const doc of due.docs) {
      try {
        await syncUserTaskCalendar(doc.id);
      } catch (error) {
        logger.error("retryUserTaskCalendarSync_item_exception", {
          utid: doc.id,
          error: safeErrorMessage(error),
        });
      }
    }
  },
);
