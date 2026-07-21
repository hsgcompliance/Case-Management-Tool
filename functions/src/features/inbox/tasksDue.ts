// functions/src/features/inbox/tasksDue.ts
import { secureHandler, db, toMonthKey, isAdmin, roleTagsFromClaims } from "../../core";

/**
 * GET /inboxTasksDueList?month=YYYY-MM
 *
 * "Tasks due this month" scoped to the viewer's own relationships: tasks
 * assigned directly to them, plus any open task tied to a customer where
 * they're the primary or secondary case manager (regardless of who the
 * task itself is assigned to). For compliance/admin viewers, this also
 * includes the unclaimed compliance group-backlog (assignedToGroup ===
 * "compliance", assignedToUid === null) — mirrors the group-backlog
 * branch in inboxListMy so compliance staff see their queue here too,
 * not just on the CaseLoad Board. Note: grantCompliance items have no
 * dueMonth/dueDate and so never appear in this month-scoped view.
 */
export const inboxTasksDueList = secureHandler(
  async (req, res) => {
    const ctx = (req as any).user || {};
    const uid = String(ctx?.uid || "");
    if (!uid) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }

    const monthRaw = String(req.query?.month || "").slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : toMonthKey(new Date());

    const tags = roleTagsFromClaims(ctx);
    const compliance = isAdmin(ctx) || tags.includes("compliance");

    const inboxRef = db.collection("userTasks");
    const base = inboxRef.where("status", "==", "open").where("dueMonth", "==", month);

    const queries = [
      base.where("assignedToUid", "==", uid).get(),
      base.where("cmUid", "==", uid).get(),
      base.where("secondaryCmUid", "==", uid).get(),
    ];
    if (compliance) {
      queries.push(base.where("assignedToGroup", "==", "compliance").where("assignedToUid", "==", null).get());
    }
    const snaps = await Promise.all(queries);

    const seen = new Set<string>();
    const out: any[] = [];
    for (const snap of snaps) {
      for (const doc of snap.docs) {
        const key = doc.id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: doc.id, ...doc.data() });
      }
    }

    out.sort((a: any, b: any) =>
      String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99"))
    );

    res.status(200).json({ ok: true, items: out, month });
  },
  { auth: "viewer", methods: ["GET", "OPTIONS"] }
);
