import * as logger from "firebase-functions/logger";
import { z } from "zod";

import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } from "../../core/env";
import { secureHandler } from "../../core/http";
import admin from "../../core/admin";
import type { AuthedRequest } from "../../core/requestContext";
import { createCalendarEvent } from "./calendarApi";

const CalendarPostEventBody = z.object({
  customerName: z.string(),
  type: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  note: z.string().optional(),
  activityId: z.string().optional(),
});

const TYPE_LABEL: Record<string, string> = {
  "in-person": "In Person",
  phone: "Phone",
  "data-entry": "Data Entry",
  other: "On Behalf of",
};

export const calendarPostEvent = secureHandler(
  async (req: AuthedRequest, res) => {
    const uid = req.user!.uid!;
    const body = CalendarPostEventBody.parse(req.body);

    const label = TYPE_LABEL[body.type] ?? body.type;
    const result = await createCalendarEvent(uid, {
      summary: `${label} - ${body.customerName}`,
      description: body.note ?? "",
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    if (!result.ok) {
      res.status(result.code === "calendar_not_connected" ? 400 : 502).json(result);
      return;
    }

    if (body.activityId) {
      try {
        await admin
          .firestore()
          .collection("cmActivities")
          .doc(body.activityId)
          .update({ calendarEventId: result.eventId, calendarSynced: true });
      } catch (err) {
        logger.warn("Could not stamp calendarEventId on activity", { activityId: body.activityId, err });
      }
    }

    res.json({ ok: true, eventId: result.eventId });
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET],
    // The lazy monolithic `googleapis` import peaks >256MiB → the worker is OOM
    // killed and Cloud Run returns an opaque 500 before createCalendarEvent can
    // respond. 512 is the floor every other googleapis-backed handler uses.
    memory: "512MiB",
  },
);
