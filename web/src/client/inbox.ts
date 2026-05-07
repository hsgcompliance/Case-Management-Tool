//client/inbox.ts
import api from './api';
import type {
  InboxListMyResp, TSendInviteBody, TSendMonthlySummaryBody,
  DigestSendNowReq, DigestSendNowResp, DigestScheduleReq, DigestScheduleResp, InboxEmailResp, InboxMetricsMyResp,
  RespOf, ReqOf
} from '@types';

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
    api.get('inboxDigestSubsGet') as Promise<RespOf<"inboxDigestSubsGet">>,
  digestSubUpdate: (body: ReqOf<"inboxDigestSubUpdate">) =>
    api.post('inboxDigestSubUpdate', body) as Promise<RespOf<"inboxDigestSubUpdate">>,
  digestHtmlPreview: (query: ReqOf<"inboxDigestHtmlPreview">) =>
    api.get('inboxDigestHtmlPreview', query) as Promise<RespOf<"inboxDigestHtmlPreview">>,
};

export default Inbox;
