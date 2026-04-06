// functions/src/features/enrollments/schemas.ts
import { toArray as toArrayContract } from "@hdb/contracts";
import * as E from "@hdb/contracts/enrollments";

// re-export z (runtime)
export { z } from "@hdb/contracts";

// --------------------
// Runtime schemas (VALUES)
// --------------------
export const EnrollmentCompliance = E.EnrollmentCompliance;
export const ScheduleMetaV1 = E.ScheduleMetaV1;
export const ScheduleMetaMigrated = E.ScheduleMetaMigrated;
export const ScheduleMeta = E.ScheduleMeta;

export const Enrollment = E.Enrollment;

export const EnrollmentsUpsertBody = E.EnrollmentsUpsertBody;
export const EnrollmentsListQuery = E.EnrollmentsListQuery;
export const EnrollmentGetByIdQuery = E.EnrollmentGetByIdQuery;

export const EnrollmentsPatchRow = E.EnrollmentsPatchRow;
export const EnrollmentsPatchBody = E.EnrollmentsPatchBody;

export const EnrollmentsDeleteBody = E.EnrollmentsDeleteBody;
export const EnrollmentsAdminDeleteBody = E.EnrollmentsAdminDeleteBody;
export const EnrollmentsDeleteResp = E.EnrollmentsDeleteResp;

export const EnrollmentsEnrollCustomerBody = E.EnrollmentsEnrollCustomerBody;
export const EnrollmentsBulkEnrollBody = E.EnrollmentsBulkEnrollBody;
export const EnrollmentsCheckOverlapsQuery = E.EnrollmentsCheckOverlapsQuery;
export const EnrollmentsCheckDualQuery = E.EnrollmentsCheckDualQuery;
export const EnrollmentsMigrateBody = E.EnrollmentsMigrateBody;
export const EnrollmentsUndoMigrationBody = E.EnrollmentsUndoMigrationBody;
export const EnrollmentsAdminReverseLedgerEntryBody =
  E.EnrollmentsAdminReverseLedgerEntryBody;

// helper (runtime)
export function toArray<T>(x: T | T[] | undefined | null): T[] {
  return toArrayContract(x);
}

// --------------------
// Types (TYPE-ONLY)
// --------------------
export type {
  TEnrollment,
  TEnrollmentsUpsertBody,
  TEnrollmentsListQuery,
  TEnrollmentGetByIdQuery,
  TEnrollmentsPatchRow,
  TEnrollmentsPatchBody,
  TEnrollmentsDeleteBody,
  TEnrollmentsAdminDeleteBody,
  TEnrollmentsDeleteResp,
  TEnrollmentsDeleteResultItem,
  TEnrollmentsEnrollCustomerBody,
  TEnrollmentsBulkEnrollBody,
  TEnrollmentsCheckOverlapsQuery,
  TEnrollmentsCheckDualQuery,
  TEnrollmentsMigrateBody,
  TEnrollmentsUndoMigrationBody,
  TEnrollmentsAdminReverseLedgerEntryBody,
} from "@hdb/contracts/enrollments";
