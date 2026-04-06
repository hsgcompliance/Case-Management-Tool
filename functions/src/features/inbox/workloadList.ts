import { secureHandler, db, authAdmin, hasLevel, roleTagsFromClaims, toDateOnly, z } from "../../core";

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v || "").toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

function toToken(v: unknown): string {
  return String(v || "").toLowerCase().trim().replace(/\s+/g, "_");
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function groupsFromTokens(tokens: string[]): string[] {
  const t = new Set(tokens.map(toToken));
  const groups = new Set<string>();
  if (t.has("admin") || t.has("super_dev") || t.has("dev") || t.has("org_dev")) groups.add("admin");
  if (t.has("admin") || t.has("compliance") || t.has("super_dev") || t.has("dev") || t.has("org_dev")) groups.add("compliance");
  if (t.has("casemanager") || t.has("case_manager") || t.has("cm") || t.has("user")) groups.add("casemanager");
  return Array.from(groups.values());
}

async function groupsForAssigneeUid(
  caller: Record<string, unknown>,
  callerUid: string,
  assigneeUid: string
): Promise<string[]> {
  if (!assigneeUid) return [];

  if (assigneeUid === callerUid) {
    const callerTokens = roleTagsFromClaims(caller as any) || [];
    const out = groupsFromTokens(callerTokens);
    if (!out.length) return ["casemanager"];
    return unique(out);
  }

  const rec = await authAdmin.getUser(assigneeUid).catch(() => null);
  const cc = (rec?.customClaims || {}) as Record<string, unknown>;
  const userTokens: string[] = [
    ...(Array.isArray(cc.roles) ? cc.roles.map((x) => String(x || "")) : []),
    String(cc.topRole || ""),
    String(cc.role || ""),
  ];
  const out = groupsFromTokens(userTokens);
  if (!out.length) return ["casemanager"];
  return unique(out);
}

function sortRows(rows: any[], sortBy: "dueDate" | "assigneeUid" | "customerId", sortDir: "asc" | "desc", hasStatusFilter: boolean): any[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...rows].sort((a: any, b: any) => {
    const ad = String(a?.dueDate || "");
    const bd = String(b?.dueDate || "");
    const au = String(a?.assignedToUid || "");
    const bu = String(b?.assignedToUid || "");
    const ac = String(a?.clientId || a?.customerId || "");
    const bc = String(b?.clientId || b?.customerId || "");

    if (sortBy === "assigneeUid") {
      const c = au.localeCompare(bu) * dir;
      if (c) return c;
      return ad.localeCompare(bd);
    }
    if (sortBy === "customerId") {
      const c = ac.localeCompare(bc) * dir;
      if (c) return c;
      return ad.localeCompare(bd);
    }

    // Legacy behavior for dueDate sorting: open first when status is not pinned.
    if (!hasStatusFilter) {
      const as = String(a?.status || "");
      const bs = String(b?.status || "");
      if (as !== bs) return as.localeCompare(bs);
    }
    return ad.localeCompare(bd) * dir;
  });
}

export const inboxWorkloadList = secureHandler(
  async (req, res) => {
    const caller: any = (req as any).user || {};
    const callerUid = String(caller?.uid || "");
    if (!callerUid) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }

    const parsed = z
      .object({
        month: z.string().optional(),
        assigneeUid: z.string().optional(),
        customerId: z.string().optional(),
        status: z.enum(["open", "done"]).optional(),
        sortBy: z.enum(["dueDate", "assigneeUid", "customerId"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        includeUnassigned: z.union([z.boolean(), z.string(), z.number()]).optional(),
        includeGroup: z.union([z.boolean(), z.string(), z.number()]).optional(),
        limit: z.coerce.number().int().min(1).max(5000).optional(),
      })
      .partial()
      .parse(req.method === "GET" ? req.query : req.body);

    const monthRaw = String(parsed?.month || "").slice(0, 7);
    const month =
      /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : toDateOnly(new Date()).slice(0, 7);
    const assigneeUid = String(parsed?.assigneeUid || "").trim() || null;
    const customerId = String(parsed?.customerId || "").trim() || null;
    const status = parsed?.status || null;
    const sortBy = parsed?.sortBy || "dueDate";
    const sortDir = parsed?.sortDir || "asc";
    const includeUnassigned = toBool(parsed?.includeUnassigned, false);
    const includeGroup = toBool(parsed?.includeGroup, true);
    const limit = Number(parsed?.limit || 2000);

    const tags = roleTagsFromClaims(caller);
    const canOversee =
      hasLevel(caller, "admin") ||
      tags.includes("compliance") ||
      tags.includes("supervisor");
    if ((!assigneeUid || assigneeUid !== callerUid) && !canOversee) {
      const e: any = new Error("forbidden");
      e.code = 403;
      e.meta = { need: "admin_or_compliance_or_supervisor" };
      throw e;
    }

    const hardLimit = Math.max(1, Math.min(5000, limit));
    const toRows = (snap: FirebaseFirestore.QuerySnapshot) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    // Fast path for list-all usage (no specific assignee filter).
    if (!assigneeUid) {
      let q: FirebaseFirestore.Query = db.collection("userTasks").where("dueMonth", "==", month);
      if (customerId) q = q.where("clientId", "==", customerId);
      if (status) q = q.where("status", "==", status);

      if (sortBy === "assigneeUid") {
        q = q.orderBy("assignedToUid", sortDir);
        q = q.orderBy("dueDate", "asc");
      } else if (sortBy === "customerId") {
        q = q.orderBy("clientId", sortDir);
        q = q.orderBy("dueDate", "asc");
      } else {
        if (!status) q = q.orderBy("status", "asc");
        q = q.orderBy("dueDate", "asc");
      }

      const snap = await q.limit(hardLimit).get();
      const items = toRows(snap).filter((it: any) => {
        const uid = String(it?.assignedToUid || "").trim();
        if (includeUnassigned) return true;
        return !!uid;
      });
      res.status(200).json({ ok: true, items: items.slice(0, hardLimit) });
      return;
    }

    // UID-specific view: include direct assignments + queue items for that user's groups.
    const groups = includeGroup ? await groupsForAssigneeUid(caller, callerUid, assigneeUid) : [];
    const map = new Map<string, any>();

    // Direct user assignments.
    let mineQ: FirebaseFirestore.Query = db
      .collection("userTasks")
      .where("dueMonth", "==", month)
      .where("assignedToUid", "==", assigneeUid);
    if (customerId) mineQ = mineQ.where("clientId", "==", customerId);
    if (status) mineQ = mineQ.where("status", "==", status);
    const mineSnap = await mineQ.get();
    for (const row of toRows(mineSnap)) {
      const k = String((row as any).utid || (row as any).id || "");
      if (k) map.set(k, row);
    }

    // Group queue assignments routed to this UID by role/group.
    for (const g of groups) {
      let gq: FirebaseFirestore.Query = db
        .collection("userTasks")
        .where("dueMonth", "==", month)
        .where("assignedToGroup", "==", g)
        .where("assignedToUid", "==", null);
      if (customerId) gq = gq.where("clientId", "==", customerId);
      if (status) gq = gq.where("status", "==", status);
      else gq = gq.where("status", "==", "open");

      const gs = await gq.get();
      for (const row of toRows(gs)) {
        const k = String((row as any).utid || (row as any).id || "");
        if (k) map.set(k, row);
      }
    }

    const sorted = sortRows(Array.from(map.values()), sortBy, sortDir, !!status);
    res.status(200).json({ ok: true, items: sorted.slice(0, hardLimit) });
  },
  { auth: "user", methods: ["GET", "POST", "OPTIONS"] }
);
