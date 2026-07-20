import {sendHtmlEmail} from './emailer';
import {buildBudgetDigestData, buildBudgetDigestHtml} from './digestBudget';
import {buildEnrollmentDigestData, buildEnrollmentDigestHtml} from './digestEnrollments';
import {markDigestFailed, markDigestSent, reserveDigestSend} from './digestSendGuard';
import {db} from '../../core';
import {getDigestDisplayConfigValue} from './digestOrgConfig';

export type GrantProgramDetailConfig = {
  showDescription: boolean;
  showEligibility: boolean;
  showCodes: boolean;
  showServices: boolean;
  showDates: boolean;
  showDuration: boolean;
};

const DEFAULT_DETAILS: GrantProgramDetailConfig = {
  showDescription: true,
  showEligibility: true,
  showCodes: true,
  showServices: true,
  showDates: true,
  showDuration: true,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function entries(value: unknown): Array<[string, string]> {
  if (Array.isArray(value)) return value.map((item, index) => [String(index + 1), String(record(item).label || record(item).name || item)]);
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null && String(item).trim()).map(([key, item]) => [key, String(item)]);
  return String(value || '').trim() ? [['', String(value)]] : [];
}

function labeledList(title: string, rows: Array<[string, string]>): string {
  if (!rows.length) return '';
  return `<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b">${esc(title)}</div>${rows.map(([key, value]) => `<div style="margin-top:3px;font-size:13px;color:#334155">${key ? `<strong>${esc(key)}:</strong> ` : ''}${esc(value)}</div>`).join('')}</div>`;
}

async function loadDetailConfig(orgId?: string): Promise<GrantProgramDetailConfig> {
  const value = await getDigestDisplayConfigValue(orgId);
  const configured = record(record(value.grantProgramDigest).details);
  return {...DEFAULT_DETAILS, ...configured} as GrantProgramDetailConfig;
}

async function loadGrantDetails(grantIds: string[]): Promise<Array<{id: string; data: Record<string, unknown>}>> {
  const unique = Array.from(new Set(grantIds.filter(Boolean)));
  const out: Array<{id: string; data: Record<string, unknown>}> = [];
  for (let index = 0; index < unique.length; index += 30) {
    const snap = await db.collection('grants').where('__name__', 'in', unique.slice(index, index + 30)).get();
    out.push(...snap.docs.map((doc) => ({id: doc.id, data: doc.data() as Record<string, unknown>})));
  }
  return out.sort((a, b) => String(a.data.name || a.id).localeCompare(String(b.data.name || b.id)));
}

export function grantDetailsHtml(grants: Array<{id: string; data: Record<string, unknown>}>, config: GrantProgramDetailConfig): string {
  const cards = grants.map(({id, data: grant}) => {
    const invoicing = record(grant.invoicing);
    const lineItems = Array.isArray(record(grant.budget).lineItems) ? record(grant.budget).lineItems as unknown[] : [];
    const lineItemCodes: Array<[string, string]> = lineItems.flatMap((item) => {
      const inv = record(record(item).invoicing);
      const label = String(record(item).label || 'Line item');
      const candidates: Array<[string, unknown]> = [
        [`${label} grant code`, inv.grantCode],
        [`${label} program code`, inv.programCode],
        [`${label} HMIS code`, inv.hmisCode],
      ];
      return candidates.filter(([, value]) => Boolean(String(value || '').trim())).map(([key, value]) => [key, String(value).trim()] as [string, string]);
    });
    const codeRows: Array<[string, unknown]> = [
      ['Grant code', grant.code || grant.grantCode || invoicing.grantCode],
      ['Program / FE code', grant.programCode || invoicing.programCode],
      ['HMIS code', grant.hmisCode || invoicing.hmisCode],
      ['Contract number', invoicing.contractNumber],
      ...lineItemCodes,
    ];
    const codes = codeRows.filter((row): row is [string, string] => Boolean(String(row[1] || '').trim())).map(([key, value]) => [key, String(value).trim()] as [string, string]);
    const description = String(grant.description || record(grant.details).description || '').trim();
    const dateRows: Array<[string, string]> = [['Start', String(grant.startDate || '').slice(0, 10)], ['End', String(grant.endDate || '').slice(0, 10)]].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
    const durationRows: Array<[string, string]> = [['Duration', String(grant.duration || '')], ['Maximum length', String(grant.maxLength || grant.maximumLength || '')]].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
    return `<div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:16px;font-weight:700;color:#0f172a">${esc(grant.name || id)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(String(grant.kind || 'grant') === 'program' ? 'Program' : 'Grant')}</div>
      ${config.showDescription && description ? `<div style="font-size:13px;line-height:1.5;color:#334155;margin-top:10px;white-space:pre-wrap">${esc(description)}</div>` : ''}
      ${config.showCodes ? labeledList('Codes', codes) : ''}
      ${config.showDates ? labeledList('Operating dates', dateRows) : ''}
      ${config.showDuration ? labeledList('Duration', durationRows) : ''}
      ${config.showServices ? labeledList('Services provided', entries(grant.servicesOffered ?? grant.servicesProvided)) : ''}
      ${config.showEligibility ? labeledList('Eligibility', entries(grant.eligibility)) : ''}
    </div>`;
  }).join('');
  return cards ? `<div style="margin:18px 0"><div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:10px">Grant &amp; Program Details</div>${cards}</div>` : '';
}

function bodyOf(html: string): string {
  return html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01`).toLocaleString('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});
}

export async function buildGrantProgramDigestHtml(opts: {
  month: string;
  grantIds: string[];
  recipientName?: string;
  orgId?: string;
}) {
  const [budget, enrollments, grants, detailConfig] = await Promise.all([
    buildBudgetDigestData({...opts}),
    buildEnrollmentDigestData({...opts}),
    loadGrantDetails(opts.grantIds),
    loadDetailConfig(opts.orgId),
  ]);
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:700px;margin:0 auto;padding:24px 12px">
      <div style="padding:20px 24px;border-radius:12px;background:#0f172a;color:white;margin-bottom:18px">
        <div style="font-size:22px;font-weight:700">Grant &amp; Program Digest</div>
        <div style="margin-top:4px;color:#cbd5e1">${monthLabel(opts.month)} · ${opts.grantIds.length} subscribed grant${opts.grantIds.length === 1 ? '' : 's'}</div>
      </div>
      ${grantDetailsHtml(grants, detailConfig)}
      ${bodyOf(buildEnrollmentDigestHtml(enrollments))}
      <div style="height:18px"></div>
      ${bodyOf(buildBudgetDigestHtml(budget))}
    </div>
  </body></html>`;
  return {html, budget, enrollments};
}

export async function buildAndSendGrantProgramDigest(to: string, opts: {
  month: string;
  grantIds: string[];
  recipientName?: string;
  orgId?: string;
  force?: boolean;
}): Promise<{ok: boolean; skipped?: boolean}> {
  const key = `digest_grantPrograms_${opts.month}_${to.toLowerCase()}`;
  const reserved = await reserveDigestSend(key, {to, month: opts.month, digestType: 'grantPrograms'}, {force: opts.force});
  if (!reserved) return {ok: true, skipped: true};
  try {
    const {html} = await buildGrantProgramDigestHtml(opts);
    const subject = `Grant & Program Digest - ${monthLabel(opts.month)}`;
    const sent = await sendHtmlEmail({from: 'hsgcompliance@thehrdc.org', to, subject, html});
    await markDigestSent(key, {id: sent.id || null, to, month: opts.month, subject, digestType: 'grantPrograms'});
    return sent;
  } catch (error: unknown) {
    await markDigestFailed(key, error, {to, month: opts.month, digestType: 'grantPrograms'});
    throw error;
  }
}
