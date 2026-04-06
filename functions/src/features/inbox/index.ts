// functions/src/features/inbox/index.ts

// HTTP handlers (callable via HTTPS)
export {inboxListMy} from "./listMy";
export {inboxMetricsMy} from "./metricsMy";
export {inboxSendInvite, inboxSendMonthlySummary} from "./emailer";
export {inboxDigestPreview} from "./digestPreview";
export {inboxSendDigestNow} from "./digestHttp";
export {inboxScheduleDigest, processScheduledDigests} from "./digestSchedule";
export {inboxWorkloadList} from "./workloadList";
export {inboxDigestSubsGet, inboxDigestSubUpdate} from "./digestSubs";
export {inboxDigestHtmlPreview} from "./digestHtmlPreview";

// Firestore triggers
export {onEnrollmentInboxIndexer} from "./triggers";
// Per-task assignment emails disabled — replaced by monthly caseload digest
// export {onUserTaskAssigned} from "./taskAssignEmail";

// Scheduler (cron)
export {sendMonthlyDigests} from "./digest";

// (Optional internal exports if you need them elsewhere; safe to omit)
// export { sendHtmlEmail, sendInviteService, sendMonthlySummaryService } from "./emailer";
// export { buildDigestRows, sendDigestEmail } from "./digestCore";
