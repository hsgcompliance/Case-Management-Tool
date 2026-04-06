// functions/src/features/users/triggers.ts
import * as functions from "firebase-functions/v1";
import type { UserRecord } from "firebase-admin/auth";
import { db, authAdmin, FieldValue, RUNTIME } from "../../core";

const isEmu =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

export const dayKeyUTC = () => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export const onAuthUserCreated = functions
  .region(RUNTIME.region)
  .runWith({ maxInstances: 10 })
  .auth.user()
  .onCreate(async (u: UserRecord) => {
    // Seed extras only. No counters.
    await db
      .collection("userExtras")
      .doc(u.uid)
      .set({ createdAt: FieldValue.serverTimestamp() }, { merge: true });

    // Create verify card if still unverified.
    try {
      const rec = await authAdmin.getUser(u.uid);
      const cc: any = rec.customClaims || {};
      const tr = String(cc.topRole || "").toLowerCase();
      const isUnverified = tr === "" || tr === "unverified" || tr === "public_user";

      if (isUnverified) {
        const now = new Date();
        const iso10 = now.toISOString().slice(0, 10);
        const ym = now.toISOString().slice(0, 7);
        const id = `userverify|${u.uid}`;

        await db
          .collection("userTasks")
          .doc(id)
          .set(
            {
              id,
              source: "userVerification",
              status: "open",
              enrollmentId: null,
              clientId: null,
              grantId: null,
              sourcePath: `auth:${u.uid}`,
              dueDate: iso10,
              dueMonth: ym,
              createdAtISO: now.toISOString(),
              updatedAtISO: now.toISOString(),
              assignedToUid: null,
              assignedToGroup: "admin",
              title: "Verify New User",
              subtitle: rec.email || null,
              labels: ["admin", "user"],
              completedAtISO: null,
              notify: false,
              cmUid: null,
            },
            { merge: true }
          );
      }
    } catch {
      // non-fatal
    }
  });

export const onAuthUserDeleted = functions
  .region(RUNTIME.region)
  .runWith({ maxInstances: 10 })
  .auth.user()
  .onDelete(async (u: UserRecord) => {
    await db
      .collection("userTasks")
      .doc(`userverify|${u.uid}`)
      .delete()
      .catch(() => {});
    if (!isEmu) {
      await db
        .collection("userExtras")
        .doc(u.uid)
        .delete()
        .catch(() => {});
    }
  });
