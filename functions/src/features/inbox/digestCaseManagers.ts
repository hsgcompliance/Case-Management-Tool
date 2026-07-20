// functions/src/features/inbox/digestCaseManagers.ts
// Case Manager overview digest with active customer/enrollment counts.
import {authAdmin, db} from '../../core';
import {sendHtmlEmail} from './emailer';
import {loadDigestEnrollments} from './digestEnrollmentSource';
import {markDigestFailed, markDigestSent, reserveDigestSend} from './digestSendGuard';

const DASHBOARD_LINK = 'https://households-db.web.app/reports/case-manager-load';
const BRAND = '#2563EB';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BG_PAGE = '#f1f5f9';
const BG_CARD = '#ffffff';
const BORDER = '#e2e8f0';
const BG_SECT = '#f8fafc';
const GREEN_TEXT = '#15803d';

type CMRow = {
  uid: string;
  name: string;
  email: string;
  activeCustomers: number;
  activeEnrollments: number;
  changedCustomers: number;
  newCustomers: number;
  totalAllocation: number;
  tiers: { tier1: number; tier2: number; tier3: number; untiered: number };
};

type CaseManagerDigestData = {
  recipientName: string;
  month: string;
  rows: CMRow[];
  totals: {
    activeCustomers: number;
    activeEnrollments: number;
    changedCustomers: number;
    newCustomers: number;
    totalAllocation: number;
  };
  dashboardLink: string;
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});
  } catch {
    return ym;
  }
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function effectiveAllocation(enrollment: Record<string, unknown>): number {
  const assigned = asRecord(enrollment.clientAllocation).amount;
  if (assigned != null) {
    const amount = Number(assigned);
    if (Number.isFinite(amount) && amount >= 0) return amount;
  }
  return (Array.isArray(enrollment.payments) ? enrollment.payments : []).reduce((sum, raw) => {
    const payment = asRecord(raw);
    if (payment.void === true) return sum;
    const amount = Number(payment.amount || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

function changedInMonth(enrollment: Record<string, unknown>, month: string): boolean {
  const migratedFrom = asRecord(enrollment.migratedFrom);
  const migratedTo = asRecord(enrollment.migratedTo);
  const continuity = asRecord(enrollment.continuity);
  return [enrollment.startDate, enrollment.endDate, migratedFrom.cutover, migratedTo.cutover, continuity.cutoffDate]
      .some((value) => String(value || '').slice(0, 7) === month);
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(value);
}

function tierSummary(tiers: CMRow['tiers']): string {
  return `<span style="font-size:11px;color:${TEXT};white-space:nowrap">T1 ${tiers.tier1} &middot; T2 ${tiers.tier2} &middot; T3 ${tiers.tier3} &middot; None ${tiers.untiered}</span>`;
}

function displayNameFromAuth(user: { displayName?: string; email?: string }, uid: string): string {
  const name = String(user.displayName || '').trim();
  const email = String(user.email || '').trim();
  return name || email || uid;
}

export async function buildCaseManagerDigestData(opts: {
  month: string;
  recipientName?: string;
  dashboardLink?: string;
}): Promise<CaseManagerDigestData> {
  const {month, recipientName = 'Team', dashboardLink = DASHBOARD_LINK} = opts;
  const customersSnap = await db
      .collection('customers')
      .where('active', '==', true)
      .where('deleted', '!=', true)
      .select('caseManagerId', 'tier')
      .get();

  const activeCustomersByUid = new Map<string, number>();
  const tiersByUid = new Map<string, CMRow['tiers']>();
  for (const doc of customersSnap.docs) {
    const customer = doc.data() as Record<string, unknown>;
    const uid = String(customer.caseManagerId || '').trim();
    if (!uid) continue;
    activeCustomersByUid.set(uid, (activeCustomersByUid.get(uid) || 0) + 1);
    const tiers = tiersByUid.get(uid) || {tier1: 0, tier2: 0, tier3: 0, untiered: 0};
    const tier = Number(customer.tier);
    if (tier === 1) tiers.tier1 += 1;
    else if (tier === 2) tiers.tier2 += 1;
    else if (tier === 3) tiers.tier3 += 1;
    else tiers.untiered += 1;
    tiersByUid.set(uid, tiers);
  }

  const activeEnrollmentsByUid = new Map<string, number>();
  const allocationByUid = new Map<string, number>();
  const changedByUid = new Map<string, Set<string>>();
  const newByUid = new Map<string, Set<string>>();
  const allEnrollments = await loadDigestEnrollments({});
  for (const row of allEnrollments) {
    const uid = String(row.caseManagerId || '').trim();
    if (!uid) continue;
    if (row.active) {
      activeEnrollmentsByUid.set(uid, (activeEnrollmentsByUid.get(uid) || 0) + 1);
      allocationByUid.set(uid, (allocationByUid.get(uid) || 0) + effectiveAllocation(row.raw));
    }
    if (String(row.startDate || '').slice(0, 7) === month) {
      const ids = newByUid.get(uid) || new Set<string>();
      ids.add(row.customerId);
      newByUid.set(uid, ids);
    }
    if (changedInMonth(row.raw, month)) {
      const ids = changedByUid.get(uid) || new Set<string>();
      ids.add(row.customerId);
      changedByUid.set(uid, ids);
    }
  }

  const cmUids = [
    ...new Set([
      ...activeCustomersByUid.keys(),
      ...activeEnrollmentsByUid.keys(),
      ...changedByUid.keys(),
    ]),
  ];

  if (!cmUids.length) {
    return {
      recipientName,
      month,
      rows: [],
      totals: {activeCustomers: 0, activeEnrollments: 0, changedCustomers: 0, newCustomers: 0, totalAllocation: 0},
      dashboardLink,
    };
  }

  const extrasMap = new Map<string, Record<string, unknown>>();
  await Promise.all(chunks(cmUids, 30).map(async (chunk) => {
    const extras = await db.collection('userExtras').where('__name__', 'in', chunk).get();
    for (const doc of extras.docs) extrasMap.set(doc.id, doc.data() as Record<string, unknown>);
  }));

  const authUsers = new Map<string, { displayName?: string; email?: string }>();
  await Promise.all(chunks(cmUids, 100).map(async (chunk) => {
    const result = await authAdmin.getUsers(chunk.map((uid) => ({uid})));
    for (const user of result.users) {
      authUsers.set(user.uid, {
        displayName: user.displayName || undefined,
        email: user.email || undefined,
      });
    }
  }));

  const rows: CMRow[] = cmUids.map((uid) => {
    const authUser = authUsers.get(uid) || {};
    const extras = extrasMap.get(uid) || {};
    const activeCustomers = activeCustomersByUid.get(uid) || 0;
    const activeEnrollments = activeEnrollmentsByUid.get(uid) || 0;
    const name = String(extras.displayName || '').trim() || displayNameFromAuth(authUser, uid);
    const email = String(extras.email || authUser.email || '').trim();

    return {
      uid,
      name,
      email,
      activeCustomers,
      activeEnrollments,
      changedCustomers: changedByUid.get(uid)?.size || 0,
      newCustomers: newByUid.get(uid)?.size || 0,
      totalAllocation: allocationByUid.get(uid) || 0,
      tiers: tiersByUid.get(uid) || {tier1: 0, tier2: 0, tier3: 0, untiered: 0},
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));
  const sum = (fn: (r: CMRow) => number) => rows.reduce((total, row) => total + fn(row), 0);

  return {
    recipientName,
    month,
    rows,
    totals: {
      activeCustomers: sum((row) => row.activeCustomers),
      activeEnrollments: sum((row) => row.activeEnrollments),
      changedCustomers: sum((row) => row.changedCustomers),
      newCustomers: sum((row) => row.newCustomers),
      totalAllocation: sum((row) => row.totalAllocation),
    },
    dashboardLink,
  };
}

export function buildCaseManagerDigestHtml(data: CaseManagerDigestData): string {
  const {recipientName, month, rows, totals, dashboardLink} = data;
  const label = monthLabel(month);

  const tableRows = rows.map((row) => `
    <tr style="border-top:1px solid ${BORDER}">
      <td style="padding:10px 12px">
        <div style="font-size:13px;font-weight:700;color:${TEXT}">${esc(row.name)}</div>
        ${row.email ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${esc(row.email)}</div>` : ''}
      </td>
      <td style="padding:10px 12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${BRAND}">${row.changedCustomers}</div>
        <div style="font-size:10px;color:${MUTED};margin-top:2px">${row.newCustomers} new</div>
      </td>
      <td style="padding:10px 12px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${TEXT}">${row.activeCustomers}</div>
        <div style="font-size:10px;color:${MUTED};margin-top:2px">${row.activeEnrollments} enrollments</div>
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:${TEXT}">${money(row.totalAllocation)}</td>
      <td style="padding:10px 12px;text-align:center">${tierSummary(row.tiers)}</td>
    </tr>`).join('');

  const noRows = !rows.length ?
    `<div style="color:${MUTED};font-size:13px;text-align:center;padding:20px">No active case managers found.</div>` :
    '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Case Manager Digest</title></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:700px" cellpadding="0" cellspacing="0">
        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:800;color:#fff">Case Manager Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.82);margin-top:4px">${label} &nbsp;-&nbsp; ${esc(recipientName)}</div>
        </td></tr>

        <tr><td style="background:${BG_CARD};padding:16px 28px;border-bottom:1px solid ${BORDER}">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:26px;font-weight:800;color:${BRAND}">${totals.changedCustomers}</div>
              <div style="font-size:11px;color:${MUTED}">Customers Changed</div>
              <div style="font-size:10px;color:${GREEN_TEXT};font-weight:700;margin-top:2px">${totals.newCustomers} new this month</div>
            </td>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:800;color:${TEXT}">${totals.activeCustomers}</div>
              <div style="font-size:11px;color:${MUTED}">Total Active Caseload</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:22px;font-weight:800;color:${TEXT}">${money(totals.totalAllocation)}</div>
              <div style="font-size:11px;color:${MUTED}">Customer Allocation</div>
              <div style="font-size:10px;color:${MUTED};margin-top:2px">${totals.activeEnrollments} active enrollments</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;overflow:hidden">
            ${rows.length ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead><tr style="background:${BG_SECT}">
                <th align="left" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Case Manager</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Customers Changed</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Total Caseload</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Allocation</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Tiers</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>` : noRows}
          </div>
          <div style="font-size:11px;color:${MUTED};margin-top:10px">Customers changed counts distinct customers with an enrollment start, end, or migration in ${label}.</div>
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700">View Details</a>
          <div style="margin-top:12px;font-size:11px;color:${MUTED}">You're receiving this digest based on your subscription preferences.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function buildAndSendCaseManagerDigest(
    to: string,
    opts: { month: string; recipientName?: string; force?: boolean },
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_caseManagers_${opts.month}_${to.toLowerCase()}`;
  const reserved = await reserveDigestSend(key, {to, month: opts.month, digestType: 'caseManagers'}, {force: opts.force});
  if (!reserved) return {ok: true, skipped: true};

  try {
    const data = await buildCaseManagerDigestData({month: opts.month, recipientName: opts.recipientName});
    const html = buildCaseManagerDigestHtml(data);
    const subject = `Case Manager Digest - ${monthLabel(opts.month)} (${data.totals.changedCustomers} customers changed, ${data.totals.activeCustomers} total)`;

    const sent = await sendHtmlEmail({from: 'hsgcompliance@thehrdc.org', to, subject, html});
    await markDigestSent(key, {id: sent.id || null, to, month: opts.month, subject, digestType: 'caseManagers'});
    return sent;
  } catch (error: unknown) {
    await markDigestFailed(key, error, {to, month: opts.month, digestType: 'caseManagers'});
    throw error;
  }
}
