import {db, isoNow} from '../../core';

const SENDING_LEASE_MS = 30 * 60_000;

type EmailLogMeta = Record<string, unknown>;

type ReserveDigestSendOptions = {
  force?: boolean;
};

export async function reserveDigestSend(
    key: string,
    meta: EmailLogMeta = {},
    options: ReserveDigestSendOptions = {},
): Promise<boolean> {
  const ref = db.collection('emailLogs').doc(key);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = (snap.data() || {}) as Record<string, unknown>;
      const status = String(existing.status || '');

      if (status === 'sent' && !options.force) return false;

      if (status === 'sending') {
        const reservedAtMs = new Date(String(existing.reservedAt || '')).getTime();
        const stale = !Number.isFinite(reservedAtMs) || Date.now() - reservedAtMs > SENDING_LEASE_MS;
        if (!stale) return false;
      } else if (status === 'failed' && !options.force) {
        return false;
      }
    }
    tx.set(ref, {
      ...meta,
      status: 'sending',
      reservedAt: isoNow(),
      ...(options.force ? {force: true} : {}),
      createdAt: isoNow(),
    }, {merge: true});
    return true;
  });
}

export async function markDigestSent(key: string, meta: EmailLogMeta = {}): Promise<void> {
  await db.collection('emailLogs').doc(key).set({
    ...meta,
    status: 'sent',
    sentAt: isoNow(),
  }, {merge: true});
}

export async function markDigestFailed(key: string, error: unknown, meta: EmailLogMeta = {}): Promise<void> {
  await db.collection('emailLogs').doc(key).set({
    ...meta,
    status: 'failed',
    error: String((error as {message?: unknown})?.message || error || 'digest_send_failed'),
    failedAt: isoNow(),
  }, {merge: true});
}
