// contracts/src/inbox.ts
import { z, ISO10, Boolish } from "./core";
import type { Ok } from "./http";

/* =============================================================================
   Canonical enums
============================================================================= */

export const InboxSourceEnum = z.enum([
  "task",
  "payment",
  "paymentCompliance",
  "userVerification",
  "adminEnrollment",
  "other",
  "jotform",
  "otherTask", // back-compat alias written by old trigger versions
]);
export type InboxSource = z.infer<typeof InboxSourceEnum>;

export const InboxStatusEnum = z.enum(["open", "done"]);
export type InboxStatus = z.infer<typeof InboxStatusEnum>;

export const InboxAssignedGroupEnum = z.enum(["admin", "casemanager", "compliance"]);
export type InboxAssignedGroup = z.infer<typeof InboxAssignedGroupEnum>;

/* =============================================================================
   Helpers
============================================================================= */

const YYYY_MM = z.string().regex(/^\d{4}-\d{2}$/);
const UrlOrHash = z.union([z.url(), z.literal("#")]);
export const InboxDigestTypeSchema = z.enum(["caseload", "budget", "enrollments", "caseManagers", "rentalAssistance"]);
export type TInboxDigestType = z.infer<typeof InboxDigestTypeSchema>;
export const InboxDigestSubRecordSchema = z.object({
  uid: z.string().min(1),
  email: z.email(),
  displayName: z.string().optional(),
  roles: z.array(z.string()),
  topRole: z.string(),
  subs: z.partialRecord(InboxDigestTypeSchema, z.boolean()),
  effective: z.record(InboxDigestTypeSchema, z.boolean()),
});
export type TInboxDigestSubRecord = z.infer<typeof InboxDigestSubRecordSchema>;

/**
 * Store uses ISO strings (isoNow()) for createdAtISO/updatedAtISO.
 * Keep permissive: validate as non-empty string so legacy data doesn’t explode.
 */
const IsoString = z.string().min(1);

/* =============================================================================
   Inbox item (stored in userTasks / returned by inbox endpoints)
============================================================================= */

export const InboxItemSchema = z
  .object({
    utid: z.string().min(1),
    source: InboxSourceEnum,
    status: InboxStatusEnum,

    enrollmentId: z.string().nullable(),
    clientId: z.string().nullable(),
    grantId: z.string().nullable(),
    sourcePath: z.string().min(1),

    dueDate: ISO10.nullish(),     // YYYY-MM-DD
    dueMonth: YYYY_MM.nullish(),  // YYYY-MM

    createdAtISO: IsoString.nullish(),
    updatedAtISO: IsoString.nullish(),

    assignedToUid: z.string().nullable(),
    assignedToGroup: InboxAssignedGroupEnum.nullish(),
    cmUid: z.string().nullable(),

    // org scoping / projection
    orgId: z.string().nullish(),
    teamIds: z.array(z.string().min(1)).nullish(),

    notify: z.boolean().nullish(),
    title: z.string().default(""),
    subtitle: z.string().nullish(),
    labels: z.array(z.string().min(1)).nullish(),

    completedAtISO: IsoString.nullish(),
  })
  .passthrough();

export type TInboxItem = z.infer<typeof InboxItemSchema>;

/** Back-compat alias (functions currently imports InboxItem). */
export type InboxItem = TInboxItem;

export const InboxItemEntitySchema = InboxItemSchema.extend({
  id: z.string().min(1),
});
export type TInboxItemEntity = z.infer<typeof InboxItemEntitySchema>;

/* =============================================================================
   InboxListMy (query + response)
============================================================================= */

export const InboxListMyQuerySchema = z
  .object({
    month: YYYY_MM.optional(),
    includeOverdue: Boolish.optional(),
    includeGroup: Boolish.optional(),
  })
  .partial();

export type TInboxListMyQuery = z.infer<typeof InboxListMyQuerySchema>;
export type TInboxListMyResp = Ok<{ items: TInboxItemEntity[] }>;

export const InboxWorkloadListQuerySchema = z
  .object({
    month: YYYY_MM.optional(),
    assigneeUid: z.string().optional(),
    includeUnassigned: Boolish.optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
  })
  .partial();

export type TInboxWorkloadListQuery = z.infer<typeof InboxWorkloadListQuerySchema>;
export type TInboxWorkloadListResp = Ok<{ items: TInboxItemEntity[] }>;

/* =============================================================================
   Email integration (runtime schemas)
============================================================================= */

export const InboxSendInviteBodySchema = z.object({
  to: z.email(),
  name: z.string().trim().optional().default(""),
  resetLink: UrlOrHash.optional().default("#"),
  subject: z.string().trim().optional(),
  html: z.string().trim().optional(),
});
export type TInboxSendInviteBody = z.infer<typeof InboxSendInviteBodySchema>;

export const InboxSendMonthlySummaryBodySchema = z.object({
  to: z.email(),
  clientId: z.union([z.string(), z.number()]).transform(String),
  tasksDue: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).transform(String).optional(),
        type: z.string().optional(),
        dueDate: z.string().optional(),
        completed: z.boolean().optional(),
        completedAt: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  monthsRemaining: z.number().int().nonnegative().nullable().optional(),
  dashboardLink: UrlOrHash.optional().default("#"),
  subject: z.string().trim().optional(),
  html: z.string().trim().optional(),
});
export type TInboxSendMonthlySummaryBody = z.infer<
  typeof InboxSendMonthlySummaryBodySchema
>;

export const InboxSendDigestNowBodySchema = z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: z.array(YYYY_MM).min(1),
  cmUid: z.string().optional(),
  combine: z.boolean().optional().default(false),
  subject: z.string().optional(),
  subjectTemplate: z.string().optional(),
  message: z.string().optional(),
});
export type TInboxSendDigestNowBody = z.infer<typeof InboxSendDigestNowBodySchema>;

export const InboxScheduleDigestBodySchema = z.object({
  digestType: InboxDigestTypeSchema.optional().default("caseload"),
  months: z.array(YYYY_MM).min(1),
  cmUid: z.string().min(1),
  combine: z.boolean().optional().default(true),
  subject: z.string().optional(),
  subjectTemplate: z.string().optional(),
  message: z.string().optional(),
  sendAt: z.string().datetime(),
});
export type TInboxScheduleDigestBody = z.infer<typeof InboxScheduleDigestBodySchema>;

export const InboxDigestPreviewQuerySchema = z.object({
  month: YYYY_MM.optional(),
  cmUid: z.string().optional(),
});
export type TInboxDigestPreviewQuery = z.infer<typeof InboxDigestPreviewQuerySchema>;

/* =============================================================================
   InboxMetricsMy (query + response)
============================================================================= */

export const InboxMetricsScopeSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  completionPct: z.number().nonnegative(), // 0-100
  overdueCount: z.number().int().nonnegative(),
  sharedCount: z.number().int().nonnegative(),
  assignedToMeCount: z.number().int().nonnegative(),
});
export type TInboxMetricsScope = z.infer<typeof InboxMetricsScopeSchema>;

export const InboxMetricsMyQuerySchema = z.object({
  month: YYYY_MM.optional(),
}).partial();
export type TInboxMetricsMyQuery = z.infer<typeof InboxMetricsMyQuerySchema>;
export type TInboxMetricsMyResp = Ok<{
  month: string;
  direct: TInboxMetricsScope;
  group: TInboxMetricsScope;
  total: TInboxMetricsScope;
}>;

/* =============================================================================
   Endpoint-level response envelopes (for endpointMap aliases)
============================================================================= */

export type TInboxEmailResp = Ok<{ id: string | null }>;
export type TInboxSendDigestNowResult = {
  uid: string;
  email: string;
  month: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};
export type TInboxSendDigestNowResp = Ok<{
  sent: number;
  skipped: number;
  failed: number;
  results: TInboxSendDigestNowResult[];
}>;
export type TInboxScheduleDigestResp = Ok<{ id: string; sendAt: string }>;
export type TInboxDigestPreviewResp = Ok<{ items: TInboxItemEntity[] }>;
export type TInboxDigestSubsGetResp = Ok<{ records: TInboxDigestSubRecord[] }>;
export type TInboxDigestSubUpdateReq = {
  uid: string;
  digestType: TInboxDigestType;
  subscribed: boolean;
};
export type TInboxDigestSubUpdateResp = Ok<{
  uid: string;
  digestType: TInboxDigestType;
  subscribed: boolean;
}>;
export type TInboxDigestHtmlPreviewReq = {
  digestType?: TInboxDigestType;
  month?: string;
  forUid?: string;
};
export type TInboxDigestHtmlPreviewResp = Ok<{
  html: string;
  subject: string;
  digestType: TInboxDigestType;
  month: string;
}>;
