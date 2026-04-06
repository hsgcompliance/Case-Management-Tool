// functions/src/features/inbox/listMy.ts
import { secureHandler, db, isAdmin, roleTagsFromClaims, toDateOnly } from "../../core";

/**
 * GET /inboxListMy?month=YYYY-MM&includeOverdue=true&includeGroup=true
 * - Direct assignments to me (always)
 * - Group backlog for groups this user can action (optional)
 */
export const inboxListMy = secureHandler(
  async (req, res) => {
    const ctx = (req as any).user || {};
    const uid = String(ctx?.uid || "");
    if (!uid) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }

    const monthRaw = String(req.query?.month || "").slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : "";
    const includeOverdue = String(req.query?.includeOverdue || "true") !== "false";
    const includeGroup = String(req.query?.includeGroup || "true") !== "false";

    const tags = roleTagsFromClaims(ctx);
    const admin = isAdmin(ctx);
    const compliance = admin || tags.includes("compliance");
    const caseManager = tags.includes("casemanager") || (!admin && !compliance);

    // Show queue tasks that this user can action.
    const groupCandidates: string[] = [];
    if (admin) groupCandidates.push("admin");
    if (compliance) groupCandidates.push("compliance");
    if (caseManager) groupCandidates.push("casemanager");

    const inboxRef = db.collection("userTasks");

    // 1) Direct assignments
    let qMine: FirebaseFirestore.Query = inboxRef.where("assignedToUid", "==", uid);
    if (month) qMine = qMine.where("dueMonth", "==", month);

    const mineSnap = await qMine.get();
    const mine = mineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 2) Optional group backlog (open + month filter)
    const groupItems: any[] = [];
    if (includeGroup && groupCandidates.length) {
      const batches = await Promise.all(
        groupCandidates.map(async (g) => {
          let base: FirebaseFirestore.Query = inboxRef
            .where("assignedToGroup", "==", g)
            .where("assignedToUid", "==", null)
            .where("status", "==", "open");

          if (month) base = base.where("dueMonth", "==", month);

          const snap = await base.get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        })
      );
      batches.forEach((arr) => groupItems.push(...arr));
    }

    // 3) Overdue mine
    let overdue: any[] = [];
    if (includeOverdue) {
      const today = toDateOnly(new Date());
      const snap = await inboxRef.where("assignedToUid", "==", uid).where("status", "==", "open").get();
      overdue = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x: any) => x.dueDate && x.dueDate < today);
    }

    // Merge + dedupe (prefer utid; fall back to doc id)
    const seen = new Set<string>();
    const out: any[] = [];
    for (const arr of [mine, overdue, groupItems]) {
      for (const it of arr) {
        const key = String((it as any).utid || (it as any).id || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(it);
      }
    }

    // Sort
    const today = toDateOnly(new Date());
    out.sort((a: any, b: any) => {
      const ad = String(a.dueDate || "9999-99-99");
      const bd = String(b.dueDate || "9999-99-99");
      const ao = a.status === "open" && a.dueDate && a.dueDate < today;
      const bo = b.status === "open" && b.dueDate && b.dueDate < today;
      if (ao && !bo) return -1;
      if (!ao && bo) return 1;
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return ad.localeCompare(bd);
    });

    res.status(200).json({ ok: true, items: out });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
