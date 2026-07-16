// Pure rent-cert schedule generation per the smart-schedule-builder RULES:
// deposit / prorated-or-arrears / recurring landlord / utility allowance rows,
// certification-type normalization (incl. the YHDP Transitional Housing Recert
// exception), expiration-month handling, and duplicate/overlap detection
// against an enrollment's existing payments. No I/O — the builder UI owns
// state, the backend owns creation.
import type { CertFields } from "./rentCertExtract";
import type { EnrollmentPaymentSummary } from "./rentCertApi";

export type CertType = "initial" | "annual" | "interim" | "other";

export type ScheduleSection = "deposit" | "prorated" | "arrears" | "recurring" | "utility";

export type DraftRow = {
  /** Stable key for React state (section + month + index). */
  key: string;
  section: ScheduleSection;
  type: "deposit" | "prorated" | "arrears" | "monthly";
  sub?: "rent" | "utility";
  label: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD (editable in preview)
  include: boolean;
  warnings: string[];
};

export type GeneratedSchedule = {
  certType: CertType;
  yhdp: boolean;
  rows: DraftRow[];
  /** Schedule-level validation warnings (RULES.md "Validation Warnings"). */
  warnings: string[];
};

export const SECTION_LABELS: Record<ScheduleSection, string> = {
  deposit: "Security Deposit",
  prorated: "Prorated Rent",
  arrears: "Rent Arrears",
  recurring: "Recurring Landlord Payments",
  utility: "Utility Allowance Payments",
};

const MAX_MONTHS = 36;

export function normalizeCertType(reason: string | null): CertType {
  const r = String(reason || "").trim().toLowerCase();
  if (r.startsWith("initial")) return "initial";
  if (r.startsWith("annual")) return "annual";
  if (r.startsWith("interim")) return "interim";
  return "other";
}

export function isYhdpRecert(intakePurpose: string | null): boolean {
  return /yhdp transitional housing recert/i.test(String(intakePurpose || ""));
}

// ── date helpers (pure string math, no timezones) ───────────────────────────

const monthOf = (iso: string) => iso.slice(0, 7);

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const firstOf = (ym: string) => `${ym}-01`;

function lastDayOfMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isLastDayOfMonth(iso: string): boolean {
  return Number(iso.slice(8, 10)) === lastDayOfMonth(monthOf(iso));
}

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── generation ──────────────────────────────────────────────────────────────

export function generateSchedule(cert: CertFields): GeneratedSchedule {
  const warnings: string[] = [];
  const rows: DraftRow[] = [];
  const certType = normalizeCertType(cert.reason);
  const yhdp = isYhdpRecert(cert.intakePurpose);

  if (!cert.reason) warnings.push("Reason for Certification is missing — treated as Other.");
  else if (certType === "other") warnings.push(`Unrecognized Reason for Certification ("${cert.reason}") — treated as Other.`);

  const eff = cert.effectiveDate;
  const exp = cert.expirationDate;
  if (!eff) warnings.push("Effective Date is missing — no recurring schedule can be generated.");
  if (!exp) warnings.push("Expiration Date is missing — no recurring schedule can be generated.");
  if (eff && exp && exp < eff) {
    warnings.push("Expiration Date is before the Effective Date — fix the dates before generating.");
    return { certType, yhdp, rows: [], warnings };
  }
  if (exp && !isLastDayOfMonth(exp)) {
    warnings.push(
      `Expiration Date ${exp} is not the last day of the month — the expiration month is treated as fully eligible (final payment on ${firstOf(monthOf(exp))}). Correct the date if that's wrong.`,
    );
  }

  // Initial (non-YHDP) pays full Monthly Housing Cost; annual/interim (and the
  // YHDP recert) pay the HRDC Payment portion.
  const useInitialLogic = certType === "initial" && !yhdp;
  let recurringAmount: number | null;
  if (useInitialLogic) {
    recurringAmount = cert.monthlyHousingCost;
    if (recurringAmount == null) warnings.push("Initial certification has no Monthly Housing Cost — recurring rows skipped.");
  } else {
    recurringAmount = cert.hrdcPayment;
    if (recurringAmount == null) {
      recurringAmount = cert.monthlyHousingCost;
      if (recurringAmount != null) {
        warnings.push("No HRDC Payment found — recurring rows fall back to Monthly Housing Cost. Review the amounts.");
      } else {
        warnings.push(`${certType === "other" ? "This" : certType.charAt(0).toUpperCase() + certType.slice(1)} certification has no HRDC Payment — recurring rows skipped.`);
      }
    }
  }

  // ── Security deposit ──
  if (cert.depositAmount != null && cert.depositAmount > 0) {
    if (!useInitialLogic) warnings.push("Deposit amount present on a non-initial certification — confirm it should be paid.");
    rows.push({
      key: "deposit",
      section: "deposit",
      type: "deposit",
      label: "Security Deposit",
      amount: cert.depositAmount,
      dueDate: eff || "",
      include: !!eff,
      warnings: eff ? [] : ["No Effective Date — set the payment date manually."],
    });
  }

  // ── Prorated rent OR arrears (one field, the arrears answer decides) ──
  const proAmt = cert.proratedOrArrears;
  const hasProrated = proAmt != null && proAmt > 0;
  if (hasProrated) {
    const isArrears = cert.includeArrears === true;
    if (cert.includeArrears == null) {
      warnings.push('"Should this Rent Cert include arrears?" is unanswered — the prorated/arrears amount is treated as prorated rent.');
    }
    rows.push({
      key: isArrears ? "arrears" : "prorated",
      section: isArrears ? "arrears" : "prorated",
      type: isArrears ? "arrears" : "prorated",
      label: isArrears ? "Rent Arrears" : "Prorated Rent",
      amount: proAmt,
      dueDate: eff || "",
      include: !!eff,
      warnings: [
        ...(eff ? [] : ["No Effective Date — set the payment date manually."]),
        ...(cert.proratedMonth ? [`Form marks the prorated/arrears month as ${cert.proratedMonth} — adjust the date if needed.`] : []),
      ],
    });
  }

  // ── Recurring landlord payments + utility allowance ──
  if (eff && exp && recurringAmount != null && recurringAmount > 0) {
    const effMonth = monthOf(eff);
    const endMonth = monthOf(exp);
    const effIsFirst = eff.slice(8, 10) === "01";

    // YHDP recert: schedule ALWAYS starts on the Effective Date (even mid-month).
    // Otherwise: start on the Effective Date only when it's the 1st; a mid-month
    // effective date is covered by the prorated payment (warn when there is none)
    // and recurring begins the first of the following month.
    let firstDue: string;
    if (yhdp) {
      firstDue = eff;
    } else if (effIsFirst) {
      firstDue = eff;
    } else {
      firstDue = firstOf(addMonths(effMonth, 1));
      if (!hasProrated) {
        warnings.push(`Effective Date ${eff} is mid-month with no prorated amount — the effective month has no landlord payment. Add a prorated row if needed.`);
      }
    }

    let ym = monthOf(firstDue);
    let count = 0;
    while (ym <= endMonth && count < MAX_MONTHS) {
      const dueDate = count === 0 ? firstDue : firstOf(ym);
      rows.push({
        key: `recurring:${ym}`,
        section: "recurring",
        type: "monthly",
        sub: "rent",
        label: `${useInitialLogic ? "Monthly Housing Cost" : "HRDC Rent Payment"} · ${ym}`,
        amount: recurringAmount,
        dueDate,
        include: true,
        warnings: [],
      });
      ym = addMonths(ym, 1);
      count += 1;
    }
    if (ym <= endMonth) {
      warnings.push(`Schedule truncated at ${MAX_MONTHS} months (${firstOf(monthOf(firstDue))} → ${exp}) — extend manually if that's really intended.`);
    }

    // Utility allowance: ONLY when tenant rent is explicitly $0.00 (blank ≠ 0)
    // and a positive allowance exists. Same certification period, 1st of month.
    if (cert.tenantRentPayment === 0 && cert.utilityAllowance != null && cert.utilityAllowance > 0) {
      let uym = effIsFirst || yhdp ? effMonth : addMonths(effMonth, 1);
      let ucount = 0;
      while (uym <= endMonth && ucount < MAX_MONTHS) {
        rows.push({
          key: `utility:${uym}`,
          section: "utility",
          type: "monthly",
          sub: "utility",
          label: `Utility Allowance · ${uym}`,
          amount: cert.utilityAllowance,
          dueDate: firstOf(uym),
          include: true,
          warnings: [],
        });
        uym = addMonths(uym, 1);
        ucount += 1;
      }
    } else if (cert.tenantRentPayment == null && cert.utilityAllowance != null && cert.utilityAllowance > 0) {
      warnings.push("Utility Allowance is set but Tenant Rent Payment is blank — utility rows are only generated when tenant rent is explicitly $0.00.");
    }
  }

  return { certType, yhdp, rows, warnings };
}

// ── conflicts against an enrollment's existing payments ─────────────────────

export type RowConflict = {
  paymentId: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  /** The existing payment came from this same submission (safe re-apply). */
  sameSource: boolean;
};

/** Mirror of the backend's duplicate-prevention family. */
export function rowFamily(row: Pick<DraftRow, "type" | "sub">): string {
  if (row.type === "deposit") return "deposit";
  if (row.type === "monthly") return row.sub === "utility" ? "utility" : "landlord";
  return "landlord"; // prorated | arrears
}

export function findConflict(
  row: Pick<DraftRow, "type" | "sub" | "dueDate">,
  payments: EnrollmentPaymentSummary[],
  submissionId: string | null,
): RowConflict | null {
  const family = rowFamily(row);
  const month = monthOf(row.dueDate);
  const hit = payments.find((p) => !p.void && p.family === family && p.serviceMonth === month);
  if (!hit) return null;
  return {
    paymentId: hit.id,
    amount: hit.amount,
    dueDate: hit.dueDate,
    paid: hit.paid,
    sameSource: !!submissionId && hit.srcSubmissionId === submissionId,
  };
}

export function describeConflict(c: RowConflict): string {
  return c.sameSource
    ? `Already applied from this submission (${money(c.amount)} on ${c.dueDate})`
    : `Existing ${c.paid ? "PAID " : ""}payment ${money(c.amount)} on ${c.dueDate}`;
}
