import type { Request, Response } from "express";
import {
  computeBudgetTotals,
  db,
  FieldValue,
  Timestamp,
  secureHandler,
  withTxn,
} from "../../core";
import { writeLedgerEntry } from "../ledger/service";
import { PaymentsDeleteRowsBody, type TPaymentsDeleteRowsBody } from "./schemas";
import {
  assertOrgAccess,
  getGrantWindowISO,
  isInGrantWindow,
  primarySubtype,
  requireUid,
} from "./utils";

function monthKey(iso: string) {
  return String(iso || "").slice(0, 7);
}

function toSpendArray(x: unknown): any[] {
  return Array.isArray(x) ? x : [];
}

function paymentTypeLabel(p: any): string {
  if (p?.type === "deposit") return "Deposit";
  if (p?.type === "prorated") return "Prorated Rent";
  if (p?.type === "service") return "Support Service";
  return primarySubtype(p) === "utility" ? "Utility Assistance" : "Rental Assistance";
}

/** POST /paymentsDeleteRows */
export async function paymentsDeleteRowsHandler(req: Request, res: Response) {
  const parsed = PaymentsDeleteRowsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.message });
  }
  const body: TPaymentsDeleteRowsBody = parsed.data;
  const removeSpends = body.updateBudgets ? true : body.removeSpends;
  const reverseLedger = body.updateBudgets ? body.reverseLedger : false;
  const user: any = (req as any)?.user || {};
  try {
    requireUid(user);
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message || "auth_required" });
  }

  const enrollmentId = String(body.enrollmentId || "").trim();
  const selectedIds = Array.from(new Set((body.paymentIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!enrollmentId) return res.status(400).json({ ok: false, error: "missing_enrollmentId" });
  if (!body.deleteAll && selectedIds.length === 0) {
    return res.status(400).json({ ok: false, error: "missing_paymentIds_or_deleteAll" });
  }

  try {
    const result = await withTxn(async (trx) => {
      const eRef = db.collection("customerEnrollments").doc(enrollmentId);
      const eSnap = await trx.get(eRef);
      if (!eSnap.exists) throw new Error("Enrollment not found");
      const e: any = eSnap.data() || {};
      assertOrgAccess(user, e);

      const payments: any[] = Array.isArray(e.payments) ? e.payments.slice() : [];
      const paymentById = new Map(payments.map((p) => [String(p?.id || "").trim(), p]));
      const targetIdSet = body.deleteAll
        ? new Set(payments.map((p) => String(p?.id || "").trim()).filter(Boolean))
        : new Set(selectedIds);

      const skippedPaidIds: string[] = [];
      const deleteIds = new Set<string>();
      for (const id of targetIdSet) {
        const p = paymentById.get(id);
        if (!p) continue;
        if (body.preservePaid && p?.paid) {
          skippedPaidIds.push(id);
          continue;
        }
        deleteIds.add(id);
      }

      const toDeletePayments = payments.filter((p) => deleteIds.has(String(p?.id || "").trim()));
      const paidToDelete = toDeletePayments.filter((p) => !!p?.paid);

      let gRef: FirebaseFirestore.DocumentReference | null = null;
      let grant: any = null;
      let lineItems: any[] = [];
      if (body.updateBudgets && paidToDelete.length > 0) {
        const grantId = String(e.grantId || "").trim();
        if (!grantId) throw new Error("Enrollment missing grantId");
        gRef = db.collection("grants").doc(grantId);
        const gSnap = await trx.get(gRef);
        if (!gSnap.exists) throw new Error("Grant not found");
        grant = gSnap.data() || {};
        assertOrgAccess(user, grant);
        lineItems = Array.isArray(grant?.budget?.lineItems)
          ? grant.budget.lineItems.map((li: any) => ({ ...li }))
          : [];
      }

      const subSpendsSnap =
        removeSpends || (body.updateBudgets && paidToDelete.length > 0)
          ? await trx.get(eRef.collection("spends"))
          : null;
      const subSpendDocs = subSpendsSnap ? subSpendsSnap.docs : [];
      const subSpends = subSpendDocs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      // Include legacy embedded spends as supplementary source for reversal lookup (read-only; no longer written back)
      const legacyEmbedded = toSpendArray(e.spends);
      const spendUniverse = [...subSpends, ...legacyEmbedded.filter((s: any) => !subSpends.find((x) => String(x?.id) === String(s?.id)))];
      const reversedOf = new Set(
        spendUniverse
          .map((s: any) => String(s?.reversalOf || "").trim())
          .filter(Boolean)
      );

      const reversedSpendIds: string[] = [];
      const removedSpendSubdocIds: string[] = [];
      let reverseSeq = 0;

      if (body.updateBudgets && paidToDelete.length > 0) {
        const win = getGrantWindowISO(grant);
        const lineItemById = new Map(lineItems.map((li: any) => [String(li?.id || ""), li]));

        for (const p of paidToDelete) {
          const paymentId = String(p?.id || "").trim();
          const matches = spendUniverse.filter((s: any) => {
            if (String(s?.paymentId || "") !== paymentId) return false;
            if (s?.reversalOf) return false;
            const amt = Number(s?.amount || 0);
            if (!(Number.isFinite(amt) && amt > 0)) return false;
            if (reversedOf.has(String(s?.id || ""))) return false;
            return true;
          });

          for (const sp of matches) {
            const spendId = String(sp?.id || "").trim();
            const amt = Number(sp?.amount || 0);
            const lineItemId = String(sp?.lineItemId || p?.lineItemId || "").trim();
            if (!lineItemId) continue;
            const li = lineItemById.get(lineItemId);
            if (!li) continue;
            if (li.locked) throw new Error(`Line item locked: ${lineItemId}`);

            const dueDateISO = String(sp?.dueDate || p?.dueDate || p?.date || "").slice(0, 10);
            const inWin = /^\d{4}-\d{2}-\d{2}$/.test(dueDateISO) ? isInGrantWindow(dueDateISO, win) : false;

            li.spent = Math.max(0, Number(li.spent || 0) - amt);
            li.projected = Math.max(0, Number(li.projected || 0) + amt);
            if (inWin) {
              li.spentInWindow = Math.max(0, Number(li.spentInWindow || 0) - amt);
              li.projectedInWindow = Math.max(0, Number(li.projectedInWindow || 0) + amt);
            }
            const capNow = Number(li.amount || 0);
            const overNow = Math.max(0, (Number(li.spent || 0) + Number(li.projected || 0)) - capNow);
            if (overNow > 0) li.overCap = overNow;
            else delete li.overCap;

            if (reverseLedger) {
              reverseSeq += 1;
              const tsNow = Timestamp.now();
              const reversalId = `sp_${spendId || paymentId}_delrev_${Date.now()}_${reverseSeq}`;
              const dueMonth = /^\d{4}-\d{2}$/.test(String(sp?.dueMonth || "")) ? String(sp.dueMonth) : monthKey(dueDateISO);
              writeLedgerEntry(trx as any, {
                id: reversalId,
                source: "enrollment",
                orgId: grant?.orgId ?? e?.orgId ?? null,
                amount: -amt,
                amountCents: -Math.round(amt * 100),
                grantId: String(e?.grantId || ""),
                lineItemId,
                enrollmentId,
                paymentId,
                customerId: e?.customerId || null,
                caseManagerId: e?.caseManagerId || null,
                note: `DELETE_PAYMENT_REVERSAL of ${spendId || paymentId}`,
                vendor: sp?.vendor ?? p?.vendor ?? null,
                comment: sp?.comment ?? p?.comment ?? null,
                labels: ["payment_delete_reversal"],
                ts: tsNow,
                dueDate: dueDateISO || null,
                month: dueMonth || new Date().toISOString().slice(0, 7),
                origin: {
                  app: "hdb",
                  baseId: paymentId,
                  sourcePath: `customerEnrollments/${enrollmentId}/spends/${spendId || "unknown"}`,
                  reason: "paymentsDeleteRows",
                },
                grantNameAtSpend: sp?.grantNameAtSpend ?? e?.grantName ?? grant?.name ?? null,
                lineItemLabelAtSpend: sp?.lineItemLabelAtSpend ?? li?.label ?? li?.name ?? lineItemId,
                customerNameAtSpend: sp?.customerNameAtSpend ?? e?.customerName ?? e?.clientName ?? null,
                paymentLabelAtSpend: sp?.paymentLabelAtSpend ?? ((dueDateISO ? `${dueDateISO} · ` : "") + paymentTypeLabel(p)),
                createdAt: tsNow,
                updatedAt: tsNow,
              });
            }
            reversedSpendIds.push(spendId || paymentId);
          }
        }

        const baseTotals = computeBudgetTotals(lineItems as any[]);
        const projectedInWindow = lineItems.reduce((s: number, i: any) => s + Number(i?.projectedInWindow || 0), 0);
        const spentInWindow = lineItems.reduce((s: number, i: any) => s + Number(i?.spentInWindow || 0), 0);
        const totals = {
          ...baseTotals,
          remaining: baseTotals.balance,
          projectedSpend: baseTotals.projectedSpend,
          projectedInWindow,
          spentInWindow,
          windowBalance: Number(baseTotals.total || 0) - spentInWindow,
          windowProjectedBalance: Number(baseTotals.total || 0) - (spentInWindow + projectedInWindow),
        };
        trx.update(gRef!, {
          "budget.lineItems": lineItems,
          "budget.total": baseTotals.total,
          "budget.totals": totals,
          "budget.updatedAt": FieldValue.serverTimestamp(),
        });
      }

      const nextPayments = payments.filter((p) => !deleteIds.has(String(p?.id || "").trim()));
      if (removeSpends) {
        for (const doc of subSpendDocs) {
          const paymentId = String((doc.data() as any)?.paymentId || "").trim();
          if (!deleteIds.has(paymentId)) continue;
          trx.delete(doc.ref);
          removedSpendSubdocIds.push(doc.id);
        }
      }

      trx.update(eRef, {
        payments: nextPayments,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        enrollmentId,
        deletedPaymentIds: Array.from(deleteIds),
        skippedPaidIds,
        reversedSpendIds,
        removedSpendSubdocIds,
      };
    }, "paymentsDeleteRows");

    return res.status(200).json({
      ok: true,
      enrollmentId: result.enrollmentId,
      deletedPaymentIds: result.deletedPaymentIds,
      skippedPaidIds: result.skippedPaidIds,
      reversedSpendIds: result.reversedSpendIds,
      removedSpendSubdocIds: result.removedSpendSubdocIds,
      counts: {
        deletedPayments: result.deletedPaymentIds.length,
        skippedPaid: result.skippedPaidIds.length,
        reversedSpends: result.reversedSpendIds.length,
        removedSpendSubdocs: result.removedSpendSubdocIds.length,
      },
    });
  } catch (err: any) {
    console.error("[paymentsDeleteRows] ERROR", err?.message, err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

export const paymentsDeleteRows = secureHandler(
  async (req, res): Promise<void> => {
    await paymentsDeleteRowsHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);
