import { call, expectOk } from './_setup.mjs';

// Health endpoint test. Attempts to call the `health` function via the
// emulator. If the endpoint does not exist (404), logs a skip. On a
// successful call, asserts that { ok: true } is returned.
(async () => {
  try {
    const r = await call('health', { method: 'GET' });
    if (r.status === 404 || r.status === 405) {
      console.log('SKIP[health]: endpoint not available');
      return;
    }
    expectOk(r);
    console.log('✓ health.test.mjs');
  } catch (e) {
    console.error('✗ health.test.mjs', e);
    process.exitCode = 1;
  }
})();
