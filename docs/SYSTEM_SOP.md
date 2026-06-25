# Households DB v2 System SOP

**Internal Operations, Security, and Maintenance SOP**

| Field | Value |
| --- | --- |
| Prepared for | Internal HRDC leadership review |
| Current practical maintainer | Griffin, HYC Compliance Coordinator |
| System owner account | `hsgcompliance@thehrdc.org` |
| Canonical repository | `https://github.com/hsgcompliance/Case-Management-Tool.git` |

> Households DB v2 is sensitive internal infrastructure. It contains customer, housing assistance, program, payment, grant, Jotform, Google Drive, and user-access information. Operate it as a confidential production system.

## Table Of Contents

- [1. Purpose](#1-purpose)
- [2. Current System Status](#2-current-system-status)
- [3. Ownership And Administrative Control](#3-ownership-and-administrative-control)
- [4. Intended Users](#4-intended-users)
- [5. Information Stored Or Organized](#5-information-stored-or-organized)
- [6. Where Information Is Stored](#6-where-information-is-stored)
- [7. Access Controls And Security](#7-access-controls-and-security)
- [8. Jotform Integration](#8-jotform-integration)
- [9. Google Drive Integration](#9-google-drive-integration)
- [10. Ledger, Payments, And Audit Trails](#10-ledger-payments-and-audit-trails)
- [11. Billing, Costs, And Invoices](#11-billing-costs-and-invoices)
- [12. Editing And Maintenance Workflow](#12-editing-and-maintenance-workflow)
- [13. Safe Change Process](#13-safe-change-process)
- [14. Deployment And Verification](#14-deployment-and-verification)
- [15. Future Maintainer Handoff](#15-future-maintainer-handoff)
- [16. Privacy And Staff-Use Expectations](#16-privacy-and-staff-use-expectations)
- [17. Risk Summary](#17-risk-summary)
- [18. Emergency Access Or Lockout](#18-emergency-access-or-lockout)
- [19. Bottom Line](#19-bottom-line)
- [Appendix A: Technical Maintainer Quick Reference](#appendix-a-technical-maintainer-quick-reference)
- [Appendix B: Developer-Heavy Technical Reference](#appendix-b-developer-heavy-technical-reference)

## 1. Purpose

Households DB v2 is an internal HRDC operations system designed to improve communication between Housing/Youth Compliance and case management teams.

The primary purpose is to help approved staff better understand:

- Customer status.
- Program enrollment.
- Budget and grant context.
- Rental assistance planning.
- Payment status.
- Staff responsibility and case manager assignment.
- Compliance and follow-up needs.

The system also supports front-line coordination. Approved users such as Reception, Resource Navigation, Overnight Shelter staff, Housing and Youth Compliance, and Case Management staff may use the system to identify a customer's assigned case manager or relevant program contact when someone on a caseload presents for services.

Households DB v2 does **not** replace HMIS, Caseworthy, Google Drive, Jotform, or formal financial systems. It functions as an internal coordination layer that brings key operational information into one place so staff can communicate more clearly and make better-informed decisions.

## 2. Current System Status

Households DB v2 is an active internal tool under ongoing development. It is not currently a fully IT-managed enterprise system.

The system has meaningful security controls and documentation, but it is still primarily maintained by Griffin, HYC Compliance Coordinator. Long-term maintenance and technical continuity are known risks.

The system is documented and structured so a reasonably tech-savvy staff member, contractor, or future maintainer using a modern code editor and AI coding assistant could troubleshoot many routine issues. Major changes should receive careful review before implementation, especially changes involving:

- Security or access controls.
- Data migration or repair.
- Jotform syncing.
- Google Drive behavior.
- Budget, ledger, or payment logic.
- Multi-organization data boundaries.

## 3. Ownership And Administrative Control

The system is owned by the HRDC-controlled account:

```text
hsgcompliance@thehrdc.org
```

This account owns or controls the related Google Cloud/Firebase project and has elevated administrative authority.

Current practical system ownership and maintenance sits with:

```text
Griffin, HYC Compliance Coordinator
```

Griffin currently approves most changes, manages technical updates, and maintains the system structure. Some workflows also pass through manager or director-level users depending on the feature.

The `hsgcompliance@thehrdc.org` account should be treated as a privileged system account. Access to this account should be controlled carefully because it has powerful system-level permissions.

## 4. Intended Users

Current intended users are internal HRDC staff only.

User groups include:

- Reception.
- Resource Navigation.
- Overnight Shelter workers.
- Housing Compliance.
- Youth Compliance.
- Case Management staff.
- Manager/director users.
- Approved administrative users.

The system is designed to support organization-scoped records in the future, but current production access is HRDC-only. Non-HRDC users should not be allowed into the system unless a separate review is completed for privacy, security, data-sharing, and access boundaries.

Production signup and access should remain limited to approved HRDC users.

## 5. Information Stored Or Organized

Households DB v2 may store or organize confidential customer, program, and operational information.

This may include:

- Customer names.
- Dates of birth.
- HMIS IDs.
- Caseworthy/CW IDs.
- Household information.
- Case manager assignments.
- Program enrollment information.
- Rental assistance projections.
- Actual payment or spending records.
- Grant, program, budget, line item, allocation, and ledger information.
- Internal tasks.
- Assessment or follow-up information.
- Jotform submission data or submission references.
- Google Drive folder and file references.
- User roles, team assignments, and access settings.

The system should be treated as containing personally identifiable information, housing assistance information, program participation information, and internal financial/program operations information.

The system should not be used for casual notes, unrelated documents, unnecessary personal details, or information that does not support program operations.

## 6. Where Information Is Stored

| System | Purpose | Notes |
| --- | --- | --- |
| Firestore | Primary operational database | Stores most customer, enrollment, payment, grant, user, task, and internal operational records. |
| Google Drive | Customer file storage | Customer files remain in Google Drive. The app helps locate, create, organize, or reference folders and files. |
| Jotform | Form and submission platform | The app can view forms, read form structures, retrieve submissions, and connect submission data to workflows. |
| Firebase/Google Cloud Storage | Infrastructure storage | Treat as production infrastructure. Do not use for exports, credentials, dumps, or sensitive reports without documented need and understood access controls. |

### Common Firestore Collections

- `customers`
- `customerEnrollments`
- `payments`
- `grants`
- `ledger`
- `jotformSubmissions`
- `userExtras`
- `users`
- `userTasks`
- `otherTasks`
- `orgs`
- `metrics`

Google Drive customer files are separate from GCS. The Drive integration operates against Google Drive using the signed-in user's Google access token when available, with configured fallback modes for service/shared OAuth access. Drive files remain in Google Drive; the app stores references and uses Drive APIs to list and create customer folders.

## 7. Access Controls And Security

The system uses layered security controls.

| Layer | Purpose |
| --- | --- |
| HRDC-only access | Production use is limited to approved HRDC users. |
| Google/Firebase login | Users must authenticate before accessing the system. |
| Role-based access | Users are assigned access levels based on role and responsibilities. |
| Organization/team scoping | Records are structured so access can be limited by organization and team. |
| Backend-controlled changes | Important writes and updates should go through controlled backend functions. |
| Firestore rules | Database rules provide an additional layer of direct read/write protection. |
| Server-side API keys | Sensitive API keys, such as the Jotform API key, remain server-side. |
| Token/session checks | Access is checked through authentication tokens and role claims. |

No security model fully eliminates risk. The system should be operated with the assumption that access, roles, exports, integrations, and user behavior all require ongoing attention.

### Security Implementation Summary

- Firebase Authentication signs users in.
- Google sign-in requests Google Drive scope so the app can operate on Drive files the user can access.
- Production signup policy is HRDC-only.
- Users receive Firebase custom claims including `topRole`, `roles`, `orgId`, and `teamIds`.
- Frontend requests send a Firebase Auth bearer ID token in the `Authorization` header.
- Frontend requests send Firebase App Check tokens in `X-Firebase-AppCheck` when App Check is active.
- Backend HTTP endpoints use `secureHandler` in `functions/src/core/http.ts`.
- Backend auth verifies ID tokens with revocation checks and refreshes custom claims from Firebase Auth.
- Firestore direct reads are guarded by `firestore.rules`.
- Most Firestore writes are disabled in rules and must go through Cloud Functions.
- Admin actions that change roles or revoke sessions trigger token refresh/revocation flows.

Treat access as defense in depth. A user should pass Firebase Auth, be active/approved, have an adequate `topRole`, match the target org/team scope, pass endpoint authorization, and pass Firestore rules for any direct reads.

## 8. Jotform Integration

Households DB v2 connects to Jotform so HRDC can better organize form and submission workflows.

This supports internal operations involving customer forms, referrals, credit card documentation, invoice requests, rent/unit eligibility forms, resource navigation workflows, and other Jotform-based processes.

### Current Uses

The Jotform integration may be used to:

- List available forms.
- Read live form question metadata.
- Read live submissions.
- Sync selected forms or submissions into Firestore.
- Link submissions to customers, grants, enrollments, HMIS IDs, and CW IDs.
- Organize credit card purchase documentation.
- Organize invoice request submissions.
- Support budget, payment, and compliance review workflows.
- Build digest or extraction maps for Jotform-derived workflows.

### Main Risks

Jotform-related risks include:

- Pulling more submission data than necessary.
- Displaying submissions to users who do not need access.
- Syncing test, duplicate, outdated, or incorrect submissions.
- Breaking workflows if form questions or field names change.
- Exposing the Jotform API key if it is mishandled.
- Treating Jotform as a permanent database when some forms may only be designed for intake, signatures, or temporary workflow capture.

### Control Expectations

The Jotform API key should never be placed in frontend code, copied into shared documents, emailed casually, committed to GitHub, or stored in an uncontrolled location.

Any new Jotform workflow should be reviewed for:

- What forms it accesses.
- What submission data it pulls.
- Whether it reads only or also creates/updates records.
- Which users can see the resulting information.
- Whether the data is necessary for the workflow.

## 9. Google Drive Integration

Households DB v2 connects with Google Drive to help staff organize and access customer-related folders and files.

The system does not replace Google Drive. Google Drive remains the storage location for client files.

### Current Uses

The Drive integration may support:

- Listing files and folders.
- Creating customer folders.
- Building customer folder structures from approved templates.
- Linking or indexing customer folder references.
- Uploading small files where supported.
- Helping staff access the correct customer file location.

### Main Risks

Google Drive-related risks include:

- A user with broad Drive access may be able to access more folder information than intended.
- Incorrect folder matching could create confusion.
- Staff may assume Households DB v2 is the file storage system, when Google Drive remains the source location.
- Future destructive actions could create serious risk if added without review.

### Control Expectations

Destructive Drive actions should not be added without explicit review. This includes:

- Deleting files.
- Mass-moving folders.
- Changing file or folder permissions.
- Bulk-updating customer folders.
- Any action that could alter large numbers of records or files.

Any future Drive expansion should include role checks, logging, and a clear rollback plan.

## 10. Ledger, Payments, And Audit Trails

Payment schedules live on customer enrollment records as projected or actual payment rows. Those rows support case management workflow, due dates, compliance status, and user-facing paid/unpaid status.

The global `ledger` collection is the authoritative spend record for grant and budget accounting. When a payment is marked paid or reversed through the approved payment workflow, the backend updates the enrollment payment row and writes the corresponding ledger entry.

Grant projected and spent totals should be recalculated from the ledger-backed payment system rather than hand-edited.

Historical corrections should preserve an audit trail. Adjustment workflows should reverse the original ledger row and write a corrected row instead of silently overwriting past spend. The system also writes audit flag records for higher-risk payment schedule, spend, and correction operations so maintainers can trace:

- What changed.
- Which enrollment was affected.
- Which payment was affected.
- Which backend workflow made the change.

This section is important because payment and budget records are not just display information. They affect program understanding, compliance review, and spending decisions.

## 11. Billing, Costs, And Invoices

Billing for Households DB v2 is managed through Google Cloud/Firebase, not through the code repository. The billing account is tied to the Google Cloud/Firebase project used to run the system.

The system owner account is:

```text
hsgcompliance@thehrdc.org
```

This account, or another account with billing permissions, should be used to view billing information.

### How To View Billing

1. Sign in with the Google account that owns or has billing access to the project.
2. Open the Google Cloud Console.
3. Select the `housing-db-v2` project.
4. Open Billing.
5. Select the billing account associated with the project. This may appear as "My Billing Account" or another billing account name depending on the owner account.

The account viewing billing usually needs one of:

- Billing Account Viewer.
- Billing Account Administrator.
- Project Owner.

### How To Find Or Print An Invoice

1. Sign in to the Google Cloud Console with an account that has billing access.
2. Select the correct billing account.
3. Open the billing section for Documents, Transactions, or Cost Management, depending on the Google Cloud Console layout.
4. Locate the invoice, statement, or transaction record for the needed billing period.
5. Download or print the invoice only if there is a valid administrative or accounting reason.

Invoices, billing exports, payment methods, account IDs, and screenshots containing billing information should not be committed to GitHub, uploaded into the app, or stored in uncontrolled shared folders.

### Cost Risk

Costs may increase if usage grows. Main cost drivers may include:

- Firestore database reads/writes.
- Cloud Functions/backend calls.
- Firebase Hosting/App Hosting.
- Google Cloud/Firebase storage.
- Jotform or Google Drive integration activity.
- Accidental storage of unnecessary exports, duplicate data, or large files.

Billing should be treated as an administrative responsibility, not a developer-only issue. Someone besides Griffin should know which account can access billing and how invoices are retrieved.

## 12. Editing And Maintenance Workflow

Households DB v2 is maintained through a GitHub code repository. Changes should be made through the codebase, reviewed, tested, and then deployed. Staff should not attempt to fix system behavior by directly editing production data unless there is a documented reason and a safe process.

The canonical GitHub repository is:

```text
https://github.com/hsgcompliance/Case-Management-Tool.git
```

### Who Can Maintain It

Current practical maintainer:

```text
Griffin, HYC Compliance Coordinator
```

Future maintenance should be possible for a reasonably tech-savvy staff member, contractor, or IT support person who has:

- Access to the GitHub repository.
- Access to the Firebase/Google Cloud project as appropriate.
- A code editor such as VS Code or Cursor.
- Node/npm installed.
- An AI coding assistant subscription such as ChatGPT, Claude, or similar.
- Enough technical judgment to avoid changing security, data, or access controls blindly.

Routine bug fixes may be manageable with this setup. Major changes should be treated more carefully.

Major changes include:

- User roles or permissions.
- Firestore security rules.
- Jotform syncing.
- Google Drive file/folder behavior.
- Budget or payment calculations.
- Customer data structure changes.
- Data migrations.
- Multi-organization access.
- Any feature that exports, copies, deletes, or bulk-edits records.

### Required Reading For Future Maintainers

Before a new developer, AI coding agent, or technical staff person makes changes, they should review:

- `AGENTS.md`
- `README.md`
- `graphify-out/GRAPH_REPORT.md`
- `docs/MAINTAINER_HANDOFF.md`
- `docs/ARCHITECTURE_SPINE.md`
- `docs/CONTRACTS_WORKFLOW.md`
- `docs/PRIVACY_AND_REPO_HYGIENE.md`

These documents matter because the system has connected frontend, backend, database, and shared contract logic. A change in one area may break another area if handled casually.

### Plain-English Maintenance Rule

Before making a change, the maintainer should be able to answer:

- What page, workflow, or user problem is being changed?
- What data does the change read or write?
- Does the change affect customer information?
- Does the change affect roles, permissions, or access?
- Does the change affect Jotform, Google Drive, payments, budgets, or reporting?
- What should be tested before deployment?
- What could go wrong if the change fails?

If those questions cannot be answered, the change should not be treated as routine.

## 13. Safe Change Process

Households DB v2 should be changed through a cautious process because it contains confidential customer and program information.

### Before Making Code Changes

The maintainer should:

- Confirm the affected page, tool, endpoint, report, or workflow.
- Identify whether the issue is frontend display, backend logic, database rules, Jotform syncing, Google Drive behavior, or user access.
- Review the relevant documentation before changing shared structures.
- Prefer existing system patterns instead of inventing one-off fixes.
- Avoid changing security rules, roles, or database structure unless the impact is understood.

> Plain rule: understand the full path from screen to database before changing sensitive workflows.

### Before Changing Data

Production data changes are high-risk. Before changing production data, the maintainer should:

- Identify the exact collection or records affected.
- Estimate how many records will be changed.
- Use a dry run whenever possible.
- Require explicit confirmation before applying bulk changes.
- Document the reason for the change.
- Document the expected result.
- Have a rollback or correction plan.

### Before Deploying Changes

Before deploying, the maintainer should:

- Run the smallest useful build or test.
- Confirm no customer data, credentials, screenshots, reports, billing exports, or local-only files are staged for commit.
- If report/data examples were used during development, confirm work is based on `_sanitized` or `_safe` copies and that any staged sample was manually reviewed.
- Use the approved deployment scripts rather than raw Firebase commands.
- Avoid deploying security, role, Jotform, Drive, payment, or budget changes without additional review.

## 14. Deployment And Verification

The system is deployed through Firebase App Hosting and Firebase Cloud Functions. Deployment should use the existing safe scripts rather than raw Firebase commands.

> Future maintainers should use the established deployment scripts, not improvise deployment commands.

### Verification Expectations

Before deployment, the maintainer should confirm that the shared data definitions, backend functions, and frontend app still build successfully.

If testing or build verification cannot be completed, the maintainer should document what failed and what risk remains before deploying.

### Why This Matters

Households DB v2 has shared logic between the frontend, backend, and contracts. A small change to a data shape can break screens, backend functions, or Firestore writes if the related pieces are not updated together.

Future changes should follow the existing maintenance workflow rather than quick edits directly in production.

## 15. Future Maintainer Handoff

If Griffin is unavailable or no longer maintaining the system, a future maintainer should treat the system as sensitive production infrastructure, not as a normal website.

### First Confirm Access To

- GitHub repository.
- Firebase/Google Cloud project.
- `hsgcompliance@thehrdc.org` or another approved admin account.
- Billing access, if cost or invoices are involved.
- Jotform admin/API access, if form syncing is involved.
- Google Drive access, if customer folders are involved.

### Then Review

- System purpose and data sensitivity.
- Current user roles.
- Firestore security rules.
- Jotform integration behavior.
- Google Drive integration behavior.
- Deployment scripts.
- Privacy/repo hygiene documentation.
- Known active bugs or pending changes.

### What A Future Maintainer Should Not Do First

A future maintainer should not start by:

- Weakening Firestore rules.
- Making endpoints public.
- Exposing API keys.
- Downloading production data.
- Bulk-editing records.
- Changing Jotform sync behavior.
- Adding Google Drive delete/move/permission actions.
- Changing payment or budget calculations without review.

### Recommended First Step For A Bug

For a routine bug, the maintainer should document:

- What the user saw.
- What page or workflow was involved.
- What should have happened.
- Whether it affects one user, one customer, one form, one grant, or the whole system.
- Whether customer data, payment data, roles, or integrations are involved.

Then use the codebase documentation and graph output to trace the relevant frontend, backend, contract, and Firestore logic.

## 16. Privacy And Staff-Use Expectations

Households DB v2 should only be used for legitimate HRDC operational purposes.

Staff should not:

- Browse customer information out of curiosity.
- Take unnecessary screenshots.
- Copy customer information into uncontrolled documents.
- Export data unless there is a documented work reason.
- Share information with people who do not need it for their job.
- Use the app as a casual notes repository.
- Store unrelated documents or unnecessary personal details in the system.

The practical privacy goal is simple: use the minimum information necessary for the program workflow.

## 17. Risk Summary

| Risk | Summary | Current Mitigations |
| --- | --- | --- |
| Data/privacy risk | The system contains confidential customer and program information. | HRDC-only access, role-based permissions, backend authorization, Firestore rules, server-side API key handling, limited direct writes. |
| Maintenance continuity risk | The system currently depends heavily on Griffin's technical knowledge. | Code documentation, GitHub storage, AI-agent handoff documentation, structured architecture. |
| Cost/billing risk | Costs may increase with greater use, larger data volume, integrations, or unnecessary exports. | Google Cloud/Firebase billing controls and expectations around billing/export handling. |
| Integration risk | Jotform and Google Drive connect to systems that may contain confidential data. | Server-side Jotform key handling, signed-in-user Drive access, review expectation for new integration workflows. |
| Human error/staff misuse risk | Internal users can still make mistakes or misuse access. | Role-based access, limiting access to job need, clear staff expectations, careful export/screenshot handling. |
| Payment and budget logic risk | Incorrect logic or manual edits could affect compliance understanding or spending decisions. | Ledger-backed spend records, controlled payment workflows, audit flags, recalculation from authoritative records. |

## 18. Emergency Access Or Lockout

If users cannot access the system, do not immediately weaken security settings.

First check:

- Is the user signing in with an approved HRDC email account?
- Does the user exist in Firebase Auth?
- Is the user approved and active?
- Does the user have the correct role?
- Does the user have the correct organization/team assignment?
- Is the issue affecting only one user or multiple users?
- Is the issue login-related, role-related, App Check-related, Firestore-related, or page-specific?

Route the issue to Griffin or the designated system point of contact.

### What Not To Do

Do not casually:

- Make endpoints public.
- Disable authentication.
- Weaken Firestore rules.
- Remove role checks.
- Share admin credentials.
- Use the owner account from an unmanaged device.
- Copy customer data out of the system to work around the issue.

Security should not be bypassed casually to resolve access issues. Firestore rules, role checks, or endpoint protections should not be weakened unless there is a documented emergency need and a follow-up plan to restore normal controls.

## 19. Bottom Line

Households DB v2 is a useful internal coordination system that improves communication between Compliance, Case Management, and customer-facing HRDC teams. It helps staff understand customer status, case manager responsibility, budget context, program enrollment, payment status, and assistance planning.

The system contains sensitive information and should be treated as confidential internal infrastructure. It has meaningful access controls and security layers, but it is still under active development and is not yet a fully IT-managed enterprise system.

Leadership should understand:

- The system supports important internal operations.
- It contains confidential customer and program information.
- It is currently HRDC-only.
- Google Drive remains the client file storage location.
- Jotform integration is useful but sensitive.
- Payment and ledger records need careful handling because they affect budget and compliance understanding.
- Griffin currently serves as the practical technical maintainer.
- Future maintenance support should be identified.
- Staff misuse, bad copy-pastes, unnecessary screenshots, and internal over-access remain practical risks.
- Cost and billing should be monitored through Google Cloud/Firebase.
- Major changes to access, security, Jotform, Drive, payment, ledger, or budget logic should be reviewed carefully before deployment.

---

## Appendix A: Technical Maintainer Quick Reference

This appendix preserves key technical steps for a future maintainer. It is not intended for normal staff use.

### Repository

```powershell
git clone https://github.com/hsgcompliance/Case-Management-Tool.git
```

### Recommended Local Setup

Use a code editor such as VS Code or Cursor.

```powershell
npm install
npm run build:contracts
npm run build:functions
npm run build:web
```

### Important Documentation

Before making significant changes, review:

- `AGENTS.md`
- `README.md`
- `graphify-out/GRAPH_REPORT.md`
- `docs/MAINTAINER_HANDOFF.md`
- `docs/ARCHITECTURE_SPINE.md`
- `docs/CONTRACTS_WORKFLOW.md`
- `docs/PRIVACY_AND_REPO_HYGIENE.md`

### Shared Contract Changes

If endpoint payloads or shared schemas change:

```powershell
npm run contracts:update
```

Then update:

- Backend handlers/services.
- Frontend clients/hooks.
- UI consumers.

### Common Deploy Commands

Use safe scripts:

```powershell
npm run deploy:hosting
npm run deploy:hosting:all
npm run deploy:functions
npm run deploy:functions:missing
npm run deploy:functions-hosting
```

`deploy:hosting` and `deploy:functions-hosting` deploy web hosting only (`hosting:web`). Use `deploy:hosting:all` only when every configured hosting target should deploy.

Use `--no-push` variants when the deploy script should not automatically commit and push.

#### Windows: clear the Next.js build cache before a web build or hosting deploy

On Windows the `next build` step (run during web build and hosting deploy) intermittently fails with a file-lock error like `EPERM: operation not permitted, rename '...\.next\cache\webpack\...\N.pack_' -> '...N.pack'`. The code compiles successfully and then fails during "Generating static pages" — it is a stale webpack cache lock, not a code defect. The hosting deploy helper clears this cache automatically. Before direct web builds, clear the cache manually and allow a long timeout:

```powershell
Remove-Item -Recurse -Force web\.next\cache -ErrorAction SilentlyContinue
npm run build:web
```

A clean re-run succeeds. Do not treat this `EPERM` as a real build failure.

### Code Graph

After meaningful code edits, update the code graph:

```powershell
python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

Before committing graph output, scan it for:

- Local paths.
- Credentials.
- Production exports.
- Customer data.
- Archive contents.

### Verification Commands

Use the smallest useful verification:

```powershell
npm run build:contracts
npm run build:functions
npm run build:web
npm -w web run test:unit
```

If verification cannot run, record:

- What command failed.
- What error appeared.
- What was not verified.
- What residual risk remains.

---

## Appendix B: Developer-Heavy Technical Reference

This appendix is intended for developers, AI coding agents, or technically capable maintainers. It preserves lower-level implementation details that are useful for maintaining the system but are not necessary for normal leadership or staff review.

### Runtime Architecture

Households DB v2 has three main runtime layers:

| Layer | Location | Purpose |
| --- | --- | --- |
| Frontend | `web/` | Next.js/React app deployed through Firebase App Hosting. Handles routing, UI, dashboards, modals, forms, and staff workflows. |
| Backend | `functions/` | Firebase Cloud Functions v2. Handles auth, authorization, Firestore writes, Jotform, Drive, payment logic, ledger logic, and sensitive operations. |
| Shared contracts | `contracts/` | Zod schemas and endpoint types used by both frontend and backend. |

Contract changes require:

```powershell
npm run contracts:update
```

The frontend, backend, and shared contracts must stay aligned. If an endpoint request/response shape changes in one place but not the others, the system can build incorrectly, fail at runtime, or silently display bad data.

### Important Configuration Files

| File | Purpose |
| --- | --- |
| `firebase.json` | Configures Firestore, Functions, App Hosting, Hosting, and local emulators. |
| `apphosting.yaml` | Configures Firebase App Hosting for the `web/` app and public Firebase client environment variables. |
| `firestore.rules` | Defines direct Firestore read/write security rules. |
| `firestore.indexes.json` | Defines Firestore indexes. |
| `functions/src/index.ts` | Main backend function export file. |
| `functions/src/core/http.ts` | Secure HTTP wrapper used by backend endpoints. |
| `functions/src/features/users/identity.ts` | Identity/signup logic, including HRDC-only signup behavior when blocking functions are enabled. |

### Firestore Collections

Common collections:

- `customers`
- `customerEnrollments`
- `payments`
- `grants`
- `ledger`
- `jotformSubmissions`
- `userExtras`
- `users`
- `userTasks`
- `otherTasks`
- `orgs`
- `metrics`

When adding new collections, preserve organization scoping. Most domain records should include `orgId`; many records may also include `teamIds`.

New collections should be reviewed for:

- Whether users can read them directly.
- Whether writes must go through Cloud Functions.
- Whether records contain PII.
- Whether records connect to payments, grants, Jotform, Drive, or user access.
- Whether Firestore rules and backend helpers enforce org/team boundaries.

### Security Implementation Details

Developers should avoid weakening any single security layer on the assumption that another layer will catch the issue.

Security layers include:

- Firebase Authentication.
- HRDC-only signup/approval policy.
- Firebase custom claims:
  - `topRole`
  - `roles[]`
  - `orgId`
  - `teamIds`
- Firebase Auth bearer ID token in the `Authorization` header.
- Firebase App Check token in `X-Firebase-AppCheck` when active.
- Backend `secureHandler`:
  - Method checks.
  - CORS checks.
  - Security headers.
  - Bearer-token verification.
  - App Check verification.
  - RBAC checks.
  - Organization/team checks.
- Firestore rules.
- Service-side validation and sanitization.
- Token refresh/revocation after role changes.

A user should pass all relevant checks:

- Authenticated.
- Active/approved.
- Correct `topRole`.
- Correct role tags or backend-owned capabilities where needed.
- Correct `orgId`.
- Correct `teamIds`, if applicable.
- Endpoint authorization.
- Firestore rules for any direct reads.

Do not rely on frontend hiding as a security control. Frontend visibility improves user experience, but backend checks and Firestore rules provide actual enforcement.

### Role Model

Canonical top-level role is stored in Firebase custom claims as `topRole`.

| Role | Meaning |
| --- | --- |
| `unverified` | Signed-in account that is not approved. Should not access protected operational data. |
| `viewer` | Can read approved org-scoped data and use read-only views. |
| `user` | Standard staff user. Can perform normal operational writes through approved functions. |
| `admin` | Can manage users and higher-risk operational workflows within scope. |
| `org_dev` | Organization-scoped developer/admin level. Can manage org configuration and org-level structures for their org. |
| `dev` | Developer-level role with elevated app maintenance capability. |
| `super_dev` | Highest system role. Current system owner/super developer is Griffin. |

There are also role tags in `roles[]`, such as:

- `casemanager`
- `compliance`
- `viewer`

Role tags may shape frontend workflows and selected capabilities, but they should not be used as the only backend authority mechanism. Backend authority should primarily come from `topRole`, org/team scope, and backend-owned capability checks.

### Organization Scoping

Current production scope:

- HRDC is the active organization using the system.
- Production access should remain HRDC-only.

Designed future scope:

- Multiple organizations can eventually store records in the same system.
- Users are scoped by `orgId`.
- Users may also be scoped by `teamIds`.
- `super_dev` may cross organization boundaries for system administration.
- `org_dev` may manage records and org-level structures inside their own organization.
- Future cross-org sharing should be explicit per document or feature.

Do not weaken the default org boundary to make cross-org access work. Build cross-org sharing intentionally, with specific access rules and a clear business case.

### Google Drive Token Behavior

Users sign in with Google and grant Drive permission.

The frontend stores the Google Drive access token in browser session storage for the current Firebase user and passes it to backend Drive endpoints as:

```http
x-drive-access-token: <user-google-drive-token>
```

The requested Google Drive scope is broad enough to operate on files and folders the signed-in Google user can access.

Current Drive workflows include:

- Listing files and folders.
- Creating customer folders.
- Building customer folder structures from configured org templates.
- Uploading small files where supported.
- Linking or indexing customer folder references.

Because the Drive token represents the active user, Drive access is constrained by what that Google account can access in Google Drive.

Do not add destructive Drive actions without explicit review, logging, and role gating. This includes:

- Delete.
- Mass move.
- Permission changes.
- Bulk folder restructuring.
- Bulk customer folder edits.

### Jotform API Key Handling

The backend uses a Jotform API key stored as a Firebase secret. The Jotform integration has broad account-level capability. Treat it as production-sensitive.

Rules:

- Do not expose the Jotform API key to frontend code.
- Do not commit the API key to GitHub.
- Do not paste the API key into documentation.
- Do not use Jotform submission data casually in logs, screenshots, or test files.
- Keep Jotform writes/syncs behind backend endpoints with role checks.

Before changing Jotform behavior, confirm:

- Which forms are accessed.
- Which questions/fields are read.
- Which submissions are pulled.
- Whether the workflow reads only or writes/syncs records.
- Which users can see synced data.
- Whether field changes in Jotform could break the workflow.

### Payment, Ledger, And Budget Logic

Payment schedules live on customer enrollment records as projected or actual payment rows.

Those rows drive:

- Case management workflow.
- Due dates.
- Compliance status.
- User-facing paid/unpaid state.

The global `ledger` collection is the authoritative spend record for grant and budget accounting.

When a payment is marked paid or reversed through `paymentsSpend`, the backend should:

- Update the enrollment payment row.
- Write the corresponding ledger entry.
- Preserve traceability between enrollment/payment and ledger activity.

Grant projected/spent totals should be recalculated from the ledger-backed payment system rather than hand-edited.

Historical corrections should preserve an audit trail. Adjustment workflows should reverse the original ledger row and write a corrected row instead of silently overwriting past spend.

The system may write audit flag records for higher-risk payment schedule, spend, and correction operations so maintainers can trace:

- What changed.
- Which enrollment was affected.
- Which payment was affected.
- Which backend workflow made the change.

Do not patch payment, grant, ledger, or budget totals manually unless there is a documented correction plan and rollback path.

### Contract Change Workflow

For endpoint shape changes:

1. Update schemas/types in `contracts/src/`.
2. Run:

   ```powershell
   npm run contracts:update
   ```

3. Update backend handlers/services.
4. Update frontend clients/hooks.
5. Update UI consumers.
6. Run the narrowest useful build/test.

Contract mismatch is a common failure point. Avoid patching frontend expectations without updating backend responses, or vice versa.

### Normal Operations Checklist

Before making code changes:

- Confirm the affected page, tool, endpoint, or workflow.
- Check the relevant graph community in `graphify-out/GRAPH_REPORT.md`.
- Trace the flow from route page to feature component, hook, client, endpoint contract, backend handler, service, and Firestore rules.
- Prefer existing feature helpers over new one-off logic.

Before deploying:

- Run the narrowest useful builds/tests.
- Run `npm run contracts:update` if `contracts/src/` changed.
- Use safe deploy scripts.
- Confirm no private data, secrets, local-only docs, generated dumps, billing exports, or screenshots are staged.
- For CSV/TXT/XLSX examples, use Mr.Bacon's `sensitive-data-replacer` (`sensid`) to create `_sanitized` or `_safe` copies before development or review. Treat sanitizer output as a starting point, then manually inspect before staging.

Before changing data:

- Prefer existing dry-run scripts.
- Keep scripts dry-run by default unless there is a strong existing pattern.
- Require explicit `--apply --yes` style flags for production writes.
- Document the target collection, query, expected count, and rollback approach.

### Deploy Workflow

Use safe npm scripts instead of raw Firebase commands:

```powershell
npm run deploy:hosting
npm run deploy:hosting:all
npm run deploy:functions
npm run deploy:functions:missing
npm run deploy:functions-hosting
```

`deploy:hosting` and `deploy:functions-hosting` deploy web hosting only (`hosting:web`). Use `deploy:hosting:all` only when every configured hosting target should deploy.

Use `--no-push` variants when the deploy script should not automatically commit and push.

Do not improvise deploy commands unless there is a documented reason.

### Developer Red Lines

Do not do the following without explicit review:

- Make endpoints public.
- Disable authentication.
- Weaken Firestore rules.
- Remove role checks.
- Expose API keys.
- Commit secrets.
- Commit production data.
- Commit customer screenshots.
- Commit billing screenshots.
- Upload customer data dumps to GCS.
- Download broad production exports casually.
- Add destructive Google Drive actions.
- Bulk-edit production records without dry run.
- Hand-edit grant/payment/ledger totals.
- Expand access to non-HRDC users.
- Implement cross-org sharing by weakening org boundaries.

These are not ordinary bug fixes. Treat them as high-risk system changes.
