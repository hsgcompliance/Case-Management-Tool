// functions/src/features/inbox/digestCaseManagers.ts
// Case Manager overview digest — one row per CM with caseload, tasks, acuity.
import { db, isoNow } from "../../core";
import { sendHtmlEmail } from "./emailer";

const DASHBOARD_LINK = "https://households-db.web.app/dashboard";
const BRAND      = "#2563EB";
const TEXT       = "#1e293b";
const MUTED      = "#64748b";
const BG_PAGE    = "#f1f5f9";
const BG_CARD    = "#ffffff";
const BORDER     = "#e2e8f0";
const BG_SECT    = "#f8fafc";
const GREEN_BG   = "#dcfce7";
const GREEN_TEXT = "#15803d";
const AMBER_BG   = "#fef3c7";
const AMBER_TEXT = "#b45309";
const DANGER_BG  = "#fee2e2";
const DANGER_TEXT = "#b91c1c";

// ── Types ─────────────────────────────────────────────────────────────────────

type CMRow = {
  uid: string;
  name: string;
  email: string;
  caseloadActive: number;
  enrollmentCount: number;
  openTasks: number;
  overdueTasks: number;
  acuityAvg: number | null;
};

type CaseManagerDigestData = {
  recipientName: string;
  month: string;
  rows: CMRow[];
  totals: {
    caseloadActive: number;
    enrollmentCount: number;
    openTasks: number;
    overdueTasks: number;
  };
  dashboardLink: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch { return ym; }
}

function acuityBadge(avg: number | null): string {
  if (avg === null) return `<span style="color:${MUTED};font-size:12px">—</span>`;
  const color = avg >= 4 ? DANGER_TEXT : avg >= 3 ? AMBER_TEXT : GREEN_TEXT;
  return `<span style="font-weight:700;color:${color};font-size:13px">${avg.toFixed(1)}</span>`;
}

function taskBadge(open: number, overdue: number): string {
  if (!open) return `<span style="color:${MUTED};font-size:12px">0</span>`;
  const bg    = overdue > 0 ? DANGER_BG  : AMBER_BG;
  const color = overdue > 0 ? DANGER_TEXT : AMBER_TEXT;
  const label = overdue > 0 ? `${open} (${overdue} overdue)` : String(open);
  return `<span style="background:${bg};color:${color};padding:1px 7px;border-radius:9999px;font-size:11px;font-weight:700">${label}</span>`;
}

// ── Data builder ──────────────────────────────────────────────────────────────

export async function buildCaseManagerDigestData(opts: {
  month: string;
  recipientName?: string;
  dashboardLink?: string;
}): Promise<CaseManagerDigestData> {
  const { month, recipientName = "Team", dashboardLink = DASHBOARD_LINK } = opts;

  // 1. List all users with casemanager role via Auth is expensive; use userExtras instead.
  //    userExtras docs exist for every registered user; filter by querying customers for distinct caseManagerIds.
  const customersSnap = await db
    .collection("customers")
    .where("active", "==", true)
    .where("deleted", "!=", true)
    .select("caseManagerId")
    .get();

  const cmUids = [
    ...new Set(
      customersSnap.docs
        .map((d) => String((d.data() as Record<string, unknown>).caseManagerId || ""))
        .filter(Boolean)
    ),
  ];

  if (!cmUids.length) {
    return { recipientName, month, rows: [], totals: { caseloadActive: 0, enrollmentCount: 0, openTasks: 0, overdueTasks: 0 }, dashboardLink };
  }

  // 2. Batch-fetch userExtras for all CM uids
  const chunks = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const extrasMap = new Map<string, Record<string, unknown>>();
  await Promise.all(
    chunks(cmUids, 30).map(async (chunk) => {
      const s = await db.collection("userExtras").where("__name__", "in", chunk).get();
      for (const doc of s.docs) extrasMap.set(doc.id, doc.data() as Record<string, unknown>);
    })
  );

  // 3. Batch-fetch open task counts from userTasks
  const taskCountMap  = new Map<string, number>(); // uid → open count
  const overdueMap    = new Map<string, number>(); // uid → overdue count
  const today         = new Date().toISOString().slice(0, 10);

  await Promise.all(
    chunks(cmUids, 30).map(async (chunk) => {
      const s = await db
        .collection("userTasks")
        .where("assignedToUid", "in", chunk)
        .where("status", "==", "open")
        .get();
      for (const doc of s.docs) {
        const t = doc.data() as Record<string, unknown>;
        const uid = String(t.assignedToUid || "");
        if (!uid) continue;
        taskCountMap.set(uid, (taskCountMap.get(uid) || 0) + 1);
        const due = String(t.dueDate || "");
        if (due && due < today) overdueMap.set(uid, (overdueMap.get(uid) || 0) + 1);
      }
    })
  );

  // 4. Build rows — use userExtras flat fields with legacy fallback
  const rows: CMRow[] = cmUids.map((uid) => {
    const e = extrasMap.get(uid) || {};
    const m = (e.metrics as Record<string, unknown>) || {};

    const caseloadActive  = Number(e.caseloadActive  ?? m.caseloadActive  ?? 0);
    const enrollmentCount = Number(e.enrollmentCount ?? m.enrollmentCount ?? 0);
    const acuityAvg       = e.acuityScoreAvg != null ? Number(e.acuityScoreAvg) : null;
    const name            = String(e.displayName || e.email || uid);
    const email           = String(e.email || "");

    return {
      uid,
      name,
      email,
      caseloadActive,
      enrollmentCount,
      openTasks:    taskCountMap.get(uid) || 0,
      overdueTasks: overdueMap.get(uid)   || 0,
      acuityAvg:    acuityAvg !== null && Number.isFinite(acuityAvg) ? acuityAvg : null,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const sum = (fn: (r: CMRow) => number) => rows.reduce((s, r) => s + fn(r), 0);

  return {
    recipientName,
    month,
    rows,
    totals: {
      caseloadActive:  sum((r) => r.caseloadActive),
      enrollmentCount: sum((r) => r.enrollmentCount),
      openTasks:       sum((r) => r.openTasks),
      overdueTasks:    sum((r) => r.overdueTasks),
    },
    dashboardLink,
  };
}

// ── HTML template ─────────────────────────────────────────────────────────────

export function buildCaseManagerDigestHtml(data: CaseManagerDigestData): string {
  const { recipientName, month, rows, totals, dashboardLink } = data;
  const label = monthLabel(month);

  const tableRows = rows.map((r) => `
    <tr style="border-top:1px solid ${BORDER}">
      <td style="padding:8px 10px">
        <div style="font-size:13px;font-weight:600;color:${TEXT}">${esc(r.name)}</div>
        ${r.email ? `<div style="font-size:11px;color:${MUTED}">${esc(r.email)}</div>` : ""}
      </td>
      <td style="padding:8px 10px;text-align:center">
        <span style="font-size:14px;font-weight:700;color:${BRAND}">${r.caseloadActive}</span>
        <div style="font-size:10px;color:${MUTED}">active</div>
      </td>
      <td style="padding:8px 10px;text-align:center">
        <span style="font-size:13px;color:${MUTED}">${r.enrollmentCount}</span>
        <div style="font-size:10px;color:${MUTED}">enrolled</div>
      </td>
      <td style="padding:8px 10px;text-align:center">${taskBadge(r.openTasks, r.overdueTasks)}</td>
      <td style="padding:8px 10px;text-align:center">${acuityBadge(r.acuityAvg)}</td>
    </tr>`).join("");

  const noRows = !rows.length
    ? `<div style="color:${MUTED};font-size:13px;text-align:center;padding:20px">No active case managers found.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Case Manager Digest</title></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:640px" cellpadding="0" cellspacing="0">

        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:700;color:#fff">Case Manager Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">${label} &nbsp;·&nbsp; ${esc(recipientName)}</div>
        </td></tr>

        <!-- Summary stats -->
        <tr><td style="background:${BG_CARD};padding:16px 28px;border-bottom:1px solid ${BORDER}">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${BRAND}">${rows.length}</div>
              <div style="font-size:11px;color:${MUTED}">Case Managers</div>
            </td>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${TEXT}">${totals.caseloadActive}</div>
              <div style="font-size:11px;color:${MUTED}">Active Clients</div>
            </td>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${totals.overdueTasks > 0 ? DANGER_TEXT : AMBER_TEXT}">${totals.openTasks}</div>
              <div style="font-size:11px;color:${MUTED}">Open Tasks</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:22px;font-weight:700;color:${totals.overdueTasks > 0 ? DANGER_TEXT : MUTED}">${totals.overdueTasks}</div>
              <div style="font-size:11px;color:${MUTED}">Overdue</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- CM table -->
        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;overflow:hidden">
            ${rows.length ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead><tr style="background:${BG_SECT}">
                <th align="left" style="padding:7px 10px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Case Manager</th>
                <th align="center" style="padding:7px 10px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Caseload</th>
                <th align="center" style="padding:7px 10px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Enrollments</th>
                <th align="center" style="padding:7px 10px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Tasks</th>
                <th align="center" style="padding:7px 10px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Acuity Avg</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>` : noRows}
          </div>
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard</a>
          <div style="margin-top:12px;font-size:11px;color:${MUTED}">You're receiving this digest based on your subscription preferences.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Send ──────────────────────────────────────────────────────────────────────

export async function buildAndSendCaseManagerDigest(
  to: string,
  opts: { month: string; recipientName?: string }
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_caseManagers_${opts.month}_${to.toLowerCase()}`;
  const logRef = db.collection("emailLogs").doc(key);
  if ((await logRef.get()).exists) return { ok: true, skipped: true };

  const data = await buildCaseManagerDigestData({ month: opts.month, recipientName: opts.recipientName });
  const html = buildCaseManagerDigestHtml(data);
  const subject = `Case Manager Digest — ${monthLabel(opts.month)} (${data.rows.length} CMs, ${data.totals.caseloadActive} clients)`;

  const sent = await sendHtmlEmail({ from: "hsgcompliance@thehrdc.org", to, subject, html });
  await logRef.set({ id: sent.id || null, to, month: opts.month, subject, createdAt: isoNow() }, { merge: true });
  return sent;
}
