// functions/src/features/enrollments/migrate.ts
import {
  db,
  FieldValue,
  secureHandler,
  withTxn,
  requireOrg,
  teamIdsFromClaims,
  isDev,
  canAccessDoc,
  toDateOnly,
  computeBudgetTotals,
  Timestamp,
} from "../../core";
import { writeLedgerEntry } from "../ledger/service";
import { EnrollmentsMigrateBody } from "./schemas";

function latestPaymentDueDate(payments: any[]): string | null {
  let maxDue = "";
  for (const p of Array.isArray(payments) ? payments : []) {
    if ((p as any)?.void === true) continue;
    const due = String((p as any)?.dueDate || (p as any)?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;
    if (!maxDue || due > maxDue) maxDue = due;
  }
  return maxDue || null;
}

function closeFutureTasksAfter(dateISO: string, schedule: any[]) {
  const nowIso = new Date().toISOString();
  let changed = false;
  const next = (Array.isArray(schedule) ? schedule : []).map((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due <= dateISO) return t;
    if (t?.status === "verified" || t?.completed === true || String(t?.status || "").toLowerCase() === "done") return t;
    changed = true;
    return {
      ...t,
      completed: true,
      completedAt: t?.completedAt || nowIso,
      status: "done",
      notes: [String(t?.notes || "").trim(), `Auto-closed during migration cutover ${dateISO}`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 2000),
    };
  });
  return { changed, next };
}

function deleteFutureTasksAfter(dateISO: string, schedule: any[]) {
  const next = (Array.isArray(schedule) ? schedule : []).filter((t: any) => {
    const due = String(t?.dueDate || "").slice(0, 10);
    return !/^\d{4}-\d{2}-\d{2}$/.test(due) || due <= dateISO;
  });
  return { changed: next.length !== (Array.isArray(schedule) ? schedule.length : 0), next };
}

/**
 * POST /migrateEnrollment
 * Body: {
 *   enrollmentId: string;
 *   toGrantId: string;
 *   cutoverDate: string; // YYYY-MM-DD (required)
 *   lineItemMap?: Record<string,string>;
 *   closeSource?: boolean;
 *   moveSpends?: boolean;
 *   moveTasks?: boolean;
 *   preserveTaskIds?: boolean;
 *   movePaidPayments?: boolean;
 *   rebuildScheduleMeta?: boolean;
 * }
 */
export const migrateEnrollment = secureHandler(
  async (req, res) => {
    const user = (req as any).user || {};
    const callerOrgId = requireOrg(user);

    const parsed = EnrollmentsMigrateBody.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.message });
      return;
    }

    const {
      enrollmentId,
      toGrantId,
      cutoverDate,
      lineItemMap,
      closeSource = true,
      moveSpends = true,
      moveTasks = true,
      preserveTaskIds = false,
      movePaidPayments = true,
      rebuildScheduleMeta = true,
      closeSourceTaskMode = "complete",
      closeSourcePaymentMode = "deleteUnpaid",
    } = parsed.data;

    if (!enrollmentId || !toGrantId) {
      res.status(400).json({
        ok: false,
        error: "missing_enrollmentId_or_toGrantId",
      });
      return;
    }

    if (!cutoverDate) {
      res.status(400).json({
        ok: false,
        error: "missing_cutoverDate",
      });
      return;
    }

    let cutover: string;
    try {
      const raw = new Date(cutoverDate);
      if (!raw || Number.isNaN(raw.getTime())) {
        throw new Error("bad_date");
      }
      cutover = toDateOnly(raw);
    } catch {
      res.status(400).json({
        ok: false,
        error: "invalid_cutoverDate",
      });
      return;
    }

    const normalizeMap = (m: any) => {
      if (!m || typeof m !== "object") return {};
      const out: Record<string, string> = {};
      for (const k of Object.keys(m)) out[String(k)] = String(m[k]);
      return out;
    };
    const liMap = normalizeMap(lineItemMap);

    // Canonical migration record (used for undo)
    const migRef = db.collection("enrollmentMigrations").doc();
    const migrationId = migRef.id;

    const result = await withTxn(
      async (tx: FirebaseFirestore.Transaction) => {
        const eRef = db
          .collection("customerEnrollments")
          .doc(String(enrollmentId));
        const eSnap = await tx.get(eRef);
        if (!eSnap.exists) throw new Error("Source enrollment not found");
        const src: any = { id: eSnap.id, ...eSnap.data() };

        if (!canAccessDoc(user, src)) throw new Error("You dont have permission to do that.");

        const fromGrantRef = db.collection("grants").doc(String(src.grantId));
        const toGrantRef = db.collection("grants").doc(String(toGrantId));
        const [fromGrantSnap, toGrantSnap] = await Promise.all([
          tx.get(fromGrantRef),
          tx.get(toGrantRef),
        ]);
        if (!fromGrantSnap.exists) throw new Error("From grant not found");
        if (!toGrantSnap.exists) throw new Error("To grant not found");
        const fromGrant = fromGrantSnap.data() || {};
        const toGrant = toGrantSnap.data() || {};

        if (!isDev(user)) {
          if (fromGrant.orgId && fromGrant.orgId !== callerOrgId) {
            throw new Error("You dont have permission to adjust the source grant");
          }
          if (toGrant.orgId && toGrant.orgId !== callerOrgId) {
            throw new Error("You dont have permission to adjust the destination grant");
          }
        }

        // Pre-migration budget snapshots for perfect undo
        const fromBudgetBefore = fromGrant?.budget
          ? {
              ...fromGrant.budget,
              lineItems: Array.isArray(fromGrant.budget.lineItems)
                ? fromGrant.budget.lineItems.slice()
                : [],
            }
          : null;

        const toBudgetBefore = toGrant?.budget
          ? {
              ...toGrant.budget,
              lineItems: Array.isArray(toGrant.budget.lineItems)
                ? toGrant.budget.lineItems.slice()
                : [],
            }
          : null;

        const toItems = Array.isArray(toGrant?.budget?.lineItems)
          ? toGrant.budget.lineItems
          : [];
        const toById = Object.fromEntries(
          toItems.map((li: any) => [String(li.id), li])
        );
        const mapLI = (raw: any) => {
          const k = String(raw ?? "");
          return Object.prototype.hasOwnProperty.call(liMap, k)
            ? String(liMap[k])
            : k;
        };

        const pays = Array.isArray(src.payments) ? src.payments : [];
        const isFutureUnpaid = (p: any) =>
          !p?.paid &&
          String(p?.dueDate || "").slice(0, 10) >= String(cutover || "");

        const futurePays = pays.filter(isFutureUnpaid);
        const stayPays = pays.filter((p: any) => !isFutureUnpaid(p));

        const destPays = futurePays.map((p: any) => {
          const mapped = mapLI(p.lineItemId);
          if (!mapped)
            throw new Error(
              `Missing lineItem mapping for "${p.lineItemId}"`
            );
          if (!toById[mapped])
            throw new Error(
              `Destination grant missing lineItemId "${mapped}"`
            );
          const { id, paid, paidAt, ...rest } = p;
          return { ...rest, lineItemId: mapped, paid: false, paidAt: null };
        });

        const fromItems = Array.isArray(fromGrant?.budget?.lineItems)
          ? fromGrant.budget.lineItems.slice()
          : [];
        const toItemsW = toItems.slice();
        const fromById = Object.fromEntries(
          fromItems.map((li: any) => [String(li.id), li])
        );
        const toByIdW = Object.fromEntries(
          toItemsW.map((li: any) => [String(li.id), li])
        );

        const sumUnpaidByLI = (arr: any[]) =>
          arr.reduce((m: any, p: any) => {
            const k = String(p.lineItemId || "");
            const a = Number(p.amount || 0);
            if (k && a > 0) m[k] = (m[k] || 0) + a;
            return m;
          }, {} as Record<string, number>);

        const fromProj = sumUnpaidByLI(futurePays);
        const toProj = sumUnpaidByLI(destPays);

        // Adjust projected
        for (const [id, amt] of Object.entries(fromProj)) {
          const li: any = fromById[String(id)];
          if (!li) continue;
          li.projected = Math.max(
            0,
            Number(li.projected || 0) - Number(amt || 0)
          );
        }
        for (const [id, amt] of Object.entries(toProj)) {
          const li: any = toByIdW[String(id)];
          if (!li) continue;
          li.projected = Number(li.projected || 0) + Number(amt || 0);
        }

        let movedSpendCount = 0;
        let futureSpends: any[] = [];
        let fromSpentByLI: Record<string, number> = {};
        let toSpentByLI: Record<string, number> = {};
        const ledgerFromIds: string[] = [];
        const ledgerToIds: string[] = [];
        const reversalSpendIds: string[] = [];

        if (moveSpends) {
          const finiteNonZero = (value: unknown): number | null => {
            const n = Number(value);
            return Number.isFinite(n) && n !== 0 ? n : null;
          };
          const spendsQ = eRef
            .collection("spends")
            .where("dueDate", ">=", cutover);
          const spendsSnap = await tx.get(spendsQ);
          futureSpends = spendsSnap.docs
            .map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
              id: d.id,
              ...d.data(),
            }))
            .filter((s: any) => finiteNonZero(s?.amount) !== null)
            .map((s: any) => ({ ...s, amount: Number(s.amount) }));

          if (movePaidPayments && futureSpends.length) {
            const sumSpentByLI = (arr: any[]) =>
              arr.reduce((m: any, s: any) => {
                const k = String(s.lineItemId || "");
                const a = Number(s.amount || 0);
                if (k && Number.isFinite(a) && a !== 0) m[k] = (m[k] || 0) + a;
                return m;
              }, {} as Record<string, number>);

            const fromSpent = sumSpentByLI(futureSpends);
            const toSpent = sumSpentByLI(
              futureSpends.map((s) => ({
                ...s,
                lineItemId: mapLI(s.lineItemId),
              }))
            );

            fromSpentByLI = fromSpent;
            toSpentByLI = toSpent;

            // Adjust spent on from/to grants
            for (const [id, amt] of Object.entries(fromSpent)) {
              const li: any = fromById[String(id)];
              if (!li) continue;
              li.spent = Math.max(
                0,
                Number(li.spent || 0) - Number(amt || 0)
              );
            }
            for (const [id, amt] of Object.entries(toSpent)) {
              const li: any = toByIdW[String(id)];
              if (!li) continue;
              li.spent = Number(li.spent || 0) + Number(amt || 0);
            }
          }
        }

        const taskSchedule = Array.isArray(src.taskSchedule)
          ? src.taskSchedule.slice()
          : Array.isArray(src.taskSchedule)
          ? src.taskSchedule.slice()
          : [];
        const isFutureTask = (t: any) =>
          String(t?.dueDate || "").slice(0, 10) >= String(cutover || "");
        const futureTasks = moveTasks
          ? taskSchedule.filter(isFutureTask)
          : [];
        const stayTasks = moveTasks
          ? taskSchedule.filter((t: any) => !isFutureTask(t))
          : taskSchedule;

        const newTaskId = (t: any) =>
          `task_${String(t.type || "task")}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        const clonedTasks = futureTasks.map((t: any) => {
          const base = { ...t };
          if (!preserveTaskIds) base.id = newTaskId(t);
          base.migratedFrom = {
            enrollmentId: src.id,
            grantId: src.grantId,
            cutover,
          };
          return base;
        });

        const markOverCap = (items: any[]) => {
          for (const li of items) {
            const cap = Number(li.amount || 0);
            const over = Math.max(
              0,
              (Number(li.spent || 0) + Number(li.projected || 0)) - cap
            );
            if (over > 0) li.overCap = over;
            else delete li.overCap;
          }
        };

        markOverCap(fromItems);
        markOverCap(toItemsW);

        const fromTotals = computeBudgetTotals(fromItems as any[]);
        const toTotals = computeBudgetTotals(toItemsW as any[]);

        const fromTotalsFull: any = {
          ...fromTotals,
          projectedSpend: fromTotals.projectedSpend,
          // legacy behavior: remaining == balance
          remaining: fromTotals.balance,
        };
        const toTotalsFull: any = {
          ...toTotals,
          projectedSpend: toTotals.projectedSpend,
          remaining: toTotals.balance,
        };

        const destRef = db.collection("customerEnrollments").doc();

        const destScheduleMeta = (() => {
          if (!rebuildScheduleMeta && src?.scheduleMeta?.version === 1)
            return { ...src.scheduleMeta, migratedOut: undefined };
          return {
            mode: "migrated",
            cutover,
            defaultEditMode: "keepManual",
            fromEnrollmentId: src.id,
            fromGrantId: src.grantId,
            lineItemMapSnapshot: liMap,
          };
        })();

        const destOrgId = src.orgId || callerOrgId;
        const destTeamIds = Array.from(
          new Set([
            destOrgId,
            ...(src.teamIds || []),
            ...teamIdsFromClaims(user),
          ])
        ).slice(0, 10);

        const dest = {
          id: destRef.id,
          orgId: destOrgId,
          teamIds: destTeamIds,

          grantId: String(toGrantId),
          grantName: String((toGrant as any)?.name || toGrantId),
          customerId: src.customerId,
          customerName: src.customerName || src.clientName || null,
          clientName: src.clientName || src.customerName || null,
          name: String((toGrant as any)?.name || toGrantId)
            ? `${String((toGrant as any)?.name || toGrantId)} - ${cutover}`
            : undefined,
          startDate: cutover,
          endDate: null,
          active: true,
          status: "active",
          deleted: false,

          scheduleMeta: destScheduleMeta,
          payments: destPays,
          spends: [],
          taskSchedule: moveTasks ? clonedTasks : undefined,
          migratedFrom: {
            enrollmentId: src.id,
            grantId: src.grantId,
            cutover,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(destRef, dest);

        // ---------- Ledger adjustments for moved paid spends ----------
        if (moveSpends && futureSpends.length && movePaidPayments) {
          const tsNow = Timestamp.now();
          const orgFrom = fromGrant.orgId || callerOrgId;
          const orgTo = toGrant.orgId || callerOrgId;

          const baseOrigin = {
            app: "hdb" as const,
            baseId: src.id,
            sourcePath: `customerEnrollments/${src.id}`,
            idempotencyKey: null,
          };

          // Reverse net future spend on source grant
          for (const [liId, amtRaw] of Object.entries(fromSpentByLI)) {
            const amt = Number(amtRaw || 0);
            if (!amt) continue;

            const ledgerId = `mig_from_${src.id}_${String(
              liId
            )}_${Date.now()}`;
            writeLedgerEntry(tx as any, {
              id: ledgerId,
              source: "migration" as const,
              orgId: orgFrom,

              amount: -amt,
              amountCents: Math.round(-amt * 100),

              grantId: String(src.grantId),
              lineItemId: String(liId),
              enrollmentId: src.id,
              customerId: src.customerId || null,

              dueDate: cutover,
              ts: tsNow,
              origin: baseOrigin,
              note: `Migration: moved future spends from ${src.grantId} to ${toGrantId}`,
            });
            ledgerFromIds.push(ledgerId);
          }

          // Apply net future spend on destination grant
          for (const [liId, amtRaw] of Object.entries(toSpentByLI)) {
            const amt = Number(amtRaw || 0);
            if (!amt) continue;

            const ledgerId = `mig_to_${src.id}_${String(liId)}_${Date.now()}`;
            writeLedgerEntry(tx as any, {
              id: ledgerId,
              source: "migration" as const,
              orgId: orgTo,

              amount: amt,
              amountCents: Math.round(amt * 100),

              grantId: String(toGrantId),
              lineItemId: String(liId),
              enrollmentId: destRef.id,
              customerId: src.customerId || null,

              dueDate: cutover,
              ts: tsNow,
              origin: {
                ...baseOrigin,
                sourcePath: `customerEnrollments/${destRef.id}`,
              },
              note: `Migration: moved future spends from ${src.grantId} to ${toGrantId}`,
            });
            ledgerToIds.push(ledgerId);
          }

          // Enrollment-level spends: reverse in source, clone into destination
          for (const s of futureSpends) {
            const newLI = mapLI(s.lineItemId);
            if (newLI && !toByIdW[newLI]) {
              throw new Error(
                `Destination missing lineItemId "${newLI}"`
              );
            }
            const revId = `rev_${s.id}_${Date.now()}`;
            tx.set(eRef.collection("spends").doc(revId), {
              ...s,
              id: revId,
              amount: -Math.abs(Number(s.amount || 0)),
              note: Array.from(
                new Set([
                  ...(Array.isArray(s.note)
                    ? s.note
                    : s.note
                    ? [s.note]
                    : []),
                  `Reversal: Migrated to ${toGrantId}`,
                ])
              ).slice(0, 10),
              migratedReversalOf: s.id,
              updatedAt: FieldValue.serverTimestamp(),
            });
            reversalSpendIds.push(revId);

            tx.set(destRef.collection("spends").doc(s.id), {
              ...s,
              enrollmentId: destRef.id,
              grantId: toGrantId,
              lineItemId: newLI,
              grantNameAtSpend: toGrant?.name || toGrantId,
              note: Array.from(
                new Set([
                  ...(Array.isArray(s.note)
                    ? s.note
                    : s.note
                    ? [s.note]
                    : []),
                  `Migrated from ${src.grantId}`,
                ])
              ).slice(0, 10),
              migratedFromSpendId: s.id,
              updatedAt: FieldValue.serverTimestamp(),
            });
            movedSpendCount++;
          }
        }

        let sourcePayments = stayPays;
        let sourceTaskSchedule = moveTasks ? stayTasks : taskSchedule;

        if (closeSource) {
          if (closeSourcePaymentMode === "deleteUnpaid") {
            sourcePayments = sourcePayments.filter((p: any) => {
              const due = String(p?.dueDate || p?.date || "").slice(0, 10);
              const isFuture = /^\d{4}-\d{2}-\d{2}$/.test(due) && due > cutover;
              return !(isFuture && !p?.paid);
            });
          } else if (closeSourcePaymentMode === "spendUnpaid") {
            const remainingFutureUnpaid = sourcePayments.filter((p: any) => {
              const due = String(p?.dueDate || p?.date || "").slice(0, 10);
              return /^\d{4}-\d{2}-\d{2}$/.test(due) && due > cutover && !p?.paid;
            });
            if (remainingFutureUnpaid.length) {
              throw new Error("migrate_close_source_spend_unpaid_not_supported");
            }
          }

          if (closeSourceTaskMode === "delete") {
            sourceTaskSchedule = deleteFutureTasksAfter(cutover, sourceTaskSchedule).next;
          } else {
            sourceTaskSchedule = closeFutureTasksAfter(cutover, sourceTaskSchedule).next;
          }

          const lastPaymentDate = latestPaymentDueDate(sourcePayments);
          if (lastPaymentDate && cutover < lastPaymentDate) {
            const err: any = new Error(`close_date_before_last_payment (${cutover} < ${lastPaymentDate})`);
            err.meta = { closeDate: cutover, lastPaymentDate };
            throw err;
          }
        }

        const sourcePatch: any = {
          payments: sourcePayments,
          taskSchedule: sourceTaskSchedule,
          migratedTo: {
            enrollmentId: destRef.id,
            grantId: toGrantId,
            cutover,
          },
          scheduleMeta: {
            ...(src.scheduleMeta || {}),
            migratedOut: {
              toEnrollmentId: destRef.id,
              toGrantId,
              cutover,
            },
          },
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (closeSource) {
          Object.assign(sourcePatch, {
            active: false,
            status: "closed",
            endDate: cutover,
          });
        }
        tx.update(eRef, sourcePatch);

        tx.update(fromGrantRef, {
          "budget.lineItems": fromItems,
          "budget.total": fromTotals.total,
          "budget.totals": fromTotalsFull,
          "budget.updatedAt": FieldValue.serverTimestamp(),
        });

        tx.update(toGrantRef, {
          "budget.lineItems": toItemsW,
          "budget.total": toTotals.total,
          "budget.totals": toTotalsFull,
          "budget.updatedAt": FieldValue.serverTimestamp(),
        });

        // Existing audit flag
        tx.set(db.collection("auditFlags").doc(), {
          context: "migrateEnrollment",
          enrollmentId: src.id,
          fromGrantId: src.grantId,
          toGrantId,
          cutover,
          moved: {
            projections: destPays.length,
            spends: movedSpendCount,
            tasks: moveTasks ? clonedTasks.length : 0,
          },
          options: {
            closeSource,
            moveSpends,
            moveTasks,
            preserveTaskIds,
            movePaidPayments,
            rebuildScheduleMeta,
            closeSourceTaskMode,
            closeSourcePaymentMode,
          },
          timestamp: FieldValue.serverTimestamp(),
        });

        // Canonical migration record for undo
        tx.set(migRef, {
          id: migrationId,
          type: "enrollmentMigration",
          orgId: src.orgId || callerOrgId,
          fromEnrollmentId: src.id,
          toEnrollmentId: destRef.id,
          fromGrantId: src.grantId,
          toGrantId,
          cutover,
          options: {
            closeSource,
            moveSpends,
            moveTasks,
            preserveTaskIds,
            movePaidPayments,
            rebuildScheduleMeta,
            closeSourceTaskMode,
            closeSourcePaymentMode,
          },
          snapshots: {
            sourceEnrollment: src,
            fromGrantBudget: fromBudgetBefore,
            toGrantBudget: toBudgetBefore,
          },
          artifacts: {
            futurePayments: futurePays,
            stayPayments: stayPays,
            destPayments: destPays,
            futureSpends,
            taskSchedule,
            futureTasks,
            stayTasks,
            ledgerFromIds,
            ledgerToIds,
            reversalSpendIds,
          },
          createdAt: FieldValue.serverTimestamp(),
          createdBy: {
            uid: (user as any)?.uid || null,
            email:
              String((user as any)?.email || "").toLowerCase() || null,
            name: (user as any)?.name || (user as any)?.displayName || null,
          },
          undone: false,
          undoneAt: null,
          undoneBy: null,
        });

        return {
          ok: true,
          migrationId,
          fromId: src.id,
          toId: destRef.id,
          fromGrantId: src.grantId,
          toGrantId,
        };
      },
      "migrateEnrollment"
    );

    res.status(200).json(result);
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);

/**
 * POST /undoEnrollmentMigration
 * Body: { migrationId: string }
 *
 * Strict undo:
 * - Restores source enrollment snapshot
 * - Deletes destination enrollment
 * - Deletes cloned/reversal spends
 * - Restores both grant budgets to their pre-migration budget object
 * - Writes compensating ledger entries (net effect 0)
 * - Marks migration as undone; idempotent.
 */
export const undoEnrollmentMigration = secureHandler(
  async (req, res) => {
    const user = (req as any).user || {};
    const callerOrgId = requireOrg(user);

    const { migrationId } = req.body || {};
    if (!migrationId) {
      res
        .status(400)
        .json({ ok: false, error: "missing_migrationId" });
      return;
    }

    try {
      const out = await withTxn(
        async (tx: FirebaseFirestore.Transaction) => {
          const migRef = db
            .collection("enrollmentMigrations")
            .doc(String(migrationId));
          const migSnap = await tx.get(migRef);
          if (!migSnap.exists) throw new Error("migration_not_found");
          const mig: any = migSnap.data() || {};

          if (mig.undone) {
            return {
              alreadyUndone: true,
              migrationId,
              fromEnrollmentId: mig.fromEnrollmentId,
              toEnrollmentId: mig.toEnrollmentId,
              fromGrantId: mig.fromGrantId,
              toGrantId: mig.toGrantId,
            };
          }

          if (!isDev(user)) {
            const migOrgId =
              mig.orgId ||
              mig.snapshots?.sourceEnrollment?.orgId ||
              null;
            if (migOrgId && migOrgId !== callerOrgId) {
              const err: any = new Error("forbidden_migration_org");
              err.code = 403;
              throw err;
            }
          }

          const fromEnrollmentId = String(mig.fromEnrollmentId || "");
          const toEnrollmentId = mig.toEnrollmentId
            ? String(mig.toEnrollmentId)
            : null;
          const fromGrantId = String(mig.fromGrantId || "");
          const toGrantId = mig.toGrantId ? String(mig.toGrantId) : null;
          const cutover = String(mig.cutover || "");

          if (!fromEnrollmentId || !fromGrantId) {
            throw new Error("migration_snapshot_incomplete");
          }

          const srcSnapshot = mig.snapshots?.sourceEnrollment;
          const fromBudgetBefore = mig.snapshots?.fromGrantBudget;
          const toBudgetBefore = mig.snapshots?.toGrantBudget;

          if (!srcSnapshot || !fromBudgetBefore) {
            throw new Error("migration_not_reversible");
          }

          const fromEnrRef = db
            .collection("customerEnrollments")
            .doc(fromEnrollmentId);
          const fromGrantRef = db
            .collection("grants")
            .doc(fromGrantId);

          const toEnrRef = toEnrollmentId
            ? db.collection("customerEnrollments").doc(toEnrollmentId)
            : null;
          const toGrantRef = toGrantId
            ? db.collection("grants").doc(toGrantId)
            : null;

          const ledgerFromIds: string[] =
            mig.artifacts?.ledgerFromIds || [];
          const ledgerToIds: string[] = mig.artifacts?.ledgerToIds || [];
          const futureSpends: any[] = mig.artifacts?.futureSpends || [];
          const reversalSpendIds: string[] =
            mig.artifacts?.reversalSpendIds || [];

          // 1) Restore source enrollment snapshot
          tx.set(fromEnrRef, srcSnapshot, { merge: false });

          // 2) Delete destination enrollment + its cloned spends
          if (toEnrRef && toEnrollmentId) {
            for (const s of futureSpends) {
              if (!s?.id) continue;
              tx.delete(
                toEnrRef.collection("spends").doc(String(s.id))
              );
            }
            tx.delete(toEnrRef);
          }

          // 3) Delete reversal spends on source enrollment
          for (const rid of reversalSpendIds) {
            tx.delete(fromEnrRef.collection("spends").doc(String(rid)));
          }

          // 4) Restore budgets to pre-migration state
          tx.set(
            fromGrantRef,
            {
              budget: fromBudgetBefore,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          if (toGrantRef && toBudgetBefore) {
            tx.set(
              toGrantRef,
              {
                budget: toBudgetBefore,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }

          // 5) Ledger compensation: net out migration rows
          const tsNow = Timestamp.now();

          const undoRows = async (ids: string[]) => {
            for (const id of ids) {
              const ref = db.collection("ledger").doc(String(id));
              const snap = await tx.get(ref);
              if (!snap.exists) continue;
              const row: any = snap.data() || {};
              const amt = Number(row.amount || 0);
              const amtCents = Number(row.amountCents || 0);
              if (!amt && !amtCents) continue;

              const undoId = `${id}_undo`;
              writeLedgerEntry(tx as any, {
                id: undoId,
                source: row.source || "system",
                orgId: row.orgId || null,

                amount: -amt,
                amountCents: -amtCents || undefined,

                grantId: row.grantId || null,
                lineItemId: row.lineItemId || null,
                enrollmentId: row.enrollmentId || null,
                paymentId: row.paymentId || null,
                customerId: row.customerId || null,
                caseManagerId: row.caseManagerId || null,

                note:
                  Array.isArray(row.note) && row.note.length
                    ? [...row.note, "UNDO_MIGRATION"].slice(0, 10)
                    : row.note
                    ? [row.note, "UNDO_MIGRATION"].slice(0, 10)
                    : ["UNDO_MIGRATION"],

                dueDate: row.dueDate || cutover || null,
                month: row.month || null,

                ts: tsNow,
                origin: {
                  app: "hdb",
                  baseId: row.id || id,
                  sourcePath: `ledger/${id}`,
                  idempotencyKey: `undoMig:${migrationId}:${id}`,
                },

                grantNameAtSpend: row.grantNameAtSpend || null,
                lineItemLabelAtSpend: row.lineItemLabelAtSpend || null,
                clientNameAtSpend: row.clientNameAtSpend || null,
                paymentLabelAtSpend: row.paymentLabelAtSpend || null,

                createdAt: tsNow,
                updatedAt: tsNow,
              });
            }
          };

          await undoRows(ledgerFromIds);
          await undoRows(ledgerToIds);

          // 6) Mark migration as undone
          tx.set(
            migRef,
            {
              undone: true,
              undoneAt: FieldValue.serverTimestamp(),
              undoneBy: {
                uid: (user as any)?.uid || null,
                email:
                  String((user as any)?.email || "").toLowerCase() ||
                  null,
                name:
                  (user as any)?.name ||
                  (user as any)?.displayName ||
                  null,
              },
            },
            { merge: true }
          );

          // 7) Audit flag for undo
          tx.set(db.collection("auditFlags").doc(), {
            context: "undoEnrollmentMigration",
            migrationId,
            enrollmentId: fromEnrollmentId,
            destEnrollmentId: toEnrollmentId,
            fromGrantId,
            toGrantId,
            cutover,
            timestamp: FieldValue.serverTimestamp(),
          });

          return {
            alreadyUndone: false,
            migrationId,
            fromEnrollmentId,
            toEnrollmentId,
            fromGrantId,
            toGrantId,
          };
        },
        "undoEnrollmentMigration"
      );

      res.status(200).json({ ok: true, ...out });
    } catch (err: any) {
      const code = (err as any)?.code || 500;
      res.status(code === 403 ? 403 : 500).json({
        ok: false,
        error: err?.message || "failed_to_undo_migration",
      });
    }
  },
  { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] }
);
