export type OperationalGrantState = {
  exists: boolean;
  status?: unknown;
  deleted?: unknown;
};

/**
 * Operational queue views hide rows assigned to a known closed/deleted grant.
 * Missing grant references stay visible so hard-delete orphans are not concealed.
 */
export function isOperationalQueueGrantVisible(
  grantId: unknown,
  grantStates: ReadonlyMap<string, OperationalGrantState>,
): boolean {
  const id = String(grantId || "").trim();
  if (!id) return true;
  const state = grantStates.get(id);
  if (!state || !state.exists) return true;
  const status = String(state.status || "").trim().toLowerCase();
  return state.deleted !== true && status !== "closed" && status !== "deleted";
}
