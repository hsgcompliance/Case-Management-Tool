import { postAuthed } from "./authedApi";

/**
 * Ad-hoc reminder task, self-assigned by default (the backend assigns the
 * caller when `assign` is omitted). Used to wire referral-form submissions
 * into the task system before a customer record exists to key a real
 * intake-tracking task on.
 */
export function createOtherTask(body: { title: string; notes?: string; customerId?: string | null }) {
  return postAuthed<{ ok: true; id: string }>("tasksOtherCreate", body);
}
