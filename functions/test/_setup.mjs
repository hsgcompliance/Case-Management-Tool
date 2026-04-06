import assert from 'node:assert/strict';

// Configuration for local emulators. Adjust PROJECT if your project ID differs.
export const PROJECT =
  process.env.PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  'housing-db-v2';
export const REGION  = 'us-central1';
export const HOSTS = {
  functions: process.env.FUNCTIONS_EMULATOR_ORIGIN || 'http://127.0.0.1:5001',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:5005',
};

/**
 * Helper to invoke an HTTPS function. Automatically builds the URL using
 * PROJECT and REGION. Supports GET and POST methods with optional query
 * parameters, JSON body and extra headers. Returns an object with
 * `status` and `data` (parsed JSON or text).
 *
 * @param {string} name Name of the deployed Cloud Function
 * @param {object} opts Options: method (default POST), query, body, headers
 */
export async function call(name, { method = 'POST', query = {}, body, headers = {} } = {}) {
  const prefix = process.env.FN_BASE || `${HOSTS.functions}/${PROJECT}/${REGION}`;
  const base = `${prefix}/${name}`;
  const url = new URL(base);
  if (method === 'GET') {
    for (const [k, v] of Object.entries(query || {})) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  const resp = await fetch(url, init);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : await resp.text();
  return { status: resp.status, data };
}

// Helpers for Auth emulator. Uses REST API to sign up or sign in a user.
const BASE_AUTH = (host) => `http://${host}/identitytoolkit.googleapis.com/v1`;
/**
 * Create or authenticate a user against the Auth emulator. Returns an
 * object containing an ID token, localId and email.
 * If the email already exists, signs in instead of creating a new user.
 */
export async function signUpOrIn({ email, password = 'change-me' }) {
  async function parseJson(r) {
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  const base = BASE_AUTH(HOSTS.auth);
  let r = await fetch(`${base}/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  let d = await parseJson(r);
  if (!r.ok && d?.error?.message === 'EMAIL_EXISTS') {
    r = await fetch(`${base}/accounts:signInWithPassword?key=fake-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    d = await parseJson(r);
  }
  if (!r.ok) throw new Error(`auth emulator: ${JSON.stringify(d)}`);
  return { idToken: d.idToken, localId: d.localId, email };
}

/**
 * Build Authorization header from an ID token. Returns an object
 * containing the Authorization header or an empty object if token is absent.
 */
export const authz = (idToken) => (idToken ? { Authorization: `Bearer ${idToken}` } : {});

/**
 * Assert that an HTTP response returned 200 and data.ok is true. Throws
 * assertion error otherwise.
 */
export function expectOk(resp) {
  assert.equal(resp.status, 200, `HTTP ${resp.status} – ${JSON.stringify(resp.data)}`);
  assert.equal(resp.data?.ok, true, `ok:false – ${JSON.stringify(resp.data)}`);
}
