// functions/src/features/inbox/emailer.ts
import {
  GMAIL_SENDER,
  MAIL_FROM_NAME,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
  secureHandler,
} from "../../core";
import { SendInviteBody, SendMonthlySummaryBody } from "./schemas";

let googleapisPromise: Promise<typeof import("googleapis")> | null = null;
async function getGoogle() {
  googleapisPromise ||= import("googleapis");
  return googleapisPromise;
}

async function getOAuth2() {
  const { google } = await getGoogle();
  const clientId = OAUTH_CLIENT_ID.value();
  const clientSecret = OAUTH_CLIENT_SECRET.value();
  const refreshToken = OAUTH_REFRESH_TOKEN.value();
  if (!clientId || !clientSecret || !refreshToken) throw new Error("missing_oauth_secrets");

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export async function sendHtmlEmail(args: {
  from?: string; // make optional; we’ll default from params
  to: string;
  subject: string;
  html: string;
}) {
  const { google } = await getGoogle();
  const oauth2 = await getOAuth2();
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  // READ PARAMS AT RUNTIME (not module import)
  const fromAddr = args.from || GMAIL_SENDER.value() || "";
  const fromName = MAIL_FROM_NAME.value() || "households-db";

  const raw = Buffer.from(
    `From: ${fromName} <${fromAddr}>\r\n` +
      `Reply-To: ${fromAddr}\r\n` +
      `List-Unsubscribe: <mailto:${fromAddr}?subject=unsubscribe>\r\n` +
      `To: ${args.to}\r\n` +
      `Subject: ${args.subject}\r\n` +
      "MIME-Version: 1.0\r\n" +
      'Content-Type: text/html; charset="UTF-8"\r\n\r\n' +
      args.html
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { ok: true, id: data.id ?? null };
}

export async function sendInviteService({
  to,
  name = "",
  resetLink = "#",
  subject,
  html,
}: {
  to: string;
  name?: string;
  resetLink?: string;
  subject?: string;
  html?: string;
}) {
  const finalSubject = subject || "You’re invited to households-db";
  const finalHtml =
    html ||
    `
    <div style="font:14px system-ui, -apple-system, Segoe UI, Roboto">
      <h2>Welcome to households-db</h2>
      <p>Hi ${name || "there"}, your account is ready.</p>
      <p><a href="${resetLink}">Set your password</a> to get started.</p>
      <p style="color:#666">If you didn’t expect this, ignore this email.</p>
    </div>
  `;
  return sendHtmlEmail({
    from: "hsgcompliance@thehrdc.org",
    to,
    subject: finalSubject,
    html: finalHtml,
  });
}

/** POST /inboxSendInvite  (admin) */
export const inboxSendInvite = secureHandler(
  async (req, res) => {
    const body = SendInviteBody.parse(req.body || {});
    const r = await sendInviteService(body);
    res.status(200).json(r);
  },
  {
    auth: "admin",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  }
);

export async function sendMonthlySummaryService(args: {
  to: string;
  clientId: string;
  tasksDue?: Array<{
    id?: string;
    type?: string;
    dueDate?: string;
    completed?: boolean;
    completedAt?: string;
  }>;
  monthsRemaining?: number | null;
  dashboardLink?: string;
  subject?: string;
  html?: string;
}) {
  const {
    to,
    clientId,
    tasksDue = [],
    monthsRemaining = null,
    dashboardLink = "#",
    subject,
    html,
  } = args;

  if (subject && html) {
    return sendHtmlEmail({
      from: "hsgcompliance@thehrdc.org",
      to,
      subject,
      html,
    });
  }

  const rows = tasksDue
    .map(
      (a) =>
        `<tr><td>${a.type || ""}</td><td>${a.dueDate || ""}</td><td>${
          a.completed ? "Yes" : "No"
        }</td></tr>`
    )
    .join("");

  const finalHtml = `
    <div style="font:14px system-ui, -apple-system, Segoe UI, Roboto">
      <h2>Monthly summary</h2>
      <p>Customer ID: <strong>${clientId}</strong></p>
      ${
        monthsRemaining != null
          ? `<p>Months of assistance remaining: <strong>${monthsRemaining}</strong></p>`
          : ""
      }
      <p><a href="${dashboardLink}">Open dashboard</a></p>
      <table border="0" cellpadding="6" style="border-collapse:collapse">
        <thead><tr><th align="left">Assessment</th><th align="left">Due</th><th align="left">Completed</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No tasks due</td></tr>'}</tbody>
      </table>
    </div>
  `;

  const finalSubject = subject || `Monthly summary for customer ${clientId}`;

  return sendHtmlEmail({
    from: "hsgcompliance@thehrdc.org",
    to,
    subject: finalSubject,
    html: finalHtml,
  });
}

/** POST /inboxSendMonthlySummary  (admin) */
export const inboxSendMonthlySummary = secureHandler(
  async (req, res) => {
    const body = SendMonthlySummaryBody.parse(req.body || {});
    const r = await sendMonthlySummaryService(body as any);
    res.status(200).json(r);
  },
  {
    auth: "admin",
    methods: ["POST", "OPTIONS"],
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  }
);
