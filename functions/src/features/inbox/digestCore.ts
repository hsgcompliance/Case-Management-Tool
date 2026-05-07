// functions/src/features/inbox/digestCore.ts
import {db, isoNow} from '../../core';
import {sendHtmlEmail} from './emailer';
import {
  buildDigestHtml,
  buildDigestSubject,
  type DigestTemplateArgs,
  type DigestPrimaryClient,
  type DigestSecondaryClient,
  type DigestEnrollmentRow,
  type DigestRentalAssistanceRow,
  type DigestRentCertRow,
  type DigestTaskRow,
} from './digestTemplate';
import {loadEnrollmentsForCustomers} from './digestEnrollmentSource';
import {computeNextRentCertDue} from './rentCert';

const DASHBOARD_LINK = 'https://households-db.web.app/dashboard';

function customerName(d: Record<string, unknown>): string {
  const fn = String(d.firstName || '').trim();
  const ln = String(d.lastName || '').trim();
  return [fn, ln].filter(Boolean).join(' ') || String(d.name || d.id || '-');
}

function formatCents(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents || 0);
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n) / 100;
  return (n < 0 ? '-$' : '$') + abs.toFixed(2);
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function amountFromPayment(p: Record<string, unknown>): number {
  const amount = Number(p.amount || 0);
  if (Number.isFinite(amount) && amount !== 0) return amount;
  const cents = Number(p.amountCents || 0);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

function formatPayment(p: { dueDate: string; amount: number } | null): string {
  if (!p) return 'None';
  return `${p.dueDate} - ${formatCents(Math.round(p.amount * 100))}`;
}

function isFinancialPayment(p: Record<string, unknown>): boolean {
  const type = String(p.type || '').toLowerCase();
  return type !== 'service' && p.void !== true && amountFromPayment(p) > 0;
}

function isActiveEnrollmentRow(e: Record<string, unknown>): boolean {
  const status = String(e.status || '').toLowerCase();
  if (e.deleted === true || status === 'deleted') return false;
  return e.active === true || status === 'active' || status === 'open';
}

type BuildOpts = {
  month: string;
  forUid: string;
  cmName?: string;
  dashboardLink?: string;
};

export async function buildDigestData(opts: BuildOpts): Promise<DigestTemplateArgs> {
  const {month, forUid, cmName = 'Case Manager', dashboardLink = DASHBOARD_LINK} = opts;

  const primarySnap = await db
      .collection('customers')
      .where('caseManagerId', '==', forUid)
      .where('active', '==', true)
      .get();

  const secondarySnap = await db
      .collection('customers')
      .where('secondaryCaseManagerId', '==', forUid)
      .where('active', '==', true)
      .get();

  const primaryRaw = primarySnap.docs.map((d) => ({id: d.id, ...(d.data() as Record<string, unknown>)}));
  const primaryIds = new Set(primaryRaw.map((c) => c.id));
  const secondaryRaw = secondarySnap.docs
      .map((d) => ({id: d.id, ...(d.data() as Record<string, unknown>)}))
      .filter((c) => !primaryIds.has(c.id));

  const allIds = [...primaryRaw, ...secondaryRaw].map((c) => c.id);
  const enrollmentMap = new Map<string, Array<Record<string, unknown>>>();
  if (allIds.length) {
    const enrollments = await loadEnrollmentsForCustomers({
      customerIds: allIds,
    });
    for (const [customerId, rows] of enrollments.entries()) {
      enrollmentMap.set(
          customerId,
          rows.map((row) => ({id: row.id, ...row.raw})),
      );
    }
  }

  const grantIds = [
    ...new Set(
        [...enrollmentMap.values()]
            .flat()
            .map((e) => String(e.grantId || ''))
            .filter(Boolean),
    ),
  ];
  const grantNameMap = new Map<string, string>();
  if (grantIds.length) {
    await Promise.all(
        chunks(grantIds, 30).map(async (chunk) => {
          const snap = await db.collection('grants').where('__name__', 'in', chunk).get();
          for (const doc of snap.docs) {
            const g = doc.data() as Record<string, unknown>;
            grantNameMap.set(doc.id, String(g.name || g.code || doc.id));
          }
        }),
    );
  }

  const tasksSnap = await db
      .collection('userTasks')
      .where('cmUid', '==', forUid)
      .where('dueMonth', '==', month)
      .where('notify', '==', true)
      .get();

  const tasksByClient = new Map<string, Array<Record<string, unknown>>>();
  for (const doc of tasksSnap.docs) {
    const t: Record<string, unknown> = {id: doc.id, ...(doc.data() as Record<string, unknown>)};
    const cid = String(t.clientId || '');
    if (!cid) continue;
    if (!tasksByClient.has(cid)) tasksByClient.set(cid, []);
    tasksByClient.get(cid)!.push(t);
  }

  const grantName = (e: Record<string, unknown>): string =>
    grantNameMap.get(String(e.grantId || '')) ||
    String(e.grantName || e.name || e.grantId || '-');

  const buildEnrollmentRow = (e: Record<string, unknown>): DigestEnrollmentRow => ({
    id: String(e.id || ''),
    grantName: grantName(e),
    status: String(e.status || (isActiveEnrollmentRow(e) ? 'active' : 'inactive')),
    endDate: String(e.endDate || ''),
  });

  const splitEnrollments = (cid: string) => {
    const rows = (enrollmentMap.get(cid) || []).sort((a, b) => {
      const aActive = isActiveEnrollmentRow(a) ? 1 : 0;
      const bActive = isActiveEnrollmentRow(b) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return grantName(a).localeCompare(grantName(b));
    });
    return {
      active: rows.filter(isActiveEnrollmentRow),
      inactive: rows.filter((row) => !isActiveEnrollmentRow(row)),
    };
  };

  const buildRentalAssistance = (enrollments: Record<string, unknown>[]): DigestRentalAssistanceRow[] =>
    enrollments
        .map((e) => {
          const payments = (Array.isArray(e.payments) ? e.payments : [])
              .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
              .map((raw) => ({
                raw,
                dueDate: String(raw.dueDate || raw.date || ''),
                amount: amountFromPayment(raw),
                paid: raw.paid === true || String(raw.status || '').toLowerCase() === 'paid',
              }))
              .filter((p) => isISO(p.dueDate) && isFinancialPayment(p.raw))
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

          const today = todayISO();
          const paidPayments = payments.filter((p) => p.paid).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
          const nextPayments = payments.filter((p) => !p.paid && p.dueDate >= today);
          const nextRentCert = computeNextRentCertDue([e]);
          return {
            enrollmentId: String(e.id || ''),
            grantName: grantName(e),
            assistanceEndDate: String(e.endDate || payments[payments.length - 1]?.dueDate || ''),
            lastPayment: formatPayment(paidPayments[0] || null),
            nextPayment: formatPayment(nextPayments[0] || null),
            nextRentCertDue: nextRentCert ? `${nextRentCert.dueDate}${nextRentCert.asap ? ' ASAP' : ''}` : 'None',
            rentCertAsap: nextRentCert?.asap === true,
          };
        })
        .filter((row): row is DigestRentalAssistanceRow => !!row);

  const buildRentCertsDueSoon = (
      clients: Array<{ name: string; activeEnrollments: Record<string, unknown>[] }>,
  ): DigestRentCertRow[] => {
    const today = todayISO();
    const limit = addDaysISO(today, 45);
    return clients
        .flatMap((client) => client.activeEnrollments.map((enrollment) => {
          const due = computeNextRentCertDue([enrollment], {today});
          if (!due || due.dueDate < today || due.dueDate > limit) return null;
          return {
            ...due,
            clientName: client.name,
            grantName: grantName(enrollment),
          };
        }))
        .filter((row): row is DigestRentCertRow => !!row)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.clientName.localeCompare(b.clientName));
  };

  const buildTasks = (cid: string): DigestTaskRow[] =>
    (tasksByClient.get(cid) || [])
        .filter((t) => t.status !== 'cancelled')
        .filter((t) => {
          const haystack = [
            t.enrollmentId,
            t.source,
            t.sourcePath,
            t.title,
            t.subtitle,
            t.type,
          ].map((value) => String(value || '').toLowerCase()).join(' ');
          return /\benrollment\b/.test(haystack) || haystack.includes('rent cert');
        })
        .map((t) => ({
          title: String(t.title || t.note || t.notes || '-'),
          dueDate: String(t.dueDate || ''),
          status: String(t.status || 'open'),
        }))
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
          return a.dueDate.localeCompare(b.dueDate);
        });

  const primarySplits = primaryRaw
      .sort((a, b) => customerName(a).localeCompare(customerName(b)))
      .map((c) => {
        const split = splitEnrollments(c.id);
        return {raw: c, name: customerName(c), active: split.active, inactive: split.inactive};
      });

  const secondarySplits = secondaryRaw
      .sort((a, b) => customerName(a).localeCompare(customerName(b)))
      .map((c) => {
        const split = splitEnrollments(c.id);
        return {raw: c, name: customerName(c), active: split.active, inactive: split.inactive};
      });

  const primaryClients: DigestPrimaryClient[] = primarySplits
      .map((c) => {
        return {
          clientId: c.raw.id,
          name: c.name,
          activeEnrollments: c.active.map(buildEnrollmentRow),
          inactiveEnrollments: c.inactive.map(buildEnrollmentRow),
          rentalAssistance: buildRentalAssistance(c.active),
          tasks: buildTasks(c.raw.id),
        };
      });

  const secondaryClients: DigestSecondaryClient[] = secondarySplits
      .map((c) => {
        return {
          clientId: c.raw.id,
          name: c.name,
          activeEnrollments: c.active.map(buildEnrollmentRow),
          inactiveEnrollments: c.inactive.map(buildEnrollmentRow),
          rentalAssistance: buildRentalAssistance(c.active),
        };
      });

  const rentCertsDueSoon = buildRentCertsDueSoon([
    ...primarySplits.map((client) => ({name: client.name, activeEnrollments: client.active})),
    ...secondarySplits.map((client) => ({name: client.name, activeEnrollments: client.active})),
  ]);

  return {
    cmName,
    month,
    primaryClients,
    secondaryClients,
    rentCertsDueSoon,
    dashboardLink,
    taskCount: 0,
  };
}

type SendOpts = {
  subject?: string;
  subjectTemplate?: string;
  dashboardLink?: string;
  cmName?: string;
  message?: string;
};

function injectMessage(html: string, message?: string): string {
  const body = String(message || '').trim();
  if (!body) return html;
  const block = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:16px;color:#1e293b;white-space:pre-wrap">${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  const needle = '<tr><td style="background:#f1f5f9;padding:20px 28px">';
  return html.includes(needle) ? html.replace(needle, `${needle}${block}`) : `${block}${html}`;
}

export async function sendDigestEmail(
    to: string,
    month: string,
    _rowsHtml: string,
    sendOpts: SendOpts = {},
    digestData?: DigestTemplateArgs,
): Promise<{ ok: boolean; id?: string | null; skipped?: boolean }> {
  const key = `digest_${month}_${to.toLowerCase()}`;
  const logRef = db.collection('emailLogs').doc(key);
  const prior = await logRef.get();
  if (prior.exists) return {ok: true, id: (prior.data() as any)?.id || null, skipped: true};

  const data = digestData ?? null;
  const taskCount = data?.taskCount ?? 0;
  const subject =
    sendOpts.subject ||
    (sendOpts.subjectTemplate ?
      sendOpts.subjectTemplate.replace('${month}', month) :
      data ?
      buildDigestSubject(month, taskCount) :
      `Caseload Digest - ${month}`);

  const html = data ?
    buildDigestHtml({...data, dashboardLink: sendOpts.dashboardLink ?? data.dashboardLink}) :
    `<div style="font:14px sans-serif"><h2>${subject}</h2><p>No digest data available.</p></div>`;

  const htmlWithMessage = injectMessage(html, sendOpts.message);
  const sent = await sendHtmlEmail({from: 'hsgcompliance@thehrdc.org', to, subject, html: htmlWithMessage});

  await logRef.set(
      {
        id: sent.id || null,
        to,
        month,
        subject,
        message: String(sendOpts.message || '').trim() || null,
        createdAt: isoNow(),
        taskCount,
      },
      {merge: true},
  );
  return sent;
}

export async function buildAndSendDigest(
    to: string,
    opts: BuildOpts & SendOpts,
): Promise<{ ok: boolean; id?: string | null; skipped?: boolean }> {
  const data = await buildDigestData(opts);
  return sendDigestEmail(to, opts.month, '', opts, data);
}

/** @deprecated Prefer buildAndSendDigest. */
export async function buildDigestRows({month, forUid}: { month: string; forUid: string }) {
  const data = await buildDigestData({month, forUid});
  return {items: [] as any[], rowsHtml: '', digestData: data};
}
