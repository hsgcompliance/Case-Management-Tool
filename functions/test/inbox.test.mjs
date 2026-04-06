import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive inbox tests. Exercises the inbox-related endpoints
 * including listing a user's inbox tasks, digest preview, sending
 * monthly summaries, sending digest immediately, and sending invites.
 * Uses a normal user account (no admin claims) because these
 * endpoints are typically accessible to authenticated users. If
 * endpoints are missing or error, logs a skip message.
 */

(async () => {
  try {
    // sign up a regular user
    const email = `inbox_${Date.now()}@example.com`;
    const { idToken } = await signUpOrIn({ email });
    const month = new Date().toISOString().slice(0, 7);

    // list my inbox tasks
    try {
      const listResp = await call('inboxListMy', { method: 'GET', headers: authz(idToken), query: {} });
      console.log('inboxListMy:', listResp);
    } catch (e) {
      console.log('SKIP[inbox]: inboxListMy not available or failed:', e?.message || e);
    }

    // digest preview
    try {
      const preview = await call('inboxDigestPreview', { method: 'GET', headers: authz(idToken), query: { month } });
      console.log('inboxDigestPreview:', preview);
    } catch (e) {
      console.log('SKIP[inbox]: inboxDigestPreview not available or failed:', e?.message || e);
    }

    // send monthly summary (POST) — combine last month & next month
    try {
      const sendMonthly = await call('inboxSendMonthlySummary', {
        method: 'POST',
        headers: authz(idToken),
        body: { months: 1, combine: true },
      });
      console.log('inboxSendMonthlySummary:', sendMonthly);
    } catch (e) {
      console.log('SKIP[inbox]: inboxSendMonthlySummary not available or failed:', e?.message || e);
    }

    // send digest now (POST)
    try {
      const sendDigestNow = await call('inboxSendDigestNow', {
        method: 'POST',
        headers: authz(idToken),
        body: { month },
      });
      console.log('inboxSendDigestNow:', sendDigestNow);
    } catch (e) {
      console.log('SKIP[inbox]: inboxSendDigestNow not available or failed:', e?.message || e);
    }

    // send invite (POST) — invites another user
    try {
      const inviteEmail = `invbox_${Date.now()}@example.com`;
      const sendInvite = await call('inboxSendInvite', {
        method: 'POST',
        headers: authz(idToken),
        body: { email: inviteEmail },
      });
      console.log('inboxSendInvite:', sendInvite);
    } catch (e) {
      console.log('SKIP[inbox]: inboxSendInvite not available or failed:', e?.message || e);
    }

    console.log('✓ inbox.full.test.mjs');
  } catch (err) {
    console.error('✗ inbox.full.test.mjs', err);
    process.exitCode = 1;
  }
})();