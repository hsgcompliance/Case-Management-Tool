// functions/src/features/users/identity.ts
import { beforeUserCreated, beforeUserSignedIn } from "firebase-functions/v2/identity";
import { RUNTIME, db } from "../../core";

const isEmu =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

// Blocking Auth triggers require Firebase Authentication with Identity Platform (GCIP).
// Keep them disabled by default so deploys work on standard Firebase Auth projects.
const enableBlockingAuthTriggers =
  String(process.env.ENABLE_GCIP_BLOCKING_FUNCTIONS || "").toLowerCase() === "true";

/**
 * NEW SIGN-UPS:
 *  - Gate by domain (prod only)
 *  - Default claims to topRole=unverified.
 *  - No org/team yet.
 */
const onBeforeUserCreatedHandler = beforeUserCreated({ region: RUNTIME.region }, (event) => {
  if (isEmu) return;

  const email = (event.data?.email || "").toLowerCase();
  const allowed = ["thehrdc.org"];
  if (!allowed.some((d) => email.endsWith(`@${d}`))) {
    throw new Error("signup_not_allowed_for_domain");
  }

  event.data!.customClaims = event.data!.customClaims || {};
  const cc = event.data!.customClaims as any;

  if (!cc.topRole) cc.topRole = "unverified";
  if (!Array.isArray(cc.roles)) cc.roles = [];
  if (!Array.isArray(cc.teamIds)) cc.teamIds = [];
  if (!cc.orgId) cc.orgId = null;
});

/**
 * SIGN-INS:
 *  - Block unverified/public_user in prod.
 *  - Honor extras.blocked / terminatedAt.
 */
const onBeforeUserSignedInHandler = beforeUserSignedIn(
  { region: RUNTIME.region },
  async (event) => {
    if (isEmu) return;

    const cc: any = event.data?.customClaims || {};
    const tr = String(cc.topRole || "").toLowerCase();

    if (tr === "unverified" || tr === "public_user" || tr === "") {
      throw new Error("awaiting_admin_approval");
    }

    const snap = await db
      .collection("userExtras")
      .doc(event.data!.uid!)
      .get()
      .catch(() => null);
    const extras = snap?.data() || {};
    if (extras.blocked === true || extras.terminatedAt) {
      throw new Error("account_disabled");
    }
  }
);

export const onBeforeUserCreated = enableBlockingAuthTriggers
  ? onBeforeUserCreatedHandler
  : undefined;

export const onBeforeUserSignedIn = enableBlockingAuthTriggers
  ? onBeforeUserSignedInHandler
  : undefined;
