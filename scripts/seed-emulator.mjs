#!/usr/bin/env node
/**
 * Emulator seed + hydrate utility for Firestore/Auth.
 *
 * Usage:
 *   node scripts/seed-emulator.mjs
 *   node scripts/seed-emulator.mjs --small
 *   node scripts/seed-emulator.mjs --no-legacy --dry-run
 *   node scripts/seed-emulator.mjs --wipe --project=housing-db-v2
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SEEDS_DIR = path.join(ROOT, "seeds");

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const arg = (k, d = null) => {
  const hit = argv.find((x) => x.startsWith(`${k}=`));
  if (!hit) return d;
  return hit.split("=").slice(1).join("=") || d;
};
const num = (k, d) => {
  const v = Number(arg(k, d));
  return Number.isFinite(v) ? v : d;
};

const PRESETS = {
  small: {
    cm: 5,
    compliance: 2,
    admin: 1,
    grants: 8,
    customers: 80,
    templates: 3,
    submissions: 40,
    jotforms: 35,
    ledger: 80,
    otherTasks: 40,
  },
  medium: {
    cm: 12,
    compliance: 4,
    admin: 2,
    grants: 18,
    customers: 280,
    templates: 5,
    submissions: 180,
    jotforms: 120,
    ledger: 280,
    otherTasks: 120,
  },
  large: {
    cm: 20,
    compliance: 8,
    admin: 3,
    grants: 32,
    customers: 650,
    templates: 8,
    submissions: 450,
    jotforms: 300,
    ledger: 700,
    otherTasks: 300,
  },
};

const ORG_CONFIG_DEFAULTS = [
  {
    id: "GrantDisplay",
    label: "Grant Display",
    kind: "display",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "CmDisplay",
    label: "CM Display",
    kind: "display",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "SystemConfig",
    label: "System Config",
    kind: "system",
    defaults: { schemaVersion: 1, value: {} },
  },
  {
    id: "CustomerEmailTemplate",
    label: "Customer Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
  {
    id: "CaseManagersEmailTemplate",
    label: "Case Managers Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
  {
    id: "BudgetEmailTemplate",
    label: "Budget Email Template",
    kind: "email_template",
    defaults: { schemaVersion: 1, subject: "", bodyText: "", bodyHtml: "", placeholders: [] },
  },
];

const preset =
  hasFlag("--small") ? "small" : hasFlag("--large") ? "large" : String(arg("--preset", "medium"));
const base = PRESETS[preset] || PRESETS.medium;

const opts = {
  projectId:
    arg("--project", null) ||
    process.env.GCLOUD_PROJECT ||
    process.env.PROJECT_ID ||
    "housing-db-v2",
  firestoreHost: arg("--firestoreHost", process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:5002"),
  authHost: arg("--authHost", process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:5005"),
  orgId: arg("--orgId", "emu_org"),
  wipe: hasFlag("--wipe") || !hasFlag("--no-wipe"),
  legacy: hasFlag("--legacy") || !hasFlag("--no-legacy"),
  dryRun: hasFlag("--dry-run"),
  cm: num("--cm", base.cm),
  compliance: num("--compliance", base.compliance),
  admin: num("--admin", base.admin),
  grants: num("--grants", base.grants),
  customers: num("--customers", base.customers),
  templates: num("--templates", base.templates),
  submissions: num("--submissions", base.submissions),
  jotforms: num("--jotforms", base.jotforms),
  ledger: num("--ledger", base.ledger),
  otherTasks: num("--otherTasks", base.otherTasks),
};

process.env.FIRESTORE_EMULATOR_HOST = opts.firestoreHost;
process.env.FIREBASE_AUTH_EMULATOR_HOST = opts.authHost;

function parseHostPort(value, label) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${label} is required`);
  const parts = raw.split(":");
  if (parts.length < 2) throw new Error(`${label} must be host:port, got "${raw}"`);
  const port = Number(parts[parts.length - 1]);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${label} has invalid port in "${raw}"`);
  }
  const host = parts.slice(0, -1).join(":").replace(/^\[|\]$/g, "").toLowerCase();
  return { host, port, raw };
}

function assertEmulatorOnly() {
  const fsHost = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, "FIRESTORE_EMULATOR_HOST");
  const authHost = parseHostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST, "FIREBASE_AUTH_EMULATOR_HOST");
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);

  if (!allowedHosts.has(fsHost.host)) {
    throw new Error(
      `Refusing to run: FIRESTORE_EMULATOR_HOST must be local emulator host. Got "${fsHost.raw}".`
    );
  }
  if (!allowedHosts.has(authHost.host)) {
    throw new Error(
      `Refusing to run: FIREBASE_AUTH_EMULATOR_HOST must be local emulator host. Got "${authHost.raw}".`
    );
  }

  if (hasFlag("--project") && /prod|production/i.test(String(opts.projectId))) {
    throw new Error(
      `Refusing to run with project "${opts.projectId}". Use an emulator/dev project id only.`
    );
  }
}

assertEmulatorOnly();

if (!admin.apps.length) {
  admin.initializeApp({ projectId: opts.projectId });
}

const db = admin.firestore();
const auth = admin.auth();

const log = (...x) => console.log("[seed]", ...x);

function rid(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}
function safeDocId(raw, fallbackPrefix = "id") {
  const base = String(raw || "").trim() || rid(fallbackPrefix);
  return base.replaceAll("/", "__").replace(/[?#\[\]*]/g, "_");
}
function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function maybe(p = 0.5) {
  return Math.random() < p;
}
function isoDaysFromToday(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function monthKey(isoDate) {
  return String(isoDate || "").slice(0, 7);
}
function monthKeysUTC() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const cur = `${y}-${String(m + 1).padStart(2, "0")}`;
  const n = new Date(Date.UTC(y, m + 1, 1));
  const next = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
  return { cur, next };
}
function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function randAmount(min = 150, max = 1800) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
function statusFromActive(active) {
  return active ? "active" : "inactive";
}
function enrollmentStatusFromActive(active) {
  return active ? "active" : "closed";
}
function popRandom() {
  return choose(["Youth", "Individual", "Family"]);
}
function displayNameFromOrgId(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .trim() || "Org";
}

async function fileJsonSafe(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function wipeFirestoreEmulator() {
  const url = `http://${opts.firestoreHost}/emulator/v1/projects/${opts.projectId}/databases/(default)/documents`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`wipe failed (${res.status}): ${t}`);
  }
}

function buildOrgSeed(orgId) {
  const name = displayNameFromOrgId(orgId);
  const now = new Date().toISOString();
  return {
    id: orgId,
    value: {
      id: orgId,
      orgId,
      name,
      active: true,
      teams: [{ id: orgId, name, active: true }],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function buildOrgConfigSeeds(orgId) {
  const now = new Date().toISOString();
  return ORG_CONFIG_DEFAULTS.map((item) => ({
    id: item.id,
    value: {
      orgId,
      id: item.id,
      label: item.label,
      kind: item.kind,
      active: true,
      ...item.defaults,
      createdAt: now,
      updatedAt: now,
    },
  }));
}

function normalizeCustomerLegacy(row, caseManagers) {
  const id = String(row.id || rid("cust_legacy"));
  const active = typeof row.active === "boolean" ? row.active : String(row.status || "").toLowerCase() === "active";
  const cm = choose(caseManagers);

  let pop = null;
  const p = String(row.population || row.meta?.population || "").toLowerCase();
  if (p.includes("youth")) pop = "Youth";
  else if (p.includes("family")) pop = "Family";
  else if (p.includes("individual")) pop = "Individual";
  else pop = popRandom();

  return {
    id,
    orgId: opts.orgId,
    firstName: row.firstName || null,
    lastName: row.lastName || null,
    name: row.name || [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || id,
    dob: row.dob || null,
    hmisId: row.hmisID || row.hmisId || null,
    cwId: row.cwID || row.cwId || null,
    caseManagerId: row.caseManagerId || cm.uid,
    caseManagerName: row.caseManagerName || cm.displayName,
    status: statusFromActive(active),
    active,
    enrolled: true,
    deleted: false,
    population: pop,
    acuityScore: row.acuityScore ?? row.acuity?.score ?? null,
    acuity: row.acuity || (row.meta?.acuitySeed ? { ...row.meta.acuitySeed } : null),
    meta: row.meta || {},
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

function normalizeEnrollmentLegacy(row, customerById, grantsById) {
  const id = String(row.id || rid("enr_legacy"));
  const customerId = String(row.customerId || row.clientId || row.customer_id || "");
  const customer = customerById.get(customerId) || null;
  const grantId = String(row.grantId || "");
  const grant = grantsById.get(grantId) || null;

  const active = typeof row.active === "boolean" ? row.active : String(row.status || "").toLowerCase() === "active";
  const status = enrollmentStatusFromActive(active);

  const assessments = Array.isArray(row.assessmentSchedule) ? row.assessmentSchedule : [];
  const taskSchedule = assessments.map((a) => {
    const dueDate = String(a?.dueDate || isoDaysFromToday(randInt(-15, 30))).slice(0, 10);
    return {
      id: String(a?.id || rid("tsk")),
      type: String(a?.type || a?.name || "Assessment"),
      dueDate,
      dueMonth: monthKey(dueDate),
      completed: Boolean(a?.completed),
      bucket: "assessment",
      notify: true,
      notes: a?.notes || "",
    };
  });

  const payments = (Array.isArray(row.payments) ? row.payments : []).map((p) => {
    const dueDate = String(p?.dueDate || p?.date || isoDaysFromToday(randInt(-10, 35))).slice(0, 10);
    return {
      id: String(p?.id || rid("pay")),
      type: String(p?.type || "monthly"),
      amount: Number(p?.amount || randAmount()),
      dueDate,
      lineItemId: p?.lineItemId || null,
      paid: Boolean(p?.paid),
      paidFromGrant: p?.paidFromGrant === true,
      vendor: p?.vendor || null,
      comment: p?.comment || null,
      note: p?.note || null,
      compliance: p?.compliance || {
        hmisComplete: maybe(0.5),
        caseworthyComplete: maybe(0.45),
      },
    };
  });

  return {
    id,
    orgId: customer?.orgId || grant?.orgId || opts.orgId,
    grantId,
    customerId,
    startDate: String(row.startDate || isoDaysFromToday(-90)).slice(0, 10),
    endDate: row.endDate ? String(row.endDate).slice(0, 10) : null,
    active,
    status,
    deleted: status === "deleted",
    stage: active ? "tenant" : "exited",
    compliance: row.compliance || null,
    customerName: row.customerName || row.clientName || customer?.name || null,
    grantName: row.grantName || grant?.name || null,
    caseManagerId: row.caseManagerId || customer?.caseManagerId || null,
    caseManagerName: row.caseManagerName || customer?.caseManagerName || null,
    payments,
    spends: Array.isArray(row.spends) ? row.spends : [],
    taskSchedule,
    taskStats: row.taskStats || {
      total: taskSchedule.length,
      completed: taskSchedule.filter((t) => t.completed).length,
      overdue: taskSchedule.filter((t) => !t.completed && String(t.dueDate) < isoDaysFromToday(0)).length,
      nextDue: taskSchedule.map((t) => t.dueDate).sort()[0] || null,
    },
    scheduleMeta: row.scheduleMeta || null,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

function generatedGrant(i) {
  const id = `grant_seed_${String(i + 1).padStart(3, "0")}`;
  const total = randInt(35000, 220000);
  const spent = randInt(0, Math.floor(total * 0.65));
  const projected = randInt(0, Math.floor(total * 0.4));
  const active = maybe(0.7);
  const status = active ? "active" : choose(["draft", "closed"]);

  const lineA = Math.round(total * 0.7);
  const lineB = total - lineA;

  return {
    id,
    orgId: opts.orgId,
    name: `Seed Grant ${i + 1}`,
    status,
    active: status === "active",
    deleted: false,
    kind: "grant",
    duration: "1 Year",
    startDate: isoDaysFromToday(randInt(-365, -30)),
    endDate: isoDaysFromToday(randInt(30, 365)),
    budget: {
      total,
      totals: {
        total,
        spent,
        projected,
        balance: total - spent,
        projectedBalance: total - spent - projected,
      },
      lineItems: [
        { id: `${id}_rent`, label: "Rent Assistance", amount: lineA, projected: Math.floor(projected * 0.75), spent: Math.floor(spent * 0.75) },
        { id: `${id}_util`, label: "Utility Assistance", amount: lineB, projected: Math.floor(projected * 0.25), spent: Math.floor(spent * 0.25) },
      ],
    },
    taskTypes: ["assessment", "housing"],
    tasks: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generatedCustomer(i, caseManagers) {
  const id = `cust_seed_${String(i + 1).padStart(5, "0")}`;
  const cm = choose(caseManagers);
  const first = choose(["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Avery", "Riley", "Quinn"]);
  const last = choose(["Lopez", "Nguyen", "Baker", "Hill", "Reed", "Price", "Campbell", "Diaz"]);
  const active = maybe(0.82);
  const score = maybe(0.7) ? Math.round((1 + Math.random() * 4) * 100) / 100 : null;
  return {
    id,
    orgId: opts.orgId,
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    dob: isoDaysFromToday(-randInt(19 * 365, 68 * 365)),
    hmisId: `HMIS-${100000 + i}`,
    cwId: `CW-${100000 + i}`,
    caseManagerId: cm.uid,
    caseManagerName: cm.displayName,
    status: statusFromActive(active),
    active,
    enrolled: true,
    deleted: false,
    population: popRandom(),
    acuityScore: score,
    acuity: score
      ? {
          score,
          level: score >= 4 ? "High Acuity" : score >= 2.5 ? "Moderate Acuity" : "Low Acuity",
          computedAt: new Date().toISOString(),
        }
      : null,
    meta: { source: "seed-emulator" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generatedEnrollment(customer, grants, idx) {
  const grant = choose(grants);
  const active = customer.active && maybe(0.75);
  const status = enrollmentStatusFromActive(active);
  const startDate = isoDaysFromToday(-randInt(20, 360));
  const endDate = active ? null : isoDaysFromToday(randInt(-120, 60));

  const paymentCount = randInt(2, 7);
  const payments = [];
  const taskSchedule = [];
  for (let i = 0; i < paymentCount; i++) {
    const dueDate = isoDaysFromToday(randInt(-25, 80));
    const paid = maybe(0.4);
    payments.push({
      id: rid("pay"),
      type: "monthly",
      amount: randAmount(350, 1500),
      dueDate,
      lineItemId: choose((grant.budget?.lineItems || []).map((x) => x.id) || [null]),
      paid,
      paidFromGrant: paid,
      vendor: choose(["ABC Property", "North Homes", "City Utility", "Community Housing"]),
      comment: paid ? "Processed" : "Pending",
      note: null,
      compliance: {
        hmisComplete: paid ? maybe(0.7) : maybe(0.2),
        caseworthyComplete: paid ? maybe(0.68) : maybe(0.22),
      },
    });
  }

  const assessCount = randInt(1, 4);
  for (let i = 0; i < assessCount; i++) {
    const dueDate = isoDaysFromToday(randInt(-20, 55));
    const done = maybe(0.45);
    taskSchedule.push({
      id: rid("tsk"),
      type: choose(["Intake Assessment", "90 Day Assessment", "Housing Stability Review"]),
      dueDate,
      dueMonth: monthKey(dueDate),
      completed: done,
      completedAt: done ? dueDate : null,
      bucket: "assessment",
      notify: true,
      notes: "",
    });
  }

  return {
    id: `enr_seed_${String(idx + 1).padStart(5, "0")}`,
    orgId: customer.orgId || grant.orgId || opts.orgId,
    grantId: grant.id,
    customerId: customer.id,
    startDate,
    endDate,
    active,
    status,
    deleted: status === "deleted",
    stage: active ? "tenant" : "exited",
    compliance: {
      caseworthyEntryComplete: maybe(0.65),
      caseworthyExitComplete: active ? null : maybe(0.5),
      hmisEntryComplete: maybe(0.65),
      hmisExitComplete: active ? null : maybe(0.5),
    },
    customerName: customer.name,
    grantName: grant.name,
    caseManagerId: customer.caseManagerId,
    caseManagerName: customer.caseManagerName,
    payments,
    spends: [],
    taskSchedule,
    taskStats: {
      total: taskSchedule.length,
      completed: taskSchedule.filter((t) => t.completed).length,
      overdue: taskSchedule.filter((t) => !t.completed && t.dueDate < isoDaysFromToday(0)).length,
      nextDue: taskSchedule.map((t) => t.dueDate).sort()[0] || null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeCoreIds({ grants, customers, enrollments }) {
  const grantIdMap = new Map();
  const customerIdMap = new Map();

  const grantsSafe = grants.map((g) => {
    const oldId = String(g.id || "");
    const id = safeDocId(oldId, "grant");
    grantIdMap.set(oldId, id);
    return { ...g, id };
  });

  const customersSafe = customers.map((c) => {
    const oldId = String(c.id || "");
    const id = safeDocId(oldId, "cust");
    customerIdMap.set(oldId, id);
    return { ...c, id };
  });

  const enrollmentsSafe = enrollments.map((e) => {
    const oldId = String(e.id || "");
    const id = safeDocId(oldId, "enr");
    const rawGrantId = String(e.grantId || "");
    const rawCustomerId = String(e.customerId || "");

    return {
      ...e,
      id,
      grantId: grantIdMap.get(rawGrantId) || safeDocId(rawGrantId, "grant"),
      customerId: customerIdMap.get(rawCustomerId) || safeDocId(rawCustomerId, "cust"),
    };
  });

  return { grantsSafe, customersSafe, enrollmentsSafe };
}

function makeLedgerEntry(e, p, source = "enrollment") {
  const amt = Number(p.amount || 0);
  const cents = Math.round(amt * 100);
  const d = String(p.dueDate || isoDaysFromToday(0)).slice(0, 10);
  const lineItemId = p.lineItemId || null;
  const grant = (e && e._grant) || null;
  const customer = (e && e._customer) || null;
  const grantLineItems = Array.isArray(grant?.budget?.lineItems) ? grant.budget.lineItems : [];
  const lineItem = grantLineItems.find((li) => String(li?.id || "") === String(lineItemId || "")) || null;
  const noteParts = ["seeded ledger entry"];
  if (p?.vendor) noteParts.push(String(p.vendor));
  if (p?.comment) noteParts.push(String(p.comment));

  return {
    source,
    orgId: e.orgId || opts.orgId,
    amountCents: cents,
    grantId: e.grantId || null,
    lineItemId,
    enrollmentId: e.id || null,
    paymentId: p.id || null,
    customerId: e.customerId || null,
    caseManagerId: e.caseManagerId || null,
    note: noteParts.join(" | "),
    vendor: p?.vendor || null,
    comment: p?.comment || null,
    labels: ["seed", p.paid ? "paid" : "projected"],
    dueDate: d,
    date: d,
    month: monthKey(d),
    ts: new Date().toISOString(),
    origin: {
      app: "hdb",
      baseId: p.id || null,
      sourcePath: e?.id ? `customerEnrollments/${e.id}#payments:${String(p.id || "")}` : null,
      idempotencyKey: e?.id && p?.id ? `seed|${e.id}|${p.id}` : null,
    },
    grantNameAtSpend: grant?.name || null,
    lineItemLabelAtSpend: lineItem?.label || null,
    customerNameAtSpend: customer?.name || e?.customerName || null,
    paymentLabelAtSpend: p?.type ? String(p.type) : "monthly",
    byUid: null,
    byEmail: "seed-emulator@example.local",
    byName: "seed-emulator",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function ensureUser(email, displayName, claims) {
  try {
    const hit = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(hit.uid, claims);
    return { uid: hit.uid, email, displayName };
  } catch {
    const created = await auth.createUser({
      email,
      password: "seedpass123!",
      displayName,
      emailVerified: true,
      disabled: false,
    });
    await auth.setCustomUserClaims(created.uid, claims);
    return { uid: created.uid, email, displayName };
  }
}

async function seedAuthUsers() {
  const users = { admin: [], cm: [], compliance: [] };
  for (let i = 0; i < opts.admin; i++) {
    const email = `seed.admin.${i + 1}@example.local`;
    users.admin.push(await ensureUser(email, `Seed Admin ${i + 1}`, {
      roles: ["admin"],
      admin: true,
      topRole: "admin",
      orgId: opts.orgId,
      teamIds: [opts.orgId],
    }));
  }
  for (let i = 0; i < opts.cm; i++) {
    const email = `seed.cm.${i + 1}@example.local`;
    users.cm.push(await ensureUser(email, `Seed CM ${i + 1}`, {
      roles: ["casemanager"],
      admin: false,
      topRole: "user",
      orgId: opts.orgId,
      teamIds: [opts.orgId],
    }));
  }
  for (let i = 0; i < opts.compliance; i++) {
    const email = `seed.comp.${i + 1}@example.local`;
    users.compliance.push(await ensureUser(email, `Seed Compliance ${i + 1}`, {
      roles: ["compliance"],
      admin: false,
      topRole: "user",
      orgId: opts.orgId,
      teamIds: [opts.orgId],
    }));
  }
  return users;
}

function makeUserExtras(users, customers) {
  const byUid = new Map();
  for (const c of customers) {
    const uid = String(c.caseManagerId || "");
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid).push(c);
  }
  const out = [];
  for (const cm of users.cm) {
    const list = byUid.get(cm.uid) || [];
    const active = list.filter((x) => x.active).length;
    const acuityVals = list.map((x) => Number(x.acuity?.score ?? x.acuityScore)).filter((n) => Number.isFinite(n));
    const sum = acuityVals.reduce((a, b) => a + b, 0);
    const count = acuityVals.length;
    out.push({
      id: cm.uid,
      value: {
        orgId: opts.orgId,
        metrics: {
          caseloadActive: active,
          acuityScoreSum: count ? Math.round(sum * 100) / 100 : null,
          acuityScoreCount: count || null,
          acuityScoreAvg: count ? Math.round((sum / count) * 100) / 100 : null,
          lastAcuityUpdatedAt: new Date().toISOString(),
        },
        settings: { seed: true },
        notes: "Seeded by scripts/seed-emulator.mjs",
      },
    });
  }
  return out;
}

function classifyTaskKind(row) {
  const src = String(row?.source || "").toLowerCase();
  const bucket = String(row?.bucket || "").toLowerCase();
  const group = String(row?.assignedToGroup || "").toLowerCase();
  const title = String(row?.title || "").toLowerCase();
  if (src === "payment" || src === "paymentcompliance" || group === "compliance") return "compliance";
  if (bucket === "assessment" || title.includes("assessment")) return "assessment";
  if (src === "other" || bucket === "other") return "other";
  return "other";
}

function buildRollups(enrollments, userTasks) {
  const { cur, next } = monthKeysUTC();
  const byUser = new Map();
  const ensure = (uid) => {
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        tasks: {
          openThisMonth: 0,
          openNextMonth: 0,
          byType: {
            assessment: { thisMonth: 0, nextMonth: 0 },
            compliance: { thisMonth: 0, nextMonth: 0 },
            other: { thisMonth: 0, nextMonth: 0 },
          },
        },
        payments: {
          unpaidThisMonth: 0,
          unpaidNextMonth: 0,
          unpaidTotal: 0,
          amountThisMonth: 0,
          amountNextMonth: 0,
          amountTotal: 0,
        },
      });
    }
    return byUser.get(uid);
  };

  for (const e of enrollments) {
    const uid = String(e.caseManagerId || "").trim();
    if (!uid) continue;
    const row = ensure(uid);
    const payments = Array.isArray(e.payments) ? e.payments : [];
    for (const p of payments) {
      if (p?.paid === true) continue;
      const dueMonth = String(p?.dueMonth || p?.dueDate || "").slice(0, 7);
      const amt = Number(p?.amount || 0);
      const safeAmt = Number.isFinite(amt) ? amt : 0;
      row.payments.unpaidTotal += 1;
      row.payments.amountTotal += safeAmt;
      if (dueMonth === cur) {
        row.payments.unpaidThisMonth += 1;
        row.payments.amountThisMonth += safeAmt;
      } else if (dueMonth === next) {
        row.payments.unpaidNextMonth += 1;
        row.payments.amountNextMonth += safeAmt;
      }
    }
  }

  for (const t of userTasks) {
    const row = t?.value || {};
    const uid = String(row?.assignedToUid || "").trim();
    if (!uid) continue;
    const status = String(row?.status || "").toLowerCase();
    if (status && status !== "open") continue;
    const dueMonth = String(row?.dueMonth || row?.dueDate || "").slice(0, 7);
    if (dueMonth !== cur && dueMonth !== next) continue;
    const kind = classifyTaskKind(row);
    const out = ensure(uid).tasks;
    if (dueMonth === cur) {
      out.openThisMonth += 1;
      out.byType[kind].thisMonth += 1;
    }
    if (dueMonth === next) {
      out.openNextMonth += 1;
      out.byType[kind].nextMonth += 1;
    }
  }

  return byUser;
}

function attachRollupsToUserExtras(userExtras, rollups) {
  const now = new Date().toISOString();
  const byId = new Map(userExtras.map((x) => [String(x.id), x]));
  for (const [uid, r] of rollups.entries()) {
    if (!byId.has(uid)) {
      byId.set(uid, { id: uid, value: { orgId: opts.orgId, metrics: {}, settings: { seed: true } } });
    }
    const row = byId.get(uid);
    row.value.metrics = {
      ...(row.value.metrics || {}),
      tasks: {
        ...r.tasks,
        updatedAt: now,
        reconciledAt: now,
      },
      payments: {
        ...r.payments,
        updatedAt: now,
        reconciledAt: now,
      },
    };
  }
  return Array.from(byId.values());
}

function attachGrantEnrollmentCounts(grants, enrollments) {
  const counts = new Map();
  for (const e of enrollments) {
    const grantId = String(e.grantId || "").trim();
    if (!grantId) continue;
    const status = String(e.status || (e.active ? "active" : "closed")).toLowerCase();
    const deleted = e.deleted === true || status === "deleted";
    const active = !deleted && (e.active === true || status === "active");
    if (!counts.has(grantId)) counts.set(grantId, { active: 0, inactive: 0 });
    if (!deleted) {
      if (active) counts.get(grantId).active += 1;
      else counts.get(grantId).inactive += 1;
    }
  }

  const now = new Date().toISOString();
  return grants.map((g) => {
    const c = counts.get(String(g.id || "")) || { active: 0, inactive: 0 };
    return {
      ...g,
      metrics: {
        ...(g.metrics || {}),
        enrollmentCounts: c,
        updatedAt: now,
      },
    };
  });
}

function buildUserTasks(enrollments, extraCount) {
  const out = [];
  for (const e of enrollments) {
    const tasks = Array.isArray(e.taskSchedule) ? e.taskSchedule : [];
    for (const t of tasks) {
      const status = t.completed ? "done" : "open";
      out.push({
        id: `task|${e.id}|${t.id}`,
        value: {
          source: "task",
          sourceId: String(t.id),
          sourcePath: `customerEnrollments/${e.id}#task:${t.id}`,
          status,
          title: String(t.type || "Task"),
          note: String(t.notes || ""),
          bucket: String(t.bucket || "assessment"),
          dueDate: t.dueDate || null,
          dueMonth: t.dueMonth || monthKey(t.dueDate),
          notify: t.notify !== false,
          enrollmentId: e.id,
          grantId: e.grantId || null,
          customerId: e.customerId || null,
          cmUid: e.caseManagerId || null,
          assignedToUid: e.caseManagerId || null,
          assignedToGroup: "casemanager",
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }

  for (let i = 0; i < extraCount; i++) {
    const id = rid("other");
    const due = isoDaysFromToday(randInt(-10, 40));
    out.push({
      id: `other|${id}`,
      value: {
        source: "other",
        sourceId: id,
        sourcePath: `otherTasks/${id}`,
        status: maybe(0.25) ? "done" : "open",
        title: choose(["Follow up call", "Doc review", "Landlord outreach", "Eligibility recheck"]),
        note: "Seeded other task",
        bucket: "other",
        dueDate: due,
        dueMonth: monthKey(due),
        notify: true,
        enrollmentId: null,
        grantId: null,
        customerId: null,
        cmUid: null,
        assignedToUid: null,
        assignedToGroup: choose(["admin", "casemanager", "compliance"]),
        updatedAt: new Date().toISOString(),
      },
    });
  }
  return out;
}

function buildAssessmentTemplates(grants, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const grant = choose(grants);
    const id = `tmpl_seed_${String(i + 1).padStart(3, "0")}`;
    out.push({
      id,
      value: {
        id,
        orgId: opts.orgId,
        grantId: grant.id,
        kind: choose(["acuity", "housing", "compliance"]),
        scope: choose(["customer", "enrollment"]),
        name: `Seed Template ${i + 1}`,
        status: "active",
        schema: {
          version: 1,
          questions: [
            { id: "q1", label: "Stability", type: "scale", min: 1, max: 5 },
            { id: "q2", label: "Income", type: "scale", min: 1, max: 5 },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }
  return out;
}

function buildAssessmentSubmissions(templates, enrollments, customers, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const tmpl = choose(templates);
    const e = choose(enrollments);
    const c = customers.find((x) => x.id === e.customerId) || choose(customers);
    const score = Math.round((1 + Math.random() * 4) * 100) / 100;
    const id = rid("asub");
    out.push({
      id,
      value: {
        id,
        orgId: opts.orgId,
        templateId: tmpl.id,
        customerId: c.id,
        enrollmentId: e.id,
        grantId: e.grantId,
        submittedAt: new Date().toISOString(),
        answers: [{ qId: "q1", value: randInt(1, 5) }, { qId: "q2", value: randInt(1, 5) }],
        computed: { score, level: score > 3.8 ? "High" : score > 2.2 ? "Medium" : "Low" },
        status: "submitted",
        updatedAt: new Date().toISOString(),
      },
    });
  }
  return out;
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────

const CC_FORM_ID = "251878265158166";
const INVOICE_FORM_ID = "252674777246167";

function buildCreditCards() {
  const cards = [
    { name: "Youth Card", code: "YTH", last4: "4321", bucket: "Youth" },
    { name: "Housing Card", code: "HSG", last4: "8765", bucket: "Housing" },
    { name: "MAD Card", code: "MAD", last4: "1122", bucket: "MAD" },
  ];
  return cards.map((c, i) => ({
    id: `cc_seed_${c.bucket.toLowerCase()}_${i + 1}`,
    value: {
      id: `cc_seed_${c.bucket.toLowerCase()}_${i + 1}`,
      orgId: opts.orgId,
      name: c.name,
      code: c.code,
      last4: c.last4,
      status: "active",
      monthlyLimitCents: randInt(5000, 20000) * 100,
      matching: { aliases: [c.name.toLowerCase()], cardAnswerValues: [c.last4, c.code] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));
}

// ─── Spend Form Submissions (CC + Invoice) ────────────────────────────────────

function buildSpendSubmissions(customers, grants, creditCards) {
  const nCC = Math.max(3, Math.floor(opts.jotforms * 0.15));
  const nInv = Math.max(3, Math.floor(opts.jotforms * 0.12));
  const now = new Date().toISOString();
  const items = [];

  // CC submissions (form 251878265158166)
  for (let i = 0; i < nCC; i++) {
    const c = choose(customers);
    const g = choose(grants);
    const card = choose(creditCards);
    const li = choose(Array.isArray(g?.budget?.lineItems) ? g.budget.lineItems : [null]);
    const txnCount = randInt(1, 3);
    const submissionId = `${CC_FORM_ID}-cc${100000 + i}`;
    const id = rid("jsub_cc");
    const daysAgo = randInt(1, 45);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const cardChoice = card.value.name;

    // Build raw answers following CC_SCHEMA field IDs
    const rawAnswers = {
      "33": cardChoice,
      "219": `${card.value.name} *${card.value.last4}`,
      "55": "Jane Smith",
      "56": "jane@example.org",
      "93": String(txnCount),
    };
    const transactions = [];
    const txnFields = [
      { merchant: "82", expenseType: "84", purpose: "85", cost: "86", customerName: "156", notes: "151" },
      { merchant: "182", expenseType: "183", purpose: "106", cost: "107", customerName: "185", notes: "143" },
      { merchant: "187", expenseType: "188", purpose: "114", cost: "115", customerName: "190", notes: "147" },
    ];
    const merchants = ["Office Depot", "Walmart", "Target", "Safeway", "Amazon", "Home Depot", "Costco"];
    let totalAmount = 0;
    for (let t = 0; t < txnCount; t++) {
      const amt = randAmount(20, 400);
      totalAmount += amt;
      const flds = txnFields[t];
      rawAnswers[flds.merchant] = choose(merchants);
      rawAnswers[flds.expenseType] = choose(["Office Supplies", "Food", "Program Materials", "Transportation"]);
      rawAnswers[flds.purpose] = `Client support service #${i}-${t}`;
      rawAnswers[flds.cost] = String(amt.toFixed(2));
      rawAnswers[flds.customerName] = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim();
      if (flds.notes) rawAnswers[flds.notes] = "Seed data transaction";
      transactions.push({ merchant: rawAnswers[flds.merchant], amount: amt, txnNumber: t + 1 });
    }

    const status = maybe(0.8) ? "active" : maybe(0.7) ? "archived" : "deleted";
    items.push({
      type: "cc",
      sub: {
        id, orgId: opts.orgId, formId: CC_FORM_ID, formTitle: "Expense Report - Credit Card",
        formAlias: "expense-report-cc", submissionId, status, active: status === "active",
        deleted: status === "deleted", source: "api",
        customerId: c.id, grantId: g.id, enrollmentId: null,
        rawAnswers, createdAt, updatedAt: now, jotformCreatedAt: createdAt, jotformUpdatedAt: now,
      },
      transactions,
      card,
      grant: g,
      lineItem: li,
      totalAmount,
    });
  }

  // Invoice submissions (form 252674777246167)
  for (let i = 0; i < nInv; i++) {
    const c = choose(customers);
    const g = choose(grants);
    const li = choose(Array.isArray(g?.budget?.lineItems) ? g.budget.lineItems : [null]);
    const amt = randAmount(150, 2000);
    const submissionId = `${INVOICE_FORM_ID}-inv${100000 + i}`;
    const id = rid("jsub_inv");
    const daysAgo = randInt(1, 45);
    const invoiceDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const vendors = ["ABC Services LLC", "Housing Partners Inc", "Community Support Co", "Rental Services Corp", "Utility Helpers Ltd"];

    const rawAnswers = {
      "31": invoiceDate,
      "4": createdAt.slice(0, 10),
      "33": "Jane Smith",
      "34": choose(["Rental Assistance", "Utility Assistance", "Support Services"]),
      "74": choose(vendors),
      "95": choose(["Check", "ACH", "Credit Card"]),
      "25": "billing@example.org",
      "75": "Direct housing assistance",
      "84": c.firstName || "Client",
      "85": c.lastName || "Name",
      "53": choose(["rental", "utility", "service"]),
      "17": String(amt.toFixed(2)),
    };

    const status = maybe(0.75) ? "active" : maybe(0.6) ? "archived" : "deleted";
    items.push({
      type: "invoice",
      sub: {
        id, orgId: opts.orgId, formId: INVOICE_FORM_ID, formTitle: "Invoice - Services",
        formAlias: "invoice-services", submissionId, status, active: status === "active",
        deleted: status === "deleted", source: "api",
        customerId: c.id, grantId: g.id, enrollmentId: null,
        rawAnswers, createdAt, updatedAt: now, jotformCreatedAt: createdAt, jotformUpdatedAt: now,
      },
      amount: amt,
      grant: g,
      lineItem: li,
      customer: c,
    });
  }

  return items;
}

// ─── PaymentQueue Items (from spend submissions) ───────────────────────────────

function buildPaymentQueueFromSpend(spendItems, creditCards) {
  const now = new Date().toISOString();
  const cardIdMap = new Map(creditCards.map((c) => [c.value.name, c.id]));
  const out = [];

  for (const item of spendItems) {
    if (item.sub.deleted) continue; // void submissions → skip

    if (item.type === "cc") {
      for (const txn of item.transactions) {
        const docId = `${item.sub.submissionId}-t${txn.txnNumber}`;
        const cardId = item.card.id;
        const cardBucket = item.card.value.matching?.cardAnswerValues?.length
          ? (item.card.value.name.includes("Youth") ? "Youth" : item.card.value.name.includes("Housing") ? "Housing" : "MAD")
          : "";
        const status = maybe(0.7) ? "pending" : "posted";
        out.push({
          id: docId,
          value: {
            id: docId, baseId: item.sub.submissionId, submissionId: item.sub.submissionId,
            paymentId: null, formId: CC_FORM_ID, formAlias: "expense-report-cc",
            formTitle: "Expense Report - Credit Card", schemaVersion: 1,
            source: "credit-card", orgId: opts.orgId,
            createdAt: item.sub.createdAt, dueDate: item.sub.createdAt.slice(0, 10),
            month: item.sub.createdAt.slice(0, 7),
            amount: txn.amount,
            merchant: txn.merchant || "Vendor",
            expenseType: "Office Supplies", program: "", billedTo: "", project: "",
            purchasePath: "program", card: item.card.value.name, cardBucket,
            txnNumber: txn.txnNumber, purpose: `Transaction ${txn.txnNumber}`,
            paymentMethod: "", serviceType: "", otherService: "", serviceScope: "",
            wex: "", descriptor: txn.merchant || "",
            customer: "", customerKey: "", purchaser: "Jane Smith", email: "jane@example.org",
            isFlex: false, flexReasons: [], submissionIsFlex: false,
            files: [], files_txn: [], files_uploadAll: [],
            files_typed: { receipt: [], required: [], agenda: [], w9: [] },
            notes: "Seed CC spend", note: "",
            rawStatus: status === "posted" ? "paid" : "unpaid",
            rawAnswers: item.sub.rawAnswers, rawMeta: {
              id: item.sub.submissionId, form_id: CC_FORM_ID,
              status: status === "posted" ? "paid" : "active",
              created_at: item.sub.createdAt.slice(0, 10), updated_at: now,
            },
            grantId: item.grant?.id || null, lineItemId: item.lineItem?.id || null,
            customerId: null, enrollmentId: null,
            creditCardId: cardId,
            ledgerEntryId: status === "posted" ? rid("led") : null,
            reversalEntryId: null,
            invoiceStatus: null, invoicedAt: null, invoicedBy: null, invoiceRef: null,
            okUnassigned: false, okUnassignedAt: null, okUnassignedBy: null,
            extractionErrors: [], extractionPath: "hardcoded",
            queueStatus: status, voidedAt: null, voidedBy: null,
            postedAt: status === "posted" ? now : null, postedBy: status === "posted" ? "seed" : null,
            reopenedAt: null, reopenedBy: null, reopenReason: null,
            createdAtISO: item.sub.createdAt, updatedAtISO: now,
            system: { lastWriter: "seed-emulator", lastWriteAt: now, extractionVersion: 1 },
          },
        });
      }
    } else if (item.type === "invoice") {
      const docId = item.sub.submissionId;
      const invoiceStatus = choose([null, "pending", "invoiced"]);
      const queueStatus = maybe(0.65) ? "pending" : "posted";
      out.push({
        id: docId,
        value: {
          id: docId, baseId: item.sub.submissionId, submissionId: item.sub.submissionId,
          paymentId: null, formId: INVOICE_FORM_ID, formAlias: "invoice-services",
          formTitle: "Invoice - Services", schemaVersion: 1,
          source: "invoice", orgId: opts.orgId,
          createdAt: item.sub.createdAt, dueDate: item.sub.rawAnswers["31"] || item.sub.createdAt.slice(0, 10),
          month: (item.sub.rawAnswers["31"] || item.sub.createdAt).slice(0, 7),
          amount: item.amount,
          merchant: item.sub.rawAnswers["74"] || "Vendor",
          expenseType: item.sub.rawAnswers["34"] || "Services", program: "", billedTo: "",
          project: `${item.customer?.firstName || ""} ${item.customer?.lastName || ""}`.trim() || item.customer?.name || "",
          purchasePath: "customer", card: "", cardBucket: "", txnNumber: null,
          purpose: item.sub.rawAnswers["75"] || "Support services",
          paymentMethod: item.sub.rawAnswers["95"] || "Check",
          serviceType: item.sub.rawAnswers["53"] || "rental",
          otherService: "", serviceScope: "IS", wex: "Non-WEX",
          descriptor: item.sub.rawAnswers["74"] || "",
          customer: item.customer ? `${item.customer.firstName || ""} ${item.customer.lastName || ""}`.trim() || item.customer.name || "" : "",
          customerKey: item.customer?.id || "", purchaser: item.sub.rawAnswers["33"] || "",
          email: item.sub.rawAnswers["25"] || "",
          isFlex: false, flexReasons: [], submissionIsFlex: false,
          files: [], files_txn: [], files_uploadAll: [],
          files_typed: { receipt: [], required: [], agenda: [], w9: [] },
          notes: item.sub.rawAnswers["75"] || "Seed invoice", note: "",
          rawStatus: queueStatus === "posted" ? "paid" : "active",
          rawAnswers: item.sub.rawAnswers, rawMeta: {
            id: item.sub.submissionId, form_id: INVOICE_FORM_ID,
            status: queueStatus === "posted" ? "paid" : "active",
            created_at: item.sub.createdAt.slice(0, 10), updated_at: now,
          },
          grantId: item.grant?.id || null, lineItemId: item.lineItem?.id || null,
          customerId: item.customer?.id || null, enrollmentId: null,
          creditCardId: null,
          ledgerEntryId: queueStatus === "posted" ? rid("led") : null,
          reversalEntryId: null,
          invoiceStatus, invoicedAt: invoiceStatus === "invoiced" ? now : null,
          invoicedBy: invoiceStatus === "invoiced" ? "seed" : null, invoiceRef: null,
          okUnassigned: false, okUnassignedAt: null, okUnassignedBy: null,
          extractionErrors: [], extractionPath: "hardcoded",
          queueStatus, voidedAt: null, voidedBy: null,
          postedAt: queueStatus === "posted" ? now : null, postedBy: queueStatus === "posted" ? "seed" : null,
          reopenedAt: null, reopenedBy: null, reopenReason: null,
          createdAtISO: item.sub.createdAt, updatedAtISO: now,
          system: { lastWriter: "seed-emulator", lastWriteAt: now, extractionVersion: 1 },
        },
      });
    }
  }

  return out;
}

// ─── Projection Queue Items (from enrollment payments) ────────────────────────

function buildProjectionQueueItems(enrollments, grantsById, customersById) {
  const now = new Date().toISOString();
  const out = [];
  for (const e of enrollments) {
    const grant = grantsById.get(String(e.grantId || "")) || null;
    const customer = customersById.get(String(e.customerId || "")) || null;
    const customerName = customer?.name || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "";
    for (const p of e.payments || []) {
      if (!p.id || !p.dueDate || !p.amount || p.void) continue;
      if (p.paid) continue; // paid ones become ledger entries
      const docId = `projection_${e.id}_${p.id}`;
      const typeMap = { deposit: "Deposit", prorated: "Prorated Rent", service: "Support Service", monthly: "Rental Assistance" };
      const typeLabel = typeMap[p.type] || "Rental Assistance";
      const status = "pending";
      out.push({
        id: docId,
        value: {
          id: docId, baseId: docId, submissionId: p.id, paymentId: p.id,
          formId: "projection", formAlias: "enrollment-projection",
          formTitle: "Enrollment Projection", schemaVersion: 1,
          source: "projection", orgId: e.orgId || opts.orgId,
          createdAt: `${p.dueDate}T00:00:00`, dueDate: p.dueDate, month: p.dueDate.slice(0, 7),
          amount: Number(p.amount || 0),
          merchant: customerName || typeLabel,
          expenseType: p.type || "projection", program: "", billedTo: "", project: "",
          purchasePath: "customer", card: "", cardBucket: "", txnNumber: null,
          purpose: typeLabel, paymentMethod: "", serviceType: p.type || "", otherService: "",
          serviceScope: "", wex: "", descriptor: typeLabel,
          customer: customerName, customerKey: "", purchaser: "", email: "",
          isFlex: false, flexReasons: [], submissionIsFlex: false,
          files: [], files_txn: [], files_uploadAll: [],
          files_typed: { receipt: [], required: [], agenda: [], w9: [] },
          notes: p.comment || "", note: p.comment || "",
          rawStatus: "unpaid", rawAnswers: {}, rawMeta: {
            id: p.id, form_id: "projection", status: "unpaid",
            created_at: p.dueDate, updated_at: now,
          },
          grantId: e.grantId || null, lineItemId: p.lineItemId || null,
          customerId: e.customerId || null, enrollmentId: e.id,
          creditCardId: null, ledgerEntryId: null, reversalEntryId: null,
          invoiceStatus: null, invoicedAt: null, invoicedBy: null, invoiceRef: null,
          okUnassigned: false, okUnassignedAt: null, okUnassignedBy: null,
          extractionErrors: [], extractionPath: "fallback",
          queueStatus: status, voidedAt: null, voidedBy: null,
          postedAt: null, postedBy: null, reopenedAt: null, reopenedBy: null, reopenReason: null,
          createdAtISO: now, updatedAtISO: now,
          compliance: {
            hmisComplete: !!(p.compliance?.hmisComplete),
            caseworthyComplete: !!(p.compliance?.caseworthyComplete),
          },
          system: { lastWriter: "seed-emulator", lastWriteAt: now, extractionVersion: 1 },
        },
      });
    }
  }
  return out;
}

function buildJotforms(customers, grants, n) {
  const formPool = [
    { id: "210001001", title: "Rental Assistance Intake", alias: "rental-assistance-intake", url: "https://form.jotform.com/210001001" },
    { id: "210001002", title: "Utility Assistance Intake", alias: "utility-assistance-intake", url: "https://form.jotform.com/210001002" },
    { id: "210001003", title: "Housing Stability Follow-up", alias: "housing-stability-follow-up", url: "https://form.jotform.com/210001003" },
    { id: "210001004", title: "Program Recertification", alias: "program-recertification", url: "https://form.jotform.com/210001004" },
    { id: "210001005", title: "Move-In Inspection", alias: "move-in-inspection", url: "https://form.jotform.com/210001005" },
    { id: "210001006", title: "Landlord Verification", alias: "landlord-verification", url: "https://form.jotform.com/210001006" },
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = choose(customers);
    const g = choose(grants);
    const form = choose(formPool);
    const submissionId = `${form.id}-${100000 + i}`;
    const id = rid("jsub");
    const status = maybe(0.88) ? "active" : maybe(0.7) ? "archived" : "deleted";
    const amount = randAmount(200, 1800);
    const lineItems = Array.isArray(g?.budget?.lineItems) ? g.budget.lineItems : [];
    const li = lineItems.length ? choose(lineItems) : null;
    const createdAt = new Date(Date.now() - randInt(0, 45) * 24 * 60 * 60 * 1000).toISOString();
    const updatedAt = new Date(Date.now() - randInt(0, 10) * 24 * 60 * 60 * 1000).toISOString();
    out.push({
      id,
      value: {
        id,
        orgId: opts.orgId,
        formId: form.id,
        formTitle: form.title,
        submissionId,
        status,
        active: status === "active",
        deleted: status === "deleted",
        source: choose(["api", "webhook", "sync", "manual"]),
        customerId: c.id,
        programId: null,
        enrollmentId: null,
        cwId: c.cwId || null,
        hmisId: c.hmisId || null,
        formAlias: form.alias,
        fieldMap: {
          customerId: "q_customer_id",
          grantId: "q_grant_id",
          amount: "q_requested_amount",
        },
        grantId: g.id,
        ip: `10.0.${randInt(1, 254)}.${randInt(1, 254)}`,
        statusRaw: status,
        submissionUrl: `${form.url}/${submissionId}`,
        editUrl: `${form.url}/${submissionId}/edit`,
        pdfUrl: `${form.url}/${submissionId}/pdf`,
        answers: {
          q_customer_id: c.id,
          q_grant_id: g.id,
          q_requested_amount: amount,
          q_household_size: randInt(1, 6),
          q_notes: choose(["Initial intake", "Urgent utility risk", "Follow-up needed"]),
        },
        raw: {
          seed: true,
          provider: "jotform",
          submissionId,
        },
        calc: {
          amount,
          currency: "USD",
          amounts: [amount],
          budgetKey: li?.id || null,
          lineItems: li
            ? [{ key: String(li.id), label: String(li.label || li.id), amount }]
            : [],
        },
        budget: {
          total: Number(g?.budget?.total || amount),
          totals: {
            total: Number(g?.budget?.total || amount),
            projected: Number(g?.budget?.totals?.projected || 0),
            spent: Number(g?.budget?.totals?.spent || 0),
            balance: Number(g?.budget?.totals?.balance || 0),
            projectedBalance: Number(g?.budget?.totals?.projectedBalance || 0),
            remaining: Number(g?.budget?.totals?.balance || 0),
          },
          lineItems: lineItems.slice(0, 3).map((x) => ({
            id: String(x?.id || rid("li")),
            label: String(x?.label || x?.id || ""),
            amount: Number(x?.amount || 0),
            projected: Number(x?.projected || 0),
            spent: Number(x?.spent || 0),
            projectedInWindow: 0,
            spentInWindow: 0,
            locked: Boolean(x?.locked),
          })),
          createdAt,
          updatedAt,
        },
        jotformCreatedAt: createdAt,
        jotformUpdatedAt: updatedAt,
        createdAt,
        updatedAt,
      },
    });
  }
  return out;
}

function buildJotformDigestMaps(jotforms, n = 8) {
  const byForm = new Map();
  for (const row of jotforms) {
    const v = row?.value || {};
    const formId = String(v.formId || "").trim();
    if (!formId || byForm.has(formId)) continue;
    byForm.set(formId, {
      formId,
      formAlias: v.formAlias || null,
      formTitle: v.formTitle || null,
    });
  }

  const picks = Array.from(byForm.values()).slice(0, Math.max(1, n));
  return picks.map((f, i) => ({
    id: f.formId,
    value: {
      id: f.formId,
      orgId: opts.orgId,
      formId: f.formId,
      formAlias: f.formAlias,
      formTitle: f.formTitle,
      header: {
        show: true,
        title: f.formTitle || `Form ${i + 1}`,
        subtitle: "Seed digest map",
      },
      sections: [
        { id: "household", label: "Household", show: true, order: 0 },
        { id: "request", label: "Request", show: true, order: 1 },
      ],
      fields: [
        { key: "q_customer_id", label: "Customer ID", questionLabel: "Customer ID", type: "question", sectionId: "household", show: true, hideIfEmpty: true, order: 0 },
        { key: "q_household_size", label: "Household Size", questionLabel: "Household Size", type: "question", sectionId: "household", show: true, hideIfEmpty: true, order: 1 },
        { key: "q_requested_amount", label: "Requested Amount", questionLabel: "Requested Amount", type: "question", sectionId: "request", show: true, hideIfEmpty: true, order: 2 },
      ],
      options: { hideEmptyFields: true, showQuestions: true, showAnswers: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));
}

function buildTours(existingTours) {
  const base = Array.isArray(existingTours) ? existingTours : [];
  const extra = [
    {
      id: "seed-casemanagers",
      name: "Case Managers Tour",
      version: 1,
      updatedAt: new Date().toISOString(),
      steps: [
        { id: "cm-1", route: "/casemanagers", selector: "body", title: "Case Managers", body: "Seed tour step." },
      ],
      orgId: opts.orgId,
    },
    {
      id: "seed-customers",
      name: "Customers Tour",
      version: 1,
      updatedAt: new Date().toISOString(),
      steps: [
        { id: "cust-1", route: "/customers", selector: "body", title: "Customers", body: "Seed tour step." },
      ],
      orgId: opts.orgId,
    },
  ];
  return [...base, ...extra];
}

function computeMetrics(customers, grants, enrollments, users) {
  const activeCustomers = customers.filter((c) => c.active).length;
  const inactiveCustomers = customers.length - activeCustomers;
  const activeGrants = grants.filter((g) => g.active).length;
  const inactiveGrants = grants.length - activeGrants;
  const activeEnrollments = enrollments.filter((e) => e.active === true && e.deleted !== true).length;
  const deletedEnrollments = enrollments.filter((e) => e.deleted === true || String(e.status || "").toLowerCase() === "deleted").length;
  const inactiveEnrollments = Math.max(0, enrollments.length - activeEnrollments - deletedEnrollments);

  const activePop = { youth: 0, individuals: 0, families: 0 };
  const customerStatusCounts = {};
  for (const c of customers) {
    const st = String(c.status || (c.active ? "active" : "inactive")).toLowerCase();
    customerStatusCounts[st] = (customerStatusCounts[st] || 0) + 1;
    if (!c.active) continue;
    const pop = String(c.population || "").toLowerCase();
    if (pop === "youth") activePop.youth += 1;
    else if (pop === "individual" || pop === "individuals") activePop.individuals += 1;
    else if (pop === "family" || pop === "families") activePop.families += 1;
  }

  const grantStatusCounts = {};
  const grantKindCounts = { grant: 0, program: 0 };
  let activeGrantKind = 0;
  let inactiveGrantKind = 0;
  let activeProgramKind = 0;
  let inactiveProgramKind = 0;
  for (const g of grants) {
    const st = String(g.status || (g.active ? "active" : "draft")).toLowerCase();
    grantStatusCounts[st] = (grantStatusCounts[st] || 0) + 1;
    const kind = String(g.kind || "").toLowerCase() === "program" ? "program" : "grant";
    grantKindCounts[kind] += 1;
    if (kind === "grant") {
      if (g.active) activeGrantKind += 1;
      else inactiveGrantKind += 1;
    } else if (g.active) activeProgramKind += 1;
    else inactiveProgramKind += 1;
  }

  const enrollmentStatusCounts = {};
  for (const e of enrollments) {
    const st = String(e.status || (e.active ? "active" : "closed")).toLowerCase();
    enrollmentStatusCounts[st] = (enrollmentStatusCounts[st] || 0) + 1;
  }

  const allUsers = [...(users.admin || []), ...(users.cm || []), ...(users.compliance || [])];
  const roleCounts = {
    admin: (users.admin || []).length,
    casemanager: (users.cm || []).length,
    compliance: (users.compliance || []).length,
  };

  return [
    {
      id: "customers",
      value: {
        total: customers.length,
        active: activeCustomers,
        inactive: inactiveCustomers,
        active_population: activePop,
        status: customerStatusCounts,
        updatedAt: new Date().toISOString(),
      },
    },
    {
      id: "grants",
      value: {
        total: grants.length,
        active: activeGrants,
        inactive: inactiveGrants,
        activeGrants: activeGrantKind,
        inactiveGrants: inactiveGrantKind,
        activePrograms: activeProgramKind,
        inactivePrograms: inactiveProgramKind,
        kind: grantKindCounts,
        status: grantStatusCounts,
        updatedAt: new Date().toISOString(),
      },
    },
    {
      id: "enrollments",
      value: {
        total: enrollments.length,
        active: activeEnrollments,
        inactive: inactiveEnrollments,
        deleted: deletedEnrollments,
        status: enrollmentStatusCounts,
        updatedAt: new Date().toISOString(),
      },
    },
    {
      id: "users",
      value: {
        total: allUsers.length,
        active: allUsers.length,
        inactive: 0,
        role_counts: roleCounts,
        updatedAt: new Date().toISOString(),
      },
    },
  ];
}

async function run() {
  log("project:", opts.projectId);
  log("firestore emulator:", opts.firestoreHost);
  log("auth emulator:", opts.authHost);
  log("org:", opts.orgId);
  log("mode:", { wipe: opts.wipe, legacy: opts.legacy, dryRun: opts.dryRun, preset });

  if (opts.wipe && !opts.dryRun) {
    log("wiping Firestore emulator...");
    await wipeFirestoreEmulator();
  }

  log("seeding auth users...");
  const users = opts.dryRun
    ? {
        admin: Array.from({ length: opts.admin }).map((_, i) => ({ uid: `dry_admin_${i}`, email: "", displayName: `Dry Admin ${i}` })),
        cm: Array.from({ length: opts.cm }).map((_, i) => ({ uid: `dry_cm_${i}`, email: "", displayName: `Dry CM ${i}` })),
        compliance: Array.from({ length: opts.compliance }).map((_, i) => ({ uid: `dry_comp_${i}`, email: "", displayName: `Dry Compliance ${i}` })),
      }
    : await seedAuthUsers();

  const generatedGrants = Array.from({ length: opts.grants }).map((_, i) => generatedGrant(i));
  const generatedCustomers = Array.from({ length: opts.customers }).map((_, i) => generatedCustomer(i, users.cm));

  const grantsById = new Map(generatedGrants.map((g) => [g.id, g]));

  let legacyCustomers = [];
  let legacyEnrollments = [];
  let legacyTours = [];

  if (opts.legacy) {
    const clientsJson = await fileJsonSafe(path.join(SEEDS_DIR, "clients.json"));
    const enrollmentsJson = await fileJsonSafe(path.join(SEEDS_DIR, "enrollments.json"));
    const toursJson = await fileJsonSafe(path.join(SEEDS_DIR, "tours.json"));
    const clients = Array.isArray(clientsJson?.clients) ? clientsJson.clients : [];
    const enrolls = Array.isArray(enrollmentsJson?.enrollments) ? enrollmentsJson.enrollments : [];
    legacyCustomers = clients.map((r) => normalizeCustomerLegacy(r, users.cm));

    for (const e of enrolls) {
      const gid = String(e.grantId || "");
      if (gid && !grantsById.has(gid)) {
        const placeholder = {
          ...generatedGrant(0),
          id: gid,
          name: `Legacy Grant ${gid.slice(0, 8)}`,
          updatedAt: new Date().toISOString(),
        };
        grantsById.set(gid, placeholder);
      }
    }

    const mergedCustomers = [...generatedCustomers, ...legacyCustomers];
    const customerById = new Map(mergedCustomers.map((c) => [String(c.id), c]));
    legacyEnrollments = enrolls.map((r) => normalizeEnrollmentLegacy(r, customerById, grantsById));
    legacyTours = Array.isArray(toursJson) ? toursJson : [];
  }

  const grantsRaw = Array.from(grantsById.values());
  const customersRaw = [...generatedCustomers, ...legacyCustomers];

  const generatedEnrollments = [];
  customersRaw.forEach((c, i) => {
    const count = c.active ? (maybe(0.2) ? 2 : 1) : maybe(0.35) ? 1 : 0;
    for (let x = 0; x < count; x++) generatedEnrollments.push(generatedEnrollment(c, grantsRaw, i * 3 + x));
  });
  const enrollmentsRaw = [...generatedEnrollments, ...legacyEnrollments];

  const { grantsSafe: grants, customersSafe: customers, enrollmentsSafe: enrollments } =
    sanitizeCoreIds({ grants: grantsRaw, customers: customersRaw, enrollments: enrollmentsRaw });

  const grantsWithMetrics = attachGrantEnrollmentCounts(grants, enrollments);
  const userTasks = buildUserTasks(enrollments, opts.otherTasks);
  const rollups = buildRollups(enrollments, userTasks);
  const userExtras = attachRollupsToUserExtras(makeUserExtras(users, customers), rollups);
  const templates = buildAssessmentTemplates(grantsWithMetrics, opts.templates);
  const submissions = buildAssessmentSubmissions(templates, enrollments, customers, opts.submissions);
  const jotforms = buildJotforms(customers, grantsWithMetrics, opts.jotforms);
  const jotformDigestMaps = buildJotformDigestMaps(jotforms);
  const tours = buildTours(legacyTours);
  const metrics = computeMetrics(customers, grantsWithMetrics, enrollments, users);
  const orgSeed = buildOrgSeed(opts.orgId);
  const orgConfigDocs = buildOrgConfigSeeds(opts.orgId);

  const ledgerRows = [];
  const grantById = new Map(grantsWithMetrics.map((g) => [String(g.id), g]));
  const customerById = new Map(customers.map((c) => [String(c.id), c]));

  // ── Spend forms (CC + Invoice) and paymentQueue ─────────────────────────────
  const creditCards = buildCreditCards();
  const spendItems = buildSpendSubmissions(customers, grantsWithMetrics, creditCards);
  const spendJotformSubs = spendItems.map((x) => ({ id: x.sub.id, value: x.sub }));
  const ccAndInvoiceQueueItems = buildPaymentQueueFromSpend(spendItems, creditCards);
  const projectionQueueItems = buildProjectionQueueItems(enrollments, grantById, customerById);
  const allPaymentQueueItems = [...ccAndInvoiceQueueItems, ...projectionQueueItems];
  for (const e of enrollments) {
    const eWithRefs = {
      ...e,
      _grant: grantById.get(String(e.grantId || "")) || null,
      _customer: customerById.get(String(e.customerId || "")) || null,
    };
    for (const p of e.payments || []) {
      if (ledgerRows.length >= opts.ledger) break;
      if (p.paid || maybe(0.25)) ledgerRows.push({ id: rid("led"), value: makeLedgerEntry(eWithRefs, p) });
    }
    if (ledgerRows.length >= opts.ledger) break;
  }

  const spends = [];
  for (const e of enrollments) {
    for (const p of e.payments || []) {
      if (!p.paid) continue;
      const sid = rid("sp");
      spends.push({
        enrollmentId: e.id,
        spendId: sid,
        value: {
          id: sid,
          orgId: e.orgId || opts.orgId,
          paymentId: p.id,
          lineItemId: p.lineItemId || null,
          amount: Number(p.amount || 0),
          source: "enrollment",
          grantId: e.grantId || null,
          enrollmentId: e.id || null,
          customerId: e.customerId || null,
          caseManagerId: e.caseManagerId || null,
          paid: true,
          status: "paid",
          note: "seed spend",
          dueDate: p.dueDate || null,
          month: monthKey(p.dueDate),
          ts: new Date().toISOString(),
        },
      });
    }
  }

  const collections = {
    orgs: [orgSeed],
    customers: customers.map((x) => ({ id: x.id, value: x })),
    grants: grantsWithMetrics.map((x) => ({ id: x.id, value: x })),
    customerEnrollments: enrollments.map((x) => ({ id: x.id, value: x })),
    userExtras,
    userTasks,
    assessmentTemplates: templates,
    assessmentSubmissions: submissions,
    jotformSubmissions: [...jotforms, ...spendJotformSubs],
    jotformDigestMaps,
    tours: tours.map((x) => ({ id: x.id, value: x })),
    ledger: ledgerRows,
    metrics,
    creditCards: creditCards.map((x) => ({ id: x.id, value: x.value })),
    paymentQueue: allPaymentQueueItems,
  };

  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));
  counts.orgConfig = orgConfigDocs.length;
  counts.spends = spends.length;

  log("planned docs:", counts);
  if (opts.dryRun) {
    log("dry run complete; no writes performed.");
    return;
  }

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    console.error("[seed] write error:", err.documentRef.path, err.code, err.message);
    if (err.failedAttempts < 3) return true;
    return false;
  });

  for (const [collection, docs] of Object.entries(collections)) {
    for (const d of docs) {
      writer.set(db.collection(collection).doc(String(d.id)), d.value, { merge: true });
    }
  }
  for (const s of spends) {
    writer.set(
      db.collection("customerEnrollments").doc(String(s.enrollmentId)).collection("spends").doc(String(s.spendId)),
      s.value,
      { merge: true }
    );
  }
  for (const d of orgConfigDocs) {
    writer.set(
      db.collection("orgs").doc(String(opts.orgId)).collection("Config").doc(String(d.id)),
      d.value,
      { merge: true }
    );
  }

  await writer.close();
  log("seed complete.");
  log("tip: run emulators with --import=.emulator-data --export-on-exit to persist hydrated state.");
}

run().catch((err) => {
  console.error("[seed] fatal:", err?.message || err);
  process.exit(1);
});
