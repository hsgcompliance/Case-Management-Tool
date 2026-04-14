// contracts/src/jotform.ts
import {
  z,
  Id,
  IdLike,
  TsLike,
  BoolLike,
  BoolFromLike,
  toArray,
} from "./core";
import { Ok } from "./http";

export { toArray } from "./core";

/** ---------- Enums ---------- */
export const JotformSubmissionStatus = z.enum(["active", "archived", "deleted"]);
export type TJotformSubmissionStatus = z.infer<typeof JotformSubmissionStatus>;

export const JotformSubmissionSource = z.enum([
  "api",
  "webhook",
  "sync",
  "manual",
]);
export type TJotformSubmissionSource = z.infer<typeof JotformSubmissionSource>;

/** ---------- helpers ---------- */
// Zod v4: .finite() is deprecated
const Num = z.coerce.number().refine(Number.isFinite, "not_finite").default(0);

/** ---------- Budget ---------- */
export const JotformBudgetLineItem = z
  .object({
    id: Id.optional(),
    label: z.string().trim().nullish(),
    amount: Num,
    projected: Num,
    spent: Num,
    projectedInWindow: Num.optional(),
    spentInWindow: Num.optional(),
    locked: z.boolean().nullish(),
  })
  .passthrough();

export type TJotformBudgetLineItem = z.infer<typeof JotformBudgetLineItem>;

export const JotformBudgetTotals = z
  .object({
    total: Num,
    projected: Num,
    spent: Num,
    balance: Num.optional(),
    projectedBalance: Num.optional(),
    remaining: Num.optional(),
    projectedInWindow: Num.optional(),
    spentInWindow: Num.optional(),
    windowBalance: Num.optional(),
    windowProjectedBalance: Num.optional(),
  })
  .passthrough();

export type TJotformBudgetTotals = z.infer<typeof JotformBudgetTotals>;

export const JotformBudget = z
  .object({
    total: Num,
    totals: JotformBudgetTotals.nullish(),
    lineItems: z.array(JotformBudgetLineItem).default([]),
    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TJotformBudget = z.infer<typeof JotformBudget>;

/** ---------- Calculation ---------- */
export const JotformSubmissionCalc = z
  .object({
    amount: Num,
    currency: z.string().trim().nullish(),
    amounts: z.array(Num).optional(),
    budgetKey: z.string().trim().nullish(),
    lineItems: z.array(
      z
        .object({
          key: z.string().trim().min(1),
          label: z.string().trim().nullish(),
          amount: Num,
        })
        .passthrough()
    ).optional(),
  })
  .passthrough();

export type TJotformSubmissionCalc = z.infer<typeof JotformSubmissionCalc>;

/** ---------- Submission (INPUT) ---------- */
export const JotformSubmissionInputSchema = z
  .object({
    id: Id.optional(),
    orgId: Id.nullish(),

    formId: Id,
    formTitle: z.string().trim().nullish(),
    submissionId: Id.optional(),

    status: JotformSubmissionStatus.optional(),
    source: JotformSubmissionSource.optional(),

    // Optional linkage to grants/programs
    grantId: Id.nullish(),
    programId: Id.nullish(),
    customerId: Id.nullish(),
    enrollmentId: Id.nullish(),
    cwId: z.string().trim().nullish(),
    hmisId: z.string().trim().nullish(),
    formAlias: z.string().trim().min(1).nullish(),
    fieldMap: z.record(z.string(), z.string()).nullish(),

    // Basic Jotform metadata
    ip: z.string().trim().nullish(),
    statusRaw: z.string().trim().nullish(),
    submissionUrl: z.url().nullish(),
    editUrl: z.url().nullish(),
    pdfUrl: z.url().nullish(),

    // Submission payload
    answers: z.record(z.string(), z.unknown()).nullish(),
    raw: z.unknown().nullish(),

    // Budget / calc payload
    budget: JotformBudget.nullish(),
    calc: JotformSubmissionCalc.nullish(),

    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();

export type TJotformSubmission = z.infer<typeof JotformSubmissionInputSchema> & Record<string, any>;

/** Back-compat runtime name */
export const JotformSubmission = JotformSubmissionInputSchema;

/** ---------- Submission (ENTITY / READ) ---------- */
export const JotformSubmissionEntity = JotformSubmissionInputSchema.extend({
  id: Id,
}).passthrough();

export type TJotformSubmissionEntity = z.infer<typeof JotformSubmissionEntity> & Record<string, any>;

/* =============================================================================
   Requests / Responses
============================================================================= */

// ---------------- Upsert (POST /jotformSubmissionsUpsert) ----------------
export const JotformSubmissionsUpsertBody = z.union([
  JotformSubmissionInputSchema,
  z.array(JotformSubmissionInputSchema).min(1),
]);
export const JotformSubmissionUpsertBody = JotformSubmissionsUpsertBody; // back-compat

export type TJotformSubmissionsUpsertBody = z.infer<typeof JotformSubmissionsUpsertBody>;
export type TJotformSubmissionsUpsertResp = Ok<{ ids: string[] }>;

// ---------------- Patch (PATCH /jotformSubmissionsPatch) ----------------
export const JotformSubmissionsPatchRow = z
  .object({
    id: Id,
    patch: JotformSubmissionInputSchema.partial().passthrough(),
    unset: z.array(z.string().min(1)).optional(),
  })
  .passthrough()
  .refine(
    (v) => Object.keys(v.patch || {}).length > 0 || (v.unset?.length || 0) > 0,
    { message: "empty_patch" }
  );

export const JotformSubmissionsPatchBody = z.union([
  JotformSubmissionsPatchRow,
  z.array(JotformSubmissionsPatchRow).min(1),
]);
export const JotformSubmissionPatchBody = JotformSubmissionsPatchBody; // back-compat

export type TJotformSubmissionsPatchRow = z.infer<typeof JotformSubmissionsPatchRow>;
export type TJotformSubmissionsPatchBody = z.infer<typeof JotformSubmissionsPatchBody>;
export type TJotformSubmissionsPatchResp = Ok<{ ids: string[] }>;

// ---------------- Soft delete (POST /jotformSubmissionsDelete) ----------------
export const JotformSubmissionsDeleteBody = z.preprocess(
  (v) => {
    if (v && typeof v === "object") {
      const o: any = v;
      if ("ids" in o) return o.ids;
      if ("id" in o) return o.id;
    }
    return v;
  },
  z.union([IdLike, z.array(IdLike).min(1)])
);

export type TJotformSubmissionsDeleteBody = z.infer<typeof JotformSubmissionsDeleteBody>;
export type TJotformSubmissionsDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- Hard delete (POST /jotformSubmissionsAdminDelete) ----------------
export const JotformSubmissionsAdminDeleteBody = JotformSubmissionsDeleteBody;
export type TJotformSubmissionsAdminDeleteBody = z.infer<typeof JotformSubmissionsAdminDeleteBody>;
export type TJotformSubmissionsAdminDeleteResp = Ok<{ ids: string[]; deleted: true }>;

// ---------------- List (GET/POST /jotformSubmissionsList) ----------------
const ActiveFilter = z.preprocess((v) => {
  if (v === "" || v == null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : v;
  if (Array.isArray(v)) return (v as any[])[0];
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(s)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
  }
  return v;
}, z.union([z.literal(true), z.literal(false)]));

export const JotformSubmissionsListQuery = z
  .object({
    status: z.string().trim().optional(),
    active: z.union([ActiveFilter, BoolLike, z.string()]).optional(),

    formId: IdLike.optional(),
    formAlias: IdLike.optional(),
    submissionId: IdLike.optional(),
    grantId: IdLike.optional(),
    programId: IdLike.optional(),
    customerId: IdLike.optional(),
    enrollmentId: IdLike.optional(),
    cwId: z.string().trim().optional(),
    hmisId: z.string().trim().optional(),

    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursorUpdatedAt: TsLike.optional(),
    cursorId: IdLike.optional(),

    // dev explicit org targeting
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TJotformSubmissionsListQuery = z.infer<typeof JotformSubmissionsListQuery>;
export type TJotformSubmissionsListResp = Ok<{
  items: TJotformSubmissionEntity[];
  next: { cursorUpdatedAt: unknown; cursorId: string } | null;
  orgId: string;
}>;

// ---------------- Get (GET/POST /jotformSubmissionsGet) ----------------
export const JotformSubmissionsGetQuery = z
  .object({ id: IdLike, orgId: IdLike.optional() })
  .passthrough();
export type TJotformSubmissionsGetQuery = z.infer<typeof JotformSubmissionsGetQuery>;
export type TJotformSubmissionsGetResp = Ok<{ submission: TJotformSubmissionEntity }>;

// ---------------- Structure (GET /jotformSubmissionsStructure) ----------------
export type TJotformSubmissionsStructureResp = Ok<{ structure: Partial<TJotformSubmission> }>;

// ---------------- Forms list (GET /jotformFormsList) ----------------
export const JotformFormsListQuery = z
  .object({
    search: z.string().trim().optional(),
    includeNoSubmissions: BoolFromLike.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .passthrough();

export const JotformFormSummary = z
  .object({
    id: Id,
    title: z.string().trim().default(""),
    alias: z.string().trim().min(1),
    count: z.coerce.number().int().nonnegative().default(0),
    lastSubmission: z.string().trim().nullish(),
    url: z.url().nullish(),
    isSign: z.boolean().optional(),
  })
  .passthrough();

export type TJotformFormsListQuery = z.infer<typeof JotformFormsListQuery>;
export type TJotformFormSummary = z.infer<typeof JotformFormSummary>;
export type TJotformFormsListResp = Ok<{ items: TJotformFormSummary[] }>;

// ---------------- Link submission (POST /jotformLinkSubmission) ----------------
export const JotformLinkSubmissionBody = z
  .object({
    id: IdLike.optional(),
    submissionId: IdLike.optional(),
    formAlias: z.string().trim().min(1).nullish(),
    grantId: IdLike.nullish(),
    customerId: IdLike.nullish(),
    enrollmentId: IdLike.nullish(),
    cwId: z.string().trim().nullish(),
    hmisId: z.string().trim().nullish(),
    fieldMap: z.record(z.string(), z.string()).nullish(),
    notes: z.string().trim().nullish(),
    orgId: IdLike.optional(),
  })
  .passthrough()
  .refine((v) => !!(v.id || v.submissionId), { message: "missing_id_or_submissionId" });

export type TJotformLinkSubmissionBody = z.infer<typeof JotformLinkSubmissionBody>;
export type TJotformLinkSubmissionResp = Ok<{
  id: string;
  linked: true;
  link: {
    grantId: string | null;
    customerId: string | null;
    enrollmentId: string | null;
    cwId: string | null;
    hmisId: string | null;
    formAlias: string | null;
  };
}>;

// ---------------- Sync selection (POST /jotformSyncSelection) ----------------
export const JotformSyncSelectionBody = z
  .object({
    mode: z.enum(["all", "formIds", "aliases"]).default("all"),
    formIds: z.array(IdLike).optional(),
    aliases: z.array(z.string().trim().min(1)).optional(),
    includeNoSubmissions: BoolFromLike.optional(),
    since: TsLike.optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    maxPages: z.coerce.number().int().min(1).max(25).optional(),
    includeRaw: BoolFromLike.optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TJotformSyncSelectionBody = z.infer<typeof JotformSyncSelectionBody>;
export type TJotformSyncSelectionResp = Ok<{
  forms: Array<{ formId: string; alias: string | null; count: number }>;
  ids: string[];
  count: number;
}>;

// ---------------- Digest map (tools/jotform editor) ----------------
export const JotformDigestFieldType = z.enum(["question", "header", "section"]);
export type TJotformDigestFieldType = z.infer<typeof JotformDigestFieldType>;

export const JotformDigestHeader = z
  .object({
    show: z.boolean().default(true),
    title: z.string().trim().nullish(),
    subtitle: z.string().trim().nullish(),
  })
  .passthrough();
export type TJotformDigestHeader = z.infer<typeof JotformDigestHeader>;

export const JotformDigestSection = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    show: z.boolean().default(true),
    order: z.coerce.number().int().default(0),
  })
  .passthrough();
export type TJotformDigestSection = z.infer<typeof JotformDigestSection>;

export const JotformDigestField = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    questionLabel: z.string().trim().nullish(),
    type: JotformDigestFieldType.default("question"),
    sectionId: z.string().trim().nullish(),
    show: z.boolean().default(true),
    hideIfEmpty: z.boolean().default(true),
    order: z.coerce.number().int().default(0),
  })
  .passthrough();
export type TJotformDigestField = z.infer<typeof JotformDigestField>;

export const JotformDigestMap = z
  .object({
    id: Id.optional(),
    orgId: Id.nullish(),
    formId: Id,
    formAlias: z.string().trim().min(1).nullish(),
    formTitle: z.string().trim().nullish(),
    header: JotformDigestHeader.default({ show: true, title: null, subtitle: null }),
    sections: z.array(JotformDigestSection).default([]),
    fields: z.array(JotformDigestField).default([]),
    options: z
      .object({
        hideEmptyFields: z.boolean().default(true),
        showQuestions: z.boolean().default(true),
        showAnswers: z.boolean().default(true),
        task: z
          .object({
            enabled: z.boolean().default(false),
            assignedToGroup: z.enum(["admin", "compliance", "casemanager"]).default("admin"),
            titlePrefix: z.string().trim().nullish(),
            titleFieldKeys: z.array(z.string().trim().min(1)).default([]),
            subtitleFieldKeys: z.array(z.string().trim().min(1)).default([]),
          })
          .passthrough()
          .default({
            enabled: false,
            assignedToGroup: "admin",
            titlePrefix: null,
            titleFieldKeys: [],
            subtitleFieldKeys: [],
          }),
      })
      .passthrough()
      .default({
        hideEmptyFields: true,
        showQuestions: true,
        showAnswers: true,
        task: {
          enabled: false,
          assignedToGroup: "admin",
          titlePrefix: null,
          titleFieldKeys: [],
          subtitleFieldKeys: [],
        },
      }),
    createdAt: TsLike.nullish(),
    updatedAt: TsLike.nullish(),
  })
  .passthrough();
export type TJotformDigestMap = z.infer<typeof JotformDigestMap>;

export const JotformDigestUpsertBody = JotformDigestMap;
export type TJotformDigestUpsertBody = z.infer<typeof JotformDigestUpsertBody>;
export type TJotformDigestUpsertResp = Ok<{ id: string }>;

export const JotformDigestGetQuery = z
  .object({
    formId: IdLike.optional(),
    formAlias: z.string().trim().optional(),
    id: IdLike.optional(),
    orgId: IdLike.optional(),
  })
  .passthrough()
  .refine((v) => !!(v.formId || v.formAlias || v.id), { message: "missing_form_id_or_alias" });
export type TJotformDigestGetQuery = z.infer<typeof JotformDigestGetQuery>;
export type TJotformDigestGetResp = Ok<{ map: TJotformDigestMap | null }>;

export const JotformDigestListQuery = z
  .object({
    search: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();
export type TJotformDigestListQuery = z.infer<typeof JotformDigestListQuery>;
export type TJotformDigestListResp = Ok<{ items: TJotformDigestMap[] }>;

// ---------------- Sync (POST /jotformSyncSubmissions) ----------------
export const JotformSyncBody = z
  .object({
    formId: IdLike,
    since: TsLike.optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    maxPages: z.coerce.number().int().min(1).max(25).optional(),
    startOffset: z.coerce.number().int().min(0).optional(),
    includeRaw: BoolFromLike.optional(),
    orgId: IdLike.optional(),
  })
  .passthrough();

export type TJotformSyncBody = z.infer<typeof JotformSyncBody>;
export type TJotformSyncResp = Ok<{ ids: string[]; count: number; nextOffset: number; hasMore: boolean }>;

/* ---- Live API proxy (no Firestore) ---- */

export const JotformApiListQuery = z
  .object({
    formId: IdLike,
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    status: z.string().optional(),
    since: TsLike.optional(),
  })
  .passthrough();
export type TJotformApiListQuery = z.infer<typeof JotformApiListQuery>;
export type TJotformApiListResp = Ok<{ items: TJotformSubmission[]; hasMore: boolean }>;

export const JotformApiGetQuery = z
  .object({ id: IdLike })
  .passthrough();
export type TJotformApiGetQuery = z.infer<typeof JotformApiGetQuery>;
export type TJotformApiGetResp = Ok<{ submission: TJotformSubmission }>;
