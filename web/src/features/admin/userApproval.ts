/** Pending approval is an access state, not the inverse of account activity. */
export function isPendingUserApproval(topRole: string): boolean {
  return topRole === "unverified" || topRole === "public_user";
}
