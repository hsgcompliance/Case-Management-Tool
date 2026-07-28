export type UserOptionState = {
  uid: string;
  label: string;
  email?: string | null;
  active?: boolean;
};

export function isUserOptionVisible(
  option: UserOptionState,
  onlyActive: boolean,
  selectedUid: string | null,
): boolean {
  return !onlyActive || option.active !== false || option.uid === selectedUid;
}

export function formatUserOptionLabel(option: UserOptionState): string {
  const identity = `${option.label}${option.email ? ` (${option.email})` : ""}`;
  return option.active === false ? `${identity} — Inactive` : identity;
}
