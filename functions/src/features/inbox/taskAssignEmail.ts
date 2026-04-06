// functions/src/features/inbox/taskAssignEmail.ts
// Sends "You've been assigned a task" email when a userTask gets assignedToUid set.

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, authAdmin, RUNTIME, isoNow, toDateOnly } from "../../core";
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN } from "../../core";
import { sendHtmlEmail } from "./emailer";

const BRAND_COLOR = "#2563EB";
const TEXT_MAIN = "#1e293b";
const TEXT_MUTED = "#64748b";
const BG_PAGE = "#f1f5f9";
const BG_CARD = "#ffffff";
const BORDER = "#e2e8f0";
const DASHBOARD_LINK = "https://households-db.web.app/dashboard";

function fmtDate(d?: string): string {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
  } catch { return d; }
}

function buildAssignmentHtml(args: {
  cmName: string;
  taskTitle: string;
  source: string;
  dueDate?: string;
  clientName?: string;
  dashboardLink: string;
}): string {
  const { cmName, taskTitle, source, dueDate, clientName, dashboardLink } = args;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Task Assigned</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:540px" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:22px 28px">
          <div style="font-size:18px;font-weight:700;color:#fff">You've been assigned a task</div>
          <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:3px">Hi ${cmName || "there"}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:${BG_CARD};padding:24px 28px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDER}">
                <div style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:.5px;font-weight:600">Task</div>
                <div style="font-size:15px;font-weight:600;color:${TEXT_MAIN};margin-top:4px">${taskTitle || "—"}</div>
              </td>
            </tr>
            ${source ? `<tr><td style="padding:8px 0;border-bottom:1px solid ${BORDER}">
              <div style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:.5px;font-weight:600">Type</div>
              <div style="font-size:13px;color:${TEXT_MAIN};margin-top:4px;text-transform:capitalize">${source}</div>
            </td></tr>` : ""}
            ${dueDate ? `<tr><td style="padding:8px 0;border-bottom:1px solid ${BORDER}">
              <div style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:.5px;font-weight:600">Due Date</div>
              <div style="font-size:13px;color:${TEXT_MAIN};margin-top:4px">${fmtDate(dueDate)}</div>
            </td></tr>` : ""}
            ${clientName ? `<tr><td style="padding:8px 0">
              <div style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:.5px;font-weight:600">Customer</div>
              <div style="font-size:13px;color:${TEXT_MAIN};margin-top:4px">${clientName}</div>
            </td></tr>` : ""}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:${BG_CARD};padding:0 28px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER}">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">View in Dashboard</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:12px 28px;text-align:center">
          <div style="font-size:11px;color:${TEXT_MUTED}">You're receiving this because a task was assigned to you.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Send a task-assignment notification email directly (callable from other services). */
export async function sendTaskAssignmentEmail(args: {
  toEmail: string;
  cmName: string;
  taskTitle: string;
  source: string;
  dueDate?: string;
  clientId?: string;
  dashboardLink?: string;
}) {
  let clientName: string | undefined;
  if (args.clientId) {
    const cdoc = await db.collection("customers").doc(args.clientId).get();
    if (cdoc.exists) {
      const d = cdoc.data() as any;
      const fn = String(d.firstName || "").trim();
      const ln = String(d.lastName || "").trim();
      clientName = [fn, ln].filter(Boolean).join(" ") || String(d.name || "");
    }
  }

  const html = buildAssignmentHtml({
    cmName: args.cmName,
    taskTitle: args.taskTitle,
    source: args.source,
    dueDate: args.dueDate,
    clientName,
    dashboardLink: args.dashboardLink ?? DASHBOARD_LINK,
  });

  return sendHtmlEmail({
    from: "hsgcompliance@thehrdc.org",
    to: args.toEmail,
    subject: `Task Assigned: ${args.taskTitle || "New task"}`,
    html,
  });
}

/**
 * Firestore trigger: fires when a userTask document is written.
 * Sends assignment email when assignedToUid transitions from null/undefined to a uid.
 */
export const onUserTaskAssigned = onDocumentWritten(
  {
    document: "userTasks/{utid}",
    region: RUNTIME.region,
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  },
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;

    // Skip deletes
    if (!after) return;

    const prevUid = before?.assignedToUid ?? null;
    const nextUid = after?.assignedToUid ?? null;

    // Only fire when uid is newly set (not already set before, and not null/undefined now)
    if (!nextUid || nextUid === prevUid) return;

    try {
      const userRecord = await authAdmin.getUser(nextUid);
      const toEmail = userRecord.email;
      if (!toEmail) return;

      // Check digest opt-out preference
      const extrasSnap = await db.collection("userExtras").doc(nextUid).get();
      const extras = extrasSnap.exists ? (extrasSnap.data() as any) : {};
      if (extras?.digestOptOut === true) return;

      const cmName = userRecord.displayName || toEmail;

      await sendTaskAssignmentEmail({
        toEmail,
        cmName,
        taskTitle: String(after.title || after.note || after.notes || "New task"),
        source: String(after.source || "task"),
        dueDate: after.dueDate ?? undefined,
        clientId: after.clientId ?? undefined,
      });

      // Log the send
      const logKey = `taskAssign_${event.params.utid}_${nextUid}`;
      await db.collection("emailLogs").doc(logKey).set(
        { type: "taskAssign", utid: event.params.utid, to: toEmail, assignedToUid: nextUid, sentAt: isoNow() },
        { merge: true }
      );
    } catch (err) {
      console.error("onUserTaskAssigned: failed to send assignment email", err);
    }
  }
);
