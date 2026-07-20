// functions/src/features/formSessions/rentCert.ts
// -----------------------------------------------------------------------------
// Forms-app rent-cert schedule endpoints (staff-authed, appCheck:false — the
// lightweight forms surface has no App Check registration).
//
//   GET  /formsEnrollmentsList?customerId=   → the customer's enrollments with
//        grant/line-item context + a payment summary (for conflict preview and
//        the enrollment-selection chips in the schedule builder).
//   POST /formsRentCertApply                 → apply a REVIEWED schedule: staff
//        selected the target enrollment(s) in the UI; the backend appends the
//        approved rows to each enrollment's payment schedule SEQUENTIALLY (one
//        transaction per enrollment, in row order) so grant budget projections
//        and the paymentQueue projection sync (trigger-driven) build in order
//        while the frontend sees a single apply call.
//
// Idempotency: every created row carries a `src:{submissionId}` note tag. Rows
// whose category+service-month already exist from the same submission report
// "already_applied"; other same-family/month overlaps report "conflict_existing"
// and are NOT created (RULES.md: never more than one landlord payment per
// enrollment + service month).
// -----------------------------------------------------------------------------
import { z } from "@hdb/contracts";
import { db, FieldValue, normId, normStr, secureHandler } from "../../core";
import { runEnrollmentProjectionsUpsert } from "../payments/upsertProjections";
import { primarySubtype } from "../payments/utils";
import { getTargetOrg } from "./http";

/* ───────────────────────────── shared helpers ───────────────────────────── */

const ISO10 = /^\d{4}-\d{2}-\d{2}$/;
const monthOf = (iso: string) => String(iso || "").slice(0, 7);

const noteTags = (p: any): string[] =>
  Array.isArray(p?.note) ? p.note.map((t: any) => String(t || "")) : p?.note ? [String(p.note)] : [];

const srcSubmissionId = (p: any): string | null => {
  const tag = noteTags(p).find((t) => t.toLowerCase().startsWith("src:"));
  return tag ? tag.slice(4).trim() || null : null;
};

/**
 * Duplicate-prevention family (RULES.md): prorated rent, arrears and monthly
 * rent are all "one landlord payment per service month"; utility allowance and
 * deposits are their own families.
 */
function paymentFamily(p: { type?: unknown; sub?: unknown; note?: unknown }): string {
  const type = String(p?.type || "").toLowerCase();
  if (type === "deposit") return "deposit";
  if (type === "monthly") return primarySubtype(p) === "utility" ? "utility" : "landlord";
  if (type === "prorated" || type === "arrears") return "landlord";
  return type || "other";
}

/* ─────────────────────────── enrollments listing ────────────────────────── */

export type FormsEnrollmentLineItem = { id: string; label: string; locked: boolean };

export type FormsEnrollmentPaymentSummary = {
  id: string;
  type: string;
  sub: string | null;
  family: string;
  dueDate: string;
  serviceMonth: string;
  amount: number;
  paid: boolean;
  void: boolean;
  srcSubmissionId: string | null;
};

export type FormsEnrollmentItem = {
  id: string;
  customerId: string;
  grantId: string;
  grantName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  active: boolean;
  stage: string | null;
  /** Has at least one unlocked grant budget line item — i.e. can be billed. */
  billable: boolean;
  grantWindowStart: string | null;
  grantWindowEnd: string | null;
  lineItems: FormsEnrollmentLineItem[];
  payments: FormsEnrollmentPaymentSummary[];
};

async function listEnrollmentsForForms(orgId: string, customerId: string): Promise<FormsEnrollmentItem[]> {
  const org = normId(orgId);
  const id = normId(customerId);
  if (!org || !id) return [];

  const snap = await db.collection("customerEnrollments").where("customerId", "==", id).limit(100).get();
  const enrollments = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) } as Record<string, any>))
    .filter((e) => normId(e.orgId) === org)
    .filter((e) => e.deleted !== true && String(e.status || "") !== "deleted");

  const grantIds = [...new Set(enrollments.map((e) => String(e.grantId || "")).filter(Boolean))];
  const grantById = new Map<string, Record<string, any>>();
  if (grantIds.length) {
    const refs = grantIds.map((g) => db.collection("grants").doc(g));
    const gSnaps = await db.getAll(...refs);
    for (const g of gSnaps) if (g.exists) grantById.set(g.id, (g.data() || {}) as Record<string, any>);
  }

  const items: FormsEnrollmentItem[] = enrollments.map((e) => {
    const grant = grantById.get(String(e.grantId || "")) || {};
    if (Object.keys(grant).length && normId(grant.orgId) !== org) {
      // Cross-org grant pointer — never leak its details.
      return null as unknown as FormsEnrollmentItem;
    }
    const rawLineItems: any[] = Array.isArray(grant?.budget?.lineItems) ? grant.budget.lineItems : [];
    const lineItems: FormsEnrollmentLineItem[] = rawLineItems.map((li) => ({
      id: String(li?.id || ""),
      label: normStr(li?.label) || normStr(li?.name) || normStr(li?.title) || String(li?.id || ""),
      locked: li?.locked === true,
    }));

    const payments: FormsEnrollmentPaymentSummary[] = (Array.isArray(e.payments) ? e.payments : []).map((p: any) => {
      const dueDate = String(p?.dueDate || p?.date || "").slice(0, 10);
      const type = String(p?.type || "").toLowerCase();
      return {
        id: String(p?.id || ""),
        type,
        sub: type === "monthly" ? primarySubtype(p) : null,
        family: paymentFamily(p),
        dueDate,
        serviceMonth: monthOf(dueDate),
        amount: Number(p?.amount || 0),
        paid: p?.paid === true,
        void: p?.void === true,
        srcSubmissionId: srcSubmissionId(p),
      };
    });

    return {
      id: String(e.id),
      customerId: String(e.customerId || ""),
      grantId: String(e.grantId || ""),
      grantName: normStr(e.grantName) || normStr(e.name) || normStr(grant?.name) || null,
      startDate: normStr(e.startDate) || null,
      endDate: normStr(e.endDate) || null,
      status: normStr(e.status) || null,
      active: e.active !== false && String(e.status || "active") === "active",
      stage: normStr(e.stage) || null,
      billable: lineItems.some((li) => !li.locked),
      grantWindowStart: normStr(grant?.startDate) || normStr(grant?.windowStart) || null,
      grantWindowEnd: normStr(grant?.endDate) || normStr(grant?.windowEnd) || null,
      lineItems,
      payments,
    };
  }).filter(Boolean);

  // Active + billable first, then newest start date.
  return items.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(b.billable) - Number(a.billable) ||
      String(b.startDate || "").localeCompare(String(a.startDate || "")),
  );
}

export const formsEnrollmentsList_http = secureHandler(
  async (req, res) => {
    const targetOrg = getTargetOrg(req, req.query);
    const q = (req.query || {}) as Record<string, unknown>;
    const customerId = normId(q.customerId) || normStr(q.customerId);
    if (!customerId) {
      res.status(400).json({ ok: false, error: "customerId_required" });
      return;
    }
    const items = await listEnrollmentsForForms(targetOrg, String(customerId));
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", appCheck: false, methods: ["GET", "OPTIONS"] },
);

/* ───────────────────────────── schedule apply ───────────────────────────── */

const ApplyRow = z.object({
  enrollmentId: z.string().min(1),
  lineItemId: z.string().min(1),
  type: z.enum(["deposit", "prorated", "arrears", "monthly"]),
  sub: z.enum(["rent", "utility"]).optional(),
  amount: z.number().positive(),
  dueDate: z.string().regex(ISO10),
  label: z.string().trim().max(120).optional(),
  vendor: z.string().trim().max(200).optional(),
});

const FormsRentCertApplyBody = z.object({
  customerId: z.string().min(1),
  submissionId: z.string().min(1),
  formId: z.string().optional(),
  /** Parsed certification fields, stored verbatim on the certification record. */
  certification: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  rows: z.array(ApplyRow).min(1).max(120),
});

export type TFormsRentCertApplyRow = z.infer<typeof ApplyRow>;

type RowResult = {
  index: number;
  enrollmentId: string;
  status: "created" | "already_applied" | "conflict_existing" | "conflict_in_batch" | "failed";
  paymentId?: string;
  existingPaymentId?: string;
  error?: string;
};

export const formsRentCertApply_http = secureHandler(
  async (req, res) => {
    const parsed = FormsRentCertApplyBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const user = (req.user || {}) as Record<string, unknown>;
    const targetOrg = getTargetOrg(req, req.body);
    const { customerId, submissionId, formId, certification, rows } = parsed.data;

    // Preserve row order per enrollment AND process enrollments in first-seen
    // order — the queue builds in the same order the preview showed.
    const groups = new Map<string, Array<{ row: TFormsRentCertApplyRow; index: number }>>();
    rows.forEach((row, index) => {
      const g = groups.get(row.enrollmentId) || [];
      g.push({ row, index });
      groups.set(row.enrollmentId, g);
    });

    const results: RowResult[] = [];

    for (const [enrollmentId, group] of groups) {
      const groupResults: RowResult[] = [];
      try {
        await runEnrollmentProjectionsUpsert(user, enrollmentId, (oldPayments, enrollment) => {
          if (String(enrollment?.customerId || "") !== customerId) {
            throw new Error("enrollment_customer_mismatch");
          }
          groupResults.length = 0; // transaction may retry — rebuild results
          const existing = (oldPayments || []).filter((p: any) => p?.void !== true);
          const accepted: any[] = [];

          for (const { row, index } of group) {
            const family = paymentFamily(row);
            const month = monthOf(row.dueDate);

            const dup = existing.find(
              (p: any) => paymentFamily(p) === family && monthOf(String(p?.dueDate || p?.date || "")) === month,
            );
            if (dup) {
              const sameSource = srcSubmissionId(dup) === submissionId;
              groupResults.push({
                index,
                enrollmentId,
                status: sameSource ? "already_applied" : "conflict_existing",
                existingPaymentId: String(dup?.id || "") || undefined,
              });
              continue;
            }
            const inBatch = accepted.find((p: any) => paymentFamily(p) === family && monthOf(p.dueDate) === month);
            if (inBatch) {
              groupResults.push({ index, enrollmentId, status: "conflict_in_batch" });
              continue;
            }

            const note: string[] = [];
            if (row.type === "monthly") note.push(`sub:${row.sub || "rent"}`);
            note.push(`src:${submissionId}`, "rentCert");
            if (row.label) note.push(row.label);

            const payment = {
              type: row.type,
              amount: row.amount,
              dueDate: row.dueDate,
              lineItemId: row.lineItemId,
              paid: false,
              paidFromGrant: false,
              note,
              ...(row.vendor ? {vendor: row.vendor} : {}),
            };
            accepted.push(payment);
            groupResults.push({ index, enrollmentId, status: "created" });
          }

          return [...(oldPayments || []), ...accepted];
        });
        results.push(...groupResults);
      } catch (err: any) {
        // Whole-enrollment failure (locked/unknown line item, org mismatch, …).
        for (const { index } of group) {
          results.push({ index, enrollmentId, status: "failed", error: String(err?.message || err) });
        }
      }
    }

    results.sort((a, b) => a.index - b.index);
    const created = results.filter((r) => r.status === "created").length;

    // Certification record — preserves the reviewed source data (RULES.md).
    try {
      await db
        .collection("rentCertifications")
        .doc(String(submissionId))
        .set(
          {
            orgId: targetOrg,
            customerId,
            submissionId,
            formId: formId || null,
            certification: certification || {},
            lastApply: {
              at: FieldValue.serverTimestamp(),
              byUid: String((user as any)?.uid || ""),
              rows: rows.length,
              created,
              results: results.map((r) => ({ ...r })),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } catch {
      // Best-effort audit record; the payments themselves are already committed.
    }

    res.status(200).json({ ok: true, created, results });
  },
  { auth: "user", appCheck: false, methods: ["POST", "OPTIONS"] },
);
