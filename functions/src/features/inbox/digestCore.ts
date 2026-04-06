// functions/src/features/inbox/digestCore.ts
import { db, isoNow } from "../../core";
import { sendHtmlEmail } from "./emailer";
import {
  buildDigestHtml,
  buildDigestSubject,
  type DigestTemplateArgs,
  type DigestPrimaryClient,
  type DigestSecondaryClient,
  type DigestEnrollmentRow,
  type DigestPaymentRow,
  type DigestTaskRow,
} from "./digestTemplate";
import { loadActiveEnrollmentsForCustomers } from "./digestEnrollmentSource";

const DASHBOARD_LINK = "https://households-db.web.app/dashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function customerName(d: Record<string, unknown>): string {
  const fn = String(d.firstName || "").trim();
  const ln = String(d.lastName || "").trim();
  return [fn, ln].filter(Boolean).join(" ") || String(d.name || d.id || "—");
}

function formatCents(cents: unknown): string {
  const n = typeof cents === "number" ? cents : Number(cents || 0);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n) / 100;
  return (n < 0 ? "-$" : "$") + abs.toFixed(2);
}

/** Chunk an array into groups of at most `size`. */
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Core data builder ─────────────────────────────────────────────────────────

type BuildOpts = {
  month: string;        // "YYYY-MM"
  forUid: string;       // CM uid
  cmName?: string;
  dashboardLink?: string;
};

export async function buildDigestData(opts: BuildOpts): Promise<DigestTemplateArgs> {
  const { month, forUid, cmName = "Case Manager", dashboardLink = DASHBOARD_LINK } = opts;

  // ── 1. Fetch primary customers (caseManagerId == cmUid, active) ─────────────
  const primarySnap = await db
    .collection("customers")
    .where("caseManagerId", "==", forUid)
    .where("active", "==", true)
    .get();

  // ── 2. Fetch secondary customers (secondaryCaseManagerId == cmUid, active) ──
  const secondarySnap = await db
    .collection("customers")
    .where("secondaryCaseManagerId", "==", forUid)
    .where("active", "==", true)
    .get();

  const primaryRaw = primarySnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  const primaryIds = new Set(primaryRaw.map((c) => c.id));

  // Deduplicate: remove anyone who is already in primary from secondary list
  const secondaryRaw = secondarySnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((c) => !primaryIds.has(c.id));

  const allIds = [...primaryRaw, ...secondaryRaw].map((c) => c.id);

  // ── 3. Batch-fetch active enrollments for all customers ─────────────────────
  const enrollmentMap = new Map<string, Array<Record<string, unknown>>>();
  if (allIds.length) {
    const activeEnrollments = await loadActiveEnrollmentsForCustomers({
      customerIds: allIds,
      caseManagerId: forUid,
    });
    for (const [customerId, rows] of activeEnrollments.entries()) {
      enrollmentMap.set(
        customerId,
        rows.map((row) => ({ id: row.id, ...row.raw }))
      );
    }
  }

  // ── 4. Fetch grant names for all referenced grants ───────────────────────────
  const grantIds = [
    ...new Set(
      [...enrollmentMap.values()]
        .flat()
        .map((e) => String(e.grantId || ""))
        .filter(Boolean)
    ),
  ];
  const grantNameMap = new Map<string, string>();
  if (grantIds.length) {
    await Promise.all(
      chunks(grantIds, 30).map(async (chunk) => {
        const snap = await db.collection("grants").where("__name__", "in", chunk).get();
        for (const doc of snap.docs) {
          const g = doc.data() as Record<string, unknown>;
          grantNameMap.set(doc.id, String(g.name || g.code || doc.id));
        }
      })
    );
  }

  // ── 5. Fetch tasks for this CM this month ────────────────────────────────────
  const tasksSnap = await db
    .collection("userTasks")
    .where("cmUid", "==", forUid)
    .where("dueMonth", "==", month)
    .get();

  const tasksByClient = new Map<string, Array<Record<string, unknown>>>();
  for (const doc of tasksSnap.docs) {
    const t: Record<string, unknown> = { id: doc.id, ...(doc.data() as Record<string, unknown>) };
    const cid = String(t.clientId || "");
    if (!cid) continue;
    if (!tasksByClient.has(cid)) tasksByClient.set(cid, []);
    tasksByClient.get(cid)!.push(t);
  }

  // ── 6. Fetch payments (paymentQueue) for primary customers this month ────────
  const paymentsByClient = new Map<string, Array<Record<string, unknown>>>();
  if (primaryRaw.length) {
    await Promise.all(
      chunks(primaryRaw.map((c) => c.id), 30).map(async (chunk) => {
        const snap = await db
          .collection("paymentQueue")
          .where("customerId", "in", chunk)
          .where("month", "==", month)
          .get();
        for (const doc of snap.docs) {
          const p: Record<string, unknown> = { id: doc.id, ...(doc.data() as Record<string, unknown>) };
          const cid = String(p.customerId || "");
          if (!paymentsByClient.has(cid)) paymentsByClient.set(cid, []);
          paymentsByClient.get(cid)!.push(p);
        }
      })
    );
  }

  // ── 7. Build primary client sections ─────────────────────────────────────────
  const buildEnrollments = (cid: string): DigestEnrollmentRow[] =>
    (enrollmentMap.get(cid) || []).map((e) => ({
      id: String(e.id || ""),
      grantName: grantNameMap.get(String(e.grantId || "")) || String(e.grantId || "—"),
    }));

  const buildPayments = (cid: string): DigestPaymentRow[] =>
    (paymentsByClient.get(cid) || [])
      .filter((p) => String(p.queueStatus || "") !== "void")
      .map((p) => ({
        amount: formatCents(p.amountCents),
        description: String(p.description || p.vendor || p.merchant || "—"),
        status: String(p.queueStatus || "pending"),
      }));

  const buildTasks = (cid: string): DigestTaskRow[] =>
    (tasksByClient.get(cid) || [])
      .filter((t) => t.status !== "cancelled")
      .map((t) => ({
        title: String(t.title || t.note || t.notes || "—"),
        dueDate: String(t.dueDate || ""),
        status: String(t.status || "open"),
      }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });

  const primaryClients: DigestPrimaryClient[] = primaryRaw
    .sort((a, b) => customerName(a).localeCompare(customerName(b)))
    .map((c) => ({
      clientId: c.id,
      name: customerName(c),
      enrollments: buildEnrollments(c.id),
      payments: buildPayments(c.id),
      tasks: buildTasks(c.id),
    }));

  // ── 8. Build secondary client sections (enrollments only) ────────────────────
  const secondaryClients: DigestSecondaryClient[] = secondaryRaw
    .sort((a, b) => customerName(a).localeCompare(customerName(b)))
    .map((c) => ({
      clientId: c.id,
      name: customerName(c),
      enrollments: buildEnrollments(c.id),
    }));

  const taskCount = primaryClients.reduce((s, c) => s + c.tasks.length, 0);

  return {
    cmName,
    month,
    primaryClients,
    secondaryClients,
    dashboardLink,
    taskCount,
  };
}

// ── Email send (with dedup via emailLogs) ─────────────────────────────────────

type SendOpts = {
  subject?: string;
  subjectTemplate?: string;
  dashboardLink?: string;
  cmName?: string;
  message?: string;
};

function injectMessage(html: string, message?: string): string {
  const body = String(message || "").trim();
  if (!body) return html;
  const block = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:16px;color:#1e293b;white-space:pre-wrap">${body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>`;
  const needle = `<tr><td style="background:#f1f5f9;padding:20px 28px">`;
  return html.includes(needle) ? html.replace(needle, `${needle}${block}`) : `${block}${html}`;
}

export async function sendDigestEmail(
  to: string,
  month: string,
  _rowsHtml: string,          // kept for back-compat, ignored
  sendOpts: SendOpts = {},
  digestData?: DigestTemplateArgs
): Promise<{ ok: boolean; id?: string | null; skipped?: boolean }> {
  const key = `digest_${month}_${to.toLowerCase()}`;
  const logRef = db.collection("emailLogs").doc(key);
  const prior = await logRef.get();
  if (prior.exists) return { ok: true, id: (prior.data() as any)?.id || null, skipped: true };

  const data = digestData ?? null;
  const taskCount = data?.taskCount ?? 0;
  const subject =
    sendOpts.subject ||
    (sendOpts.subjectTemplate
      ? sendOpts.subjectTemplate.replace("${month}", month)
      : data
      ? buildDigestSubject(month, taskCount)
      : `Caseload Digest — ${month}`);

  const html = data
    ? buildDigestHtml({ ...data, dashboardLink: sendOpts.dashboardLink ?? data.dashboardLink })
    : `<div style="font:14px sans-serif"><h2>${subject}</h2><p>No digest data available.</p></div>`;

  const htmlWithMessage = injectMessage(html, sendOpts.message);
  const sent = await sendHtmlEmail({ from: "hsgcompliance@thehrdc.org", to, subject, html: htmlWithMessage });

  await logRef.set(
    {
      id: sent.id || null,
      to,
      month,
      subject,
      message: String(sendOpts.message || "").trim() || null,
      createdAt: isoNow(),
      taskCount,
    },
    { merge: true }
  );
  return sent;
}

/** Full pipeline: build caseload data + send. */
export async function buildAndSendDigest(
  to: string,
  opts: BuildOpts & SendOpts
): Promise<{ ok: boolean; id?: string | null; skipped?: boolean }> {
  const data = await buildDigestData(opts);
  return sendDigestEmail(to, opts.month, "", opts, data);
}

// ── Back-compat shim (used by digestHttp legacy path) ─────────────────────────
/** @deprecated Prefer buildAndSendDigest. */
export async function buildDigestRows({ month, forUid }: { month: string; forUid: string }) {
  const data = await buildDigestData({ month, forUid });
  return { items: [] as any[], rowsHtml: "", digestData: data };
}
