# Inbox, Digest, and Reminder Projection

The inbox feature is now a lightweight notification and reminder surface. It still reads from `userTasks` for compatibility, but new behavior should treat those rows as projected reminders or notes for customer/grant context and digest emails, not as a task completion workflow.

## Current direction

- `userTasks` remains the fast read model for inbox lists, workload flags, customer flags, and digest emails.
- Existing `customerEnrollments.taskSchedule[]` rows are still projected so old data does not disappear.
- Digest emails should present task-shaped rows as "Notes / Reminders".
- New reminders should prefer lightweight note/reminder writes tied to customers, grants, payments, compliance, Jotform, or other operational events.
- Completion/status fields are compatibility fields. Do not build new product behavior around marking generic tasks complete.

## Deprecated task lifecycle

The old lifecycle centered on generated enrollment tasks, `status`, `completed`, `completedAt`, verification, reopen metadata, and `tasksUpdateStatus`.

That lifecycle is deprecated:

- `tasksUpdateStatus` and bulk status endpoints remain for old screens and historical rows.
- `onEnrollmentBuildTasks` and `onEnrollmentAutoAssignCM` are no longer exported from the tasks feature.
- The inbox enrollment trigger keeps a compatibility projection for embedded `taskSchedule` rows.
- Status-like values may still appear in stored rows, but digest/customer UI should not rely on them as workflow state.

## Still active

- Payment and compliance rows can still appear in `userTasks` as operational notifications.
- Jotform and other-task indexing can still write to `userTasks` so important items surface in the same inbox/digest channel.
- `onOtherTaskWrite` remains exported because it supports the lighter reminder/notification path.
- Digest scheduling and send-now flows continue to gather `userTasks` rows for case manager emails.
- Caseload digests also derive "Next Rent Cert Due" directly from active enrollment payment schedules for rental assistance customers.

## Implementation notes

- Contracts make several lifecycle inputs optional/defaulted for back compatibility.
- `taskSchedule` projection in `functions/src/features/inbox/triggers.ts` is explicitly marked deprecated.
- Digest rendering in `functions/src/features/inbox/digestTemplate.ts` avoids status badges and completion language.
- Rent-cert due dates are computed from monthly rent payments: the fourth month of rental assistance, then every three rental payments after that, requires docs one month before the target payment. If the due date is today or earlier, the digest renders it as ASAP with bold amber/yellow styling.
- Future work should add a clearer reminder/notification model before removing old fields from stored records.

## Avoid

- Do not add new completion requirements to generic task rows.
- Do not depend on `status === "done"` as the source of truth for customer/grant reminders.
- Do not regenerate enrollment task schedules as part of normal grant/customer flows unless intentionally supporting old data.
- Do not add new UI that asks case managers to complete generic tasks. Prefer notes, reminders, flags, and digest visibility.
