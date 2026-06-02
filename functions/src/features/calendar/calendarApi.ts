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
}

export type CalendarEventResult =
  | { ok: true; eventId: string }
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
      startObj = { dateTime: `${event.date}T${event.startTime}:00`, timeZone: tz };
      endObj   = { dateTime: `${event.date}T${endTime}:00`,           timeZone: tz };
    } else {
      startObj = { date: event.date };
      endObj   = { date: event.date };
    }

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.summary,
        description: event.description ?? "",
        start: startObj,
        end: endObj,
      },
    });

    // Update lastSyncAt in public metadata
    const record = await readToken(uid, "googleCalendar");
    if (record) {
      const meta = tokenToPublicMeta(record);
      await writePublicMeta(uid, "googleCalendar", { ...meta, lastSyncAt: isoNow() });
    }

    return { ok: true, eventId: data.id ?? "" };
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

function bumpHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}
