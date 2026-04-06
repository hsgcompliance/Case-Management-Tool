export function monthKeyNow() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export function monthKeyOffsetDays(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export function fullNameFromCustomer(c: any) {
  const first = String(c?.firstName || "").trim();
  const last = String(c?.lastName || "").trim();
  return `${first} ${last}`.trim() || String(c?.name || c?.displayName || c?.id || "-");
}
