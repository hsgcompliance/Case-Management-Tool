import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive enrollments tests. This script exercises the major
 * enrollment-related endpoints exposed by the API. It creates a
 * couple of grants and customers, then performs a sequence of
 * enrollment operations including creation, retrieval, patching,
 * listing, overlap checking, bulk enrollment, migration and deletion.
 *
 * For each call we log the result and continue on failures. This is
 * intended to exercise the API surface rather than assert on the
 * returned data shapes. If an endpoint is missing, a SKIP message is
 * printed.
 */

(async () => {
  try {
    const isoToday = () => new Date().toISOString().slice(0, 10);
    // 1) Sign up an admin user and grant admin claims
    const adminEmail = `admin_enroll_${Date.now()}@example.com`;
    let { idToken } = await signUpOrIn({ email: adminEmail });
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(idToken) });
    } catch {
      console.log('SKIP[enrollments]: devGrantAdmin not available');
    }
    // refresh token to reflect admin claims
    ({ idToken } = await signUpOrIn({ email: adminEmail }));

    // 2) Create two grants via grantsUpsert
    let grantA, grantB;
    try {
      const bodyA = {
        name: `Grant A ${Date.now()}`,
        status: 'active',
        budget: {
          lineItems: [
            { id: 'li_rent', label: 'Rent', amount: 5000, projected: 0, spent: 0 },
            { id: 'li_util', label: 'Utilities', amount: 1200, projected: 0, spent: 0 },
          ],
        },
      };
      const upsertA = await call('grantsUpsert', { method: 'POST', headers: authz(idToken), body: bodyA });
      grantA = upsertA?.data?.ids?.[0] || upsertA?.data?.id;
      const bodyB = {
        name: `Grant B ${Date.now()}`,
        status: 'active',
        budget: {
          lineItems: [
            { id: 'li_rent', label: 'Rent', amount: 7000, projected: 0, spent: 0 },
            { id: 'li_util', label: 'Utilities', amount: 1500, projected: 0, spent: 0 },
          ],
        },
      };
      const upsertB = await call('grantsUpsert', { method: 'POST', headers: authz(idToken), body: bodyB });
      grantB = upsertB?.data?.ids?.[0] || upsertB?.data?.id;
      console.log('grantsUpsert:', { grantA, grantB });
    } catch (e) {
      console.log('grantsUpsert failed:', e?.message || e);
    }

    // 3) Create three customers via customersUpsert
    let cust1, cust2, cust3;
    try {
      const c1 = await call('customersUpsert', {
        method: 'POST',
        headers: authz(idToken),
        body: { firstName: `Cust1 ${Date.now()}`, lastName: 'One' },
      });
      cust1 = c1?.data?.ids?.[0] || c1?.data?.id;
      const c2 = await call('customersUpsert', {
        method: 'POST',
        headers: authz(idToken),
        body: { firstName: `Cust2 ${Date.now()}`, lastName: 'Two' },
      });
      cust2 = c2?.data?.ids?.[0] || c2?.data?.id;
      const c3 = await call('customersUpsert', {
        method: 'POST',
        headers: authz(idToken),
        body: { firstName: `Cust3 ${Date.now()}`, lastName: 'Three' },
      });
      cust3 = c3?.data?.ids?.[0] || c3?.data?.id;
      console.log('customersUpsert:', { cust1, cust2, cust3 });
    } catch (e) {
      console.log('customersUpsert failed:', e?.message || e);
    }

    // 4) enrollmentsUpsert — create one enrollment (cust1 on grantA)
    let enrId;
    try {
      const upsertBody = {
        grantId: grantA,
        customerId: cust1,
        startDate: isoToday(),
        status: 'active',
      };
      const enrCreate = await call('enrollmentsUpsert', {
        method: 'POST',
        headers: authz(idToken),
        body: upsertBody,
      });
      enrId = enrCreate?.data?.ids?.[0] || enrCreate?.data?.id;
      console.log('enrollmentsUpsert:', { enrId });
    } catch (e) {
      console.log('enrollmentsUpsert failed:', e?.message || e);
    }

    // 5) enrollmentGetById
    try {
      if (enrId) {
        const getResp = await call('enrollmentGetById', { method: 'GET', headers: authz(idToken), query: { id: enrId } });
        console.log('enrollmentGetById:', getResp);
      }
    } catch (e) {
      console.log('enrollmentGetById failed:', e?.message || e);
    }

    // 6) enrollmentsPatch — set caseManagerId
    try {
      if (enrId) {
        const patchResp = await call('enrollmentsPatch', {
          method: 'PATCH',
          headers: authz(idToken),
          body: { id: enrId, patch: { caseManagerId: 'cm_test_001', status: 'active' } },
        });
        console.log('enrollmentsPatch:', patchResp);
      }
    } catch (e) {
      console.log('enrollmentsPatch failed:', e?.message || e);
    }

    // 7) enrollmentsList — filter by grantA
    try {
      if (grantA) {
        const listResp = await call('enrollmentsList', {
          method: 'GET',
          headers: authz(idToken),
          query: { grantId: grantA, limit: 10 },
        });
        console.log('enrollmentsList grantA:', listResp);
      }
    } catch (e) {
      console.log('enrollmentsList failed:', e?.message || e);
    }

    // 8) enrollmentsCheckOverlaps — for cust1 today
    try {
      if (cust1) {
        const overlapResp = await call('enrollmentsCheckOverlaps', {
          method: 'POST',
          headers: authz(idToken),
          body: { customerId: cust1, date: isoToday() },
        });
        console.log('enrollmentsCheckOverlaps:', overlapResp);
      }
    } catch (e) {
      console.log('enrollmentsCheckOverlaps failed:', e?.message || e);
    }

    // 9) enrollmentsBulkEnroll — enroll cust2 & cust3 into grantB
    let bulkResult;
    try {
      if (grantB && cust2 && cust3) {
        bulkResult = await call('enrollmentsBulkEnroll', {
          method: 'POST',
          headers: authz(idToken),
          body: {
            grantId: grantB,
            customerIds: [cust2, cust3],
            extra: { startDate: isoToday(), status: 'active' },
            skipIfExists: true,
          },
        });
        console.log('enrollmentsBulkEnroll:', bulkResult);
      }
    } catch (e) {
      console.log('enrollmentsBulkEnroll failed:', e?.message || e);
    }

    // 10) migrateEnrollment — move cust1 enrollment from grantA to grantB
    let destId;
    try {
      if (enrId && grantB) {
        const migResp = await call('migrateEnrollment', {
          method: 'POST',
          headers: authz(idToken),
          body: {
            enrollmentId: enrId,
            toGrantId: grantB,
            cutoverDate: isoToday(),
            lineItemMap: { li_rent: 'li_rent', li_util: 'li_util' },
            closeSource: true,
            moveSpends: false,
            movePaidPayments: false,
            moveTasks: false,
          },
        });
        destId = migResp?.data?.toId;
        console.log('migrateEnrollment:', migResp);
      }
    } catch (e) {
      console.log('migrateEnrollment failed:', e?.message || e);
    }

    // 11) enrollmentsDelete — soft delete destination (if any)
    try {
      if (destId) {
        const delResp = await call('enrollmentsDelete', {
          method: 'POST',
          headers: authz(idToken),
          body: { enrollmentId: destId, hard: false },
        });
        console.log('enrollmentsDelete:', delResp);
      }
    } catch (e) {
      console.log('enrollmentsDelete failed:', e?.message || e);
    }

    // 12) enrollmentsAdminDelete — hard delete destination
    try {
      if (destId) {
        const hardResp = await call('enrollmentsAdminDelete', {
          method: 'POST',
          headers: authz(idToken),
          body: { id: destId },
        });
        console.log('enrollmentsAdminDelete:', hardResp);
      }
    } catch (e) {
      console.log('enrollmentsAdminDelete failed:', e?.message || e);
    }

    console.log('✓ enrollments.full.test.mjs');
  } catch (err) {
    console.error('✗ enrollments.full.test.mjs', err);
    process.exitCode = 1;
  }
})();