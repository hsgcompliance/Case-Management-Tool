// functions/src/features/inbox/digestRentalAssistance.ts
// Rental Assistance digest: active assistance grouped by grant, plus ended assistance.
import {db, isoNow} from '../../core';
import {sendHtmlEmail} from './emailer';
import {loadDigestEnrollments} from './digestEnrollmentSource';
import {computeNextRentCertDue} from './rentCert';

const DASHBOARD_LINK = 'https://households-db.web.app/dashboard';
const BRAND = '#2563EB';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BG_PAGE = '#f1f5f9';
const BG_CARD = '#ffffff';
const BORDER = '#e2e8f0';
const BG_SECT = '#f8fafc';
const GREEN_TEXT = '#15803d';
const AMBER_TEXT = '#b45309';
const DANGER_TEXT = '#b91c1c';

type GrantBudgetSummary = {
  total: number;
  spent: number;
  projectedSpend: number;
  available: number;
  pctAllocated: number;
};

type AssistanceRow = {
  customerName: string;
  startDate: string;
  endDate: string;
  paymentAmount: string;
  nextRentCertDate: string;
};

type GrantAssistanceGroup = {
  grantId: string;
  grantName: string;
  grantCode: string;
  budget: GrantBudgetSummary;
  rows: AssistanceRow[];
};

type EndedAssistanceRow = {
  customerId: string;
  grantName: string;
  customerName: string;
  startDate: string;
  lastPaymentDate: string;
};

type RentalAssistanceDigestData = {
  recipientName: string;
  month: string;
  groups: GrantAssistanceGroup[];
  ended: EndedAssistanceRow[];
  dashboardLink: string;
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

function fmtMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function amountFromPayment(p: Record<string, unknown>): number {
  const amount = Number(p.amount || 0);
  if (Number.isFinite(amount) && amount !== 0) return amount;
  const cents = Number(p.amountCents || 0);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

function isFinancialPayment(p: Record<string, unknown>): boolean {
  const type = String(p.type || '').toLowerCase();
  return type !== 'service' && p.void !== true && amountFromPayment(p) > 0;
}

function paymentRows(enrollment: Record<string, unknown>) {
  return (Array.isArray(enrollment.payments) ? enrollment.payments : [])
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
      .map((raw) => ({
        raw,
        dueDate: String(raw.dueDate || raw.date || ''),
        amount: amountFromPayment(raw),
        paid: raw.paid === true || String(raw.status || '').toLowerCase() === 'paid',
      }))
      .filter((payment) => isISO(payment.dueDate) && isFinancialPayment(payment.raw))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function isActiveEnrollment(row: Record<string, unknown>): boolean {
  const status = String(row.status || '').toLowerCase();
  if (row.deleted === true || status === 'deleted') return false;
  return row.active === true || status === 'active' || status === 'open';
}

function customerName(data: Record<string, unknown>, fallback: string): string {
  const fn = String(data.firstName || '').trim();
  const ln = String(data.lastName || '').trim();
  return [fn, ln].filter(Boolean).join(' ') || String(data.name || fallback);
}

function grantBudget(data: Record<string, unknown>): GrantBudgetSummary {
  const totals = ((data.budget as any)?.totals || data.budgetTotals || {}) as Record<string, unknown>;
  const total = Number(totals.total || 0);
  const spent = Number(totals.spent || 0);
  const projectedSpend = Number(totals.projectedSpend || Number(totals.projected || 0) + spent);
  const available = Number(totals.projectedBalance ?? total - projectedSpend);
  const pctAllocated = total > 0 ? Math.round((projectedSpend / total) * 100) : 0;
  return {total, spent, projectedSpend, available, pctAllocated};
}

function budgetColor(budget: GrantBudgetSummary): string {
  if (budget.available < 0 || budget.pctAllocated >= 95) return DANGER_TEXT;
  if (budget.pctAllocated >= 75) return AMBER_TEXT;
  return GREEN_TEXT;
}

export async function buildRentalAssistanceDigestData(opts: {
  month: string;
  forUid?: string;
  recipientName?: string;
  dashboardLink?: string;
}): Promise<RentalAssistanceDigestData> {
  const {month, forUid, recipientName = 'Team', dashboardLink = DASHBOARD_LINK} = opts;
  const enrollmentRows = await loadDigestEnrollments({caseManagerId: forUid});
  const enrollments: Array<Record<string, unknown>> = enrollmentRows.map((row) => ({id: row.id, ...row.raw}));

  const customerIds = [...new Set(enrollments.map((e) => String(e.customerId || e.clientId || '')).filter(Boolean))];
  const customerMap = new Map<string, Record<string, unknown>>();
  if (customerIds.length) {
    await Promise.all(chunks(customerIds, 30).map(async (chunk) => {
      const snap = await db.collection('customers').where('__name__', 'in', chunk).get();
      for (const doc of snap.docs) customerMap.set(doc.id, {id: doc.id, ...(doc.data() as Record<string, unknown>)});
    }));
  }

  const grantIds = [...new Set(enrollments.map((e) => String(e.grantId || '')).filter(Boolean))];
  const grantMap = new Map<string, Record<string, unknown>>();
  if (grantIds.length) {
    await Promise.all(chunks(grantIds, 30).map(async (chunk) => {
      const snap = await db.collection('grants').where('__name__', 'in', chunk).get();
      for (const doc of snap.docs) grantMap.set(doc.id, {id: doc.id, ...(doc.data() as Record<string, unknown>)});
    }));
  }

  const activeAssistanceByCustomer = new Set<string>();
  const groups = new Map<string, GrantAssistanceGroup>();
  const endedCandidates: EndedAssistanceRow[] = [];
  const today = todayISO();

  for (const enrollment of enrollments) {
    const customerId = String(enrollment.customerId || enrollment.clientId || '');
    const grantId = String(enrollment.grantId || '');
    if (!customerId || !grantId) continue;
    const customer = customerMap.get(customerId) || {};
    if (customer.active !== true) continue;
    const payments = paymentRows(enrollment);
    if (!payments.length) continue;

    const grant = grantMap.get(grantId) || {};
    const grantName = String(enrollment.grantName || grant.name || grant.code || grantId);
    const grantCode = String(grant.code || '');
    const name = String(enrollment.customerName || enrollment.clientName || '').trim() || customerName(customer, customerId);
    const active = isActiveEnrollment(enrollment);

    if (active) {
      activeAssistanceByCustomer.add(customerId);
      const due = computeNextRentCertDue([enrollment], {today});
      const nextPayment = payments.find((payment) => !payment.paid && payment.dueDate >= today) || payments[payments.length - 1];
      const group = groups.get(grantId) || {
        grantId,
        grantName,
        grantCode,
        budget: grantBudget(grant),
        rows: [],
      };
      group.rows.push({
        customerName: name,
        startDate: String(enrollment.startDate || ''),
        endDate: String(enrollment.endDate || ''),
        paymentAmount: fmtMoney(Math.round(nextPayment.amount * 100)),
        nextRentCertDate: due ? fmtDate(due.dueDate) : 'N/A',
      });
      groups.set(grantId, group);
    } else {
      const paidPayments = payments.filter((payment) => payment.paid);
      const lastPayment = (paidPayments.length ? paidPayments : payments)
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
      endedCandidates.push({
        customerId,
        grantName,
        customerName: name,
        startDate: String(enrollment.startDate || ''),
        lastPaymentDate: lastPayment?.dueDate || '',
      });
    }
  }

  const grouped = Array.from(groups.values())
      .map((group) => ({
        ...group,
        rows: group.rows.sort((a, b) => a.customerName.localeCompare(b.customerName)),
      }))
      .sort((a, b) => a.grantName.localeCompare(b.grantName));

  const ended = endedCandidates
      .filter((row) => row.customerId && !activeAssistanceByCustomer.has(row.customerId))
      .sort((a, b) => a.customerName.localeCompare(b.customerName) || a.grantName.localeCompare(b.grantName));

  return {recipientName, month, groups: grouped, ended, dashboardLink};
}

function budgetStrip(group: GrantAssistanceGroup): string {
  const color = budgetColor(group.budget);
  const bar = Math.max(0, Math.min(100, group.budget.pctAllocated));
  return `
    <div style="background:#e2e8f0;border-radius:9999px;height:7px;margin:10px 0 12px;overflow:hidden">
      <div style="height:7px;width:${bar}%;background:${color};border-radius:9999px"></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        ${budgetCell('Budget', fmtMoney(group.budget.total), TEXT)}
        ${budgetCell('Spent', fmtMoney(group.budget.spent), TEXT)}
        ${budgetCell('Projected', fmtMoney(group.budget.projectedSpend), AMBER_TEXT)}
        ${budgetCell('Available', fmtMoney(group.budget.available), color)}
      </tr>
    </table>`;
}

function budgetCell(label: string, value: string, color: string): string {
  return `<td style="text-align:center;padding:0 6px">
    <div style="font-size:14px;font-weight:800;color:${color};white-space:nowrap">${value}</div>
    <div style="font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:.4px">${label}</div>
  </td>`;
}

function assistanceTable(rows: AssistanceRow[]): string {
  if (!rows.length) return `<div style="font-size:13px;color:${MUTED};padding:6px 0">No active rental assistance.</div>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <thead><tr style="background:${BG_SECT}">
      <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Customer</th>
      <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase;white-space:nowrap">Start-End</th>
      <th align="right" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase;white-space:nowrap">Payment</th>
      <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase;white-space:nowrap">Next Rent Cert</th>
    </tr></thead>
    <tbody>${rows.map((row) => `<tr style="border-top:1px solid ${BORDER}">
      <td style="padding:8px;font-size:13px;font-weight:700;color:${TEXT}">${esc(row.customerName)}</td>
      <td style="padding:8px;font-size:12px;color:${MUTED};white-space:nowrap">${fmtDate(row.startDate)} - ${fmtDate(row.endDate)}</td>
      <td style="padding:8px;font-size:13px;font-weight:700;color:${TEXT};text-align:right;white-space:nowrap">${esc(row.paymentAmount)}</td>
      <td style="padding:8px;font-size:12px;color:${row.nextRentCertDate === 'N/A' ? MUTED : AMBER_TEXT};white-space:nowrap">${esc(row.nextRentCertDate)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function grantSection(group: GrantAssistanceGroup): string {
  return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:12px;margin-bottom:14px;overflow:hidden">
    <div style="padding:14px 16px;background:#ffffff;border-bottom:1px solid ${BORDER}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:800;color:${TEXT}">${esc(group.grantName)}</div>
          ${group.grantCode ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${esc(group.grantCode)}</div>` : ''}
        </div>
        <div style="font-size:11px;font-weight:800;color:${budgetColor(group.budget)};background:#f8fafc;border:1px solid ${BORDER};border-radius:9999px;padding:4px 9px;white-space:nowrap">${group.budget.pctAllocated}% allocated</div>
      </div>
      ${budgetStrip(group)}
    </div>
    <div style="padding:0">${assistanceTable(group.rows)}</div>
  </div>`;
}

function endedTable(rows: EndedAssistanceRow[]): string {
  if (!rows.length) return '';
  return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:12px;margin-top:18px;overflow:hidden">
    <div style="padding:12px 14px;background:#fef3c7;border-bottom:1px solid #fde68a;font-size:14px;font-weight:800;color:#92400e">Assistance has ended for</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <thead><tr style="background:${BG_SECT}">
        <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Grant</th>
        <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Customer</th>
        <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase;white-space:nowrap">Start Date</th>
        <th align="left" style="padding:7px 8px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase;white-space:nowrap">Last Payment</th>
      </tr></thead>
      <tbody>${rows.map((row) => `<tr style="border-top:1px solid ${BORDER}">
        <td style="padding:8px;font-size:12px;color:${MUTED}">${esc(row.grantName)}</td>
        <td style="padding:8px;font-size:13px;font-weight:700;color:${TEXT}">${esc(row.customerName)}</td>
        <td style="padding:8px;font-size:12px;color:${MUTED};white-space:nowrap">${fmtDate(row.startDate)}</td>
        <td style="padding:8px;font-size:12px;color:${MUTED};white-space:nowrap">${fmtDate(row.lastPaymentDate)}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

export function buildRentalAssistanceDigestHtml(data: RentalAssistanceDigestData): string {
  const {recipientName, month, groups, ended, dashboardLink} = data;
  const label = monthLabel(month);
  const activeCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const grantHtml = groups.length ?
    groups.map(grantSection).join('') :
    `<div style="color:${MUTED};font-size:13px;text-align:center;padding:20px">No active rental assistance.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Rental Assistance Digest</title></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:760px" cellpadding="0" cellspacing="0">
        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:800;color:#fff">Rental Assistance Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px">${label} &nbsp;-&nbsp; ${esc(recipientName)}</div>
        </td></tr>

        <tr><td style="background:${BG_CARD};padding:18px 28px;border-bottom:1px solid ${BORDER}">
          <div style="font-size:15px;color:${TEXT};font-weight:700">The following are the folks receiving Rental Assistance.</div>
          <table cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:800;color:${BRAND}">${activeCount}</div>
              <div style="font-size:11px;color:${MUTED}">Receiving Assistance</div>
            </td>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:800;color:${BRAND}">${groups.length}</div>
              <div style="font-size:11px;color:${MUTED}">Grants</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:22px;font-weight:800;color:${AMBER_TEXT}">${ended.length}</div>
              <div style="font-size:11px;color:${MUTED}">Ended Assistance</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          ${grantHtml}
          ${endedTable(ended)}
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700">View Dashboard</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function buildAndSendRentalAssistanceDigest(
    to: string,
    opts: { month: string; forUid?: string; recipientName?: string },
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_rentalAssistance_${opts.month}_${to.toLowerCase()}`;
  const logRef = db.collection('emailLogs').doc(key);
  if ((await logRef.get()).exists) return {ok: true, skipped: true};

  const data = await buildRentalAssistanceDigestData(opts);
  const html = buildRentalAssistanceDigestHtml(data);
  const subject = `Rental Assistance Digest - ${monthLabel(opts.month)} (${data.groups.reduce((sum, group) => sum + group.rows.length, 0)} active)`;

  const sent = await sendHtmlEmail({from: 'hsgcompliance@thehrdc.org', to, subject, html});
  await logRef.set({id: sent.id || null, to, month: opts.month, subject, createdAt: isoNow()}, {merge: true});
  return sent;
}
