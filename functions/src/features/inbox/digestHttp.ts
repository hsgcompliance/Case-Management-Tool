// functions/src/features/inbox/digestHttp.ts
import {secureHandler, authAdmin, db, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN} from '../../core';
import {buildAndSendDigest} from './digestCore';
import {buildAndSendBudgetDigest} from './digestBudget';
import {buildAndSendEnrollmentDigest} from './digestEnrollments';
import {buildAndSendCaseManagerDigest} from './digestCaseManagers';
import {buildAndSendRentalAssistanceDigest} from './digestRentalAssistance';
import {DigestSendNowBody} from './schemas';
import {getDigestEnabledFlags} from './digestOrgConfig';
import {isSubscribed, type DigestSubs} from './digestSubs';

async function getAllUsersMap() {
  const {users} = await authAdmin.listUsers();
  const out = new Map<string, { email: string; displayName?: string; roles: string[]; topRole: string; claims: Record<string, unknown> }>();
  users.forEach((u) => {
    if (!u.email) return;
    const roles = (u.customClaims?.roles as string[]) || [];
    const topRole = String(u.customClaims?.topRole || 'user');
    out.set(u.uid, {email: u.email, displayName: u.displayName, roles, topRole, claims: (u.customClaims || {}) as Record<string, unknown>});
  });
  return out;
}

async function getDigestSubs(uid: string): Promise<DigestSubs> {
  const snap = await db.collection('userExtras').doc(uid).get();
  if (!snap.exists) return {};
  return ((snap.data() as Record<string, unknown>)?.digestSubs || {}) as DigestSubs;
}

export const inboxSendDigestNow = secureHandler(
    async (req, res) => {
      const {months, cmUid, subject, subjectTemplate, message, digestType} =
      DigestSendNowBody.parse(req.body || {});

      const usersMap = await getAllUsersMap();

      // For caseload, target CMs only; for others, target all relevant users unless cmUid specified
      const targets: Array<{ uid: string; email: string; displayName?: string; roles: string[]; topRole: string; claims: Record<string, unknown> }> =
      (() => {
        if (cmUid) {
          const u = usersMap.get(cmUid);
          return u ? [{uid: cmUid, ...u}] : [];
        }
        return Array.from(usersMap.entries()).map(([uid, v]) => ({uid, ...v})).filter((u) => {
          const isCM = u.roles.includes('casemanager');
          const isAdmin = u.topRole === 'admin' || u.topRole === 'dev' || u.topRole === 'org_dev';
          const isCompliance = u.roles.includes('compliance');
          if (digestType === 'caseload') return isCM;
          if (digestType === 'budget') return isAdmin || isCompliance;
          if (digestType === 'enrollments') return isCM || isAdmin;
          if (digestType === 'caseManagers') return isAdmin || isCompliance;
          if (digestType === 'rentalAssistance') return isAdmin || isCompliance;
          return false;
        });
      })();

      if (!targets.length) {
        res.status(400).json({ok: false, error: 'no_targets'});
        return;
      }

      const results: Array<{ uid: string; email: string; month: string; ok: boolean; skipped?: boolean; error?: string }> = [];

      for (const u of targets) {
        const digestFlags = await getDigestEnabledFlags(u.claims);
        const digestDisabled = digestFlags[digestType] === false;
        const subs = await getDigestSubs(u.uid);
        const userSubscribed = isSubscribed(digestType, subs, u.roles, u.topRole);
        for (const month of months) {
          try {
            if (digestDisabled) {
              results.push({uid: u.uid, email: u.email, month, ok: true, skipped: true, error: 'digest_disabled'});
              continue;
            }
            if (!userSubscribed) {
              results.push({uid: u.uid, email: u.email, month, ok: true, skipped: true, error: 'not_subscribed'});
              continue;
            }
            let r: { ok: boolean; skipped?: boolean };
            const name = u.displayName || u.email;
            const isCM = u.roles.includes('casemanager');
            const isAdmin = u.topRole === 'admin' || u.topRole === 'dev' || u.topRole === 'org_dev';

            if (digestType === 'caseload') {
              r = await buildAndSendDigest(u.email, {month, forUid: u.uid, cmName: name, subject, subjectTemplate, message});
            } else if (digestType === 'budget') {
              r = await buildAndSendBudgetDigest(u.email, {month, forUid: u.uid, recipientName: name});
            } else if (digestType === 'enrollments') {
              r = await buildAndSendEnrollmentDigest(u.email, {
                month,
                forUid: isCM && !isAdmin ? u.uid : undefined,
                recipientName: name,
              });
            } else if (digestType === 'caseManagers') {
              r = await buildAndSendCaseManagerDigest(u.email, {month, recipientName: name});
            } else {
              r = await buildAndSendRentalAssistanceDigest(u.email, {month, recipientName: name});
            }

            results.push({uid: u.uid, email: u.email, month, ok: r.ok, skipped: r.skipped});
          } catch (err: any) {
            results.push({uid: u.uid, email: u.email, month, ok: false, error: err?.message || 'send_failed'});
          }
        }
      }

      const sent = results.filter((r) => r.ok && !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.ok).length;

      res.status(200).json({ok: true, sent, skipped, failed, results});
    },
    {
      auth: 'admin',
      methods: ['POST', 'OPTIONS'],
      secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
      memory: '512MiB',
    },
);
