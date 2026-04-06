// functions/src/features/users/index.ts
export {
  usersCreate,
  usersInvite,
  usersSetRole,
  usersSetActive,
  usersRevokeSessions,
  usersList,
  devOrgsList,
  devOrgsUpsert,
  devOrgsPatchTeams,
  usersMe,
  usersMeUpdate,
} from "./http";

import { devGrantAdmin as devGrantAdminEmu } from "./dev";
const isEmu =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
export const devGrantAdmin = isEmu ? devGrantAdminEmu : undefined;

export {onAuthUserCreated, onAuthUserDeleted} from "./triggers";
export {onUserTaskMetrics} from "./taskMetrics";
export {onUserTaskWorkloadMetrics} from "./workloadMetrics";
export {onUserPaymentMetrics} from "./paymentMetrics";
export {onCaseloadMetrics} from "./caseloadMetrics";
export {onAcuityMetrics} from "./acuityMetrics";

export { onBeforeUserSignedIn, onBeforeUserCreated } from "./identity";
