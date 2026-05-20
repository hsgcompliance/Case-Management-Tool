# Product Backlog Notes

These notes preserve useful product intent from old local prompt scratchpads. They are not committed requirements. Treat them as directional backlog context and validate with current stakeholders before building.

## Product Principle

The app should make compliance a byproduct of normal case manager and operations workflows. Avoid duplicate entry. Favor additive, migration-safe changes.

## CM-First Workflow Ideas

Possible task mode model on `usersMe`:

- `taskMode: "viewer" | "workflow"`
- `taskModeSetAt`
- `taskModeSetBy: "self" | "admin" | "system"`

Potential behavior:

- `viewer` sees tasks, due dates, filters, and context, with completion workflows minimized.
- `workflow` can complete, reschedule, update, and receive completion metrics.

Potential acceptance checks:

- New case manager with no task mode sees a first-login selection once.
- Settings can change task mode later.
- Inbox includes direct tasks and eligible group tasks.
- Dashboard counts match filtered datasets.
- Completion percent uses a documented denominator.

## Inbox And Metrics Ideas

Monthly inbox/dashboard metrics may include:

- assigned count
- completed count
- completion percent
- overdue count
- due next seven days count

Scopes:

- direct assigned tasks
- group queue tasks
- total union with dedupe

Rules to define before implementation:

- cancelled task denominator behavior
- overdue date definition
- direct plus group dedupe behavior
- sort order for open-first views

## Email Digest Ideas

Potential monthly case manager digest:

- month label in subject
- assigned, completed, completion percent
- due this month
- optional group queue load
- dashboard link
- plaintext fallback
- mobile-friendly HTML
- preview/send-now endpoint for admins
- per-user digest preference
- delivery logging

One-off assigned-task emails should use similar hierarchy to task/detail cards and link back to the app.

## Programs, Referrals, Assessments, Buckets

Potential program/grant distinction:

- keep `grants`
- add `kind: "grant" | "program"`
- add `tags: string[]`
- programs hide/ignore budget/payment flows but still support enrollments, referrals, tasks, and assessments

Potential referral/waitlist collection:

- `referrals/{referralId}`
- org/team scoped
- linked to grant/program
- optional `customerId`
- snapshot for pre-customer contact/household info
- statuses like new, screening, prioritized, accepted, ineligible, archived
- priority and review fields
- promotion path to customer and enrollment

Potential assessment run collection:

- `assessments/{assessmentId}`
- org/team scoped
- linked to grant/program and subject
- subject can be referral, enrollment, or customer
- stores rubric/version, answers, score, level, submitted metadata, and lifecycle fields

Potential bucket/queue collection:

- `buckets/{bucketId}`
- org/team scoped
- optional grant/program link
- type, name, and membership model
- may mirror bucket IDs onto `userExtras/{uid}` for fast access

Risks to resolve before implementation:

- naming collision between old task template "assessments" and true assessment runs
- Firestore query/index shape for queue membership
- security leakage across org/team/bucket boundaries
- migration path for existing grant task definitions
