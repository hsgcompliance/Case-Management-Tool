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
      endObj   = { date: event.date };
    }

    const requestBody = {
      summary: event.summary,
      description: event.description ?? "",
      start: startObj,
      end: endObj,
    };

    // Update the existing event in place when an id is supplied (edit re-sync) —
    // so editing a session never spawns a duplicate event. If the event was
    // deleted in Google Calendar, patch 404s and we fall back to inserting.
    let eventId = "";
    if (event.eventId) {
      try {
        const { data } = await calendar.events.patch({
          calendarId: "primary",
          eventId: event.eventId,
          requestBody,
        });
        eventId = data.id ?? event.eventId;
      } catch (patchErr: any) {
        const status = patchErr?.code ?? patchErr?.response?.status;
        if (status !== 404 && status !== 410) throw patchErr;
        // 404/410 → the event is gone; fall through to insert a fresh one.
      }
    }

    if (!eventId) {
      const { data } = await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });
      eventId = data.id ?? "";
    }

    // Update lastSyncAt in public metadata
    const record = await readToken(uid, "googleCalendar");
    if (record) {
      const meta = tokenToPublicMeta(record);
      await writePublicMeta(uid, "googleCalendar", { ...meta, lastSyncAt: isoNow() });
    }

    return { ok: true, eventId };
  } catch (err: any) {
    logger.warn("Calendar event create failed", { uid, err: String(err) });

    const status = err?.code ?? err?.response?.status;
    if (status === 401 || status === 403) {
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

    const msg = err?.errors?.[0]?.message ?? err?.message ?? String(err);
    if (String(msg).includes("SERVICE_DISABLED")) {
      return { ok: false, error: "Google Calendar API is not enabled", code: "calendar_api_disabled" };
    }

    return { ok: false, error: msg, code: "unknown" };
  }
}

export async function deleteCalendarEvent(
  uid: string,
  eventId: string,
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
      calendarId: "primary",
      eventId: cleanEventId,
    });

    const record = await readToken(uid, "googleCalendar");
    if (record) {
      const meta = tokenToPublicMeta(record);
      await writePublicMeta(uid, "googleCalendar", { ...meta, lastSyncAt: isoNow() });
    }

    return { ok: true, eventId: cleanEventId };
  } catch (err: any) {
    const status = err?.code ?? err?.response?.status;
    if (status === 404 || status === 410) {
      return { ok: true, eventId: cleanEventId, notFound: true };
    }
    logger.warn("Calendar event delete failed", { uid, eventId: cleanEventId, err: String(err) });

    if (status === 401 || status === 403) {
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

    const msg = err?.errors?.[0]?.message ?? err?.message ?? String(err);
    if (String(msg).includes("SERVICE_DISABLED")) {
      return { ok: false, error: "Google Calendar API is not enabled", code: "calendar_api_disabled" };
    }

    return { ok: false, error: msg, code: "unknown" };
  }
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
