/**
 * Server-side Google Calendar API calls.
 * All calls go through the user's stored OAuth token — never a client-supplied token.
 */
import * as logger from "firebase-functions/logger";
import { buildOAuthClient } from "../google/oauthClient";
import { patchToken, writePublicMeta, readToken, tokenToPublicMeta } from "../google/tokenStore";
import { isoNow } from "../../core";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  timeZone?: string;
  calendarId?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  transparency?: "opaque" | "transparent";
  sendUpdates?: "all" | "externalOnly" | "none";
  privateProperties?: Record<string, string>;
  /** When set, update this existing event in place instead of inserting a new one. */
  eventId?: string;
}

export type CalendarEventResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string; code: string };

export type CalendarDeleteResult =
  | { ok: true; eventId: string; notFound?: boolean }
  | { ok: false; error: string; code: string };

export async function createCalendarEvent(
  uid: string,
  event: CalendarEventInput,
): Promise<CalendarEventResult> {
  const authResult = await buildOAuthClient(uid, "googleCalendar");

  if (!authResult.ok) {
    const code =
      authResult.code === "not_connected"
        ? "calendar_not_connected"
        : "calendar_needs_reconnect";
    return { ok: false, error: authResult.code, code };
  }

  try {
    const { google } = await import("googleapis");
    const calendar = google.calendar({ version: "v3", auth: authResult.auth });

    const tz = event.timeZone ?? "America/Denver";
    let startObj: Record<string, string>;
    let endObj: Record<string, string>;

    if (event.startTime) {
      const endTime = event.endTime ?? bumpHour(event.startTime);
      // When the end is not after the start (e.g. a 23:30 start auto-bumped to
      // 00:30, or an explicit overnight session), the end belongs on the next
      // day — otherwise Google rejects the event (end must be after start).
      const endDate = endTime <= event.startTime ? addOneDay(event.date) : event.date;
      startObj = { dateTime: `${event.date}T${event.startTime}:00`, timeZone: tz };
      endObj   = { dateTime: `${endDate}T${endTime}:00`,             timeZone: tz };
    } else {
      startObj = { date: event.date };
      // Google Calendar all-day end dates are exclusive.
      endObj   = { date: addOneDay(event.date) };
    }

    const calendarId = String(event.calendarId || "primary").trim() || "primary";
    const attendees = event.attendees
      ? Array.from(
          new Map(
            event.attendees
              .map((entry) => ({
                email: String(entry.email || "").trim().toLowerCase(),
                displayName: String(entry.displayName || "").trim() || undefined,
              }))
              .filter((entry) => entry.email)
              .map((entry) => [entry.email, entry]),
          ).values(),
        )
      : undefined;
    const requestBody: Record<string, unknown> = {
      summary: event.summary,
      description: event.description ?? "",
      start: startObj,
      end: endObj,
      ...(attendees ? { attendees } : {}),
      ...(event.transparency ? { transparency: event.transparency } : {}),
      ...(event.privateProperties
        ? { extendedProperties: { private: event.privateProperties } }
        : {}),
    };

    // Update the existing event in place when an id is supplied (edit re-sync) —
    // so editing a session never spawns a duplicate event. If the event was
    // deleted in Google Calendar, patch 404s and we fall back to inserting.
    let eventId = "";
    if (event.eventId) {
      try {
        const { data } = await calendar.events.patch({
          calendarId,
          eventId: event.eventId,
          requestBody,
          sendUpdates: event.sendUpdates ?? "none",
        });
        eventId = data.id ?? event.eventId;
      } catch (patchErr: any) {
        const status = patchErr?.code ?? patchErr?.response?.status;
        if (status !== 404 && status !== 410) throw patchErr;
        // 404/410 → the event is gone; fall through to insert a fresh one.
      }
    }

    if (!eventId) {
      const insertBody = event.eventId
        ? { ...requestBody, id: event.eventId }
        : requestBody;
      try {
        const { data } = await calendar.events.insert({
          calendarId,
          requestBody: insertBody,
          sendUpdates: event.sendUpdates ?? "none",
        });
        eventId = data.id ?? event.eventId ?? "";
      } catch (insertErr: any) {
        const status = insertErr?.code ?? insertErr?.response?.status;
        if (status !== 409 || !event.eventId) throw insertErr;
        // Deterministic IDs make concurrent/rapid source writes safe. If another
        // invocation inserted first, converge by patching the same event.
        const { data } = await calendar.events.patch({
          calendarId,
          eventId: event.eventId,
          requestBody,
          sendUpdates: event.sendUpdates ?? "none",
        });
        eventId = data.id ?? event.eventId;
      }
    }

    // The event is already durable. Integration metadata is bookkeeping and
    // must not turn a successful Calendar write into a retry.
    const record = await readToken(uid, "googleCalendar").catch(() => null);
    if (record) {
      const meta = tokenToPublicMeta(record);
      await writePublicMeta(uid, "googleCalendar", { ...meta, lastSyncAt: isoNow() })
        .catch((metadataError) => {
          logger.warn("Calendar sync metadata update failed", {
            uid,
            err: safeGoogleErrorMessage(metadataError),
          });
        });
    }

    return { ok: true, eventId };
  } catch (err: any) {
    logger.warn("Calendar event create failed", { uid, err: String(err) });

    const status = err?.code ?? err?.response?.status;
    if (status === 401) {
      // Mark as needs_reconnect in private store and public meta
      await patchToken(uid, "googleCalendar", {
        status: "needs_reconnect",
        updatedAt: Date.now(),
        errorMessage: String(err?.message ?? err),
      });
      const record = await readToken(uid, "googleCalendar");
      if (record) {
        await writePublicMeta(uid, "googleCalendar", {
          ...tokenToPublicMeta(record),
          connected: false,
          permissionStatus: "needs_reconnect",
        });
      }
      return { ok: false, error: "Token expired or revoked", code: "calendar_needs_reconnect" };
    }

    const msg = safeGoogleErrorMessage(err);
    return { ok: false, error: msg, code: calendarErrorCode(err) };
  }
}

export async function deleteCalendarEvent(
  uid: string,
  eventId: string,
  calendarId = "primary",
): Promise<CalendarDeleteResult> {
  const cleanEventId = String(eventId || "").trim();
  if (!cleanEventId) return { ok: true, eventId: "", notFound: true };

  const authResult = await buildOAuthClient(uid, "googleCalendar");
  if (!authResult.ok) {
    const code =
      authResult.code === "not_connected"
        ? "calendar_not_connected"
        : "calendar_needs_reconnect";
    return { ok: false, error: authResult.code, code };
  }

  try {
    const { google } = await import("googleapis");
    const calendar = google.calendar({ version: "v3", auth: authResult.auth });
    await calendar.events.delete({
      calendarId: String(calendarId || "primary").trim() || "primary",
      eventId: cleanEventId,
      sendUpdates: "none",
    });

    const record = await readToken(uid, "googleCalendar").catch(() => null);
    if (record) {
      const meta = tokenToPublicMeta(record);
      await writePublicMeta(uid, "googleCalendar", { ...meta, lastSyncAt: isoNow() })
        .catch((metadataError) => {
          logger.warn("Calendar delete metadata update failed", {
            uid,
            eventId: cleanEventId,
            err: safeGoogleErrorMessage(metadataError),
          });
        });
    }

    return { ok: true, eventId: cleanEventId };
  } catch (err: any) {
    const status = err?.code ?? err?.response?.status;
    if (status === 404 || status === 410) {
      return { ok: true, eventId: cleanEventId, notFound: true };
    }
    logger.warn("Calendar event delete failed", { uid, eventId: cleanEventId, err: String(err) });

    if (status === 401) {
      await patchToken(uid, "googleCalendar", {
        status: "needs_reconnect",
        updatedAt: Date.now(),
        errorMessage: String(err?.message ?? err),
      });
      const record = await readToken(uid, "googleCalendar");
      if (record) {
        await writePublicMeta(uid, "googleCalendar", {
          ...tokenToPublicMeta(record),
          connected: false,
          permissionStatus: "needs_reconnect",
        });
      }
      return { ok: false, error: "Token expired or revoked", code: "calendar_needs_reconnect" };
    }

    const msg = safeGoogleErrorMessage(err);
    return { ok: false, error: msg, code: calendarErrorCode(err) };
  }
}

function safeGoogleErrorMessage(err: any): string {
  const raw = err?.errors?.[0]?.message ?? err?.message ?? "Google Calendar request failed";
  return String(raw).replace(/\s+/g, " ").trim().slice(0, 500);
}

function calendarErrorCode(err: any): string {
  const status = Number(err?.code ?? err?.response?.status ?? 0);
  const message = safeGoogleErrorMessage(err).toLowerCase();
  if (message.includes("service_disabled")) return "calendar_api_disabled";
  if (status === 401) return "calendar_needs_reconnect";
  if (status === 429 || message.includes("rate limit") || message.includes("quota")) {
    return "calendar_rate_limited";
  }
  if (status === 403) return "calendar_permission_denied";
  if (status >= 500) return "calendar_unavailable";
  return "calendar_unknown";
}

function bumpHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/** "2026-06-22" → "2026-06-23" (handles month/year rollover via UTC math). */
function addOneDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
