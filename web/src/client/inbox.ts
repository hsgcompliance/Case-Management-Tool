//client/inbox.ts
import api from './api';
import type {
  InboxListMyResp, TSendInviteBody, TSendMonthlySummaryBody,
  DigestSendNowReq, DigestSendNowResp, DigestScheduleReq, DigestScheduleResp, InboxEmailResp, InboxMetricsMyResp
} from '@types';

// Local types for digest subscription (not yet in contracts)
type DigestType = "caseload" | "budget" | "enrollments" | "caseManagers";
type DigestSubRecord = {
  uid: string; email: string; displayName?: string;
  roles: string[]; topRole: string;
  subs: Partial<Record<DigestType, boolean>>;
  effective: Record<DigestType, boolean>;
};

export const Inbox = {
  listMy: (query?: { month?: string; includeOverdue?: boolean; includeGroup?: boolean }) =>
    api.get('inboxListMy', query) as Promise<InboxListMyResp>,
  metricsMy: (query?: { month?: string }) =>
    api.get('inboxMetricsMy', query) as Promise<InboxMetricsMyResp>,
  workloadList: (query?: {
    month?: string;
    assigneeUid?: string;
    customerId?: string;
    status?: "open" | "done";
    sortBy?: "dueDate" | "assigneeUid" | "customerId";
    sortDir?: "asc" | "desc";
    includeUnassigned?: boolean;
    limit?: number;
  }) =>
    api.get('inboxWorkloadList', query),
  sendInvite: (body: TSendInviteBody) =>
    api.post('inboxSendInvite', body) as Promise<InboxEmailResp>,
  sendMonthlySummary: (body: TSendMonthlySummaryBody) =>
    api.post('inboxSendMonthlySummary', body) as Promise<InboxEmailResp>,
  digestPreview: (query: { month: string; cmUid?: string }) =>
    api.get('inboxDigestPreview', query),
  sendDigestNow: (body: DigestSendNowReq) =>
    api.post('inboxSendDigestNow', body) as Promise<DigestSendNowResp>,
  scheduleDigest: (body: DigestScheduleReq) =>
    api.post('inboxScheduleDigest', body) as Promise<DigestScheduleResp>,
  digestSubsGet: () =>
    api.get('inboxDigestSubsGet') as Promise<{ ok: boolean; records: DigestSubRecord[] }>,
  digestSubUpdate: (body: { uid: string; digestType: DigestType; subscribed: boolean }) =>
    api.post('inboxDigestSubUpdate', body) as Promise<{ ok: boolean; uid: string; digestType: string; subscribed: boolean }>,
  digestHtmlPreview: (query: { digestType: DigestType; month?: string; forUid?: string }) =>
    api.get('inboxDigestHtmlPreview', query) as Promise<{ ok: boolean; html: string; subject: string; digestType: string; month: string }>,
};

export default Inbox;
