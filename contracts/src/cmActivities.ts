// contracts/src/cmActivities.ts
import { z, Id, ISO10 } from "./core";

export const CmActivityType = z.enum([
  "in-person",
  "phone",
  "data-entry",
  "other",
]);
export type TCmActivityType = z.infer<typeof CmActivityType>;

export const CmActivity = z.object({
  id: Id,
  orgId: Id,
  caseManagerId: Id,
  caseManagerName: z.string().trim().optional(),
  customerId: Id,
  customerName: z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: z.string().trim().optional(), // "HH:MM"
  endTime: z.string().trim().optional(),   // "HH:MM"
  note: z.string().trim().optional(),
  calendarEventId: z.string().trim().optional(),
  calendarSynced: z.boolean().optional(),
  // Set true once the session has been pushed to the customer's TSS workbook as a
  // progress-note row (mirrors calendarSynced). workbookRowKey is the appended
  // row's key returned by appendCustomerWorkbookRow.
  workbookSynced: z.boolean().optional(),
  workbookSyncedAt: z.string().optional(),
  workbookRowKey: z.string().trim().optional(),
  archived: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type TCmActivity = z.infer<typeof CmActivity>;

export const CmActivityCreateBody = z.object({
  customerId: Id,
  customerName: z.string().trim().optional(),
  type: CmActivityType,
  date: ISO10,
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  note: z.string().trim().optional(),
  postToCalendar: z.boolean().optional(),
});
export type TCmActivityCreateBody = z.infer<typeof CmActivityCreateBody>;

export const CmActivityUpdateBody = z.object({
  type: CmActivityType.optional(),
  date: ISO10.optional(),
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  note: z.string().trim().optional(),
});
export type TCmActivityUpdateBody = z.infer<typeof CmActivityUpdateBody>;

export const CmActivitiesListQuery = z.object({
  month: z.string().optional(),      // "YYYY-MM"
  customerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type TCmActivitiesListQuery = z.infer<typeof CmActivitiesListQuery>;

export const CmActivitiesListResp = z.object({
  items: z.array(CmActivity),
});
export type TCmActivitiesListResp = z.infer<typeof CmActivitiesListResp>;
