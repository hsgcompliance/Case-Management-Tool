// functions/src/features/inbox/digestEnrollments.ts
// Enrollment digest: active enrollments, new this month, ending soon.
import { db, isoNow } from "../../core";
import { sendHtmlEmail } from "./emailer";
import { monthAdd } from "./utils";
import { loadDigestEnrollments } from "./digestEnrollmentSource";

const DASHBOARD_LINK = "https://households-db.web.app/dashboard";
const BRAND = "#2563EB";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const BG_PAGE = "#f1f5f9";
const BG_CARD = "#ffffff";
const BORDER = "#e2e8f0";
const BG_SECT = "#f8fafc";
const GREEN_BG = "#dcfce7";
const GREEN_TEXT = "#15803d";
const AMBER_BG = "#fef3c7";
const AMBER_TEXT = "#b45309";
const BLUE_BG = "#dbeafe";
const BLUE_TEXT = "#1d4ed8";

type EnrollmentRow = {
  id: string;
  customerName: string;
  grantName: string;
  startDate: string;
  endDate: string;
  status: string;
};

type EnrollmentDigestData = {
  recipientName: string;
  month: string;
  active: EnrollmentRow[];
  newThisMonth: EnrollmentRow[];
  endingThisMonth: EnrollmentRow[];
  endingNextMonth: EnrollmentRow[];
  dashboardLink: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return ym;
  }
}

function fmtDate(d: string): string {
  if (!d) return "-";
  try {
    const [y, m, day] = d.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
  } catch {
    return d;
  }
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function buildEnrollmentDigestData(opts: {
  month: string;
  forUid?: string;
  recipientName?: string;
  dashboardLink?: string;
}): Promise<EnrollmentDigestData> {
  const { month, forUid, recipientName = "Team", dashboardLink = DASHBOARD_LINK } = opts;
  const nextMonth = monthAdd(month, 1);

  const enrollments: Array<Record<string, unknown>> = (
    await loadDigestEnrollments({
      caseManagerId: forUid,
      activeOnly: true,
    })
  ).map((row) => ({ id: row.id, ...row.raw }));

  const customerIds = [
    ...new Set(
      enrollments
        .map((e) => String(e.customerId || e.clientId || "").trim())
        .filter(Boolean)
    ),
  ];
  const customerMap = new Map<string, string>();
  if (customerIds.length) {
    await Promise.all(
      chunks(customerIds, 30).map(async (chunk) => {
        const snap = await db.collection("customers").where("__name__", "in", chunk).get();
        for (const doc of snap.docs) {
          const customer = doc.data() as Record<string, unknown>;
          const fn = String(customer.firstName || "").trim();
          const ln = String(customer.lastName || "").trim();
          customerMap.set(doc.id, [fn, ln].filter(Boolean).join(" ") || String(customer.name || doc.id));
        }
      })
    );
  }

  const grantIds = [...new Set(enrollments.map((e) => String(e.grantId || "")).filter(Boolean))];
  const grantMap = new Map<string, string>();
  if (grantIds.length) {
    await Promise.all(
      chunks(grantIds, 30).map(async (chunk) => {
        const snap = await db.collection("grants").where("__name__", "in", chunk).get();
        for (const doc of snap.docs) {
          const grant = doc.data() as Record<string, unknown>;
          grantMap.set(doc.id, String(grant.name || grant.code || doc.id));
        }
      })
    );
  }

  const toRow = (e: Record<string, unknown>): EnrollmentRow => ({
    id: String(e.id || ""),
    customerName:
      String(e.customerName || e.clientName || "").trim() ||
      customerMap.get(String(e.customerId || e.clientId || "").trim()) ||
      String(e.customerId || e.clientId || "-"),
    grantName:
      String(e.grantName || "").trim() ||
      grantMap.get(String(e.grantId || "")) ||
      String(e.grantId || "-"),
    startDate: String(e.startDate || ""),
    endDate: String(e.endDate || ""),
    status: String(e.status || "active"),
  });

  const active = enrollments.map(toRow).sort((a, b) => a.customerName.localeCompare(b.customerName));
  const newThisMonth = active.filter((e) => e.startDate.startsWith(month));
  const endingThisMonth = active.filter((e) => e.endDate.startsWith(month));
  const endingNextMonth = active.filter((e) => e.endDate.startsWith(nextMonth));

  return { recipientName, month, active, newThisMonth, endingThisMonth, endingNextMonth, dashboardLink };
}

function enrollmentTable(rows: EnrollmentRow[], showEnd = false): string {
  if (!rows.length) return `<div style="font-size:13px;color:${MUTED};padding:4px 0">None.</div>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <thead><tr style="background:${BG_SECT}">
      <th align="left" style="padding:5px 8px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Customer</th>
      <th align="left" style="padding:5px 8px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase">Grant</th>
      ${showEnd ? `<th align="left" style="padding:5px 8px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase;white-space:nowrap">End Date</th>` : ""}
      <th align="left" style="padding:5px 8px;font-size:11px;color:${MUTED};font-weight:600;text-transform:uppercase;white-space:nowrap">Start Date</th>
    </tr></thead>
    <tbody>
      ${rows.map((r) => `<tr style="border-top:1px solid ${BORDER}">
        <td style="padding:6px 8px;font-size:13px;color:${TEXT}">${esc(r.customerName)}</td>
        <td style="padding:6px 8px;font-size:12px;color:${MUTED}">${esc(r.grantName)}</td>
        ${showEnd ? `<td style="padding:6px 8px;font-size:12px;color:${AMBER_TEXT};white-space:nowrap">${fmtDate(r.endDate)}</td>` : ""}
        <td style="padding:6px 8px;font-size:12px;color:${MUTED};white-space:nowrap">${fmtDate(r.startDate)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function section(title: string, badge: string, badgeBg: string, badgeColor: string, content: string): string {
  return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;margin-bottom:14px;overflow:hidden">
    <div style="background:${BG_SECT};border-bottom:1px solid ${BORDER};padding:10px 14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:14px;font-weight:700;color:${TEXT}">${title}</span>
      <span style="background:${badgeBg};color:${badgeColor};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700">${badge}</span>
    </div>
    <div style="padding:12px 14px">${content}</div>
  </div>`;
}

export function buildEnrollmentDigestHtml(data: EnrollmentDigestData): string {
  const { recipientName, month, active, newThisMonth, endingThisMonth, endingNextMonth, dashboardLink } = data;
  const label = monthLabel(month);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Enrollment Digest</title></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:640px" cellpadding="0" cellspacing="0">

        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:700;color:#fff">Enrollment Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">${label} &nbsp;&#183;&nbsp; ${esc(recipientName)}</div>
        </td></tr>

        <tr><td style="background:${BG_CARD};padding:16px 28px;border-bottom:1px solid ${BORDER}">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:20px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${BRAND}">${active.length}</div>
              <div style="font-size:11px;color:${MUTED}">Active</div>
            </td>
            <td style="padding-right:20px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${GREEN_TEXT}">${newThisMonth.length}</div>
              <div style="font-size:11px;color:${MUTED}">New This Month</div>
            </td>
            <td style="padding-right:20px;text-align:center">
              <div style="font-size:22px;font-weight:700;color:${AMBER_TEXT}">${endingThisMonth.length}</div>
              <div style="font-size:11px;color:${MUTED}">Ending This Month</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:22px;font-weight:700;color:${MUTED}">${endingNextMonth.length}</div>
              <div style="font-size:11px;color:${MUTED}">Ending Next Month</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          ${newThisMonth.length ? section("New This Month", String(newThisMonth.length), GREEN_BG, GREEN_TEXT, enrollmentTable(newThisMonth)) : ""}
          ${endingThisMonth.length ? section("Ending This Month", String(endingThisMonth.length), AMBER_BG, AMBER_TEXT, enrollmentTable(endingThisMonth, true)) : ""}
          ${endingNextMonth.length ? section("Ending Next Month", String(endingNextMonth.length), BLUE_BG, BLUE_TEXT, enrollmentTable(endingNextMonth, true)) : ""}
          ${section("All Active Enrollments", String(active.length), BLUE_BG, BLUE_TEXT, enrollmentTable(active, true))}
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function buildAndSendEnrollmentDigest(
  to: string,
  opts: { month: string; forUid?: string; recipientName?: string }
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_enrollments_${opts.month}_${to.toLowerCase()}`;
  const logRef = db.collection("emailLogs").doc(key);
  if ((await logRef.get()).exists) return { ok: true, skipped: true };

  const data = await buildEnrollmentDigestData(opts);
  const html = buildEnrollmentDigestHtml(data);
  const label = monthLabel(opts.month);
  const subject = `Enrollment Digest - ${label} (${data.active.length} active)`;

  const sent = await sendHtmlEmail({ from: "hsgcompliance@thehrdc.org", to, subject, html });
  await logRef.set({ id: sent.id || null, to, month: opts.month, subject, createdAt: isoNow() }, { merge: true });
  return sent;
}
