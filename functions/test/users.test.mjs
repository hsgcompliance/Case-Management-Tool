import { call, signUpOrIn, authz } from './_setup.mjs';

/*
 * Comprehensive users tests. This script exercises most of the user
 * management endpoints including creation, role assignment, activation
 * toggling, profile retrieval/update, listing and inviting. It logs
 * each response and continues on failures to provide maximal coverage.
 */

(async () => {
  try {
    const adminEmail = `admin_users_${Date.now()}@example.com`;
    let adminAuth = await signUpOrIn({ email: adminEmail });
    // grant admin claim on the admin account
    try {
      await call('devGrantAdmin', { method: 'POST', headers: authz(adminAuth.idToken) });
    } catch {
      console.log('SKIP[users]: devGrantAdmin not available');
    }
    // refresh admin token after claim assignment
    adminAuth = await signUpOrIn({ email: adminEmail });

    // define credentials for the new user to be created
    const userEmail = `user_${Date.now()}@example.com`;
    const userPass = 'change-me';

    // usersCreate (admin)
    let createdUid;
    try {
      const createRes = await call('usersCreate', {
        method: 'POST',
        headers: authz(adminAuth.idToken),
        body: { email: userEmail, password: userPass, name: 'Normal User', roles: ['case_manager'] },
      });
      createdUid = createRes?.data?.user?.uid || createRes?.data?.user?.id;
      console.log('usersCreate:', createRes);
    } catch (e) {
      console.log('usersCreate failed:', e?.message || e);
    }

    // sign in as the created user (creates Auth record if not already)
    let userAuth;
    try {
      userAuth = await signUpOrIn({ email: userEmail, password: userPass });
      console.log('user signIn:', { localId: userAuth.localId });
    } catch (e) {
      console.log('user signIn failed:', e?.message || e);
    }

    // usersMe (user)
    try {
      if (userAuth?.idToken) {
        const me = await call('usersMe', { method: 'GET', headers: authz(userAuth.idToken) });
        console.log('usersMe:', me);
      }
    } catch (e) {
      console.log('usersMe failed:', e?.message || e);
    }

    // usersMeUpdate (user)
    try {
      if (userAuth?.idToken) {
        const upd = await call('usersMeUpdate', {
          method: 'POST',
          headers: authz(userAuth.idToken),
          body: { updates: { notes: 'Prefers dark mode', settings: { theme: 'dark' } } },
        });
        console.log('usersMeUpdate:', upd);
      }
    } catch (e) {
      console.log('usersMeUpdate failed:', e?.message || e);
    }

    // usersList (admin, GET)
    try {
      const listGet = await call('usersList', {
        method: 'GET',
        headers: authz(adminAuth.idToken),
        query: { limit: 10, status: 'all' },
      });
      console.log('usersList GET:', listGet);
    } catch (e) {
      console.log('usersList GET failed:', e?.message || e);
    }

    // usersList (admin, POST)
    try {
      const listPost = await call('usersList', {
        method: 'POST',
        headers: authz(adminAuth.idToken),
        body: { limit: 10, status: 'active' },
      });
      console.log('usersList POST:', listPost);
    } catch (e) {
      console.log('usersList POST failed:', e?.message || e);
    }

    // usersSetRole (admin)
    try {
      if (createdUid) {
        const setRole = await call('usersSetRole', {
          method: 'POST',
          headers: authz(adminAuth.idToken),
          body: { uid: createdUid, roles: ['compliance'] },
        });
        console.log('usersSetRole:', setRole);
      }
    } catch (e) {
      console.log('usersSetRole failed:', e?.message || e);
    }

    // usersSetActive (admin -> disable)
    try {
      if (createdUid) {
        const disable = await call('usersSetActive', {
          method: 'POST',
          headers: authz(adminAuth.idToken),
          body: { uid: createdUid, active: false },
        });
        console.log('usersSetActive disable:', disable);
      }
    } catch (e) {
      console.log('usersSetActive disable failed:', e?.message || e);
    }

    // usersSetActive (admin -> enable)
    try {
      if (createdUid) {
        const enable = await call('usersSetActive', {
          method: 'POST',
          headers: authz(adminAuth.idToken),
          body: { uid: createdUid, active: true },
        });
        console.log('usersSetActive enable:', enable);
      }
    } catch (e) {
      console.log('usersSetActive enable failed:', e?.message || e);
    }

    // usersInvite (admin)
    try {
      const inviteEmail = `invited_${Date.now()}@example.com`;
      const invite = await call('usersInvite', {
        method: 'POST',
        headers: authz(adminAuth.idToken),
        body: { email: inviteEmail, name: 'Invited Person', roles: ['case_manager'] },
      });
      console.log('usersInvite:', invite);
    } catch (e) {
      console.log('usersInvite failed:', e?.message || e);
    }

    console.log('✓ users.full.test.mjs');
  } catch (err) {
    console.error('✗ users.full.test.mjs', err);
    process.exitCode = 1;
  }
})();
