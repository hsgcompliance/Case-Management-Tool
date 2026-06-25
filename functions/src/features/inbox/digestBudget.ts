// functions/src/features/inbox/digestBudget.ts
// Budget digest — per-grant budget summary email.
import { db } from "../../core";
import { sendHtmlEmail } from "./emailer";
import {markDigestFailed, markDigestSent, reserveDigestSend} from './digestSendGuard';
import {getGrantFinancialCapabilities} from '../grants/schemas';

const DASHBOARD_LINK = "https://households-db.web.app/dashboard";
const BRAND   = "#2563EB";
const TEXT    = "#1e293b";
const MUTED   = "#64748b";
const BG_PAGE = "#f1f5f9";
const BG_CARD = "#ffffff";
const BORDER  = "#e2e8f0";
const BG_SECT = "#f8fafc";
const WARN_BG = "#fef3c7";
const WARN_TEXT = "#b45309";
const DANGER_BG = "#fee2e2";
const DANGER_TEXT = "#b91c1c";
const OK_BG     = "#dcfce7";
const OK_TEXT   = "#15803d";

// ── Types ─────────────────────────────────────────────────────────────────────

type GrantBudgetRow = {
  id: string;
  name: string;
  code: string;
  total: number;
  spent: number;
  projected: number;
  projectedSpend: number;
  balance: number;
  projectedBalance: number;
  pctUsed: number;          // spent / total
  pctAllocated: number;     // projectedSpend / total
  display: {
    showGrantTotals: boolean;
    showLineItems: boolean;
    showSplitGoals: boolean;
  };
  lineItems: Array<{
    id: string;
    label: string;
    total: number;
    spent: number;
    projected: number;
    projectedSpend: number;
    balance: number;
    projectedBalance: number;
    pctAllocated: number;
    splitGoals: Array<{
      id: string;
      label: string;
      startDate: string;
      endDate: string;
      total: number;
      spent: number;
      projected: number;
      projectedSpend: number;
      balance: number;
      projectedBalance: number;
      pctAllocated: number;
    }>;
  }>;
};

type BudgetDigestData = {
  recipientName: string;
  month: string;
  grants: GrantBudgetRow[];
  totals: {
    total: number;
    spent: number;
    projected: number;
    projectedSpend: number;
    balance: number;
  };
  dashboardLink: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(dollars: number): string {
  return "$" + Number(dollars || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

function statusColor(pctAllocated: number): [string, string] {
  if (pctAllocated >= 95) return [DANGER_BG, DANGER_TEXT];
  if (pctAllocated >= 75) return [WARN_BG, WARN_TEXT];
  return [OK_BG, OK_TEXT];
}

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch { return ym; }
}

function lineItemDisplayConfig(grant: Record<string, unknown>, lineItem: Record<string, unknown>) {
  const grantDigest = ((grant.budget as any)?.digestDisplay ?? {}) as Record<string, unknown>;
  const itemDisplay = (lineItem.display && typeof lineItem.display === "object" ? lineItem.display : {}) as Record<string, unknown>;
  const mainLevel = String(itemDisplay.mainDisplayLevel || grantDigest.mainDisplayLevel || "grant");
  return {
    appearInDigest: itemDisplay.appearInDigest !== false,
    showLineItems: itemDisplay.showLineItemTotal !== false && (mainLevel === "lineItem" || mainLevel === "split" || itemDisplay.showLineItemTotal === true || itemDisplay.showSplitGoals === true),
    showSplitGoals: itemDisplay.showSplitGoals === true || mainLevel === "split",
  };
}

function periodText(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Date range TBD";
  return `${startDate || "TBD"}-${endDate || "TBD"}`;
}

// ── Data builder ──────────────────────────────────────────────────────────────

export async function buildBudgetDigestData(opts: {
  month: string;
  recipientName?: string;
  dashboardLink?: string;
}): Promise<BudgetDigestData> {
  const { month, recipientName = "Team", dashboardLink = DASHBOARD_LINK } = opts;

  const grantsSnap = await db
    .collection("grants")
    .where("active", "==", true)
    .get();

  const grants: GrantBudgetRow[] = [];

  for (const doc of grantsSnap.docs) {
    const g = doc.data() as Record<string, unknown>;
    const capabilities = getGrantFinancialCapabilities(g);
    if (!capabilities.drawsDownBudget) continue; // budget digest is spend-down only
    if (!(g.pins as any)?.digest?.enabled) continue; // must have budget digest pin enabled

    const name  = String(g.name || g.code || doc.id);
    const code  = String(g.code || "");
    const bt    = (g.budget as any)?.totals ?? (g.budgetTotals as any) ?? {};

    const total           = Number(bt.total           || 0);
    const spent           = Number(bt.spent           || 0);
    const projected       = Number(bt.projected       || 0);
    const projectedSpend  = Number(bt.projectedSpend  || spent + projected);
    const balance         = Number(bt.balance         ?? total - spent);
    const projectedBalance = Number(bt.projectedBalance ?? total - projectedSpend);
    const digestDisplay = ((g.budget as any)?.digestDisplay ?? {}) as Record<string, unknown>;
    const mainLevel = String(digestDisplay.mainDisplayLevel || "grant");
    const showGrantTotals = digestDisplay.showGrantTotals !== false;
    const showLineItems = mainLevel === "lineItem" || mainLevel === "split";
    const showSplitGoals = mainLevel === "split";

    // Skip grants with no budget configured
    if (!total) continue;

    const lineItems = (Array.isArray((g.budget as any)?.lineItems) ? (g.budget as any).lineItems : [])
      .filter((li: Record<string, unknown>) => lineItemDisplayConfig(g, li).appearInDigest)
      .map((li: Record<string, unknown>) => {
        const liTotal = Number(li.amount || 0);
        const liSpent = Number(li.spent || 0);
        const liProjected = Number(li.projected || 0);
        const liProjectedSpend = liSpent + liProjected;
        const liDisplay = lineItemDisplayConfig(g, li);
        return {
          id: String(li.id || ""),
          label: String(li.label || li.id || "Line item"),
          total: liTotal,
          spent: liSpent,
          projected: liProjected,
          projectedSpend: liProjectedSpend,
          balance: liTotal - liSpent,
          projectedBalance: liTotal - liProjectedSpend,
          pctAllocated: pct(liProjectedSpend, liTotal),
          splitGoals: liDisplay.showSplitGoals
            ? (Array.isArray(li.splitGoals) ? li.splitGoals : []).map((goal: Record<string, unknown>, index: number) => {
                const goalTotal = Number(goal.amount || 0);
                const goalSpent = Number(goal.spent || 0);
                const goalProjected = Number(goal.projected || 0);
                const goalProjectedSpend = goalSpent + goalProjected;
                return {
                  id: String(goal.id || `${li.id || "li"}_${index}`),
                  label: String(goal.label || `Cycle ${index + 1}`),
                  startDate: String(goal.startDate || ""),
                  endDate: String(goal.endDate || ""),
                  total: goalTotal,
                  spent: goalSpent,
                  projected: goalProjected,
                  projectedSpend: goalProjectedSpend,
                  balance: goalTotal - goalSpent,
                  projectedBalance: goalTotal - goalProjectedSpend,
                  pctAllocated: pct(goalProjectedSpend, goalTotal),
                };
              })
            : [],
        };
      });

    grants.push({
      id: doc.id,
      name,
      code,
      total,
      spent,
      projected,
      projectedSpend,
      balance,
      projectedBalance,
      pctUsed:       pct(spent,          total),
      pctAllocated:  pct(projectedSpend,  total),
      display: {
        showGrantTotals,
        showLineItems,
        showSplitGoals,
      },
      lineItems: showLineItems || showSplitGoals ? lineItems : [],
    });
  }

  grants.sort((a, b) => a.name.localeCompare(b.name));

  const sum = (fn: (g: GrantBudgetRow) => number) => grants.reduce((s, g) => s + fn(g), 0);

  return {
    recipientName,
    month,
    grants,
    totals: {
      total:          sum((g) => g.total),
      spent:          sum((g) => g.spent),
      projected:      sum((g) => g.projected),
      projectedSpend: sum((g) => g.projectedSpend),
      balance:        sum((g) => g.balance),
    },
    dashboardLink,
  };
}

// ── HTML template ─────────────────────────────────────────────────────────────

export function buildBudgetDigestHtml(data: BudgetDigestData): string {
  const { recipientName, month, grants, totals, dashboardLink } = data;
  const label = monthLabel(month);

  const grantRows = grants.map((g) => {
    const [bgColor, fgColor] = statusColor(g.pctAllocated);
    const barW = Math.min(100, g.pctAllocated);
    const childRows = g.lineItems.map((li) => {
      const splitRows = li.splitGoals.map((goal) => `
        <div style="border-left:2px solid ${BORDER};margin-left:14px;padding:6px 0 6px 10px">
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:${TEXT}">
            <span>${esc(goal.label)} <span style="color:${MUTED};font-size:11px">${esc(periodText(goal.startDate, goal.endDate))}</span></span>
            <strong>${fmt$(goal.projectedSpend)} / ${fmt$(goal.total)}</strong>
          </div>
          <div style="font-size:11px;color:${goal.projectedBalance < 0 ? DANGER_TEXT : MUTED};margin-top:2px">Projected balance ${fmt$(goal.projectedBalance)}</div>
        </div>`).join("");
      return `
        <div style="border-top:1px solid ${BORDER};padding:9px 0">
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:${TEXT}">
            <strong>${esc(li.label)}</strong>
            <strong>${fmt$(li.projectedSpend)} / ${fmt$(li.total)}</strong>
          </div>
          <div style="font-size:11px;color:${li.projectedBalance < 0 ? DANGER_TEXT : MUTED};margin-top:2px">Projected balance ${fmt$(li.projectedBalance)}</div>
          ${splitRows}
        </div>`;
    }).join("");
    return `
  <div style="background:${BG_CARD};border:1px solid ${BORDER};border-radius:10px;margin-bottom:12px;overflow:hidden">
    <div style="background:${BG_SECT};border-bottom:1px solid ${BORDER};padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:14px;font-weight:700;color:${TEXT}">${esc(g.name)}</span>
        ${g.code ? `<span style="margin-left:8px;font-size:11px;color:${MUTED}">${esc(g.code)}</span>` : ""}
      </div>
      <span style="background:${bgColor};color:${fgColor};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700">${g.pctAllocated}% allocated</span>
    </div>
    <div style="padding:12px 14px">
      <!-- Progress bar -->
      <div style="background:#e2e8f0;border-radius:9999px;height:6px;margin-bottom:10px;overflow:hidden">
        <div style="background:${fgColor};height:6px;width:${barW}%;border-radius:9999px"></div>
      </div>
      <!-- Stats grid -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:0 6px">
            <div style="font-size:13px;font-weight:700;color:${TEXT}">${fmt$(g.total)}</div>
            <div style="font-size:10px;color:${MUTED}">Budget</div>
          </td>
          <td style="text-align:center;padding:0 6px">
            <div style="font-size:13px;font-weight:700;color:${TEXT}">${fmt$(g.spent)}</div>
            <div style="font-size:10px;color:${MUTED}">Spent</div>
          </td>
          <td style="text-align:center;padding:0 6px">
            <div style="font-size:13px;font-weight:700;color:${WARN_TEXT}">${fmt$(g.projected)}</div>
            <div style="font-size:10px;color:${MUTED}">Projected</div>
          </td>
          <td style="text-align:center;padding:0 6px">
            <div style="font-size:13px;font-weight:700;color:${g.balance < 0 ? DANGER_TEXT : OK_TEXT}">${fmt$(g.balance)}</div>
            <div style="font-size:10px;color:${MUTED}">Balance</div>
          </td>
          <td style="text-align:center;padding:0 6px">
            <div style="font-size:13px;font-weight:700;color:${g.projectedBalance < 0 ? DANGER_TEXT : MUTED}">${fmt$(g.projectedBalance)}</div>
            <div style="font-size:10px;color:${MUTED}">Proj. Balance</div>
          </td>
        </tr>
      </table>
      ${childRows ? `<div style="margin-top:10px">${childRows}</div>` : ""}
    </div>
  </div>`;
  }).join("");

  const noGrants = !grants.length
    ? `<div style="color:${MUTED};font-size:13px;text-align:center;padding:20px">No active grants with budget configured.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label} Budget Digest</title></head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:640px" cellpadding="0" cellspacing="0">

        <tr><td style="background:${BRAND};border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="font-size:22px;font-weight:700;color:#fff">Budget Digest</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">${label} &nbsp;·&nbsp; ${esc(recipientName)}</div>
        </td></tr>

        <!-- Summary totals -->
        <tr><td style="background:${BG_CARD};padding:16px 28px;border-bottom:1px solid ${BORDER}">
          <table cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="text-align:center">
              <div style="font-size:20px;font-weight:700;color:${BRAND}">${fmt$(totals.total)}</div>
              <div style="font-size:11px;color:${MUTED}">Total Budget</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:20px;font-weight:700;color:${TEXT}">${fmt$(totals.spent)}</div>
              <div style="font-size:11px;color:${MUTED}">Spent</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:20px;font-weight:700;color:${WARN_TEXT}">${fmt$(totals.projected)}</div>
              <div style="font-size:11px;color:${MUTED}">Projected</div>
            </td>
            <td style="text-align:center">
              <div style="font-size:20px;font-weight:700;color:${totals.balance < 0 ? DANGER_TEXT : OK_TEXT}">${fmt$(totals.balance)}</div>
              <div style="font-size:11px;color:${MUTED}">Balance</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:${BG_PAGE};padding:20px 28px">
          ${grantRows}${noGrants}
        </td></tr>

        <tr><td style="background:${BG_CARD};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <a href="${dashboardLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard</a>
          <div style="margin-top:12px;font-size:11px;color:${MUTED}">You're receiving this budget digest based on your subscription preferences.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Send ──────────────────────────────────────────────────────────────────────

export async function buildAndSendBudgetDigest(
  to: string,
  opts: { month: string; forUid: string; recipientName?: string; force?: boolean }
): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = `digest_budget_${opts.month}_${to.toLowerCase()}`;
  const reserved = await reserveDigestSend(key, {to, month: opts.month, digestType: 'budget'}, {force: opts.force});
  if (!reserved) return { ok: true, skipped: true };

  try {
    const data = await buildBudgetDigestData({ month: opts.month, recipientName: opts.recipientName });
    const html = buildBudgetDigestHtml(data);
    const subject = `Budget Digest - ${monthLabel(opts.month)} (${data.grants.length} grant${data.grants.length !== 1 ? "s" : ""})`;

    const sent = await sendHtmlEmail({ from: "hsgcompliance@thehrdc.org", to, subject, html });
    await markDigestSent(key, { id: sent.id || null, to, month: opts.month, subject, digestType: 'budget' });
    return sent;
  } catch (error: unknown) {
    await markDigestFailed(key, error, {to, month: opts.month, digestType: 'budget'});
    throw error;
  }
}
