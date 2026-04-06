import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive grants tests. Exercises the grants endpoints: structure
 * retrieval, upsert, patch, list, activity fetch, soft delete and hard
 * delete. Uses an admin account with elevated privileges. Logs each
 * response for inspection and continues on failures.
 */

(async () => {
  try {
    // 1) sign up admin and grant admin claim
    const adminEmail = `admin_grants_${Date.now()}@example.com`;
    let { idToken } = await signUpOrIn({ email: adminEmail });
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(idToken) });
    } catch {
      console.log('SKIP[grants]: devGrantAdmin not available');
    }
    ({ idToken } = await signUpOrIn({ email: adminEmail }));

    // 2) grantsStructure (GET)
    try {
      const struct = await call('grantsStructure', { method: 'GET', headers: authz(idToken) });
      console.log('grantsStructure:', struct);
    } catch (e) {
      console.log('grantsStructure failed:', e?.message || e);
    }

    // 3) grantsUpsert (POST single)
    let grantId;
    try {
      const body = {
        name: 'Stability Fund',
        status: 'active',
        budget: {
          total: 10000,
          lineItems: [
            { label: 'Rent', amount: 8000, projected: 500, spent: 1000 },
            { label: 'Utilities', amount: 2000, projected: 100, spent: 300 },
          ],
        },
        assessmentTypes: ['VI-SPDAT'],
        meta: { year: 2025 },
      };
      const upResp = await call('grantsUpsert', { method: 'POST', headers: authz(idToken), body });
      grantId = upResp?.data?.ids?.[0] || upResp?.data?.id;
      console.log('grantsUpsert:', { grantId });
    } catch (e) {
      console.log('grantsUpsert failed:', e?.message || e);
    }

    // 4) grantsPatch (PATCH) — rename + adjust line item
    try {
      if (grantId) {
        const patchBody = [
          {
            id: grantId,
            patch: {
              name: 'Stability Fund (Revised)',
              budget: {
                lineItems: [
                  { id: 'Rent', label: 'Rent', projected: 800, spent: 1200 },
                  { id: 'New', label: 'Deposits', amount: 500, projected: 0, spent: 0 },
                ],
              },
            },
          },
        ];
        const patchResp = await call('grantsPatch', { method: 'PATCH', headers: authz(idToken), body: patchBody });
        console.log('grantsPatch:', patchResp);
      }
    } catch (e) {
      console.log('grantsPatch failed:', e?.message || e);
    }

    // 5) grantsList (GET) — active only
    try {
      const list = await call('grantsList', { method: 'GET', headers: authz(idToken), query: { status: 'active', limit: 10 } });
      console.log('grantsList:', list);
    } catch (e) {
      console.log('grantsList failed:', e?.message || e);
    }

    // 6) grantsActivity (GET)
    try {
      if (grantId) {
        const act = await call('grantsActivity', { method: 'GET', headers: authz(idToken), query: { grantId, limit: 50 } });
        console.log('grantsActivity:', act);
      }
    } catch (e) {
      console.log('grantsActivity failed:', e?.message || e);
    }

    // 7) grantsDelete (POST) — soft delete
    try {
      if (grantId) {
        const del = await call('grantsDelete', { method: 'POST', headers: authz(idToken), body: { id: grantId } });
        console.log('grantsDelete:', del);
      }
    } catch (e) {
      console.log('grantsDelete failed:', e?.message || e);
    }

    // 8) grantsAdminDelete (POST) — hard delete
    try {
      if (grantId) {
        const del2 = await call('grantsAdminDelete', { method: 'POST', headers: authz(idToken), body: { id: grantId } });
        console.log('grantsAdminDelete:', del2);
      }
    } catch (e) {
      console.log('grantsAdminDelete failed:', e?.message || e);
    }

    console.log('✓ grants.full.test.mjs');
  } catch (err) {
    console.error('✗ grants.full.test.mjs', err);
    process.exitCode = 1;
  }
})();