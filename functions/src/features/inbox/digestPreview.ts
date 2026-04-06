// functions/src/features/inbox/digestPreview.ts
import { secureHandler, db, z, requireLevel } from "../../core";
import { monthKey } from "./utils";
import {
  InboxDigestPreviewQuery, type TInboxDigestPreviewQuery,
} from "./schemas"

const Q = InboxDigestPreviewQuery;

export const inboxDigestPreview = secureHandler(
  async (req, res) => {
    const { month, cmUid } = Q.parse(req.method === "GET" ? req.query : req.body);
    const targetMonth = month || monthKey(); // default current


    const caller = (req as any).user;
    const callerUid = caller?.uid as string | undefined;

    if (!callerUid) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }

    // Only admins/devs can preview another user's digest.
    const targetUid = cmUid || callerUid;
    if (cmUid && cmUid !== callerUid) {
      requireLevel(caller, "admin");
    }

    const snap = await db
      .collection("userTasks")
      .where("dueMonth", "==", targetMonth)
      .where("notify", "==", true)
      .where("cmUid", "==", targetUid)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ ok: true, items });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);
