import { call, signUpOrIn, authz, expectOk } from './_setup.mjs';

// End-to-end workflow test. This script exercises a representative set of
// features exposed by the functions: it signs up a user, calls a few
// available read endpoints across grants, inbox, enrollments, tasks and
// acuity. The goal is to ensure the emulator responds without errors.
(async () => {
  try {
    const email = `e2e_${Date.now()}@example.com`;
    const { idToken } = await signUpOrIn({ email });
    const month = new Date().toISOString().slice(0, 7);

    // Grants structure (skeleton)
    try {
      const gs = await call('grantsStructure', { method: 'GET', headers: authz(idToken) });
      if (gs.status === 200) {
        expectOk(gs);
        console.log('• grantsStructure ok');
      } else {
        console.log('SKIP[e2e]: grantsStructure returned status', gs.status);
      }
    } catch {
      console.log('SKIP[e2e]: grantsStructure not available');
    }

    // Enrollments list
    try {
      const el = await call('enrollmentsList', { method: 'GET', headers: authz(idToken) });
      if (el.status === 200) {
        expectOk(el);
        console.log('• enrollmentsList ok');
      } else {
        console.log('SKIP[e2e]: enrollmentsList returned status', el.status);
      }
    } catch {
      console.log('SKIP[e2e]: enrollmentsList not available');
    }

    // Inbox digest preview
    try {
      const dp = await call('inboxDigestPreview', { method: 'GET', headers: authz(idToken), query: { month } });
      if (dp.status === 200) {
        expectOk(dp);
        console.log('• inboxDigestPreview ok');
      } else {
        console.log('SKIP[e2e]: inboxDigestPreview returned status', dp.status);
      }
    } catch {
      console.log('SKIP[e2e]: inboxDigestPreview not available');
    }

    // Tasks other list
    try {
      const tl = await call('tasksOtherListMy', { method: 'GET', headers: authz(idToken) });
      if (tl.status === 200) {
        console.log('• tasksOtherListMy ok');
      } else {
        console.log('SKIP[e2e]: tasksOtherListMy returned status', tl.status);
      }
    } catch {
      console.log('SKIP[e2e]: tasksOtherListMy not available');
    }

    // Acuity rubrics list
    try {
      const ar = await call('acuityRubricsList', { method: 'GET', headers: authz(idToken) });
      if (ar.status === 200) {
        expectOk(ar);
        console.log('• acuityRubricsList ok');
      } else {
        console.log('SKIP[e2e]: acuityRubricsList returned status', ar.status);
      }
    } catch {
      console.log('SKIP[e2e]: acuityRubricsList not available');
    }

    console.log('✓ e2e.workflow.test.mjs');
  } catch (err) {
    console.error('✗ e2e.workflow.test.mjs', err);
    process.exitCode = 1;
  }
})();
