import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, RUNTIME } from "../../core";
import { refreshAllCreditCardBudgets } from "../creditCards/refreshBudget";

type UserPaymentTotals = {
  unpaidThisMonth: number;
  unpaidNextMonth: number;
  unpaidTotal: number;
  amountThisMonth: number;
  amountNextMonth: number;
  amountTotal: number;
};

type PopCounts = { Youth: number; Individual: number; Family: number; unknown: number };

type ClientTotals = {
  total: number;
  active: number;
  inactive: number;
  populationCounts: PopCounts;
};

type GrantEnrollCounts = {
  active: number;
  inactive: number;
  populationCounts: PopCounts;
};

// Extended pop counts using lowercase keys (matching proposal)
type PopByLower = { youth: number; family: number; individual: number; unknown: number };

function emptyPopByLower(): PopByLower {
  return { youth: 0, family: 0, individual: 0, unknown: 0 };
}

function normPopLower(v: unknown): keyof PopByLower {
  const s = String(v || "").trim().toLowerCase();
  if (s === "youth") return "youth";
  if (s === "family" || s === "families") return "family";
  if (s === "individual" || s === "individuals") return "individual";
  return "unknown";
}

function emptyPopCounts(): PopCounts {
  return { Youth: 0, Individual: 0, Family: 0, unknown: 0 };
}

function normPopKey(v: unknown): keyof PopCounts {
  const s = String(v || "").trim();
  if (s === "Youth" || s === "Individual" || s === "Family") return s;
  return "unknown";
}

const PAGE_SIZE = 400;
const MAX_REFS = 50; // max customer/CM refs to store in metric docs

function monthKeysUTC() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const cur = `${y}-${String(m + 1).padStart(2, "0")}`;
  const n = new Date(Date.UTC(y, m + 1, 1));
  const next = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
  const p = new Date(Date.UTC(y, m - 1, 1));
  const prev = `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
  const pp = new Date(Date.UTC(y, m - 2, 1));
  const prev2 = `${pp.getUTCFullYear()}-${String(pp.getUTCMonth() + 1).padStart(2, "0")}`;
  return { cur, next, prev, prev2 };
}

function statusOfCustomer(c: any): string {
  return String(c?.status || (c?.active ? "active" : "inactive")).toLowerCase();
}

function isActiveCustomer(c: any): boolean {
  return c?.active === true || statusOfCustomer(c) === "active";
}

function populationBucket(v: unknown): "youth" | "individuals" | "families" | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "youth") return "youth";
  if (s === "individual" || s === "individuals") return "individuals";
  if (s === "family" || s === "families") return "families";
  return null;
}

function emptyClientTotals(): ClientTotals {
  return { total: 0, active: 0, inactive: 0, populationCounts: emptyPopCounts() };
}

function emptyGrantEnrollCounts(): GrantEnrollCounts {
  return { active: 0, inactive: 0, populationCounts: emptyPopCounts() };
}

function statusOfGrant(g: any): string {
  return String(g?.status || "draft").toLowerCase();
}

function kindOfGrant(g: any): "grant" | "program" {
  return String(g?.kind || "").toLowerCase() === "program" ? "program" : "grant";
}

function enrollmentStatus(e: any): string {
  return String(e?.status || (e?.active ? "active" : "closed")).toLowerCase();
}

function enrollmentState(e: any): { status: string; active: boolean; deleted: boolean } {
  const status = enrollmentStatus(e);
  const deleted = e?.deleted === true || status === "deleted";
  const active = !deleted && (e?.active === true || status === "active");
  return { status, active, deleted };
}

function customerName(row: any): string | null {
  if (row?.name) return String(row.name);
  const first = String(row?.firstName || "").trim();
  const last = String(row?.lastName || "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return null;
}

async function forEachDoc(
  collection: string,
  fields: string[] | null,
  cb: (id: string, data: FirebaseFirestore.DocumentData) => void,
) {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  while (true) {
    let q: FirebaseFirestore.Query = db.collection(collection).orderBy("__name__").limit(PAGE_SIZE);
    if (fields && fields.length) q = (q as FirebaseFirestore.Query).select(...fields);
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) cb(doc.id, doc.data());
    cursor = snap.docs[snap.docs.length - 1] || null;
  }
}

function emptyPaymentTotals(): UserPaymentTotals {
  return {
    unpaidThisMonth: 0,
    unpaidNextMonth: 0,
    unpaidTotal: 0,
    amountThisMonth: 0,
    amountNextMonth: 0,
    amountTotal: 0,
  };
}

export const reconcileMetricsWeekly = onSchedule(
  { region: RUNTIME.region, schedule: "15 3 * * 0", timeZone: "America/Denver" },
  async () => {
    const { cur, next, prev, prev2 } = monthKeysUTC();
    const reconciledAtISO = new Date().toISOString();

    // ── 1. Users scan: names + role filter for case manager count ─────────
    const userNames = new Map<string, string | null>(); // uid → displayName
    const caseManagerUids = new Set<string>();           // uids with group === "casemanager"
    await forEachDoc("users", ["displayName", "email", "group"], (id, row) => {
      userNames.set(id, row?.displayName ? String(row.displayName) : (row?.email ? String(row.email) : null));
      const grp = String(row?.group || "").toLowerCase().trim();
      if (grp === "casemanager" || grp === "case_manager") caseManagerUids.add(id);
    });

    // ── 2. Customers scan (pass 1): global counts + per-CM client totals ───
    const customerStatus: Record<string, number> = {};
    const customerPop = { youth: 0, individuals: 0, families: 0 };
    let customerTotal = 0;
    let customerActive = 0;
    let customerInactive = 0;

    // Population-segmented system data
    const popCmSets = {
      youth: new Set<string>(),
      family: new Set<string>(),
      individual: new Set<string>(),
    };
    const popCustomerCounts = {
      youth: { total: 0, active: 0, inactive: 0 },
      family: { total: 0, active: 0, inactive: 0 },
      individual: { total: 0, active: 0, inactive: 0 },
    };

    // Per-CM client data
    type AcuityAccum = { sum: number; count: number };
    const acuityByUser = new Map<string, AcuityAccum>();
    const clientByUser = new Map<string, ClientTotals>();
    // Customer ref data (id, name, population, active, primary/secondary CM ids)
    type CustRef = {
      id: string;
      name: string | null;
      caseManagerId: string | null;
      secondaryCaseManagerId: string | null;
      active: boolean;
      population: string;
    };
    const customerRefs = new Map<string, CustRef>(); // customerId → ref

    await forEachDoc(
      "customers",
      [
        "active",
        "status",
        "population",
        "caseManagerId",
        "secondaryCaseManagerId",
        "acuityScore",
        "acuity",
        "name",
        "firstName",
        "lastName",
      ],
      (id, row) => {
        customerTotal += 1;
        const st = statusOfCustomer(row);
        const active = isActiveCustomer(row);
        const pop = populationBucket(row.population);
        const popLower = normPopLower(row.population);
        const primaryUid = String(row?.caseManagerId || "").trim();
        const secondaryUid = String(row?.secondaryCaseManagerId || "").trim();
        const contactUids = [primaryUid, secondaryUid].filter(
          (value, index, arr) => !!value && arr.indexOf(value) === index
        );

        customerStatus[st] = (customerStatus[st] || 0) + 1;
        if (active) {
          customerActive += 1;
          if (pop) customerPop[pop] += 1;
        } else {
          customerInactive += 1;
        }

        // Population-segmented tracking (youth/family/individual only)
        if (popLower !== "unknown") {
          const bucket = popLower as "youth" | "family" | "individual";
          popCustomerCounts[bucket].total += 1;
          if (active) popCustomerCounts[bucket].active += 1;
          else popCustomerCounts[bucket].inactive += 1;
          for (const uid of contactUids) popCmSets[bucket].add(uid);
        }

        // Customer ref (limited to MAX_REFS per CM later)
        const cname = customerName(row);
        customerRefs.set(id, {
          id,
          name: cname,
          caseManagerId: primaryUid || null,
          secondaryCaseManagerId: secondaryUid || null,
          active,
          population: String(row?.population || "unknown"),
        });

        // Per-CM client counts
        for (const uid of contactUids) {
          const cl = clientByUser.get(uid) || emptyClientTotals();
          cl.total += 1;
          if (active) {
            cl.active += 1;
            cl.populationCounts[normPopKey(row?.population)] += 1;
          } else {
            cl.inactive += 1;
          }
          clientByUser.set(uid, cl);
        }

        const rawScore = row?.acuityScore ?? (row?.acuity as any)?.score;
        const score = Number(rawScore);
        if (!Number.isFinite(score)) return;
        if (primaryUid) {
          const acc = acuityByUser.get(primaryUid) || { sum: 0, count: 0 };
          acc.sum += score;
          acc.count += 1;
          acuityByUser.set(primaryUid, acc);
        }
        if (secondaryUid && secondaryUid !== primaryUid) {
          const acc = acuityByUser.get(secondaryUid) || { sum: 0, count: 0 };
          acc.sum += score * 0.5;
          acc.count += 0.5;
          acuityByUser.set(secondaryUid, acc);
        }
      },
    );

    // ── 3. Grants scan: global counts + grant names + budget ──────────────
    const grantStatus: Record<string, number> = {};
    const grantKind = { grant: 0, program: 0 };
    let grantTotal = 0;
    let grantActive = 0;
    let grantInactive = 0;
    let activeGrants = 0;
    let inactiveGrants = 0;
    let activePrograms = 0;
    let inactivePrograms = 0;
    const grantIds = new Set<string>();
    const grantNames = new Map<string, string | null>(); // grantId → name
    type GrantBudgetData = { spent: number; projected: number; lineItemsActive: number };
    const grantBudgets = new Map<string, GrantBudgetData>();

    await forEachDoc("grants", ["active", "status", "kind", "name", "title", "budget"], (id, row) => {
      grantIds.add(id);
      grantTotal += 1;
      const st = statusOfGrant(row);
      const active = row?.active === true;
      const kind = kindOfGrant(row);
      const gname = row?.name ? String(row.name) : (row?.title ? String(row.title) : null);
      grantNames.set(id, gname);

      grantStatus[st] = (grantStatus[st] || 0) + 1;
      grantKind[kind] += 1;

      if (active) {
        grantActive += 1;
        if (kind === "grant") activeGrants += 1;
        else activePrograms += 1;
      } else {
        grantInactive += 1;
        if (kind === "grant") inactiveGrants += 1;
        else inactivePrograms += 1;
      }

      // Budget data for spending chips
      const b = row?.budget;
      if (b) {
        const spent = Number(b?.totals?.spent ?? 0);
        const projected = Number(b?.totals?.projected ?? 0);
        const lineItems = Array.isArray(b?.lineItems) ? b.lineItems : [];
        const lineItemsActive = lineItems.filter((li: any) => Number(li?.amount ?? 0) > 0).length;
        grantBudgets.set(id, {
          spent: Number.isFinite(spent) ? spent : 0,
          projected: Number.isFinite(projected) ? projected : 0,
          lineItemsActive,
        });
      }
    });

    // ── 4. Enrollments scan: global + per-grant + per-CM caseload ─────────
    const enrollmentStatusCounts: Record<string, number> = {};
    let enrollmentTotal = 0;
    let enrollmentActive = 0;
    let enrollmentInactive = 0;
    let enrollmentDeleted = 0;
    const grantEnrollmentCounts = new Map<string, GrantEnrollCounts>();
    const paymentByUser = new Map<string, UserPaymentTotals>();
    const caseloadByUser = new Map<string, { caseloadActive: number; enrollmentCount: number }>();
    const enrollPopByUser = new Map<string, PopByLower>(); // per-CM enrollment population counts
    // Per-grant customer and CM tracking
    const grantCustomerSets = new Map<string, Set<string>>(); // grantId → all customerIds
    const grantActiveCustomerSets = new Map<string, Set<string>>(); // grantId → active customerIds
    const grantCmSets = new Map<string, Set<string>>(); // grantId → caseManagerIds
    // Per-grant enrollment population counts (lowercase)
    const grantEnrollPopByGrant = new Map<string, PopByLower>();
    // Per-grant payment month totals
    const grantPaymentCur = new Map<string, { unpaidCount: number; unpaidAmount: number }>();

    await forEachDoc(
      "customerEnrollments",
      ["active", "deleted", "status", "grantId", "caseManagerId", "customerId", "payments", "population"],
      (_id, row) => {
        enrollmentTotal += 1;
        const st = enrollmentState(row);
        enrollmentStatusCounts[st.status] = (enrollmentStatusCounts[st.status] || 0) + 1;
        if (st.deleted) enrollmentDeleted += 1;
        else if (st.active) enrollmentActive += 1;
        else enrollmentInactive += 1;

        const popKey = normPopKey(row?.population);
        const popLower = normPopLower(row?.population);
        const grantId = String(row?.grantId || "").trim();
        const customerId = String(row?.customerId || "").trim();
        const uid = String(row?.caseManagerId || "").trim();

        // Grant enrollment counts (legacy embedded)
        if (grantId) {
          const entry = grantEnrollmentCounts.get(grantId) || emptyGrantEnrollCounts();
          if (!st.deleted) {
            if (st.active) entry.active += 1;
            else entry.inactive += 1;
            entry.populationCounts[popKey] += 1;
          }
          grantEnrollmentCounts.set(grantId, entry);

          // Grant customer sets (for unique customer counts)
          if (!st.deleted && customerId) {
            if (!grantCustomerSets.has(grantId)) grantCustomerSets.set(grantId, new Set());
            grantCustomerSets.get(grantId)!.add(customerId);
            if (st.active) {
              if (!grantActiveCustomerSets.has(grantId)) grantActiveCustomerSets.set(grantId, new Set());
              grantActiveCustomerSets.get(grantId)!.add(customerId);
            }
          }

          // Grant CM sets
          if (!st.deleted && uid) {
            if (!grantCmSets.has(grantId)) grantCmSets.set(grantId, new Set());
            grantCmSets.get(grantId)!.add(uid);
          }

          // Grant enrollment population (lowercase)
          if (!st.deleted) {
            const gep = grantEnrollPopByGrant.get(grantId) || emptyPopByLower();
            gep[popLower] += 1;
            grantEnrollPopByGrant.set(grantId, gep);
          }
        }

        if (!uid) return;

        // Caseload counters per CM
        if (!st.deleted) {
          const cl = caseloadByUser.get(uid) || { caseloadActive: 0, enrollmentCount: 0 };
          cl.enrollmentCount += 1;
          if (st.active) cl.caseloadActive += 1;
          caseloadByUser.set(uid, cl);

          // Enrollment population per CM (lowercase)
          const ep = enrollPopByUser.get(uid) || emptyPopByLower();
          ep[popLower] += 1;
          enrollPopByUser.set(uid, ep);
        }

        // Payment metrics per CM + per grant
        const payments = Array.isArray(row?.payments) ? row.payments : [];
        const p = paymentByUser.get(uid) || emptyPaymentTotals();

        for (const pay of payments) {
          if (pay?.paid === true) continue;
          const dueMonth = String(pay?.dueMonth || pay?.dueDate || "").slice(0, 7);
          const amt = Number(pay?.amount || 0);
          const safeAmt = Number.isFinite(amt) ? amt : 0;

          p.unpaidTotal += 1;
          p.amountTotal += safeAmt;
          if (dueMonth === cur) {
            p.unpaidThisMonth += 1;
            p.amountThisMonth += safeAmt;
            // Grant current-month unpaid
            if (grantId) {
              const gp = grantPaymentCur.get(grantId) || { unpaidCount: 0, unpaidAmount: 0 };
              gp.unpaidCount += 1;
              gp.unpaidAmount += safeAmt;
              grantPaymentCur.set(grantId, gp);
            }
          } else if (dueMonth === next) {
            p.unpaidNextMonth += 1;
            p.amountNextMonth += safeAmt;
          }
        }
        paymentByUser.set(uid, p);
      },
    );

    // ── 5. UserTasks scan: per-user month task counts + system month totals ─
    // Month-scoped task totals (all months in window)
    // ── 6. Jotform scan: monthly submission counts ────────────────────────
    let jotformCurMonthCount = 0;
    await forEachDoc("jotformSubmissions", ["createdAt", "status", "active"], (_id, row) => {
      const created = String(row?.createdAt || "").slice(0, 7);
      if (created === cur) jotformCurMonthCount += 1;
    });

    // ── 7. Write legacy metrics docs (unchanged) ──────────────────────────
    await db.doc("metrics/customers").set(
      {
        total: customerTotal,
        active: customerActive,
        inactive: customerInactive,
        active_population: customerPop,
        status: customerStatus,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

    await db.doc("metrics/grants").set(
      {
        total: grantTotal,
        active: grantActive,
        inactive: grantInactive,
        activeGrants,
        inactiveGrants,
        activePrograms,
        inactivePrograms,
        kind: grantKind,
        status: grantStatus,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

    await db.doc("metrics/enrollments").set(
      {
        total: enrollmentTotal,
        active: enrollmentActive,
        inactive: enrollmentInactive,
        deleted: enrollmentDeleted,
        status: enrollmentStatusCounts,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

    // Legacy embedded grant enrollment counts on grant docs
    const grantWriter = db.bulkWriter();
    for (const grantId of grantIds) {
      const c = grantEnrollmentCounts.get(grantId) || emptyGrantEnrollCounts();
      grantWriter.set(
        db.doc(`grants/${grantId}`),
        {
          metrics: {
            enrollmentCounts: {
              active: c.active,
              inactive: c.inactive,
              total: c.active + c.inactive,
              population: c.populationCounts,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
    }
    await grantWriter.close();

    // ── 8. Write userExtras ───────────────────────────────────────────────────
    // Only iterate uids that actually have reconciled data. Skipping the full
    // userExtras scan avoids reading every doc just for its ID, and prevents
    // incorrectly zeroing out caseloadActive/enrollmentCount for users whose
    // uid doesn't appear in caseloadByUser (e.g. non-CM staff, or CMs whose
    // enrollments store a legacy caseManagerId). Real-time triggers keep
    // non-task per-user counts current between reconcile runs.
    const userExtrasIds = new Set<string>([
      ...paymentByUser.keys(),
      ...caseloadByUser.keys(),
      ...acuityByUser.keys(),
      ...clientByUser.keys(),
      ...enrollPopByUser.keys(),
    ]);

    const userWriter = db.bulkWriter();
    for (const uid of userExtrasIds) {
      const p = paymentByUser.get(uid) || emptyPaymentTotals();
      const hasCaseload = caseloadByUser.has(uid);
      const cl = caseloadByUser.get(uid) ?? { caseloadActive: 0, enrollmentCount: 0 };
      const ac = acuityByUser.get(uid) ?? { sum: 0, count: 0 };
      const acuityAvg = ac.count > 0 ? Math.round((ac.sum / ac.count) * 100) / 100 : null;
      const hasClients = clientByUser.has(uid);
      const clients = clientByUser.get(uid) ?? emptyClientTotals();
      const enrollPop = enrollPopByUser.get(uid) ?? emptyPopByLower();

      userWriter.set(
        db.doc(`userExtras/${uid}`),
        {
          taskMetrics: FieldValue.delete(),
          paymentMetrics: {
            ...p,
            updatedAt: FieldValue.serverTimestamp(),
            reconciledAt: FieldValue.serverTimestamp(),
          },
          // Only overwrite caseload/client/acuity fields for uids that
          // actually appeared in the enrollment/customer scans. This prevents
          // the reconcile from zeroing out real-time-maintained counts for
          // users with no enrollment activity this cycle.
          ...(hasCaseload ? {
            caseloadActive: cl.caseloadActive,
            enrollmentCount: cl.enrollmentCount,
            enrollmentActive: cl.caseloadActive,
            enrollmentInactive: cl.enrollmentCount - cl.caseloadActive,
            enrollmentPopulationCounts: enrollPop,
          } : {}),
          ...(hasClients ? {
            clientTotal: clients.total,
            clientActive: clients.active,
            clientInactive: clients.inactive,
            clientPopulationCounts: clients.populationCounts,
          } : {}),
          ...(acuityByUser.has(uid) ? {
            acuityScoreSum: ac.sum,
            acuityScoreCount: ac.count,
            acuityScoreAvg: acuityAvg,
            ...(ac.count > 0 ? { lastAcuityUpdatedAt: reconciledAtISO } : {}),
          } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    await userWriter.close();

    // ── 9. Write metrics/systemSummary ────────────────────────────────────
    // Collect CM name refs per population bucket
    function cmRefsForPop(cmSet: Set<string>): Array<{ id: string; name: string | null }> {
      const refs: Array<{ id: string; name: string | null }> = [];
      for (const uid of cmSet) {
        refs.push({ id: uid, name: userNames.get(uid) ?? null });
        if (refs.length >= MAX_REFS) break;
      }
      return refs;
    }

    await db.doc("metrics/systemSummary").set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        reconciledAt: FieldValue.serverTimestamp(),
        caseManagers: {
          total: caseManagerUids.size,
          // A CM is "active" if they have at least one non-deleted enrollment
          active: [...caseManagerUids].filter((uid) => (caseloadByUser.get(uid)?.enrollmentCount ?? 0) > 0).length,
          inactive: [...caseManagerUids].filter((uid) => (caseloadByUser.get(uid)?.enrollmentCount ?? 0) === 0).length,
        },
        customers: {
          total: customerTotal,
          active: customerActive,
          inactive: customerInactive,
        },
        populations: {
          youth: {
            customerTotal: popCustomerCounts.youth.total,
            activeCustomerTotal: popCustomerCounts.youth.active,
            inactiveCustomerTotal: popCustomerCounts.youth.inactive,
            caseManagerTotal: popCmSets.youth.size,
            caseManagers: cmRefsForPop(popCmSets.youth),
          },
          family: {
            customerTotal: popCustomerCounts.family.total,
            activeCustomerTotal: popCustomerCounts.family.active,
            inactiveCustomerTotal: popCustomerCounts.family.inactive,
            caseManagerTotal: popCmSets.family.size,
            caseManagers: cmRefsForPop(popCmSets.family),
          },
          individual: {
            customerTotal: popCustomerCounts.individual.total,
            activeCustomerTotal: popCustomerCounts.individual.active,
            inactiveCustomerTotal: popCustomerCounts.individual.inactive,
            caseManagerTotal: popCmSets.individual.size,
            caseManagers: cmRefsForPop(popCmSets.individual),
          },
        },
        enrollments: {
          total: enrollmentTotal - enrollmentDeleted,
          active: enrollmentActive,
          inactive: enrollmentInactive,
        },
        grants: {
          total: grantTotal,
          active: grantActive,
          inactive: grantInactive,
        },
      },
      { merge: false },
    );

    // System month docs (prev2, prev, cur, next)
    const systemMonthWriter = db.bulkWriter();
    for (const month of [prev2, prev, cur, next]) {
      systemMonthWriter.set(
        db.doc(`metrics/systemSummary/months/${month}`),
        {
          month,
          updatedAt: FieldValue.serverTimestamp(),
          reconciledAt: FieldValue.serverTimestamp(),
          payments: {
            total: 0, // not scanned per-month yet; derived from CM totals in UI
            unpaid: 0,
            amount: 0,
          },
          spending: {
            spent: 0,   // aggregated from grant budgets if needed in future
            projected: 0,
            grantsWithActiveSpendItems: [],
          },
          jotform: {
            submissionsTotal: month === cur ? jotformCurMonthCount : 0,
            locallyTrackedOnly: true,
          },
        },
        { merge: false },
      );
    }
    await systemMonthWriter.close();

    // ── 10. Write caseManagerMetrics/{uid} + month subdocs ───────────────
    // Only write for uids that have actual data — do NOT include all userNames
    // keys, because that would write zero-filled docs for every user in the
    // system (admins, compliance officers, etc.) and would zero out real-time-
    // maintained caseload/client counts for users with no activity this cycle.
    const allCmUids = new Set<string>([
      ...caseManagerUids,
      ...clientByUser.keys(),
      ...caseloadByUser.keys(),
    ]);

    const cmSummaryWriter = db.bulkWriter();
    for (const uid of allCmUids) {
      const name = userNames.get(uid) ?? null;
      const p = paymentByUser.get(uid) || emptyPaymentTotals();
      const hasCaseload = caseloadByUser.has(uid);
      const cl = caseloadByUser.get(uid) ?? { caseloadActive: 0, enrollmentCount: 0 };
      const hasAcuity = acuityByUser.has(uid);
      const ac = acuityByUser.get(uid) ?? { sum: 0, count: 0 };
      const acuityAvg = ac.count > 0 ? Math.round((ac.sum / ac.count) * 100) / 100 : null;
      const hasClients = clientByUser.has(uid);
      const clients = clientByUser.get(uid) ?? emptyClientTotals();
      const enrollPop = enrollPopByUser.get(uid) ?? emptyPopByLower();

      // Build customer refs for this CM (capped)
      const cmCustomerRefs: Array<{
        id: string; name: string | null; caseManagerId: string | null;
        caseManagerName: string | null; population: string; active: boolean;
      }> = [];
      for (const [, ref] of customerRefs) {
        if (ref.caseManagerId !== uid && ref.secondaryCaseManagerId !== uid) continue;
        cmCustomerRefs.push({
          id: ref.id,
          name: ref.name,
          caseManagerId: uid,
          caseManagerName: name,
          population: ref.population as any,
          active: ref.active,
        });
        if (cmCustomerRefs.length >= MAX_REFS) break;
      }

      cmSummaryWriter.set(
        db.doc(`caseManagerMetrics/${uid}`),
        {
          uid,
          caseManager: { id: uid, name },
          updatedAt: FieldValue.serverTimestamp(),
          reconciledAt: FieldValue.serverTimestamp(),
          ...(hasClients ? {
            customers: {
              total: clients.total,
              active: clients.active,
              inactive: clients.inactive,
              byPopulation: {
                youth: clients.populationCounts.Youth,
                family: clients.populationCounts.Family,
                individual: clients.populationCounts.Individual,
                unknown: clients.populationCounts.unknown,
              },
              refs: cmCustomerRefs,
            },
          } : {}),
          ...(hasCaseload ? {
            enrollments: {
              total: cl.enrollmentCount,
              active: cl.caseloadActive,
              inactive: cl.enrollmentCount - cl.caseloadActive,
              byPopulation: enrollPop,
            },
          } : {}),
          ...(hasAcuity ? {
            acuity: {
              scoreSum: ac.sum,
              scoreCount: ac.count,
              scoreAvg: acuityAvg,
            },
          } : {}),
          tasks: FieldValue.delete(),
          payments: p,
        },
        { merge: true },
      );

      for (const month of [prev2, prev, cur, next]) {
        const isThisMonth = month === cur;
        cmSummaryWriter.set(
          db.doc(`caseManagerMetrics/${uid}/months/${month}`),
          {
            month,
            uid,
            name,
            updatedAt: FieldValue.serverTimestamp(),
            reconciledAt: FieldValue.serverTimestamp(),
            payments: {
              unpaidCount: isThisMonth ? p.unpaidThisMonth : 0,
              unpaidAmount: isThisMonth ? p.amountThisMonth : 0,
            },
          },
          { merge: false },
        );
      }
    }
    await cmSummaryWriter.close();

    // ── 11. Write grantMetrics/{grantId} + month subdocs ─────────────────
    const grantMetricWriter = db.bulkWriter();
    for (const grantId of grantIds) {
      const name = grantNames.get(grantId) ?? null;
      const enroll = grantEnrollmentCounts.get(grantId) || emptyGrantEnrollCounts();
      const enrollPop = grantEnrollPopByGrant.get(grantId) || emptyPopByLower();
      const budget = grantBudgets.get(grantId) || { spent: 0, projected: 0, lineItemsActive: 0 };
      const customerSet = grantCustomerSets.get(grantId) || new Set<string>();
      const activeCustomerSet = grantActiveCustomerSets.get(grantId) || new Set<string>();
      const cmSet = grantCmSets.get(grantId) || new Set<string>();
      const paymentCur = grantPaymentCur.get(grantId) || { unpaidCount: 0, unpaidAmount: 0 };

      // Build CM refs
      const cmRefs: Array<{ id: string; name: string | null }> = [];
      for (const uid of cmSet) {
        cmRefs.push({ id: uid, name: userNames.get(uid) ?? null });
        if (cmRefs.length >= MAX_REFS) break;
      }

      // Build customer refs (capped)
      const custRefs: Array<{
        id: string; name: string | null; caseManagerId: string | null;
        caseManagerName: string | null; population: string; active: boolean;
      }> = [];
      for (const cid of customerSet) {
        const ref = customerRefs.get(cid);
        if (!ref) continue;
        custRefs.push({
          id: ref.id,
          name: ref.name,
          caseManagerId: ref.caseManagerId,
          caseManagerName: ref.caseManagerId ? (userNames.get(ref.caseManagerId) ?? null) : null,
          population: ref.population as any,
          active: ref.active,
        });
        if (custRefs.length >= MAX_REFS) break;
      }

      grantMetricWriter.set(
        db.doc(`grantMetrics/${grantId}`),
        {
          grantId,
          grant: { id: grantId, name },
          updatedAt: FieldValue.serverTimestamp(),
          reconciledAt: FieldValue.serverTimestamp(),
          enrollments: {
            total: enroll.active + enroll.inactive,
            active: enroll.active,
            inactive: enroll.inactive,
            byPopulation: enrollPop,
          },
          customers: {
            uniqueTotal: customerSet.size,
            activeUniqueTotal: activeCustomerSet.size,
            inactiveUniqueTotal: customerSet.size - activeCustomerSet.size,
            refs: custRefs,
          },
          caseManagers: {
            total: cmSet.size,
            refs: cmRefs,
          },
          spending: {
            projected: budget.projected,
            spent: budget.spent,
            projectedInWindow: budget.projected, // same as projected; window filtering future improvement
            spentInWindow: budget.spent,
            lineItemsActive: budget.lineItemsActive,
          },
        },
        { merge: false },
      );

      // Grant month subdocs
      for (const month of [prev2, prev, cur, next]) {
        const isThisMonth = month === cur;
        grantMetricWriter.set(
          db.doc(`grantMetrics/${grantId}/months/${month}`),
          {
            month,
            grantId,
            name,
            updatedAt: FieldValue.serverTimestamp(),
            reconciledAt: FieldValue.serverTimestamp(),
            enrollments: {
              active: isThisMonth ? enroll.active : 0,
              inactive: isThisMonth ? enroll.inactive : 0,
              total: isThisMonth ? enroll.active + enroll.inactive : 0,
            },
            payments: {
              unpaidCount: isThisMonth ? paymentCur.unpaidCount : 0,
              unpaidAmount: isThisMonth ? paymentCur.unpaidAmount : 0,
            },
            spending: {
              projected: isThisMonth ? budget.projected : 0,
              spent: isThisMonth ? budget.spent : 0,
              activeLineItems: [],
            },
          },
          { merge: false },
        );
      }
    }
    await grantMetricWriter.close();

    // ── 12. Refresh stored credit card budgets ────────────────────────────
    // Writes budget.* back to each creditCards/{id} doc so the budget page
    // reads O(n cards) docs instead of O(months × queue size) per load.
    await refreshAllCreditCardBudgets();
  },
);
