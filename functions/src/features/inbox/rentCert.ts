export type DigestRentCertDue = {
  dueDate: string;
  targetPaymentDate: string;
  asap: boolean;
  label: string;
};

function isISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function addMonthsISO(iso: string, months: number): string {
  if (!isISO(iso)) return "";
  const [year0, month0, day0] = iso.split("-").map(Number);
  const total = year0 * 12 + (month0 - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(day0, lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function paymentNotes(p: Record<string, unknown>): string {
  const note = p.note;
  if (Array.isArray(note)) return note.filter(Boolean).map(String).join(" ");
  return note ? String(note) : "";
}

function isRentPayment(p: Record<string, unknown>): boolean {
  if (String(p.type || "").toLowerCase() !== "monthly") return false;
  const notes = paymentNotes(p).toLowerCase();
  return !notes || notes.includes("rent");
}

function fmtShortMonth(iso: string): string {
  if (!isISO(iso)) return iso;
  const [, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Math.max(0, Math.min(11, Number(month) - 1))]} ${Number(day)}`;
}

/**
 * Next rent cert due across the given enrollments.
 *
 * Persisted `payment.rentCert` (maintained by the continuum sync and manual
 * toggles) is the source of truth. The every-3-months heuristic only runs for
 * legacy enrollments that carry no persisted rent-cert state at all, and only
 * certs due now or in the future are returned — never a past cert.
 */
export function computeNextRentCertDue(
  enrollments: Array<Record<string, unknown>>,
  opts?: { today?: string }
): DigestRentCertDue | null {
  const today = opts?.today && isISO(opts.today) ? opts.today : todayISO();
  const dues: DigestRentCertDue[] = [];

  for (const enrollment of enrollments) {
    const payments = (Array.isArray(enrollment.payments) ? enrollment.payments : [])
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
      .filter((p) => p.void !== true);

    let hasPersistedState = false;
    for (const p of payments) {
      if (p.rentCertOptOut === true) hasPersistedState = true;
      const rc = p.rentCert as Record<string, unknown> | null | undefined;
      const rcDue = String(rc?.dueDate || "").slice(0, 10);
      if (!rc || !isISO(rcDue)) continue;
      hasPersistedState = true;
      if (["completed", "effective"].includes(String(rc.status || "due"))) continue;
      const paymentDate = String(p.dueDate || p.date || "").slice(0, 10);
      const targetPaymentDate = isISO(String(rc.targetPaymentDate || "").slice(0, 10))
        ? String(rc.targetPaymentDate).slice(0, 10)
        : paymentDate;
      dues.push({
        dueDate: rcDue,
        targetPaymentDate,
        asap: rcDue <= today,
        label: `${fmtShortMonth(targetPaymentDate)} rent cert due ${fmtShortMonth(rcDue)}`,
      });
    }
    if (hasPersistedState) continue;

    const rentPayments = payments
      .filter((p) => isRentPayment(p))
      .map((p): Record<string, unknown> & { dueDate: string } => ({
        ...p,
        dueDate: String(p.dueDate || p.date || ""),
      }))
      .filter((p) => isISO(p.dueDate) && Number(p.amount || 0) > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (rentPayments.length < 4) continue;
    for (let i = 3; i < rentPayments.length; i += 3) {
      const targetPaymentDate = rentPayments[i].dueDate;
      const dueDate = addMonthsISO(targetPaymentDate, -1);
      if (!dueDate) continue;
      dues.push({
        dueDate,
        targetPaymentDate,
        asap: dueDate <= today,
        label: `${fmtShortMonth(targetPaymentDate)} rent cert due ${fmtShortMonth(dueDate)}`,
      });
    }
  }

  const sorted = dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return sorted.find((due) => due.targetPaymentDate >= today) || null;
}

/** Last scheduled assistance (rent) payment date across the enrollments, or "". */
export function computeLastAssistanceDate(enrollments: Array<Record<string, unknown>>): string {
  let last = "";
  for (const enrollment of enrollments) {
    const payments = Array.isArray(enrollment.payments) ? enrollment.payments : [];
    for (const raw of payments) {
      if (!raw || typeof raw !== "object") continue;
      const p = raw as Record<string, unknown>;
      if (p.void === true || !isRentPayment(p) || Number(p.amount || 0) <= 0) continue;
      const date = String(p.dueDate || p.date || "").slice(0, 10);
      if (isISO(date) && date > last) last = date;
    }
  }
  return last;
}
