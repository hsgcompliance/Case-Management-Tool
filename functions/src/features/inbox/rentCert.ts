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

export function computeNextRentCertDue(
  enrollments: Array<Record<string, unknown>>,
  opts?: { today?: string }
): DigestRentCertDue | null {
  const today = opts?.today && isISO(opts.today) ? opts.today : todayISO();
  const dues: DigestRentCertDue[] = [];

  for (const enrollment of enrollments) {
    const payments = Array.isArray(enrollment.payments) ? enrollment.payments : [];
    const rentPayments = payments
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
      .filter((p) => p.void !== true && isRentPayment(p))
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
  return sorted.find((due) => due.targetPaymentDate >= today) || sorted[sorted.length - 1] || null;
}
