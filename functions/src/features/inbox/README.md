## Why this works well

* **Single source of truth** remains in `customerEnrollments/*` (and your existing payment functions). The new `userTasks` is a **projection** for speed and UX simplicity.
* **Deterministic IDs (UTIDs)** ensure idempotency and cheap upserts.
* **Assignment consistency**: we mirror `assignedToUid/Group` from tasks; for payments we use a sane default (configurable later per line item if you want).
* **Automatic completion**: When a task is completed (via `tasksUpdateStatus`), a payment is paid (via `spendBudget`), or compliance is approved (`updatePaymentCompliance`), the *enrollment* changes. The trigger picks that up and flips the inbox item to `done`.
* **React Query friendly**: Fast, single query to `GET /inboxListMy` for the current month + overdue; zero client-side joins.

---

## What you might want next (optional)

* **Configurable routing**: put `defaultOwner` on grant line items (e.g., `"compliance"` vs `"casemanager"`) and use that in the trigger for payment tasks.
* **Backfill util**: a one-shot admin function to rebuild the `userTasks` projection for a grant or for all enrollments (same logic as the trigger over a query).
* **Indexes** (Firestore): you’ll likely want composites such as:

  * `userTasks (assignedToUid, status, dueMonth)`
  * `userTasks (assignedToGroup, assignedToUid, status, dueMonth)`  (where `assignedToUid == null`)
* **Strict compliance criteria**: if you have a definitive status field (e.g., `compliance.status in {"pending","approved"}`), swap the heuristic with those constants.

---

## Triggers vs. “push on write” inside handlers?

Keep it in **triggers**:

* You already have several code paths that mutate tasks/payments (admin regenerate, merge modes, compliance patches, spend/reverse). Triggers guarantee consistency without every handler remembering to write to a second collection.
* Your existing idempotency/transactions around spend are preserved.

---

