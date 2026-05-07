# Tasks Feature Deprecation Notes

The tasks feature is in compatibility mode. The original system generated enrollment task schedules and supported assignment, status changes, completion, verification, and reopen workflows. Product direction has moved away from that model.

New work should treat task-shaped records as lightweight reminders or notes that can be shown on customer/grant surfaces and included in digest emails.

## Deprecated lifecycle

The following concepts are deprecated for new product work:

- Generic task completion as a primary workflow.
- `completed`, `completedAt`, `status`, verification, and reopen metadata as required state.
- Generated enrollment task schedules as the default path for grants/customers.
- `tasksUpdateStatus` and bulk status updates as core user actions.
- Enrollment task generator triggers as automatic workflow drivers.

These fields and handlers remain for back compatibility with old records and screens.

## Current backend posture

- `contracts/src/tasks.ts` defaults optional lifecycle fields so old callers keep working.
- `tasksUpdateStatus` and bulk status handlers are marked deprecated but still available.
- `tasksUpsertManual` now frames writes as lightweight reminder notes.
- Enrollment creation and bulk enrollment explicitly call the schedule generator when `generateTaskSchedule !== false`.
- The explicit generator evaluates grant `tasks` plus `conditionalTaskRules`; do not re-enable enrollment-created task triggers for this path.
- `functions/src/features/tasks/index.ts` no longer exports:
  - `onEnrollmentBuildTasks`
  - `onEnrollmentAutoAssignCM`
- `onOtherTaskWrite` remains exported because it supports the reminder/notification projection into `userTasks`.

## Grant notification definitions

Grant/program reminder definitions still live on `grants/{id}.tasks` for now. They support recurring definitions such as monthly data entry, weekly compliance, 3-month recertification, and annual recertification.

Conditional reminder rules live on `grants/{id}.conditionalTaskRules`. The explicit generator supports:

- age rules, using customer DOB as of enrollment start date;
- population rules, matching `Youth`, `Individual`, or `Family`;
- concurrent-enrollment rules, matching another active enrollment by grant/program name.

Conditional rules can also carry recurrence fields (`kind`, `frequency`, `every`, `endDate`, `notify`) so a matched rule can generate more than one reminder.

## Recommended path forward

- Keep reminder/notification records tied to customer, grant, payment, compliance, or form context.
- Surface them through customer pages, important operational areas, and digest emails.
- Use optional due dates and descriptive notes instead of mandatory completion state.
- Keep compatibility readers tolerant of old `taskSchedule` records.
- Rename frontend surfaces over time from "Tasks" to "Notes", "Reminders", or "Follow-ups" where the UI is no longer status-driven.

## Rent certification reminders

Rent certification is now treated as payment-derived reminders, not a sequential task workflow. The payment schedule builder should emit paired one-off reminder definitions for each rent-cert event:

- one reminder assigned to `casemanager`, with notes about collecting updated customer/landlord documents;
- one reminder assigned to `compliance`, with notes about preparing and sending the updated certification or notice.

Both reminders use the same event title, such as `Apr 1 rent cert due Mar 1`, but carry role-specific notes. The generator respects `assignedToGroup` on single-owner definitions, so this no longer needs `multiparty.mode = "sequential"`.

Payment-derived rent-cert definitions use the `payment_rent_cert_` prefix. Schedule rebuilds replace that prefix so deposit-only or short rental schedules can remove stale rent-cert reminders when the payment schedule no longer reaches the recertification month.

## Known cleanup still pending

- Some frontend components still call `tasksUpdateStatus` or expose complete-oriented UI.
- Some metrics still expose completion percentages from `userTasks`.
- Assessment and enrollment flows may still update `taskSchedule` for old review/checkpoint behavior.
- Admin regenerate dialogs still describe preserving completed tasks.

Those areas should be handled as product cleanup, not as contract-breaking removals.
