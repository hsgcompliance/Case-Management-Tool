import {
  db,
  FieldValue,
  canAccessDoc,
  requireOrg,
  secureHandler,
  type AuthedRequest,
} from "../../core";
import {
  EnrollmentsAllocationSetBody,
  EnrollmentsContinuumSummaryQuery,
  EnrollmentsCycleRolloverPreviewBody,
  EnrollmentsCycleRolloverRunBody,
} from "./schemas";
import { migrateEnrollmentHandler } from "./migrate";
import { summarize } from "../tasks/utils";

type Row = Record<string, any> & { id: string };

const iso10 = (value: unknown) => String(value || "").slice(0, 10);
const isOpen = (row: Row) =>
  row.deleted !== true && String(row.status || (row.active === false ? "closed" : "active")) === "active";
const isDone = (task: any) =>
  task?.completed === true || ["done", "verified"].includes(String(task?.status || "").toLowerCase());

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day || 1));
  return date.toISOString().slice(0, 10);
}

function paymentDate(payment: any): string {
  return iso10(payment?.dueDate || payment?.date);
}

function isRentPayment(payment: any): boolean {
  if (payment?.void === true || Number(payment?.amount || 0) <= 0) return false;
  if (String(payment?.type || "").toLowerCase() !== "monthly") return false;
  const notes = Array.isArray(payment?.note) ? payment.note.join(" ") : String(payment?.note || "");
  return !notes.trim() || notes.toLowerCase().includes("rent");
}

export function calculatedEnrollmentAllocation(enrollment: Row): number {
  return (Array.isArray(enrollment.payments) ? enrollment.payments : []).reduce((sum: number, payment: any) => {
    if (payment?.void === true) return sum;
    const amount = Number(payment?.amount || 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

async function getEnrollment(id: string): Promise<Row | null> {
  const snap = await db.collection("customerEnrollments").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as Row) : null;
}

async function resolveContinuum(seed: Row): Promise<Row[]> {
  const continuumId = String(seed?.continuity?.continuumId || "").trim();
  if (continuumId) {
    const snap = await db.collection("customerEnrollments").where("continuity.continuumId", "==", continuumId).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Row))
      .sort((a, b) => iso10(a.startDate).localeCompare(iso10(b.startDate)) || a.id.localeCompare(b.id));
  }

  const found = new Map<string, Row>([[seed.id, seed]]);
  const queue = [seed];
  while (queue.length) {
    const row = queue.shift()!;
    const ids = [row?.migratedFrom?.enrollmentId, row?.migratedTo?.enrollmentId]
      .map((value) => String(value || "").trim())
      .filter((id) => id && !found.has(id));
    for (const id of ids) {
      const linked = await getEnrollment(id);
      if (linked) {
        found.set(id, linked);
        queue.push(linked);
      }
    }
  }
  return Array.from(found.values()).sort(
    (a, b) => iso10(a.startDate).localeCompare(iso10(b.startDate)) || a.id.localeCompare(b.id),
  );
}

type RentCertEventStatus = "due" | "completed" | "effective";

function continuumSummary(rows: Row[]) {
  const assistanceMonthKeys = new Set<string>();
  const rentRows: Array<{ date: string; enrollmentId: string; paymentId: string; manualDueDate: string; manualStatus: RentCertEventStatus | ""; optOut: boolean }> = [];
  let editable = 0;
  let calculated = 0;
  let effective = 0;

  const enrollments = rows.map((row) => {
    const calc = calculatedEnrollmentAllocation(row);
    const rawEditable = row?.clientAllocation?.amount;
    const edit = rawEditable == null ? null : Number(rawEditable);
    const safeEdit = edit != null && Number.isFinite(edit) && edit >= 0 ? edit : null;
    const eff = safeEdit ?? calc;
    calculated += calc;
    editable += safeEdit ?? 0;
    effective += eff;

    for (const payment of Array.isArray(row.payments) ? row.payments : []) {
      if (!isRentPayment(payment)) continue;
      const date = paymentDate(payment);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const manualStatus = String(payment?.rentCert?.status || "");
      rentRows.push({
        date,
        enrollmentId: row.id,
        paymentId: String(payment?.id || ""),
        manualDueDate: payment?.rentCert?.source === "manual" ? iso10(payment.rentCert.dueDate) : "",
        manualStatus: payment?.rentCert?.source === "manual" && ["due", "completed", "effective"].includes(manualStatus)
          ? manualStatus as RentCertEventStatus
          : "",
        optOut: payment?.rentCertOptOut === true,
      });
      if (payment?.paid === true) assistanceMonthKeys.add(date.slice(0, 7));
    }

    return {
      id: row.id,
      grantId: String(row.grantId || ""),
      grantName: row.grantName ? String(row.grantName) : null,
      startDate: iso10(row.startDate) || null,
      endDate: iso10(row.endDate) || null,
      editableAllocation: safeEdit,
      calculatedAllocation: calc,
      effectiveAllocation: eff,
    };
  });

  // One representative payment per date drives the every-3-months cadence.
  // Rows carrying a manual cert win date collisions so operator edits are
  // never shadowed by a sibling enrollment's payment on the same date.
  const byDate = new Map<string, (typeof rentRows)[number]>();
  for (const row of rentRows.sort((a, b) => a.date.localeCompare(b.date))) {
    const prior = byDate.get(row.date);
    if (!prior || (row.manualDueDate && !prior.manualDueDate)) byDate.set(row.date, row);
  }
  const uniqueRentRows = Array.from(byDate.values());
  const rentCertEvents: Array<{ targetDate: string; dueDate: string; enrollmentId: string; paymentId: string; source: "calculated" | "manual"; status: RentCertEventStatus }> = [];
  for (let index = 3; index < uniqueRentRows.length; index += 3) {
    const target = uniqueRentRows[index];
    // Sticky clear: an opted-out payment consumes its cadence slot without a cert.
    if (target.optOut) continue;
    rentCertEvents.push({
      targetDate: target.date,
      dueDate: target.manualDueDate || addMonths(target.date, -1),
      enrollmentId: target.enrollmentId,
      paymentId: target.paymentId,
      source: target.manualDueDate ? "manual" : "calculated",
      status: target.manualStatus || "due",
    });
  }
  // Every manual cert emits an event, including rows that lost the per-date
  // dedupe above — a manually added cert must never disappear from the schedule.
  for (const target of rentRows.filter((row) => row.manualDueDate)) {
    if (rentCertEvents.some((event) => event.enrollmentId === target.enrollmentId && event.paymentId === target.paymentId)) continue;
    rentCertEvents.push({ targetDate: target.date, dueDate: target.manualDueDate, enrollmentId: target.enrollmentId, paymentId: target.paymentId, source: "manual", status: target.manualStatus || "due" });
  }
  rentCertEvents.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const lastAssistanceDate = uniqueRentRows.length ? uniqueRentRows[uniqueRentRows.length - 1].date : null;

  const today = new Date().toISOString().slice(0, 10);
  const current = rows.find((row) => {
    const start = iso10(row.startDate);
    const end = iso10(row.endDate);
    return (!start || start <= today) && (!end || end >= today);
  }) || rows.find((row) => iso10(row.startDate) > today) || rows.at(-1) || null;

  return {
    currentEnrollmentId: current?.id || null,
    assistanceMonthsReceived: assistanceMonthKeys.size,
    assistanceMonthKeys: Array.from(assistanceMonthKeys).sort(),
    allocation: { editable, calculated, effective },
    enrollments,
    rentCertEvents,
    lastAssistanceDate,
  };
}

export async function syncContinuumRentCertReminders(seedEnrollmentId: string): Promise<void> {
  const seed = await getEnrollment(seedEnrollmentId);
  if (!seed) return;
  const rows = await resolveContinuum(seed);
  const summary = continuumSummary(rows);
  const eventsByEnrollment = new Map<string, typeof summary.rentCertEvents>();
  for (const event of summary.rentCertEvents) {
    const list = eventsByEnrollment.get(event.enrollmentId) || [];
    list.push(event);
    eventsByEnrollment.set(event.enrollmentId, list);
  }
  await Promise.all(rows.map(async (row) => {
    const existing = Array.isArray(row.taskSchedule) ? row.taskSchedule : [];
    const priorById = new Map(existing.map((task: any) => [String(task?.id || ""), task]));
    const legacyPrior = (targetDate: string, role: string) => existing.find((task: any) => {
      const id = String(task?.defId || task?.id || "").toLowerCase();
      const text = `${String(task?.title || task?.type || "")} ${String(task?.notes || task?.note || "")}`.toLowerCase();
      if (!id.startsWith("payment_rent_cert_") && !id.startsWith("pay_cert_") && !text.includes("rent cert")) return false;
      const direct = String(task?.targetPaymentDate || "").slice(0, 10);
      const matched = String(task?.defId || task?.id || "").match(/(\d{4}-\d{2}-\d{2})(?:_[a-z]+)?$/i)?.[1] || "";
      return (direct || matched) === targetDate && String(task?.assignedToGroup || "").toLowerCase() === role;
    });
    const eventTargetDates = new Set((eventsByEnrollment.get(row.id) || []).map((event) => event.targetDate));
    const keep = existing.filter((task: any) => {
      const id = String(task?.defId || task?.id || "").toLowerCase();
      const direct = String(task?.targetPaymentDate || "").slice(0, 10);
      const matched = String(task?.defId || task?.id || "").match(/(\d{4}-\d{2}-\d{2})(?:_[a-z]+)?$/i)?.[1] || "";
      if (id.startsWith("payment_rent_cert_")) return false;
      return !(id.startsWith("pay_cert_") && eventTargetDates.has(direct || matched));
    });
    const generated: any[] = [];
    for (const event of eventsByEnrollment.get(row.id) || []) {
      const forceComplete = event.status === "completed" || event.status === "effective";
      for (const role of ["casemanager", "compliance"] as const) {
        const id = `payment_rent_cert_${event.paymentId}_${event.targetDate}_${role}`;
        const prior: any = priorById.get(id) || legacyPrior(event.targetDate, role);
        const completed = forceComplete ? true : prior?.completed === true;
        generated.push({
          id,
          type: `${event.targetDate.slice(0, 7)} rent cert due ${event.dueDate}`,
          title: `${event.targetDate.slice(0, 7)} rent cert due ${event.dueDate}`,
          defId: id,
          dueDate: event.dueDate,
          dueMonth: event.dueDate.slice(0, 7),
          completed,
          completedAt: completed ? (prior?.completedAt || new Date().toISOString()) : null,
          status: prior?.status || undefined,
          verifiedAt: prior?.verifiedAt || null,
          verifiedBy: prior?.verifiedBy || null,
          byUid: prior?.byUid || null,
          notify: true,
          notes: role === "casemanager"
            ? "Collect updated customer and landlord documents for rent certification."
            : "Prepare and send the updated rent certification or notice.",
          bucket: "compliance",
          managed: true,
          assignedToGroup: role,
          assignedToUid: role === "casemanager" ? row.caseManagerId || null : null,
          assignedAt: prior?.assignedAt || null,
          assignedBy: prior?.assignedBy || "system",
          rentCertPaymentId: event.paymentId,
          targetPaymentDate: event.targetDate,
        });
      }
    }
    const next = [...keep, ...generated].sort((a, b) => String(a?.dueDate || "").localeCompare(String(b?.dueDate || "")));
    const eventByPaymentId = new Map((eventsByEnrollment.get(row.id) || []).map((event) => [event.paymentId, event]));
    const payments = (Array.isArray(row.payments) ? row.payments : []).map((payment: any) => {
      const event = eventByPaymentId.get(String(payment?.id || ""));
      if (!event) return payment?.rentCert?.source === "calculated" ? { ...payment, rentCert: null } : payment;
      const ids = ["casemanager", "compliance"].map((role) => `payment_rent_cert_${event.paymentId}_${event.targetDate}_${role}`);
      const eventTasks = generated.filter((task) => ids.includes(String(task.id || "")));
      const allDone = eventTasks.length > 0 && eventTasks.every((task) => task.completed === true);
      // "effective" is an operator-declared terminal state — never downgrade it.
      const status = event.status === "effective" ? "effective" : allDone ? "completed" : "due";
      return { ...payment, rentCert: { dueDate: event.dueDate, targetPaymentDate: event.targetDate, source: event.source, taskIds: ids, status } };
    });
    await db.collection("customerEnrollments").doc(row.id).set({
      payments,
      taskSchedule: next,
      taskStats: summarize(next),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }));
}

export const enrollmentsContinuumSummary = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user || {}) as Record<string, unknown>;
  requireOrg(user);
  const parsed = EnrollmentsContinuumSummaryQuery.safeParse(req.method === "GET" ? req.query : req.body);
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_query" });
  const seed = await getEnrollment(String(parsed.data.enrollmentId));
  if (!seed) return void res.status(404).json({ ok: false, error: "enrollment_not_found" });
  if (!canAccessDoc(user, seed as any)) return void res.status(403).json({ ok: false, error: "forbidden" });
  const rows = (await resolveContinuum(seed)).filter((row) => canAccessDoc(user, row as any));
  const summary = continuumSummary(rows);
  res.status(200).json({
    ok: true,
    continuumId: String(seed?.continuity?.continuumId || seed.id),
    ...summary,
  });
}, { auth: "viewer", requireOrg: true, methods: ["GET", "OPTIONS"] });

export const enrollmentsAllocationSet = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user || {}) as Record<string, unknown>;
  requireOrg(user);
  const parsed = EnrollmentsAllocationSetBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
  const ref = db.collection("customerEnrollments").doc(String(parsed.data.enrollmentId));
  const snap = await ref.get();
  if (!snap.exists) return void res.status(404).json({ ok: false, error: "enrollment_not_found" });
  if (!canAccessDoc(user, snap.data() || {})) return void res.status(403).json({ ok: false, error: "forbidden" });
  await ref.set({
    clientAllocation: {
      amount: parsed.data.amount,
      note: parsed.data.note ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: String((user as any).uid || "") || null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.status(200).json({ ok: true, enrollmentId: ref.id });
}, { auth: "user", requireOrg: true, methods: ["POST", "OPTIONS"] });

async function rolloverPreview(user: Record<string, unknown>, input: { grantId: string; cutoverDate?: string }) {
  const fromSnap = await db.collection("grants").doc(input.grantId).get();
  if (!fromSnap.exists) throw Object.assign(new Error("source_grant_not_found"), { status: 404 });
  const from = { id: fromSnap.id, ...(fromSnap.data() || {}) } as Row;
  if (!canAccessDoc(user, from as any)) throw Object.assign(new Error("forbidden"), { status: 403 });
  const toGrantId = String(from?.linking?.cycle?.nextGrantId || "").trim();
  if (!toGrantId) throw Object.assign(new Error("next_cycle_not_configured"), { status: 400 });
  const toSnap = await db.collection("grants").doc(toGrantId).get();
  if (!toSnap.exists) throw Object.assign(new Error("next_cycle_not_found"), { status: 400 });
  const to = { id: toSnap.id, ...(toSnap.data() || {}) } as Row;
  if (!canAccessDoc(user, to as any)) throw Object.assign(new Error("forbidden"), { status: 403 });

  const cutoverDate = input.cutoverDate || iso10(to.startDate);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoverDate)) blockers.push("destination_start_date_required");
  else if (!/^\d{4}-\d{2}-01$/.test(cutoverDate)) blockers.push("migration_cutover_must_start_month");
  if (!isOpen(to)) blockers.push("destination_grant_not_active");
  if (String(to?.linking?.cycle?.previousGrantId || "") !== from.id) blockers.push("cycle_link_not_reciprocal");
  const fromEnd = iso10(from.endDate);
  if (fromEnd && cutoverDate && fromEnd >= cutoverDate) warnings.push("grant_dates_overlap");
  if (fromEnd && cutoverDate && addDays(fromEnd, 1) < cutoverDate) warnings.push("grant_date_gap");

  const enrollmentSnap = await db.collection("customerEnrollments").where("grantId", "==", from.id).get();
  const destinationSnap = await db.collection("customerEnrollments").where("grantId", "==", to.id).get();
  const destinationCustomers = new Set(destinationSnap.docs.map((doc) => String(doc.data()?.customerId || "")));
  const items = enrollmentSnap.docs.map((doc) => {
    const row = { id: doc.id, ...(doc.data() || {}) } as Row;
    const rowBlockers: string[] = [];
    const rowWarnings: string[] = [];
    if (!isOpen(row)) rowBlockers.push("source_enrollment_not_active");
    if (row.migratedTo || row?.continuity?.nextEnrollmentId) rowBlockers.push("already_rolled_over");
    if (destinationCustomers.has(String(row.customerId || ""))) rowBlockers.push("destination_enrollment_exists");
    const futurePayments = (Array.isArray(row.payments) ? row.payments : []).filter(
      (payment: any) => !payment?.paid && payment?.void !== true && paymentDate(payment) >= cutoverDate,
    );
    const futureTasks = (Array.isArray(row.taskSchedule) ? row.taskSchedule : []).filter(
      (task: any) => !isDone(task) && iso10(task?.dueDate) >= cutoverDate,
    );
    if ((Array.isArray(row.payments) ? row.payments : []).some((payment: any) => payment?.paid && paymentDate(payment) >= cutoverDate)) {
      rowWarnings.push("paid_rows_on_or_after_cutover_remain_on_source");
    }
    return {
      enrollmentId: row.id,
      customerId: String(row.customerId || ""),
      customerName: row.customerName ? String(row.customerName) : null,
      eligible: !blockers.length && !rowBlockers.length,
      blockers: rowBlockers,
      warnings: rowWarnings,
      futureUnpaidPayments: futurePayments.length,
      futureOpenReminders: futureTasks.length,
      calculatedAllocation: calculatedEnrollmentAllocation(row),
    };
  });
  return { fromGrantId: from.id, toGrantId: to.id, cutoverDate, sourceCloseDate: cutoverDate ? addDays(cutoverDate, -1) : "", blockers, warnings, items };
}

export const enrollmentsCycleRolloverPreview = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user || {}) as Record<string, unknown>;
  requireOrg(user);
  const parsed = EnrollmentsCycleRolloverPreviewBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
  try {
    res.status(200).json({ ok: true, ...(await rolloverPreview(user, parsed.data)) });
  } catch (error: any) {
    res.status(Number(error?.status || 500)).json({ ok: false, error: error?.message || "rollover_preview_failed" });
  }
}, { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] });

async function invokeMigration(user: Record<string, unknown>, body: Record<string, unknown>): Promise<any> {
  let status = 200;
  let payload: any;
  const req = { body, user };
  const res = { status(code: number) { status = code; return this; }, json(value: any) { payload = value; return this; } };
  await migrateEnrollmentHandler(req, res);
  if (status >= 400 || !payload?.ok) throw new Error(String(payload?.error || "migration_failed"));
  return payload;
}

export const enrollmentsCycleRolloverRun = secureHandler(async (req, res) => {
  const user = ((req as AuthedRequest).user || {}) as Record<string, unknown>;
  requireOrg(user);
  const parsed = EnrollmentsCycleRolloverRunBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ ok: false, error: "invalid_body", issues: parsed.error.issues });
  try {
    const preview = await rolloverPreview(user, parsed.data);
    if (preview.blockers.length) return void res.status(400).json({ ok: false, error: "rollover_blocked", blockers: preview.blockers });
    const selected = new Set((parsed.data.enrollmentIds || preview.items.filter((item) => item.eligible).map((item) => item.enrollmentId)).map(String));
    const results: Array<Record<string, unknown>> = [];
    for (const item of preview.items.filter((row) => selected.has(row.enrollmentId))) {
      if (!item.eligible) {
        results.push({ enrollmentId: item.enrollmentId, ok: true, skipped: item.blockers.join(",") || "not_eligible" });
        continue;
      }
      try {
        const migrated = await invokeMigration(user, {
          enrollmentId: item.enrollmentId,
          toGrantId: preview.toGrantId,
          cutoverDate: preview.cutoverDate,
          closeSource: true,
          moveSpends: false,
          moveTasks: true,
          movePaidPayments: false,
          rebuildScheduleMeta: true,
          closeSourceTaskMode: "complete",
          closeSourcePaymentMode: "deleteUnpaid",
        });
        const continuumId = String((await getEnrollment(item.enrollmentId))?.continuity?.continuumId || `continuum_${item.enrollmentId}`);
        const batch = db.batch();
        batch.set(db.collection("customerEnrollments").doc(item.enrollmentId), {
          endDate: preview.sourceCloseDate,
          continuity: { continuumId, kind: "grantCycle", nextEnrollmentId: migrated.toId, rolloverSource: "admin", cutoffDate: preview.cutoverDate },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        batch.set(db.collection("customerEnrollments").doc(migrated.toId), {
          continuity: { continuumId, kind: "grantCycle", previousEnrollmentId: item.enrollmentId, rolloverSource: "admin", cutoffDate: preview.cutoverDate },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
        results.push({ enrollmentId: item.enrollmentId, ok: true, destinationEnrollmentId: migrated.toId });
      } catch (error: any) {
        results.push({ enrollmentId: item.enrollmentId, ok: false, error: error?.message || "rollover_failed" });
      }
    }
    res.status(200).json({ ok: true, fromGrantId: preview.fromGrantId, toGrantId: preview.toGrantId, cutoverDate: preview.cutoverDate, results });
  } catch (error: any) {
    res.status(Number(error?.status || 500)).json({ ok: false, error: error?.message || "rollover_failed" });
  }
}, { auth: "admin", requireOrg: true, methods: ["POST", "OPTIONS"] });
