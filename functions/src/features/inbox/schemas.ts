// functions/src/features/inbox/schemas.ts
import * as C from "@hdb/contracts";
export { z } from "@hdb/contracts";

// Runtime schemas (contracts-first)
export const SendInviteBody = C.inbox.InboxSendInviteBodySchema;
export const SendMonthlySummaryBody = C.inbox.InboxSendMonthlySummaryBodySchema;
export const DigestSendNowBody = C.inbox.InboxSendDigestNowBodySchema;
export const ScheduleDigestBody = C.inbox.InboxScheduleDigestBodySchema;
export const InboxDigestPreviewQuery = C.inbox.InboxDigestPreviewQuerySchema;

// Optional but useful if/when you start validating inbox reads in handlers
export const InboxItemSchema = C.inbox.InboxItemSchema;
export const InboxItemEntitySchema = C.inbox.InboxItemEntitySchema;
export const InboxListMyQuerySchema = C.inbox.InboxListMyQuerySchema;

// Types
export type {
  InboxSource,
  InboxStatus,
  InboxAssignedGroup,

  // Back-compat (functions code already uses this)
  TInboxItem as InboxItem,

  // Canonical (new preferred)
  TInboxItem,
  TInboxItemEntity,
  TInboxListMyQuery,

  TInboxSendInviteBody as TSendInviteBody,
  TInboxSendMonthlySummaryBody as TSendMonthlySummaryBody,
  TInboxSendDigestNowBody as TDigestSendNowBody,
  TInboxScheduleDigestBody as TScheduleDigestBody,
  TInboxDigestPreviewQuery,
} from "@hdb/contracts";
