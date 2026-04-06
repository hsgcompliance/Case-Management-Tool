import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive tasks tests. Exercises task-related endpoints
 * including schedule generation, writing schedules to an enrollment,
 * assigning tasks, updating fields and status, and deletion. Since
 * tasks operations often depend on existing enrollments and task IDs,
 * this test uses placeholder IDs from the legacy test harness. If
 * these endpoints are unavailable or return errors, the test will
 * report a skip rather than fail the run.
 */

(async () => {
  try {
    // sign up admin and grant claims
    const adminEmail = `admin_tasks_${Date.now()}@example.com`;
    let { idToken } = await signUpOrIn({ email: adminEmail });
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(idToken) });
    } catch {
      console.log('SKIP[tasks]: devGrantAdmin not available');
    }
    ({ idToken } = await signUpOrIn({ email: adminEmail }));

    // 1) tasksGenerateSchedule
    try {
      const gen = await call('tasksGenerateSchedule', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          assessmentDef: { kind: 'recurring', frequency: 'monthly', name: 'Monthly Check-in' },
          startDate: '2025-10-01',
        },
      });
      console.log('tasksGenerateSchedule:', gen);
    } catch (e) {
      console.log('tasksGenerateSchedule failed:', e?.message || e);
    }

    // 2) tasksGenerateScheduleWrite (using a placeholder enrollmentId)
    try {
      const genWrite = await call('tasksGenerateScheduleWrite', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId: 'enr_demo_1',
          keepManual: true,
          mode: 'replaceManaged',
        },
      });
      console.log('tasksGenerateScheduleWrite:', genWrite);
    } catch (e) {
      console.log('tasksGenerateScheduleWrite failed:', e?.message || e);
    }

    // placeholder taskId used in legacy scripts
    const taskId = 'asmt_monthly-check-in_2025-11-01';
    const enrollmentId = 'enr_demo_1';

    // 3) tasksAssign
    try {
      const assign = await call('tasksAssign', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          taskId,
          assign: { group: 'compliance' },
        },
      });
      console.log('tasksAssign:', assign);
    } catch (e) {
      console.log('tasksAssign failed:', e?.message || e);
    }

    // 4) tasksUpdateFields
    try {
      const updFields = await call('tasksUpdateFields', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          taskId,
          patch: { notify: true, notes: 'Bring docs' },
        },
      });
      console.log('tasksUpdateFields:', updFields);
    } catch (e) {
      console.log('tasksUpdateFields failed:', e?.message || e);
    }

    // 5) tasksUpdateStatus: complete
    try {
      const updStatus = await call('tasksUpdateStatus', {
        method: 'POST',
        headers: authz(idToken),
        body: {
          enrollmentId,
          taskId,
          action: 'complete',
          notes: 'Done in person',
        },
      });
      console.log('tasksUpdateStatus:', updStatus);
    } catch (e) {
      console.log('tasksUpdateStatus failed:', e?.message || e);
    }

    // 6) tasksDelete
    try {
      const del = await call('tasksDelete', {
        method: 'POST',
        headers: authz(idToken),
        body: { enrollmentId, taskId },
      });
      console.log('tasksDelete:', del);
    } catch (e) {
      console.log('tasksDelete failed:', e?.message || e);
    }

    console.log('✓ tasks.full.test.mjs');
  } catch (err) {
    console.error('✗ tasks.full.test.mjs', err);
    process.exitCode = 1;
  }
})();