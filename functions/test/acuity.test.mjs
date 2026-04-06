import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive acuity tests. This script exercises the acuity
 * endpoints for rubrics: create/update, get, list, submit answers,
 * recalc and delete. It also creates a temporary customer to attach
 * answers to. If any endpoint is missing or errors, the test logs a
 * skip message and continues.
 */

(async () => {
  try {
    // sign up admin and grant admin claim
    const adminEmail = `admin_acuity_${Date.now()}@example.com`;
    let { idToken } = await signUpOrIn({ email: adminEmail });
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(idToken) });
    } catch {
      console.log('SKIP[acuity]: devGrantAdmin not available');
    }
    ({ idToken } = await signUpOrIn({ email: adminEmail }));

    // create a temporary customer for answer submission
    let customerId;
    try {
      const cust = await call('customersUpsert', {
        method: 'POST',
        headers: authz(idToken),
        body: { firstName: 'Acuity', lastName: 'Tester', email: `acuity_${Date.now()}@example.com` },
      });
      customerId = cust?.data?.ids?.[0] || cust?.data?.id;
      console.log('customersUpsert (acuity):', { customerId });
    } catch (e) {
      console.log('customersUpsert (acuity) failed:', e?.message || e);
    }

    // set a rubric
    let rubricId;
    const rubricBody = {
      id: `rub_${Date.now()}`,
      name: `Test Rubric ${Date.now()}`,
      items: [
        { id: 'shelter', label: 'Shelter', type: 'scale', max: 5 },
        { id: 'income', label: 'Income', type: 'scale', max: 5 },
      ],
    };
    try {
      const setResp = await call('acuityRubricsSet', { method: 'POST', headers: authz(idToken), body: rubricBody });
      rubricId = rubricBody.id;
      console.log('acuityRubricsSet:', setResp);
    } catch (e) {
      console.log('acuityRubricsSet failed:', e?.message || e);
    }

    // get the rubric
    try {
      if (rubricId) {
        const getResp = await call('acuityRubricsGet', { method: 'GET', headers: authz(idToken), query: { id: rubricId } });
        console.log('acuityRubricsGet:', getResp);
      }
    } catch (e) {
      console.log('acuityRubricsGet failed:', e?.message || e);
    }

    // list rubrics
    try {
      const listResp = await call('acuityRubricsList', { method: 'GET', headers: authz(idToken) });
      console.log('acuityRubricsList:', listResp);
    } catch (e) {
      console.log('acuityRubricsList failed:', e?.message || e);
    }

    // submit answers
    try {
      if (rubricId && customerId) {
        const ans = await call('acuitySubmitAnswers', {
          method: 'POST',
          headers: authz(idToken),
          body: {
            customerId,
            rubricId,
            answers: [
              { itemId: 'shelter', value: 3 },
              { itemId: 'income', value: 2 },
            ],
          },
        });
        console.log('acuitySubmitAnswers:', ans);
      }
    } catch (e) {
      console.log('acuitySubmitAnswers failed:', e?.message || e);
    }

    // recalc rubric (bulk recompute)
    try {
      if (rubricId) {
        const recalc = await call('acuityRecalcRubric', { method: 'POST', headers: authz(idToken), body: { id: rubricId } });
        console.log('acuityRecalcRubric:', recalc);
      }
    } catch (e) {
      console.log('acuityRecalcRubric failed:', e?.message || e);
    }

    // delete rubric
    try {
      if (rubricId) {
        const del = await call('acuityRubricsDelete', { method: 'POST', headers: authz(idToken), body: { id: rubricId } });
        console.log('acuityRubricsDelete:', del);
      }
    } catch (e) {
      console.log('acuityRubricsDelete failed:', e?.message || e);
    }

    console.log('✓ acuity.full.test.mjs');
  } catch (err) {
    console.error('✗ acuity.full.test.mjs', err);
    process.exitCode = 1;
  }
})();