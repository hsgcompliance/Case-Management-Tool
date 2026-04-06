//contracts/src/enrollments.ts

// ---- Imports ----------------------------------------------------------------

import { 
  BoolLike,
  BoolFromLike, 
  ISO10, 
  TsLike, 
  z, 
  Id, 
  Ids,
  IdLike, 
  GrantIdsLike, 
  toArray,
  JsonObjLike
} from "./core";
import { Ok } from "./http";
import { Population } from "./customers";
import { Payment, Spend } from "./payments";
import { TaskScheduleItem, TaskStats } from "./tasks";

// ---- Enrollment compliance --------------------------------------------------

/** Enrollment-level compliance flags. */
export const EnrollmentCompliance = z.object({
  caseworthyEntryComplete: z.boolean().nullish(),
  caseworthyExitComplete: z.boolean().nullish(),
  hmisEntryComplete: z.boolean().nullish(),
  hmisExitComplete: z.boolean().nullish(),
});

// ---- Schedule meta ----------------------------------------------------------

/** Legacy builder meta (v1) captured alongside schedules. */
export const ScheduleMetaV1 = z.object({
  version: z.literal(1),
  rentPlans: z.array(
    z.object({
      firstDue: z.string(),
      months: z.string(),
      monthly: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  utilPlans: z.array(
    z.object({
      firstDue: z.string(),
      months: z.string(),
      monthly: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  deposit: z
    .object({
      enabled: z.boolean(),
      date: z.string(),
      amount: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional(),
    })
    .optional(),
  prorated: z
    .object({
      enabled: z.boolean(),
      date: z.string(),
      amount: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional(),
    })
    .optional(),
  services: z.array(
    z.object({
      id: z.string(),
      note: z.string(),
      date: z.string(),
      amount: z.string(),
      lineItemId: z.string(),
      vendor: z.string().optional(),
      comment: z.string().optional(),
    }),
  ),
  migratedOut: z
    .object({
      toEnrollmentId: z.string(),
      toGrantId: z.string(),
      cutover: z.string(),
    })
    .nullable()
    .optional(),
});

/** Meta written on destination enrollment during migration. */
export const ScheduleMetaMigrated = z.object({
  mode: z.literal("migrated"),
  cutover: z.string(),
  defaultEditMode: z.enum(["keepManual", "rebuildUnpaid"]).optional(),
  fromEnrollmentId: z.string(),
  fromGrantId: z.string(),
  lineItemMapSnapshot: z.record(z.string(), z.string()).optional(),
  migratedOut: z
    .object({
      toEnrollmentId: z.string(),
      toGrantId: z.string(),
      cutover: z.string(),
    })
    .nullable()
    .optional(),
});

export const ScheduleMeta = z.union([ScheduleMetaMigrated, ScheduleMetaV1]);

/** Saved task-builder definitions (enrollment-scoped task schedule source of truth). */
export const TaskScheduleMeta = z.object({
  version: z.literal(1),
  defs: z.array(z.unknown()).default([]),
  savedAt: TsLike.nullish().optional(),
}).passthrough();

// ---- Core model -------------------------------------------------------------

/** Primary enrollment record. */
export const Enrollment = z.object({
  id: Id,
  grantId: z.string(),
  customerId: z.string(),

  // org/team access (server authoritative)
  orgId: z.string().trim().min(1).nullish(),
  teamIds: z.array(z.string().trim().min(1)).max(10).optional(),

  startDate: z.string().nullable().optional(), // YYYY-MM-DD
  endDate: z.string().nullable().optional(),

  migratedFrom: z
    .object({ enrollmentId: z.string(), grantId: z.string(), cutover: z.string() })
    .nullable()
    .optional(),
  migratedTo: z
    .object({ enrollmentId: z.string(), grantId: z.string(), cutover: z.string() })
    .nullable()
    .optional(),

  active: z.boolean().nullable().optional(),
  status: z.enum(["active", "deleted", "closed"]).nullable().optional(),
  deleted: z.boolean().nullable().optional(),

  // Operational stage (waitlist → tenant, etc.) kept separate from lifecycle status.
  stage: z.enum(["waitlisted", "offered", "tenant", "exited"]).nullable().optional(),

  // First-class priority snapshot for waitlist ordering (computed from an assessment).
  priorityScore: z.number().nullable().optional(),
  priorityLevel: z.string().nullable().optional(),
  priorityAt: TsLike.nullish().optional(),
  priorityTemplateId: z.string().nullable().optional(),
  priorityTemplateVersion: z.number().int().nullable().optional(),
  priorityAssessmentId: z.string().nullable().optional(),

  // Optional generic latest-results cache (templateId → small snapshot)
  latestAssessments: z
    .record(
      z.string(),
      z
        .object({
          at: TsLike.nullish().optional(),
          assessmentId: z.string().nullable().optional(),
          templateVersion: z.number().int().nullable().optional(),
          computed: z.record(z.string(), z.unknown()).optional(),
        })
        .passthrough(),
    )
    .nullish()
    .optional(),

  compliance: EnrollmentCompliance.nullish(),

  customerName: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  grantName: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  population: Population.optional(),
  caseManagerId: z.string().nullable().optional(),
  caseManagerName: z.string().nullable().optional(),

  // --- Finance (kept here for now; payments & spends also live in dedicated features)
  payments: z.array(Payment).nullable().optional(),
  spends: z.array(Spend).nullable().optional(),

  // --- Tasks (single model for tasks & compliance)
  taskSchedule: z.array(TaskScheduleItem).nullable().optional(),
  taskStats: TaskStats.nullish(),
  scheduleMeta: ScheduleMeta.nullish(),
  taskScheduleMeta: TaskScheduleMeta.nullish(),

  /**
   * Whether to auto-generate the task schedule from grant.tasks when this
   * enrollment is created.  Defaults to true when absent.
   * Set to false to enroll the client without creating managed tasks.
   */
  generateTaskSchedule: z.boolean().default(true),

  createdAt: TsLike.nullish().optional(),
  updatedAt: TsLike, // required by convention
});

export type TEnrollment = z.infer<typeof Enrollment>;
export type TEnrollmentEntity = TEnrollment & { id: string };

// ---- Queries: list + get ----------------------------------------------------

export const EnrollmentGetByIdQuery = z.object({ id: Id }).passthrough();
export type TEnrollmentGetByIdQuery = z.infer<typeof EnrollmentGetByIdQuery>;
export type TEnrollmentGetByIdResp = Ok<{ enrollment: TEnrollmentEntity }>;

export const EnrollmentsListQuery = z
  .object({
    active: BoolLike.optional(),
    customerId: Id.optional(),
    grantId: Id.optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    startAfter: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();
export type TEnrollmentsListQuery = z.infer<typeof EnrollmentsListQuery>;

export type TEnrollmentsListResp = Ok<{
  items: TEnrollmentEntity[];
  next: string | null;
}>;

// ---- Backfill Names: admin/dev utility --------------------------------------

export const EnrollmentsBackfillNamesBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    allOrgs: BoolFromLike.optional(),
    dryRun: BoolFromLike.optional(),
  })
  .passthrough();
export type TEnrollmentsBackfillNamesBody = z.infer<typeof EnrollmentsBackfillNamesBody>;

export type TEnrollmentsBackfillNamesResp = Ok<{
  scanned: number;
  updated: number;
  ids: string[];
  dryRun: boolean;
  scopedToOrg: string | null;
  resolvedGrants: number;
  resolvedCustomers: number;
}>;

// ---- Upsert: user ----------------------------------------------------------

export const EnrollmentsUpsertBody = z.union([
  Enrollment.partial(),
  z.array(Enrollment.partial()).min(1),
]);
export type TEnrollmentsUpsertBody = z.infer<typeof EnrollmentsUpsertBody>;

export type TEnrollmentsUpsertResp = Ok<{ ids: string[] }>;

// ---- Patch: user ------------------------------------------------------------

export const EnrollmentsPatchRow = z
  .object({
    id: Id,
    patch: z.record(z.string(), z.unknown()).optional(),
    unset: z.array(z.string()).optional(),
  })
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" },
  );

export type TEnrollmentsPatchRow = z.infer<typeof EnrollmentsPatchRow>;

export const EnrollmentsPatchBody = z.union([
  EnrollmentsPatchRow,
  z.array(EnrollmentsPatchRow).min(1),
]);

export type TEnrollmentsPatchBody = z.infer<typeof EnrollmentsPatchBody>;

export type TEnrollmentsPatchResp = Ok<{ ids: string[] }>;
// ---- Delete: user + admin ---------------------------------------------------

const EnrollmentDeleteIdObj = z
  .object({
    id: Id.optional(),
    ids: Ids.optional(),
  })
  .refine(
    (v) =>
      typeof v.id === "string" || (Array.isArray(v.ids) && v.ids.length > 0),
    { message: "missing_id_or_ids" },
  );

export const EnrollmentsDeleteBody = z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: z.boolean().optional(),
    hard: z.boolean().optional(),
  }),
]);

export const EnrollmentsAdminDeleteBody = z.union([
  Id,
  Ids,
  EnrollmentDeleteIdObj.extend({
    voidPaid: z.boolean().optional(),
    mode: z.enum(["safe", "hard"]).optional(),
    purgeSpends: z.boolean().optional(),
    purgeSubcollections: z.boolean().optional(),
  }),
]);

export const EnrollmentsDeleteResultItem = z.object({
  id: z.string(),
  ok: z.literal(true).optional(),
  error: z.string().optional(),
});

export const EnrollmentsDeleteCoreOutput = z.object({
  ok: z.boolean(),
  results: z.array(EnrollmentsDeleteResultItem),
});

export const EnrollmentsDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: z.literal(true),
});

export const EnrollmentsAdminDeleteResp = EnrollmentsDeleteCoreOutput.extend({
  deleted: z.literal(true),
  mode: z.enum(["safe", "hard"]),
  purged: z
    .object({
      spends: z.number().int().nonnegative(),
      enrollments: z.number().int().nonnegative(),
    })
    .optional(),
  purgeErrors: z.array(z.object({ id: z.string(), error: z.string() })).optional(),
});

// Types
export type TEnrollmentsAdminDeleteBody = z.infer<typeof EnrollmentsAdminDeleteBody>;
export type TEnrollmentsAdminDeleteResp = z.infer<typeof EnrollmentsAdminDeleteResp>;
export type TEnrollmentsDeleteBody = z.infer<typeof EnrollmentsDeleteBody>;
export type TEnrollmentsDeleteResp = z.infer<typeof EnrollmentsDeleteResp>;
export type TEnrollmentsDeleteResultItem = z.infer<typeof EnrollmentsDeleteResultItem>;

// ---- Enroll -----------------------------------------------------------------

export const EnrollmentsEnrollCustomerBody = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o: Record<string, unknown> = { ...(v as Record<string, unknown>) };
    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;

    // normalize onto customerId
    if (o.customerId == null && o.clientId != null) o.customerId = o.clientId;
    if (o.customerId == null && o.customer_id != null) o.customerId = o.customer_id;

    return o;
  },
  z.object({
    grantId: IdLike,
    customerId: IdLike,
    extra: JsonObjLike.default({}),
  }).passthrough()
);
export type TEnrollmentsEnrollCustomerBody = z.infer<typeof EnrollmentsEnrollCustomerBody>;

export type TEnrollmentsEnrollCustomerResp = Ok<{ id: string }>;

// ---- Bulk enroll ------------------------------------------------------------

export const EnrollmentsBulkEnrollBody = z.preprocess(
  (v) => {
    if (!v || typeof v !== "object") return v;
    const o: Record<string, unknown> = { ...(v as Record<string, unknown>) };

    if (o.grantId == null && o.grant_id != null) o.grantId = o.grant_id;

    // normalize onto customerIds
    if (o.customerIds == null && o.clientIds != null) o.customerIds = o.clientIds;

    // normalize onto perCustomerExtra
    if (o.perCustomerExtra == null && o.perClientExtra != null) o.perCustomerExtra = o.perClientExtra;

    return o;
  },
  z.object({
    grantId: IdLike,

    customerIds: z.preprocess((v) => {
      // accept: ["a","b"], "a,b", "a"
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
      return v;
    }, z.array(IdLike).min(1)),

    // options used by the handler (normalized + defaulted)
    skipIfExists: BoolFromLike.default(true),
    existsMode: z.enum(["nonDeleted", "activeOnly"]).default("nonDeleted"),

    // payloads used by the handler (normalized + defaulted)
    extra: JsonObjLike.default({}),

    perCustomerExtra: z.preprocess((v) => {
      if (v && typeof v === "object") return v;
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return v; }
      }
      return v;
    }, z.record(z.string(), JsonObjLike).default({})),
  }).passthrough()
);
export type TEnrollmentsBulkEnrollBody = z.infer<typeof EnrollmentsBulkEnrollBody>;

export type TEnrollmentsBulkEnrollResultItem =
  | { customerId: string; enrollmentId: string; existed?: true }
  | { customerId: string; error: string };

export type TEnrollmentsBulkEnrollResp = Ok<{
  results: TEnrollmentsBulkEnrollResultItem[];
}>;

// ---- Check overlaps ---------------------------------------------------------

export const EnrollmentsCheckOverlapsQuery = z.object({
  customerId: Id.optional(),
  clientId: Id.optional(),
  grantIds: GrantIdsLike.optional(),
  window: z.object({ start: ISO10.optional(), end: ISO10.optional() }).optional(),
  activeOnly: z.boolean().optional(),
}).passthrough();

export type TEnrollmentsCheckOverlapsQuery = z.infer<typeof EnrollmentsCheckOverlapsQuery>;

type EnrollmentOverlapSide = {
  id: string;
  grantId: string;
  startDate?: string | null;
  endDate?: string | null;
  [k: string]: unknown;
};
type EnrollmentOverlap = {
  a: EnrollmentOverlapSide;
  b: EnrollmentOverlapSide;
  [k: string]: unknown;
};

export type TEnrollmentsCheckOverlapsResp = Ok<{
  overlaps: EnrollmentOverlap[];
  count: number;
}>;

// ---- Check dual -------------------------------------------------------------

const EnrollmentLikeForDual = z
  .object({
    customerId: Id.optional(),
    clientId: Id.optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const EnrollmentsCheckDualQuery = z
  .object({
    enrollments: z.array(EnrollmentLikeForDual).min(1),
  })
  .passthrough();

export type TEnrollmentsCheckDualQuery = z.infer<typeof EnrollmentsCheckDualQuery>;

export type TEnrollmentsCheckDualResp = Ok<{
  conflicts: Array<{
    customerId: string;
    count: number;
    activeEnrollments: Array<Record<string, unknown>>;
  }>;
}>;

// ---- Migrate ----------------------------------------------------------------

export const EnrollmentsMigrateBody = z
  .object({
    enrollmentId: Id,
    toGrantId: Id,
    cutoverDate: ISO10,
    lineItemMap: z.record(z.string(), z.string()).optional(),
    closeSource: z.boolean().optional(),
    moveSpends: z.boolean().optional(),
    moveTasks: z.boolean().optional(),
    preserveTaskIds: z.boolean().optional(),
    movePaidPayments: z.boolean().optional(),
    rebuildScheduleMeta: z.boolean().optional(),
    closeSourceTaskMode: z.enum(["complete", "delete"]).optional(),
    closeSourcePaymentMode: z.enum(["spendUnpaid", "deleteUnpaid", "keep"]).optional(),
  })
  .passthrough();

export type TEnrollmentsMigrateBody = z.infer<typeof EnrollmentsMigrateBody>;

export type TEnrollmentsMigrateResp = Ok<{
  migrationId: string;
  fromId: string;
  toId: string;
  fromGrantId: string;
  toGrantId: string;
}>;

// ---- Undo migration ---------------------------------------------------------

export const EnrollmentsUndoMigrationBody = z
  .object({
    migrationId: Id,
  })
  .passthrough();
export type TEnrollmentsUndoMigrationBody = z.infer<typeof EnrollmentsUndoMigrationBody>;

export type TEnrollmentsUndoMigrationResp = Ok<{
  alreadyUndone: boolean;
  migrationId: string;
  fromEnrollmentId: string;
  toEnrollmentId: string | null;
  fromGrantId: string;
  toGrantId: string | null;
}>;

// ---- Reverse ledger entry (admin) ------------------------------------------

export const EnrollmentsAdminReverseLedgerEntryBody = z
  .object({
    ledgerId: Id,
    mode: z.enum(["ledger", "budget", "both"]).optional(),
    note: z.string().optional(),
  })
  .passthrough();
export type TEnrollmentsAdminReverseLedgerEntryBody = z.infer<
  typeof EnrollmentsAdminReverseLedgerEntryBody
>;

export type TEnrollmentsAdminReverseLedgerEntryResp = Ok<{
  mode: "ledger" | "budget" | "both";
}>;
