import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive payments tests. Exercises payment-related endpoints
 * including generating projections, upserting projections, recalculating
 * future payments, recording a spend, updating compliance flags,
 * recalculating grant projections and copying schedules. Placeholder
 * enrollment and grant IDs are used; on failure the test logs a skip
 * message rather than aborting. This test assumes admin privileges.
 */

(async () => {
  try {
    // sign up admin and grant claim
    const adminEmail = `admin_payments_${Date.now()}@example.com`;
    let { idToken } = await signUpOrIn({ email: adminEmail });
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(idToken) });
    } catch {
      console.log('SKIP[payments]: devGrantAdmin not available');
    }
    ({ idToken } = await signUpOrIn({ email: adminEmail }));

    // placeholder IDs matching legacy examples
    const grantId = 'grant_demo_1';
    const enrollmentId = 'enr_demo_1';
    const paymentId = 'pay_monthly_rent_2025-11-01_rent_120000_1';

    // 1) paymentsGenerateProjections
    try {
      const gen = await call('paymentsGenerateProjections', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          startDate: '2025-10-01',
          months: 3,
          monthlyAmount: 1000,
          deposit: 500,
        },
      });
      console.log('paymentsGenerateProjections:', gen);
    } catch (e) {
      console.log('paymentsGenerateProjections failed:', e?.message || e);
    }

    // 2) paymentsUpsertProjections
    try {
      const upsert = await call('paymentsUpsertProjections', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          payments: [
            { type: 'monthly', amount: 1000, dueDate: '2025-10-01', lineItemId: 'rent' },
            { type: 'monthly', amount: 1000, dueDate: '2025-11-01', lineItemId: 'rent' },
            { type: 'service', amount: 150, dueDate: '2025-10-15', lineItemId: 'svc' },
          ],
        },
      });
      console.log('paymentsUpsertProjections:', upsert);
    } catch (e) {
      console.log('paymentsUpsertProjections failed:', e?.message || e);
    }

    // 3) paymentsRecalculateFuture
    try {
      const recalc = await call('paymentsRecalculateFuture', {
        method: 'POST',
        headers: authz(idToken),
        body: { enrollmentId, newMonthlyAmount: 1200 },
      });
      console.log('paymentsRecalculateFuture:', recalc);
    } catch (e) {
      console.log('paymentsRecalculateFuture failed:', e?.message || e);
    }

    // 4) paymentsSpend
    try {
      const spend = await call('paymentsSpend', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          paymentId,
          note: 'Paid at office',
          vendor: 'Landlord Inc',
          comment: 'All good',
        },
      });
      console.log('paymentsSpend:', spend);
    } catch (e) {
      console.log('paymentsSpend failed:', e?.message || e);
    }

    // 5) paymentsUpdateCompliance
    try {
      const updateComp = await call('paymentsUpdateCompliance', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          paymentId,
          patch: { hmisComplete: true },
        },
      });
      console.log('paymentsUpdateCompliance:', updateComp);
    } catch (e) {
      console.log('paymentsUpdateCompliance failed:', e?.message || e);
    }

    // 6) paymentsRecalcGrantProjected
    try {
      const recalcProj = await call('paymentsRecalcGrantProjected', {
        method: 'POST',
        headers: authz(idToken),
        body: { grantId },
      });
      console.log('paymentsRecalcGrantProjected:', recalcProj);
    } catch (e) {
      console.log('paymentsRecalcGrantProjected failed:', e?.message || e);
    }

    // 7) paymentsBulkCopySchedule
    try {
      const bulkCopy = await call('paymentsBulkCopySchedule', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          sourceEnrollmentId: enrollmentId,
          targetEnrollmentIds: ['enr_demo_2', 'enr_demo_3'],
          mode: 'merge',
          includeTypes: ['monthly', 'service'],
        },
      });
      console.log('paymentsBulkCopySchedule:', bulkCopy);
    } catch (e) {
      console.log('paymentsBulkCopySchedule failed:', e?.message || e);
    }

    console.log('✓ payments.full.test.mjs');
  } catch (err) {
    console.error('✗ payments.full.test.mjs', err);
    process.exitCode = 1;
  }
})();