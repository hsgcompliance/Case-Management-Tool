// functions/src/features/enrollments/adminReverseLedgerEntry.ts
import {
  db,
  FieldValue,
  Timestamp,
  secureHandler,
  withTxn,
  requireOrg,
} from "../../core";
import { writeLedgerEntry } from "../ledger/service";

const KEEP_RECENT_SPENDS = 50;
const monthKey = (iso: string) => String(iso || "").slice(0, 7); // 'YYYY-MM'

const makeIdempoKey = (parts: (string | number | null | undefined)[]) =>
  parts.map((p) => String(p ?? "")).join("|");

const removeUndefinedDeep = (value: any): any => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(removeUndefinedDeep);
  const out: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = removeUndefinedDeep(v);
  }
  return out;
};

/**
 * Admin-only reversal tool starting from a ledger row.
 *
 * Modes:
 *  - 'ledger' → write a compensating ledger/spend entry, do NOT touch grant.budget.*
 *  - 'budget' → adjust grant.budget.* as if this ledger row never happened, no ledger write
 *  - 'both'   → do both
 *
 * IMPORTANT:
 *  - Does NOT change payments[].paid or cmMonth.* counters.
 *  - Idempotent per (ledgerId, mode).
 *  - Tries to obey "all required reads before writes" ordering.
 */
export const adminReverseLedgerEntry = secureHandler(
  async (req, res) => {
    const user = (req as any).user || {};
    // Enforce org scope; actual "admin" restriction can be done via claims / API gateway.
    requireOrg(user);

    const { ledgerId, mode } = (req.body || {}) as {
      ledgerId?: string;
      mode?: "ledger" | "budget" | "both" | string;
    };

    if (!ledgerId) {
      res.status(400).json({ ok: false, error: "Missing ledgerId" });
      return;
    }

    const effectiveMode: "ledger" | "budget" | "both" =
      mode === "ledger" || mode === "budget" || mode === "both"
        ? mode
        : "both";

    try {
      await withTxn(
        async (tx: FirebaseFirestore.Transaction) => {
          // ---------- 1) REQUIRED LEDGER READ ----------
          const ledRef = db.collection("ledger").doc(String(ledgerId));
          const ledSnap = await tx.get(ledRef);
          if (!ledSnap.exists) throw new Error("Ledger entry not found");

          const led: any = ledSnap.data() || {};
          const grantId = led.grantId;
          const lineItemId = led.lineItemId || null;
          const enrollmentId = led.enrollmentId || null;
          const paymentId = led.paymentId || led.origin?.baseId || null;
          const cmUid = led.caseManagerId || null;

          if (!grantId) throw new Error("Ledger entry missing grantId");
          if (!lineItemId) throw new Error("Ledger entry missing lineItemId");

          const amountCentsOrig = Number(led.amountCents ?? 0);
          if (!Number.isFinite(amountCentsOrig) || amountCentsOrig === 0) {
            throw new Error("Invalid amountCents on ledger entry");
          }

          const amountOrig =
            typeof led.amount === "number"
              ? Number(led.amount)
              : amountCentsOrig / 100;

          const sign = amountOrig >= 0 ? 1 : -1;
          const amt = Math.abs(amountOrig);
          if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("Invalid amount on ledger entry");
          }

          const dueDateISO = String(led.dueDate || "").slice(0, 10);
          const dueMonthRaw = led.month || monthKey(dueDateISO);
          const dueMonth =
            /^\d{4}-\d{2}$/.test(String(dueMonthRaw || ""))
              ? String(dueMonthRaw)
              : monthKey(dueDateISO);

          // ---------- 2) IDEMPOTENCY READ ----------
          const idemKey = makeIdempoKey([
            "adminReverseLedgerEntry",
            ledgerId,
            effectiveMode,
          ]);
          const idemRef = db.collection("idempotency").doc(idemKey);
          const idemSnap = await tx.get(idemRef);
          if (idemSnap.exists) {
            // Already processed successfully – no further writes
            return;
          }

          // ---------- 3) CONDITIONAL READS: GRANT + ENROLLMENT ----------
          let gRef: FirebaseFirestore.DocumentReference | null = null;
          let grant: any = null;
          let lineItems: any[] = [];

          if (effectiveMode === "budget" || effectiveMode === "both") {
            gRef = db.collection("grants").doc(String(grantId));
            const gSnap = await tx.get(gRef);
            if (!gSnap.exists) throw new Error("Grant not found for ledger entry");

            grant = gSnap.data() || {};
            lineItems = Array.isArray(grant?.budget?.lineItems)
              ? grant.budget.lineItems
              : [];

            const li = lineItems.find(
              (x: any) => String(x.id) === String(lineItemId)
            );
            if (!li) throw new Error("Line item missing on grant.budget");
            if (li.locked) throw new Error("Line item is locked");
          }

          let eRef: FirebaseFirestore.DocumentReference | null = null;
          let enr: any = null;
          let spendsArr: any[] = [];

          if (effectiveMode === "ledger" || effectiveMode === "both") {
            if (!enrollmentId) {
              throw new Error(
                "Ledger entry missing enrollmentId; cannot write compensating spend"
              );
            }

            // v2 collection name
            eRef = db
              .collection("customerEnrollments")
              .doc(String(enrollmentId));
            const eSnap = await tx.get(eRef);
            if (!eSnap.exists)
              throw new Error("Enrollment not found for ledger entry");

            enr = eSnap.data() || {};
            spendsArr = Array.isArray(enr.spends) ? enr.spends.slice() : [];
          }

          // ---------- 4) ALL READS ARE DONE. NOW PREPARE WRITES ----------
          const reverseAmount = -amountOrig;
          const reverseAmountCents = -amountCentsOrig;
          const tsNow = Timestamp.now();

          // ---------- 4a) BUDGET BRANCH WRITES ----------
          if (effectiveMode === "budget" || effectiveMode === "both") {
            const lineItemsMut = Array.isArray(lineItems)
              ? lineItems.map((li: any) => ({ ...li }))
              : [];

            const idx = lineItemsMut.findIndex(
              (x: any) => String(x.id) === String(lineItemId)
            );
            if (idx === -1)
              throw new Error("Line item missing on grant.budget");

            const li = lineItemsMut[idx];
            const cap = Number(li.amount || 0);

            if (sign > 0) {
              // Original was a positive spend → reversing it
              li.spent = Math.max(0, Number(li.spent || 0) - amt);
              const maxProj = Math.max(0, cap - li.spent);
              li.projected = Math.min(
                maxProj,
                Number(li.projected || 0) + amt
              );
            } else {
              // Original was a negative (reversal) → undo the reversal
              li.projected = Math.max(
                0,
                Number(li.projected || 0) - amt
              );
              li.spent = Number(li.spent || 0) + amt;
            }

            // Recompute overCap
            const capNow = Number(li.amount || 0);
            const overNow = Math.max(
              0,
              (Number(li.spent || 0) + Number(li.projected || 0)) - capNow
            );
            if (overNow > 0) li.overCap = overNow;
            else delete li.overCap;

            // Recompute totals (align with v2 budget.totals)
            const totalCap = lineItemsMut.reduce(
              (s: number, i: any) => s + Number(i.amount || 0),
              0
            );
            const spent = lineItemsMut.reduce(
              (s: number, i: any) => s + Number(i.spent || 0),
              0
            );
            const projected = lineItemsMut.reduce(
              (s: number, i: any) => s + Number(i.projected || 0),
              0
            );
            const balance = totalCap - spent;
            const projectedBalance = totalCap - (spent + projected);

            const totalsFull = {
              total: totalCap,
              spent,
              balance,
              projected,
              projectedBalance,
              // legacy compatibility
              remaining: balance,
            };

            tx.update(gRef!, {
              "budget.lineItems": lineItemsMut,
              "budget.total": totalCap,
              "budget.totals": totalsFull,
              "budget.updatedAt": FieldValue.serverTimestamp(),
            });
          }

          // ---------- 4b) LEDGER BRANCH WRITES ----------
          if (effectiveMode === "ledger" || effectiveMode === "both") {
            const newId = `sp_${enrollmentId}_${paymentId || "manual"}_adminrev_${Date.now()}`;

            const customerId =
              led.customerId ||
              enr?.customerId ||
              led.clientId ||
              enr?.clientId ||
              null;

            const clientNameAtSpend =
              led.clientNameAtSpend ||
              enr?.customerName ||
              enr?.clientName ||
              enr?.customer?.name ||
              enr?.client?.name ||
              customerId ||
              enrollmentId;

            const grantNameAtSpend =
              led.grantNameAtSpend || enr?.grantName || grantId;

            const lineItemLabelAtSpend =
              led.lineItemLabelAtSpend ||
              (Array.isArray(enr?.budgetLineItems)
                ? enr.budgetLineItems.find(
                    (li: any) => String(li.id) === String(lineItemId)
                  )?.label
                : null) ||
              lineItemId;

            const paymentLabelAtSpend =
              led.paymentLabelAtSpend ||
              (dueDateISO
                ? `${dueDateISO} · Admin reversal`
                : "Admin reversal");

            const noteParts = [
              led.note || null,
              `ADMIN_REVERSAL(${effectiveMode}) of ${ledgerId}`,
            ]
              .map((x) => String(x || "").trim())
              .filter(Boolean);

            const spendEntry: any = {
              id: newId,
              grantId,
              grantNameAtSpend,
              enrollmentId,
              customerId,
              clientNameAtSpend,
              caseManagerId: cmUid || enr?.caseManagerId || null,

              paymentId,
              paymentType: led.paymentType || "admin",
              paymentLabelAtSpend,

              lineItemId,
              lineItemLabelAtSpend,

              amount: reverseAmount,
              amountCents: reverseAmountCents,

              note: noteParts.join(" * ") || null,
              ts: tsNow,
              dueDate: dueDateISO || null,
              dueMonth: /^\d{4}-\d{2}$/.test(dueMonth) ? dueMonth : null,
              reversalOf: ledgerId,

              byUid: (user as any)?.uid || "",
              byName:
                (user as any)?.name ||
                (user as any)?.displayName ||
                "",
              by: {
                uid: (user as any)?.uid || "",
                email: String((user as any)?.email || "").toLowerCase(),
                name:
                  (user as any)?.name ||
                  (user as any)?.displayName ||
                  "",
              },

              paymentSnapshot: led.paymentSnapshot || undefined,
              idempotencyKey: idemKey,
            };

            const safeSpendEntry = removeUndefinedDeep(spendEntry);
            const updatedSpends = [...spendsArr, safeSpendEntry].slice(
              -KEEP_RECENT_SPENDS
            );

            // Enrollment main doc
            tx.update(eRef!, {
              spends: updatedSpends,
              updatedAt: FieldValue.serverTimestamp(),
            });

            // Enrollment subdoc
            tx.set(
              eRef!.collection("spends").doc(newId),
              safeSpendEntry
            );

            // Ledger compensating entry – use shared helper so grantMonth stays consistent
            writeLedgerEntry(tx as any, {
              id: newId,
              source: led.source || "adminReverse",
              orgId: led.orgId || null,

              amount: reverseAmount,
              amountCents: reverseAmountCents,

              grantId,
              lineItemId,
              enrollmentId,
              paymentId,
              customerId,
              caseManagerId: cmUid || led.caseManagerId || null,

              note: safeSpendEntry.note ?? led.note ?? null,
              dueDate: led.dueDate || dueDateISO || null,
              month: dueMonth,

              ts: tsNow,
              origin: {
                ...(led.origin || {}),
                parentLedgerId: ledgerId,
                adminMode: effectiveMode,
                idempotencyKey: idemKey,
              },

              grantNameAtSpend,
              lineItemLabelAtSpend,
              clientNameAtSpend,
              paymentLabelAtSpend,

              createdAt: tsNow,
              updatedAt: tsNow,
            });
          }

          // ---------- 4c) IDEMPOTENCY WRITE (LAST) ----------
          tx.set(idemRef, {
            key: idemKey,
            function: "adminReverseLedgerEntry",
            ledgerId,
            mode: effectiveMode,
            createdAt: FieldValue.serverTimestamp(),
          });
        },
        "adminReverseLedgerEntry"
      );

      res.status(200).json({ ok: true, mode: effectiveMode });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(
        "[adminReverseLedgerEntry] ERROR",
        err?.message || err,
        err
      );
      const msg = String(err?.message || err);
      const status =
        msg.includes("not found") || msg.includes("Missing") ? 400 : 500;
      res.status(status).json({ ok: false, error: msg });
    }
  },
  {
    auth: "user",           // you can tighten this to a stricter role if secureHandler supports it
    requireOrg: true,
    methods: ["POST", "OPTIONS"],
  }
);
