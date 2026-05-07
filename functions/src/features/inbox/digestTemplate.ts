// functions/src/features/inbox/digestTemplate.ts
// Caseload monthly digest email template.

export type DigestEnrollmentRow = {
  id: string;
  grantName: string;
  status: string;
  endDate: string;
};

export type DigestRentalAssistanceRow = {
  enrollmentId: string;
  grantName: string;
  assistanceEndDate: string;
  lastPayment: string;
  nextPayment: string;
  nextRentCertDue: string;
  rentCertAsap: boolean;
};

export type DigestTaskRow = {
  title: string;
  dueDate: string;
  status: string;
};

export type DigestRentCertRow = {
  clientName: string;
  grantName: string;
  dueDate: string;
  targetPaymentDate: string;
  asap: boolean;
  label: string;
};

export type DigestPrimaryClient = {
  clientId: string;
  name: string;
  activeEnrollments: DigestEnrollmentRow[];
  inactiveEnrollments: DigestEnrollmentRow[];
  rentalAssistance: DigestRentalAssistanceRow[];
  tasks: DigestTaskRow[];
};

export type DigestSecondaryClient = {
  clientId: string;
  name: string;
  activeEnrollments: DigestEnrollmentRow[];
  inactiveEnrollments: DigestEnrollmentRow[];
  rentalAssistance: DigestRentalAssistanceRow[];
};

export type DigestTemplateArgs = {
  cmName: string;
  month: string;
  primaryClients: DigestPrimaryClient[];
  secondaryClients: DigestSecondaryClient[];
  rentCertsDueSoon: DigestRentCertRow[];
  dashboardLink: string;
  taskCount: number;
};

const BRAND = '#2563EB';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BG_PAGE = '#f1f5f9';
const BG_CARD = '#ffffff';
const BORDER = '#e2e8f0';
const BG_SECT = '#f8fafc';

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return ym;
  }
}

function fmtDate(d: string): string {
  if (!d) return '-';
  try {
    const [y, m, day] = d.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
  } catch {
    return d;
  }
}

function fmtMDY(d: string): string {
  if (!d) return '-';
  try {
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  } catch {
    return d;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bullet(text: string, muted = false): string {
  return `<div style="padding:2px 0 2px 14px;font-size:13px;color:${muted ? MUTED : TEXT};position:relative">
    <span style="position:absolute;left:2px;color:${MUTED}">&bull;</span>${esc(text)}
  </div>`;
}

function subBullet(text: string): string {
  return `<div style="padding:2px 0 2px 26px;font-size:12px;color:${MUTED};position:relative">
    <span style="position:absolute;left:14px;color:#cbd5e1">-</span>${esc(text)}
  </div>`;
}

function sectionLabel(label: string): string {
  return `<div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.6px;margin:10px 0 4px">${label}</div>`;
}

function clientBlock(name: string, inner: string): string {
  return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;margin-bottom:12px;overflow:hidden">
    <div style="background:${BG_SECT};border-bottom:1px solid ${BORDER};padding:10px 14px;font-size:14px;font-weight:700;color:${TEXT}">${esc(name)}</div>
    <div style="padding:12px 14px">${inner}</div>
  </div>`;
}

function field(label: string, value: string, accent = false): string {
  return `<td style="padding:7px 9px;border-top:1px solid ${BORDER};vertical-align:top;width:50%">
    <div style="font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:.45px">${esc(label)}</div>
    <div style="font-size:13px;color:${accent ? '#92400e' : TEXT};font-weight:${accent ? '800' : '600'};margin-top:2px">${esc(value || '-')}</div>
  </td>`;
}

function rentalAssistanceHtml(rows: DigestRentalAssistanceRow[]): string {
  if (!rows.length) return '';
  return `
    <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;margin:0 0 12px;overflow:hidden">
      <div style="padding:10px 12px;background:#dbeafe;border-bottom:1px solid #bfdbfe;font-size:13px;font-weight:800;color:#1e3a8a;text-transform:uppercase;letter-spacing:.5px">Rental Assistance</div>
      ${rows.map((row) => `
        <div style="background:#fff;margin:10px;border:1px solid ${BORDER};border-radius:10px;overflow:hidden">
          <div style="padding:9px 10px;font-size:14px;font-weight:700;color:${TEXT}">${esc(row.grantName)}</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              ${field('Assistance End Date', fmtDate(row.assistanceEndDate))}
              ${field('Last Payment', row.lastPayment)}
            </tr>
            <tr>
              ${field('Next Payment', row.nextPayment)}
              ${field('Next Rent Cert Due', row.nextRentCertDue, row.rentCertAsap)}
            </tr>
          </table>
        </div>
      `).join('')}
    </div>`;
}

function enrollmentListHtml(label: string, rows: DigestEnrollmentRow[]): string {
  const html = sectionLabel(label);
  if (!rows.length) return html + subBullet('None');
  return html + rows.map((row) => {
    const details = [
      row.status ? `Status: ${row.status}` : '',
      row.endDate ? `End: ${fmtDate(row.endDate)}` : '',
    ].filter(Boolean).join(' - ');
    return `${bullet(row.grantName)}${details ? subBullet(details) : ''}`;
  }).join('');
}

function primaryClientHtml(c: DigestPrimaryClient): string {
  let inner = '';
  inner += rentalAssistanceHtml(c.rentalAssistance);
  inner += enrollmentListHtml('Active Enrollments', c.activeEnrollments);
  inner += enrollmentListHtml('Inactive Enrollments', c.inactiveEnrollments);

  if (c.tasks.length) {
    inner += sectionLabel('Enrollment Related Tasks');
    inner += c.tasks.map((task) => {
      const datePart = task.dueDate ? ` - ${fmtDate(task.dueDate)}` : '';
      return bullet(`${task.title}${datePart}`);
    }).join('');
  }

  return clientBlock(c.name || c.clientId, inner);
}

function secondaryClientHtml(c: DigestSecondaryClient): string {
  let inner = '';
  inner += rentalAssistanceHtml(c.rentalAssistance);
  inner += enrollmentListHtml('Active Enrollments', c.activeEnrollments);
  inner += enrollmentListHtml('Inactive Enrollments', c.inactiveEnrollments);
  return clientBlock(c.name || c.clientId, inner);
}

function rentCertsDueSoonHtml(rows: DigestRentCertRow[]): string {
  if (!rows.length) return '';
  return `
    <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;margin-bottom:16px;overflow:hidden">
      <div style="background:#fef3c7;border-bottom:1px solid #fde68a;padding:10px 14px;font-size:13px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Rent Certs Due Soon</div>
      <div style="padding:10px 14px">
        ${rows.map((row) => {
    const prefix = [row.clientName, row.grantName].filter(Boolean).join(' - ');
    const label = `Update Rental Amount, Rent Cert Due ${fmtMDY(row.dueDate)}`;
    return bullet(prefix ? `${prefix}: ${label}` : label, row.asap);
  }).join('')}
      </div>
    </div>`;
}

export function buildDigestHtml(args: DigestTemplateArgs): string {
  const {cmName, month, primaryClients, secondaryClients, rentCertsDueSoon, dashboardLink} = args;
  const label = monthLabel(month);
  const rentalCount =
    primaryClients.reduce((sum, client) => sum + client.rentalAssistance.length, 0) +
    secondaryClients.reduce((sum, client) => sum + client.rentalAssistance.length, 0);

  const primaryHtml = primaryClients.length ?
    primaryClients.map(primaryClientHtml).join('') :
    `<div style="color:${MUTED};font-size:13px;padding:8px 0">No primary clients this month.</div>`;

  const secondaryHtml = secondaryClients.length ?
    secondaryClients.map(secondaryClientHtml).join('') :
    `<div style="color:${MUTED};font-size:13px;padding:8px 0">No secondary clients.</div>`;

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
        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:700;color:#fff">Monthly Caseload Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">${label} &nbsp;-&nbsp; ${esc(cmName)}</div>
        </td></tr>

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
                <div style="font-size:22px;font-weight:700;color:${BRAND}">${rentalCount}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:2px">Rental Assistance</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          ${rentCertsDueSoonHtml(rentCertsDueSoon)}

          <div style="font-size:16px;font-weight:700;color:${TEXT};margin-bottom:12px">My Caseload</div>
          ${primaryHtml}

          <div style="font-size:16px;font-weight:700;color:${TEXT};margin:20px 0 12px">Secondary Clients</div>
          ${secondaryHtml}
        </td></tr>

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

export function buildDigestSubject(month: string, _taskCount?: number): string {
  const label = monthLabel(month);
  return `${label} Caseload Digest`;
}

export function buildDigestPlaintext(args: DigestTemplateArgs): string {
  const {cmName, month, primaryClients, secondaryClients, rentCertsDueSoon, dashboardLink} = args;
  const label = monthLabel(month);
  const lines: string[] = [
    `MONTHLY CASELOAD DIGEST - ${label.toUpperCase()}`,
    `For: ${cmName}`,
    '='.repeat(50),
    '',
    'MY CASELOAD (PRIMARY)',
    '',
  ];

  if (rentCertsDueSoon.length) {
    lines.push('RENT CERTS DUE SOON', '');
    rentCertsDueSoon.forEach((row) => {
      const prefix = [row.clientName, row.grantName].filter(Boolean).join(' - ');
      const label = `Update Rental Amount, Rent Cert Due ${fmtMDY(row.dueDate)}`;
      lines.push(`- ${prefix ? `${prefix}: ${label}` : label}`);
    });
    lines.push('');
  }

  for (const client of primaryClients) {
    lines.push(`> ${client.name}`);
    appendClientPlaintext(lines, client);
    lines.push('');
  }

  if (secondaryClients.length) {
    lines.push('SECONDARY CLIENTS', '');
    for (const client of secondaryClients) {
      lines.push(`> ${client.name}`);
      appendClientPlaintext(lines, client);
      lines.push('');
    }
  }

  lines.push(`Dashboard: ${dashboardLink}`);
  return lines.join('\n');
}

function appendClientPlaintext(
    lines: string[],
    client: DigestPrimaryClient | DigestSecondaryClient,
): void {
  if (client.rentalAssistance.length) {
    lines.push('  Rental Assistance:');
    client.rentalAssistance.forEach((row) => {
      lines.push(`    - ${row.grantName}`);
      lines.push(`      Assistance End Date: ${fmtDate(row.assistanceEndDate)}`);
      lines.push(`      Last Payment: ${row.lastPayment}`);
      lines.push(`      Next Payment: ${row.nextPayment}`);
      lines.push(`      Next Rent Cert Due: ${row.nextRentCertDue}`);
    });
  }
  lines.push('  Active Enrollments:');
  if (client.activeEnrollments.length) {
    client.activeEnrollments.forEach((row) => lines.push(`    - ${row.grantName}`));
  } else {
    lines.push('    - None');
  }
  lines.push('  Inactive Enrollments:');
  if (client.inactiveEnrollments.length) {
    client.inactiveEnrollments.forEach((row) => lines.push(`    - ${row.grantName}`));
  } else {
    lines.push('    - None');
  }
  if ('tasks' in client && client.tasks.length) {
    lines.push('  Enrollment Related Tasks:');
    client.tasks.forEach((task) => {
      const datePart = task.dueDate ? ` - ${fmtDate(task.dueDate)}` : '';
      lines.push(`    - ${task.title}${datePart}`);
    });
  }
}
