// functions/src/features/inbox/metricsMy.ts
import { secureHandler, db, isAdmin, roleTagsFromClaims, toDateOnly, toMonthKey } from "../../core";
import type { TInboxMetricsScope } from "@hdb/contracts";

function computeScope(items: any[], today: string, myUid: string): TInboxMetricsScope {
  const nonCancelled = items.filter((x: any) => x.status !== "cancelled");
  const assignedCount = nonCancelled.length;
  const openCount = nonCancelled.filter((x: any) => x.status === "open").length;
  const completedCount = nonCancelled.filter((x: any) => x.status === "done").length;
  const completionPct = assignedCount > 0 ? (completedCount / assignedCount) * 100 : 0;
  const overdueCount = nonCancelled.filter(
    (x: any) => x.status === "open" && x.dueDate && x.dueDate < today
  ).length;
  const sharedCount = nonCancelled.filter((x: any) => {
    const assignedToGroup = String(x?.assignedToGroup || "").trim();
    const waitingOnUid = String(x?.waitingOnUid || "").trim();
    return !!assignedToGroup || !!waitingOnUid;
  }).length;
  const assignedToMeCount = nonCancelled.filter(
    (x: any) => String(x?.assignedToUid || "") === myUid
  ).length;
  return {
    assignedCount,
    openCount,
    completedCount,
    completionPct,
    overdueCount,
    sharedCount,
    assignedToMeCount,
  };
}

/**
 * GET /inboxMetricsMy?month=YYYY-MM
 * Returns month-scoped task counts for direct, group, and total views.
 */
export const inboxMetricsMy = secureHandler(
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
    const admin = isAdmin(ctx);
    const compliance = admin || tags.includes("compliance");
    const caseManager = tags.includes("casemanager") || (!admin && !compliance);

    const groupCandidates: string[] = [];
    if (admin) groupCandidates.push("admin");
    if (compliance) groupCandidates.push("compliance");
    if (caseManager) groupCandidates.push("casemanager");

    const inboxRef = db.collection("userTasks");
    const today = toDateOnly(new Date());

    // 1) Direct: all my items for the month (all statuses)
    const directSnap = await inboxRef
      .where("assignedToUid", "==", uid)
      .where("dueMonth", "==", month)
      .get();
    const directMonthItems = directSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Also pull open overdue items from prior months (no dueMonth filter)
    const overdueSnap = await inboxRef
      .where("assignedToUid", "==", uid)
      .where("status", "==", "open")
      .get();
    const overdueItems = overdueSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((x: any) => x.dueDate && x.dueDate < today);

    // Dedup direct + overdue by utid/id
    const directSeen = new Set<string>();
    const directItems: any[] = [];
    for (const item of [...directMonthItems, ...overdueItems]) {
      const key = String((item as any).utid || (item as any).id || "");
      if (!key || directSeen.has(key)) continue;
      directSeen.add(key);
      directItems.push(item);
    }

    // 2) Group: unassigned open items for my groups this month
    const groupItems: any[] = [];
    if (groupCandidates.length) {
      const batches = await Promise.all(
        groupCandidates.map(async (g) => {
          const snap = await inboxRef
            .where("assignedToGroup", "==", g)
            .where("assignedToUid", "==", null)
            .where("status", "==", "open")
            .where("dueMonth", "==", month)
            .get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        })
      );
      batches.forEach((arr) => groupItems.push(...arr));
    }

    // 3) Total = dedup of direct + group by utid
    const seen = new Set<string>();
    const totalItems: any[] = [];
    for (const item of [...directItems, ...groupItems]) {
      const key = String((item as any).utid || (item as any).id || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      totalItems.push(item);
    }

    res.status(200).json({
      ok: true,
      month,
      direct: computeScope(directItems, today, uid),
      group: computeScope(groupItems, today, uid),
      total: computeScope(totalItems, today, uid),
    });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
