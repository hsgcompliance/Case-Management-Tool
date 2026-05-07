// functions/src/features/inbox/digestCaseManagers.ts
// Case Manager overview digest with active customer/enrollment counts.
import {authAdmin, db, isoNow} from '../../core';
import {sendHtmlEmail} from './emailer';
import {loadDigestEnrollments} from './digestEnrollmentSource';

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

type DeltaValue = number | null;

type CMRow = {
  uid: string;
  name: string;
  email: string;
  activeCustomers: number;
  activeEnrollments: number;
  customerDelta: DeltaValue;
  enrollmentDelta: DeltaValue;
  acuityAvg: number | null;
};

type CaseManagerDigestData = {
  recipientName: string;
  month: string;
  rows: CMRow[];
  totals: {
    activeCustomers: number;
    activeEnrollments: number;
    customerDelta: DeltaValue;
    enrollmentDelta: DeltaValue;
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

function previousMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readActiveCustomersMetric(row: Record<string, unknown>): number | null {
  return numberOrNull(asRecord(row.customers).active) ??
    numberOrNull(row.activeCustomers) ??
    numberOrNull(row.caseloadActive);
}

function readActiveEnrollmentsMetric(row: Record<string, unknown>): number | null {
  return numberOrNull(asRecord(row.enrollments).active) ??
    numberOrNull(row.activeEnrollments) ??
    numberOrNull(row.enrollmentActive) ??
    numberOrNull(row.caseloadActive);
}

function deltaBadge(delta: DeltaValue): string {
  if (delta === null) return `<div style="font-size:10px;color:${MUTED};margin-top:2px">change n/a</div>`;
  if (delta === 0) return `<div style="font-size:10px;color:${MUTED};margin-top:2px">no change</div>`;
  const color = delta > 0 ? GREEN_TEXT : DANGER_TEXT;
  const sign = delta > 0 ? '+' : '';
  return `<div style="font-size:10px;color:${color};font-weight:700;margin-top:2px">${sign}${delta} from last month</div>`;
}

function acuityBadge(avg: number | null): string {
  if (avg === null) return `<span style="color:${MUTED};font-size:12px">-</span>`;
  const color = avg >= 4 ? DANGER_TEXT : avg >= 3 ? AMBER_TEXT : GREEN_TEXT;
  return `<span style="font-weight:700;color:${color};font-size:13px">${avg.toFixed(1)}</span>`;
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
  const prevMonth = previousMonth(month);

  const customersSnap = await db
      .collection('customers')
      .where('active', '==', true)
      .where('deleted', '!=', true)
      .select('caseManagerId')
      .get();

  const activeCustomersByUid = new Map<string, number>();
  for (const doc of customersSnap.docs) {
    const uid = String((doc.data() as Record<string, unknown>).caseManagerId || '').trim();
    if (!uid) continue;
    activeCustomersByUid.set(uid, (activeCustomersByUid.get(uid) || 0) + 1);
  }

  const activeEnrollmentsByUid = new Map<string, number>();
  const activeEnrollments = await loadDigestEnrollments({activeOnly: true});
  for (const row of activeEnrollments) {
    const uid = String(row.caseManagerId || '').trim();
    if (!uid) continue;
    activeEnrollmentsByUid.set(uid, (activeEnrollmentsByUid.get(uid) || 0) + 1);
  }

  const cmUids = [
    ...new Set([
      ...activeCustomersByUid.keys(),
      ...activeEnrollmentsByUid.keys(),
    ]),
  ];

  if (!cmUids.length) {
    return {
      recipientName,
      month,
      rows: [],
      totals: {activeCustomers: 0, activeEnrollments: 0, customerDelta: null, enrollmentDelta: null},
      dashboardLink,
    };
  }

  const extrasMap = new Map<string, Record<string, unknown>>();
  const summaryMap = new Map<string, Record<string, unknown>>();
  const previousMap = new Map<string, Record<string, unknown>>();
  await Promise.all(chunks(cmUids, 30).map(async (chunk) => {
    const [extras, summaries] = await Promise.all([
      db.collection('userExtras').where('__name__', 'in', chunk).get(),
      db.collection('caseManagerMetrics').where('__name__', 'in', chunk).get(),
    ]);
    for (const doc of extras.docs) extrasMap.set(doc.id, doc.data() as Record<string, unknown>);
    for (const doc of summaries.docs) summaryMap.set(doc.id, doc.data() as Record<string, unknown>);
  }));

  await Promise.all(cmUids.map(async (uid) => {
    const snap = await db.doc(`caseManagerMetrics/${uid}/months/${prevMonth}`).get();
    if (snap.exists) previousMap.set(uid, snap.data() as Record<string, unknown>);
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
    const summary = summaryMap.get(uid) || {};
    const previous = previousMap.get(uid) || {};
    const activeCustomers = activeCustomersByUid.get(uid) || readActiveCustomersMetric(summary) || 0;
    const activeEnrollments = activeEnrollmentsByUid.get(uid) || readActiveEnrollmentsMetric(summary) || 0;
    const prevCustomers = readActiveCustomersMetric(previous);
    const prevEnrollments = readActiveEnrollmentsMetric(previous);
    const acuityAvg =
      numberOrNull(asRecord(summary.acuity).scoreAvg) ??
      numberOrNull(extras.acuityScoreAvg);
    const name = String(extras.displayName || '').trim() || displayNameFromAuth(authUser, uid);
    const email = String(extras.email || authUser.email || '').trim();

    return {
      uid,
      name,
      email,
      activeCustomers,
      activeEnrollments,
      customerDelta: prevCustomers === null ? null : activeCustomers - prevCustomers,
      enrollmentDelta: prevEnrollments === null ? null : activeEnrollments - prevEnrollments,
      acuityAvg,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));
  const sum = (fn: (r: CMRow) => number) => rows.reduce((total, row) => total + fn(row), 0);
  const sumDelta = (fn: (r: CMRow) => DeltaValue): DeltaValue => {
    const values = rows.map(fn);
    return values.every((value) => value !== null) ? values.reduce((total, value) => total + (value || 0), 0) : null;
  };

  return {
    recipientName,
    month,
    rows,
    totals: {
      activeCustomers: sum((row) => row.activeCustomers),
      activeEnrollments: sum((row) => row.activeEnrollments),
      customerDelta: sumDelta((row) => row.customerDelta),
      enrollmentDelta: sumDelta((row) => row.enrollmentDelta),
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
        <div style="font-size:16px;font-weight:800;color:${BRAND}">${row.activeCustomers}</div>
        ${deltaBadge(row.customerDelta)}
      </td>
      <td style="padding:10px 12px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${TEXT}">${row.activeEnrollments}</div>
        ${deltaBadge(row.enrollmentDelta)}
      </td>
      <td style="padding:10px 12px;text-align:center">${acuityBadge(row.acuityAvg)}</td>
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
              <div style="font-size:22px;font-weight:800;color:${BRAND}">${rows.length}</div>
              <div style="font-size:11px;color:${MUTED}">Case Managers</div>
            </td>
            <td style="padding-right:24px;text-align:center">
              <div style="font-size:22px;font-weight:800;color:${TEXT}">${totals.activeCustomers}</div>
              <div style="font-size:11px;color:${MUTED}">Active Customers</div>
              ${deltaBadge(totals.customerDelta)}
            </td>
            <td style="text-align:center">
              <div style="font-size:22px;font-weight:800;color:${TEXT}">${totals.activeEnrollments}</div>
              <div style="font-size:11px;color:${MUTED}">Active Enrollments</div>
              ${deltaBadge(totals.enrollmentDelta)}
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;overflow:hidden">
            ${rows.length ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead><tr style="background:${BG_SECT}">
                <th align="left" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Case Manager</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Active Customers</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Active Enrollments</th>
                <th align="center" style="padding:8px 12px;font-size:11px;color:${MUTED};font-weight:700;text-transform:uppercase">Acuity Avg</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>` : noRows}
          </div>
          <div style="font-size:11px;color:${MUTED};margin-top:10px">Monthly change appears when prior-month case manager snapshots include customer and enrollment counts.</div>
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700">View Dashboard</a>
          <div style="margin-top:12px;font-size:11px;color:${MUTED}">You're receiving this digest based on your subscription preferences.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function buildAndSendCaseManagerDigest(
    to: string,
    opts: { month: string; recipientName?: string },
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_caseManagers_${opts.month}_${to.toLowerCase()}`;
  const logRef = db.collection('emailLogs').doc(key);
  if ((await logRef.get()).exists) return {ok: true, skipped: true};

  const data = await buildCaseManagerDigestData({month: opts.month, recipientName: opts.recipientName});
  const html = buildCaseManagerDigestHtml(data);
  const subject = `Case Manager Digest - ${monthLabel(opts.month)} (${data.rows.length} CMs, ${data.totals.activeCustomers} customers)`;

  const sent = await sendHtmlEmail({from: 'hsgcompliance@thehrdc.org', to, subject, html});
  await logRef.set({id: sent.id || null, to, month: opts.month, subject, createdAt: isoNow()}, {merge: true});
  return sent;
}
