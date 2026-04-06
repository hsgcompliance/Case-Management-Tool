// functions/test.mjs
// Node 18+ (global fetch). Run: `node functions/test.mjs`
//
// ENV (emulator-friendly):
//  GCLOUD_PROJECT=housing-db-v2
//  PROJECT_ID=housing-db-v2
//  REGION=us-central1
//  FN_BASE=http://127.0.0.1:5001/housing-db-v2/us-central1   # no /api for individual HTTP functions
//  FIRESTORE_EMULATOR_HOST=127.0.0.1:5002
//  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:5005
//  DEV_EMAIL=admin.harness@example.com
//  DEV_PASS=change-me
//
// Optional:
//  AUTH_BEARER=eyJ...  # overridden by emulator bootstrap below if on localhost
//
// Artifacts: out/run-YYYYMMDDHHMMSS/*

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// --- Config ---------------------------------------------------------------
const REGION = process.env.REGION || "us-central1";
const PROJ = process.env.GCLOUD_PROJECT || "demo";
const BASE = (process.env.FN_BASE || `http://127.0.0.1:5001/${PROJ}/${REGION}`).replace(/\/+$/, "");

let AUTH = process.env.AUTH_BEARER || null; // becomes emulator token after bootstrap
const PROJECT_ID = process.env.PROJECT_ID || PROJ;
const AUTH_EMU_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:5005";
const AUTH_EMU_BASE = `http://${AUTH_EMU_HOST}/identitytoolkit.googleapis.com/v1`;
const DEV_EMAIL = process.env.DEV_EMAIL || "admin.harness@example.com";
const DEV_PASS  = process.env.DEV_PASS  || "change-me";

const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const OUT_DIR = path.resolve("out", `run-${RUN_ID}`);

await fs.mkdir(OUT_DIR, { recursive: true });

// Optional Firestore harvest support (admin SDK). Loaded lazily.
let admin = null;

// --- Utilities ------------------------------------------------------------
async function writeOut(rel, data) {
  const full = path.join(OUT_DIR, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2));
  return full;
}

function h2(title) { console.log(`\n=== ${title} ===`); }

function short(obj) {
  try { const s = JSON.stringify(obj); return s.length > 300 ? s.slice(0, 300) + "…(trunc)" : s; }
  catch { return String(obj); }
}

function camelToRoute(s) {
  if (s.includes("/")) return s.replace(/^\/+/, "");
  return s.replace(/([a-z0-9])([A-Z])/g, "$1/$2").toLowerCase();
}

// --- Emulator Auth helpers -----------------------------------------------
async function emuJson(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } }

async function emuSignUpOrIn(email, password) {
  let r = await fetch(`${AUTH_EMU_BASE}/accounts:signUp?key=fake-key`, {
    method: "POST", headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  let d = await emuJson(r);
  if (!r.ok && d?.error?.message === "EMAIL_EXISTS") {
    r = await fetch(`${AUTH_EMU_BASE}/accounts:signInWithPassword?key=fake-key`, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    d = await emuJson(r);
  }
  if (!r.ok) throw new Error(`auth failed: ${r.status} ${JSON.stringify(d)}`);
  return { idToken: d.idToken, localId: d.localId };
}

async function emuGrantAdmin(localId, claims = { admin: true, roles: ["admin"] }) {
  const payload = { localId, customAttributes: claims };
  // Try new route, then legacy route
  let r = await fetch(`http://${AUTH_EMU_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
    method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
  });
  if (r.ok) return true;
  r = await fetch(`http://${AUTH_EMU_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts:update`, {
    method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
  });
  if (r.ok) return true;
  const t = await r.text(); throw new Error(`setAdminClaim failed: ${r.status} ${t}`);
}

const isEmu = /^(http:\/\/)?(127\.0\.0\.1|localhost)/i.test(BASE);

// Refresh our own bearer and persist a preview
async function refreshSelfAuth(reason = "manual") {
  const a = await emuSignUpOrIn(DEV_EMAIL, DEV_PASS);
  AUTH = a.idToken;
  const out = { reason, email: DEV_EMAIL, uid: a.localId, tokenPreview: a.idToken?.slice(0, 20) + "..." };
  await writeOut("raw/devAuth.json", out);
  return out;
}

// --- HTTP caller with auto path variants + auth refresh on 'revoked' ------
async function callRaw(name, { method = "POST", body, headers = {} } = {}) {
  const core = name.replace(/^\/+/, "");
  const route = camelToRoute(core);
  const prefix = (process.env.FN_PREFIX || "").replace(/^\/|\/$/g, "");
  const variants = [...new Set([prefix && `${prefix}/${core}`, prefix && `${prefix}/${route}`, core, route].filter(Boolean))];

  const finalHeaders = { "content-type": "application/json", ...headers };
  const attempts = [];

  for (const p of variants) {
    const url = `${BASE}/${p}`;
    let triedRefresh = false;

    while (true) {
      if (AUTH) finalHeaders["authorization"] = `Bearer ${AUTH}`;
      let res, text, data;
      try {
        res = await fetch(url, {
          method,
          headers: finalHeaders,
          body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
        });
        text = await res.text();
      } catch (err) {
        attempts.push({ url, status: 0, error: `Network error: ${err?.message || err}` });
        break;
      }
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (res.ok) return { ok: true, status: res.status, data, url };

      const msg = typeof data === "string" ? data : (data?.error || data?.message || data?.raw || "");
      const errStr = String(msg).toLowerCase();

      // If our token was revoked/expired, refresh once and retry this exact URL
      if (isEmu && !triedRefresh && (errStr.includes("revoked") || errStr.includes("expired") || res.status === 401)) {
        try {
          await refreshSelfAuth("auto-refresh");
          triedRefresh = true;
          continue; // retry same URL once with fresh token
        } catch (e) {
          attempts.push({ url, status: res.status, error: `auth refresh failed: ${e?.message || e}`, body: data });
          break;
        }
      }

      attempts.push({ url, status: res.status, error: data?.error || data || `HTTP ${res.status}` });
      break; // move to next variant
    }
  }

  return { ok: false, status: 0, error: "All path variants failed", attempts };
}

// Try multiple function names (best-effort). Returns first successful.
async function callOneOf(names, opts = {}) {
  const attempts = [];
  for (const n of names) {
    const r = await callRaw(n, opts);
    attempts.push({ name: n, ...r });
    if (r.ok) return { ...r, tried: attempts };
  }
  return { ok: false, error: "All candidates failed", tried: attempts };
}

async function step(name, fn) {
  const t0 = Date.now();
  h2(name);
  try {
    const out = await fn();
    await writeOut(`steps/${name.replace(/\s+/g, "_")}.json`, { ok: true, result: out });
    console.log(`✔ ${name} (${Date.now() - t0}ms)`);
    return out;
  } catch (err) {
    const e = { ok: false, error: err?.message || String(err), stack: err?.stack };
    await writeOut(`steps/${name.replace(/\s+/g, "_")}_ERROR.json`, e);
    console.warn(`✖ ${name} -> ${e.error}`);
    return null;
  }
}

function rid(prefix) {
  const s = crypto.randomBytes(4).toString("hex");
  return `${prefix}_${RUN_ID}_${s}`;
}

// --- Test data seeds ------------------------------------------------------
const adminEmail = `admin+${RUN_ID}@example.com`;
const inviteeEmail = `invitee+${RUN_ID}@example.com`;
const bulkEmails = Array.from({ length: 4 }).map((_, i) => `user${i + 1}+${RUN_ID}@example.com`);
const grantNames = [`Rapid Rehouse ${RUN_ID}`, `Stable Start ${RUN_ID}`];

const ctx = { users: {}, customers: {}, grants: [], enrollments: [], acuity: {} };

// --- Flow -----------------------------------------------------------------

await step("Debug Context", async () => {
  const out = { BASE, PROJECT_ID, REGION, AUTH_EMU_HOST, FN_PREFIX: (process.env.FN_PREFIX || "").replace(/^\/|\/$/g, "") || null };
  await writeOut("raw/context.json", out);
  return out;
});

await step("Dev Auth (Emulator): sign in + grant admin + refresh", async () => {
  if (!isEmu) return { skipped: true, reason: "not emulator" };
  let a = await emuSignUpOrIn(DEV_EMAIL, DEV_PASS);
  try {
    await emuGrantAdmin(a.localId, { admin: true, roles: ["admin"] });
  } catch {
    // fallback: function sets claims on *caller* (this will revoke our token once)
    const r = await callRaw("devGrantAdmin", { method: "POST", headers: { authorization: `Bearer ${a.idToken}` } });
    if (!r.ok) throw new Error(`devGrantAdmin failed: ${r.status} ${JSON.stringify(r.data || r.error)}`);
  }
  // refresh after claims/revocation
  const out = await refreshSelfAuth("bootstrap");
  return out;
});

await step("Health", async () => callRaw("health", { method: "GET" }));

await step("Create Admin User", async () => {
  const r = await callOneOf(["usersCreate"], { method: "POST", body: { email: adminEmail, name: "Admin Test", active: true } });
  await writeOut("raw/usersCreate.json", r);
  if (r.ok) ctx.users.admin = r.data;
  return r;
});

await step("Invite User", async () => {
  const r = await callOneOf(["usersInvite"], { method: "POST", body: { email: inviteeEmail } });
  await writeOut("raw/usersInvite.json", r);
  if (r.ok) ctx.users.invitee = r.data;
  return r;
});

await step("Grant Admin to New User (no token revoke)", async () => {
  // IMPORTANT: do NOT call devGrantAdmin here — it revokes the *caller*'s token.
  const uid = ctx.users?.admin?.id || ctx.users?.admin?.uid || undefined;
  const r = await callOneOf(["usersSetRole"], { method: "POST", body: { email: adminEmail, uid, role: "admin", admin: true } });
  await writeOut("raw/usersSetRole.json", r);
  // If backend uses revoke on target user, our token is still fine.
  return r;
});

await step("Bulk Create Users (2 active, 2 inactive)", async () => {
  const results = [];
  for (let i = 0; i < bulkEmails.length; i++) {
    const email = bulkEmails[i];
    const create = await callOneOf(["usersCreate"], { method: "POST", body: { email, name: `Test User ${i + 1}`, active: i < 2 } });
    results.push({ create });
    if (create.ok) {
      const uid = create.data?.id || create.data?.uid || null;
      ctx.users[email] = { uid, email, data: create.data };
      if (i >= 2 && uid) {
        const setActive = await callOneOf(["usersSetActive"], { method: "POST", body: { uid, active: false } });
        results[results.length - 1].setActive = setActive;
      }
    }
  }
  await writeOut("raw/bulkUsers.json", results);
  return results;
});

await step("Bulk Create Grants with placeholder assessments/eligibility", async () => {
  const results = [];
  for (const name of grantNames) {
    const body = {
      id: rid("g"),
      name,
      orgId: "org_demo",
      budget: {
        lineItems: [
          { id: "rent", label: "Rental Assistance", amount: 10000, projected: 0, spent: 0 },
          { id: "util", label: "Utility Assistance", amount: 5000, projected: 0, spent: 0 },
        ],
        totals: { projected: 0, spent: 0, remaining: 15000 },
      },
      assessments: { required: [{ id: "intake", label: "Intake", offsetDays: 0 }, { id: "90d", label: "90 Day", offsetDays: 90 }] },
      eligibility: { minAge: 18, county: "Any" },
    };
    const r = await callOneOf(["grantsUpsert", "grantsCreate"], { method: "POST", body });
    results.push({ name, r });
    if (r.ok) ctx.grants.push(r.data?.id || body.id);
  }
  await writeOut("raw/grantsUpsert.json", results);
  return results;
});

await step("Create Customers (one active, one inactive)", async () => {
  const active = await callOneOf(["customersUpsert"], { method: "POST", body: { id: rid("custA"), firstName: "Alex", lastName: "Active", active: true } });
  const inactive = await callOneOf(["customersUpsert"], { method: "POST", body: { id: rid("custI"), firstName: "Ina", lastName: "Inactive", active: false } });
  if (active.ok) ctx.customers.active = active.data?.id || "custA";
  if (inactive.ok) ctx.customers.inactive = inactive.data?.id || "custI";
  await writeOut("raw/customersUpsert.json", { active, inactive });
  return { active, inactive };
});

await step("Enroll active & inactive customer into grants", async () => {
  const results = [];

  const e1 = await callOneOf(["enrollmentsUpsert"], {
    method: "POST",
    body: {
      id: rid("enrA"),
      grantId: ctx.grants[0],
      customerId: ctx.customers.active,
      startDate: new Date().toISOString().slice(0, 10),
      payments: [],
      taskSchedule: [],
    },
  });
  results.push({ e1 });
  if (e1.ok) ctx.enrollments.push(e1.data?.id || "enrA");

  const e2 = await callOneOf(["enrollmentsUpsert"], {
    method: "POST",
    body: {
      id: rid("enrI"),
      grantId: ctx.grants[1],
      customerId: ctx.customers.inactive,
      startDate: new Date().toISOString().slice(0, 10),
      payments: [],
      taskSchedule: [],
    },
  });
  results.push({ e2 });
  if (e2.ok) ctx.enrollments.push(e2.data?.id || "enrI");

  await writeOut("raw/enrollmentsUpsert.json", results);
  return results;
});

await step("Generate Task Schedule from Grant & add one-off task", async () => {
  const enrolId = ctx.enrollments[0];

  const gen = await callOneOf(["tasksGenerateScheduleWrite", "tasksGenerateSchedule"], {
    method: "POST",
    body: { enrollmentId: enrolId, strategy: "default", overwrite: true },
  });

  const addOne = await callOneOf(["tasksUpdateFields"], {
    method: "POST",
    body: {
      enrollmentId: enrolId,
      taskId: rid("tsk"),
      patch: { type: "Task", notes: "One-off verification", dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    },
  });

  await writeOut("raw/tasksGenerateAndAdd.json", { gen, addOne });
  return { gen, addOne };
});

await step("Generate payment projections for enrollment", async () => {
  const enrolId = ctx.enrollments[0];
  const firstDue = new Date(); firstDue.setDate(1); firstDue.setMonth(firstDue.getMonth() + 1);
  const YYYYMMDD = firstDue.toISOString().slice(0, 10);

  const generate = await callOneOf(["paymentsGenerateProjections"], {
    method: "POST",
    body: {
      enrollmentId: enrolId,
      plans: {
        rent: { firstDue: YYYYMMDD, months: 6, monthly: 900, lineItemId: "rent" },
        util: { firstDue: YYYYMMDD, months: 3, monthly: 150, lineItemId: "util" },
      },
      deposit: { enabled: true, date: YYYYMMDD, amount: 1200, lineItemId: "rent" },
    },
  });

  const sample = generate.ok ? generate.data?.payments || [] : [
    { type: "monthly", amount: 900, dueDate: YYYYMMDD,                         lineItemId: "rent" },
    { type: "monthly", amount: 900, dueDate: YYYYMMDD.replace(/-\d+$/, "-15"), lineItemId: "rent" },
    { type: "service", amount: 200, dueDate: YYYYMMDD,                         lineItemId: "util", note: "Setup" },
  ];

  const upsert = await callOneOf(["paymentsUpsertProjections"], { method: "POST", body: { enrollmentId: enrolId, payments: sample } });

  await writeOut("raw/paymentsGenerateUpsert.json", { generate, upsert });
  return { generate, upsert };
});

await step("Define an Acuity rubric & submit answers for active customer", async () => {
  const rubricId = rid("rub");
  const setRubric = await callOneOf(["acuityRubricsSet"], {
    method: "POST",
    body: {
      id: rubricId,
      name: `Test Rubric ${RUN_ID}`,
      items: [
        { id: "shelter", label: "Shelter", type: "scale", max: 5 },
        { id: "income",  label: "Income",  type: "scale", max: 5 },
      ],
    },
  });

  const submit = await callOneOf(["acuitySubmitAnswers"], {
    method: "POST",
    body: {
      customerId: ctx.customers.active,
      rubricId,
      answers: [
        { itemId: "shelter", value: 3 },
        { itemId: "income",  value: 2 },
      ],
    },
  });

  await writeOut("raw/acuity.json", { setRubric, submit });
  ctx.acuity = { rubricId, setRubric, submit };
  return { setRubric, submit };
});

// Optional: mark grant budgets for reconcile (if your triggers/scheduler present)
await step("Request budget reconcile for grants (flag needsRecalc)", async () => {
  const results = [];
  for (const gid of ctx.grants) {
    const r = await callOneOf(["paymentsRecalcGrantProjected", "paymentsUpdateGrantBudget"], { method: "POST", body: { grantId: gid } });
    results.push({ gid, r });
  }
  await writeOut("raw/paymentsRecalc.json", results);
  return results;
});

// --- Harvest DB snapshot (best-effort) ------------------------------------
await step("Harvest DB snapshot (best-effort)", async () => {
  try {
    const mod = await import("firebase-admin");
    admin = mod.default;
    try { admin.app(); } catch { admin.initializeApp({ projectId: PROJECT_ID }); }
    const db = admin.firestore();
    const collections = ["users", "customers", "grants", "customerEnrollments", "ledger", "auditFlags", "acuity"];
    const out = {};
    for (const col of collections) {
      const snap = await db.collection(col).limit(500).get();
      out[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await writeOut(`harvest/${col}.json`, out[col]);
    }
    await writeOut("harvest/_index.json", { collections, count: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])) });
    return { ok: true, collections };
  } catch (err) {
    return { ok: false, note: "Skipping harvest (no admin SDK / no access?)", error: err?.message || String(err) };
  }
});

// --- Cleanup --------------------------------------------------------------
await step("Delete Enrollments", async () => {
  const results = [];
  for (const id of ctx.enrollments) {
    const r = await callOneOf(["enrollmentsDelete", "enrollmentsAdminDelete"], { method: "POST", body: { id } });
    results.push({ id, r });
  }
  await writeOut("raw/deleteEnrollments.json", results);
  return results;
});

await step("Delete Customers", async () => {
  const ids = [ctx.customers.active, ctx.customers.inactive].filter(Boolean);
  const results = [];
  for (const id of ids) {
    const r = await callOneOf(["customersDelete", "customersAdminDelete"], { method: "POST", body: { id } });
    results.push({ id, r });
  }
  await writeOut("raw/deleteCustomers.json", results);
  return results;
});

await step("Delete Grants", async () => {
  const results = [];
  for (const gid of ctx.grants) {
    const r = await callOneOf(["grantsDelete"], { method: "POST", body: { id: gid } });
    results.push({ id: gid, r });
  }
  await writeOut("raw/deleteGrants.json", results);
  return results;
});

await step("Summary", async () => {
  const summary = { base: BASE, runId: RUN_ID, adminEmail, inviteeEmail, bulkEmails, grants: ctx.grants, customers: ctx.customers, enrollments: ctx.enrollments, acuity: ctx.acuity };
  await writeOut("summary.json", summary);
  console.log(short(summary));
  return summary;
});

console.log(`\nDone. Artifacts in: ${OUT_DIR}\n`);
