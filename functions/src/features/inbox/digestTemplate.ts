// functions/src/features/inbox/digestTemplate.ts
// Caseload monthly digest — clean bullet-point format.

export type DigestEnrollmentRow = {
  id: string;
  grantName: string;
};

export type DigestPaymentRow = {
  amount: string;       // formatted, e.g. "$500.00"
  description: string;
  status: string;       // "pending" | "posted" | "void"
};

export type DigestTaskRow = {
  title: string;
  dueDate: string;      // YYYY-MM-DD or ""
  status: string;       // "open" | "done"
};

export type DigestPrimaryClient = {
  clientId: string;
  name: string;
  enrollments: DigestEnrollmentRow[];
  payments: DigestPaymentRow[];
  tasks: DigestTaskRow[];
};

export type DigestSecondaryClient = {
  clientId: string;
  name: string;
  enrollments: DigestEnrollmentRow[];
};

export type DigestTemplateArgs = {
  cmName: string;
  month: string;          // YYYY-MM
  primaryClients: DigestPrimaryClient[];
  secondaryClients: DigestSecondaryClient[];
  dashboardLink: string;
  taskCount: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRAND   = "#2563EB";
const TEXT    = "#1e293b";
const MUTED   = "#64748b";
const BG_PAGE = "#f1f5f9";
const BG_CARD = "#ffffff";
const BORDER  = "#e2e8f0";
const BG_SECT = "#f8fafc";

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch { return ym; }
}

function fmtDate(d: string): string {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
  } catch { return d; }
}

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function bullet(text: string, muted = false): string {
  return `<div style="padding:2px 0 2px 14px;font-size:13px;color:${muted ? MUTED : TEXT};position:relative">
    <span style="position:absolute;left:2px;color:${MUTED}">•</span>${esc(text)}
  </div>`;
}

function subBullet(text: string): string {
  return `<div style="padding:2px 0 2px 26px;font-size:12px;color:${MUTED};position:relative">
    <span style="position:absolute;left:14px;color:#cbd5e1">–</span>${esc(text)}
  </div>`;
}

function clientBlock(name: string, inner: string): string {
  return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;margin-bottom:12px;overflow:hidden">
    <div style="background:${BG_SECT};border-bottom:1px solid ${BORDER};padding:10px 14px;font-size:14px;font-weight:700;color:${TEXT}">${esc(name)}</div>
    <div style="padding:10px 14px">${inner}</div>
  </div>`;
}

function sectionLabel(label: string): string {
  return `<div style="font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.6px;margin:6px 0 3px">${label}</div>`;
}

// ── Primary client section ────────────────────────────────────────────────────

function primaryClientHtml(c: DigestPrimaryClient): string {
  let inner = "";

  // Enrollments
  inner += sectionLabel("Active Enrollments");
  if (c.enrollments.length) {
    inner += c.enrollments.map((e) => bullet(e.grantName)).join("");
  } else {
    inner += subBullet("None");
  }

  // Payments
  inner += sectionLabel("Payments This Month");
  if (c.payments.length) {
    inner += c.payments.map((p) => {
      const badge = p.status === "posted"
        ? ` <span style="background:#dcfce7;color:#15803d;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:600">Paid</span>`
        : p.status === "void"
        ? ` <span style="background:#fee2e2;color:#b91c1c;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:600">Void</span>`
        : ` <span style="background:#dbeafe;color:#1d4ed8;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:600">Pending</span>`;
      const label = [p.amount, p.description].filter(Boolean).join(" — ");
      return `<div style="padding:2px 0 2px 14px;font-size:13px;color:${TEXT};position:relative">
        <span style="position:absolute;left:2px;color:${MUTED}">•</span>${esc(label)}${badge}
      </div>`;
    }).join("");
  } else {
    inner += subBullet("None");
  }

  // Tasks
  inner += sectionLabel("Tasks");
  if (c.tasks.length) {
    inner += c.tasks.map((t) => {
      const done = t.status === "done";
      const datePart = t.dueDate ? ` · ${fmtDate(t.dueDate)}` : "";
      const badge = done
        ? ` <span style="background:#dcfce7;color:#15803d;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:600">Done</span>`
        : ` <span style="background:#dbeafe;color:#1d4ed8;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:600">Open</span>`;
      return `<div style="padding:2px 0 2px 14px;font-size:13px;color:${done ? MUTED : TEXT};position:relative;${done ? "text-decoration:line-through" : ""}">
        <span style="position:absolute;left:2px;color:${MUTED}">•</span>${esc(t.title)}${esc(datePart)}${badge}
      </div>`;
    }).join("");
  } else {
    inner += subBullet("None this month");
  }

  return clientBlock(c.name || c.clientId, inner);
}

// ── Secondary client section ──────────────────────────────────────────────────

function secondaryClientHtml(c: DigestSecondaryClient): string {
  let inner = sectionLabel("Active Enrollments");
  if (c.enrollments.length) {
    inner += c.enrollments.map((e) => bullet(e.grantName)).join("");
  } else {
    inner += subBullet("None");
  }
  return clientBlock(c.name || c.clientId, inner);
}

// ── Full HTML template ────────────────────────────────────────────────────────

export function buildDigestHtml(args: DigestTemplateArgs): string {
  const { cmName, month, primaryClients, secondaryClients, dashboardLink } = args;
  const label = monthLabel(month);
  const totalTasks = primaryClients.reduce((s, c) => s + c.tasks.length, 0);
  const openTasks  = primaryClients.reduce((s, c) => s + c.tasks.filter(t => t.status !== "done").length, 0);

  const primaryHtml = primaryClients.length
    ? primaryClients.map(primaryClientHtml).join("")
    : `<div style="color:${MUTED};font-size:13px;padding:8px 0">No primary clients this month.</div>`;

  const secondaryHtml = secondaryClients.length
    ? secondaryClients.map(secondaryClientHtml).join("")
    : `<div style="color:${MUTED};font-size:13px;padding:8px 0">No secondary clients.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${label} Caseload Digest</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:640px" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:700;color:#fff">Monthly Caseload Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">${label} &nbsp;·&nbsp; ${esc(cmName)}</div>
        </td></tr>

        <!-- Stats -->
        <tr><td style="background:${BG_CARD};padding:16px 28px;border-bottom:1px solid ${BORDER}">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:24px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:${BRAND}">${primaryClients.length}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:2px">Primary Clients</div>
              </td>
              <td style="padding-right:24px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:${BRAND}">${secondaryClients.length}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:2px">Secondary Clients</div>
              </td>
              <td style="padding-right:24px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:${BRAND}">${openTasks}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:2px">Open Tasks</div>
              </td>
              <td style="text-align:center">
                <div style="font-size:22px;font-weight:700;color:${BRAND}">${totalTasks}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:2px">Total Tasks</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:${BG_PAGE};padding:20px 28px">

          <!-- Primary caseload -->
          <div style="font-size:16px;font-weight:700;color:${TEXT};margin-bottom:12px">My Caseload</div>
          ${primaryHtml}

          <!-- Secondary clients -->
          <div style="font-size:16px;font-weight:700;color:${TEXT};margin:20px 0 12px">Secondary Clients</div>
          ${secondaryHtml}

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard</a>
          <div style="margin-top:12px;font-size:11px;color:${MUTED}">
            You're receiving this monthly caseload digest as a case manager.<br>
            To opt out, update your preferences in Settings.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildDigestSubject(month: string, taskCount: number): string {
  const label = monthLabel(month);
  return `${label} Caseload Digest — ${taskCount} Task${taskCount !== 1 ? "s" : ""}`;
}

// ── Plaintext fallback ────────────────────────────────────────────────────────

export function buildDigestPlaintext(args: DigestTemplateArgs): string {
  const { cmName, month, primaryClients, secondaryClients, dashboardLink } = args;
  const label = monthLabel(month);
  const lines: string[] = [
    `MONTHLY CASELOAD DIGEST — ${label.toUpperCase()}`,
    `For: ${cmName}`,
    "=".repeat(50),
    "",
    "MY CASELOAD (PRIMARY)",
    "",
  ];

  for (const c of primaryClients) {
    lines.push(`▸ ${c.name}`);
    if (c.enrollments.length) {
      lines.push("  Enrollments:");
      c.enrollments.forEach((e) => lines.push(`    • ${e.grantName}`));
    }
    if (c.payments.length) {
      lines.push("  Payments This Month:");
      c.payments.forEach((p) => lines.push(`    • ${p.amount} — ${p.description} [${p.status}]`));
    }
    if (c.tasks.length) {
      lines.push("  Tasks:");
      c.tasks.forEach((t) => {
        const datePart = t.dueDate ? ` · ${fmtDate(t.dueDate)}` : "";
        lines.push(`    • [${t.status}] ${t.title}${datePart}`);
      });
    }
    lines.push("");
  }

  if (secondaryClients.length) {
    lines.push("SECONDARY CLIENTS", "");
    for (const c of secondaryClients) {
      lines.push(`▸ ${c.name}`);
      if (c.enrollments.length) {
        lines.push("  Enrollments:");
        c.enrollments.forEach((e) => lines.push(`    • ${e.grantName}`));
      }
      lines.push("");
    }
  }

  lines.push(`Dashboard: ${dashboardLink}`);
  return lines.join("\n");
}
