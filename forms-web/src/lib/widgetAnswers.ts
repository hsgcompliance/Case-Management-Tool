export type WidgetField = { label: string; value: string };

const LABELS: Record<string, string> = {
  CalcV: "Calculation version",
  AsOf: "Calculation as-of date",
  Person: "Household member",
  Employer: "Employer or income source",
  Frequency: "Pay frequency",
  PeriodsPerYear: "Pay periods per year",
  Method: "Calculation method",
  Basis: "Income basis",
  EmploymentStart: "Employment start date",
  HourlyWage: "Hourly wage",
  RegularHoursWeek: "Usual hours per week",
  ReducedHours: "Reduced hours applied",
  ReducedHoursWeek: "Reduced hours per week",
  ReducedPeriod: "Reduced-hours period",
  ScheduledHours30: "Scheduled hours in 30 days",
  OtherProjectedMonthly: "Other projected monthly income",
  OtherActual30: "Other income received in 30 days",
  StubsEntered: "Paystubs entered",
  StubsIncluded: "Paystubs included",
  AverageCheck: "Average included check",
  Annualized: "Annualized income",
  AverageMonthly: "Average monthly income",
  Estimated30Day: "Estimated 30-day income",
  Actual30Received: "Actual income received in 30 days",
  Actual30Earned: "Actual income earned in 30 days",
  IncomeUsed30: "30-day income used",
  EvidencePayDates: "Evidence pay dates",
  MostRecentAgeDays: "Most recent paystub age (days)",
  PreparedBy: "Prepared by",
  Flags: "Review flags",
  Notes: "Calculation notes",
  County: "County",
  HH: "Household size",
  MonthlyIncome: "Gross monthly income",
  AMI100: "100% AMI monthly value",
  AMI30: "30% AMI monthly limit",
  Pct: "Percent of AMI",
  Status: "Status",
  Size: "Unit size",
  FMR: "Monthly FMR",
  ESGLimit: "ESG asset limit",
  Requested: "Requested assistance",
  Use: "Included in projection",
  Work: "Work period",
  Pay: "Pay date",
  Gross: "Gross pay",
  Class: "Classification",
  Note: "Audit note",
  Widget: "Widget",
  AMI100Monthly: "100% AMI monthly value",
  AMI30Monthly: "30% AMI monthly limit",
  AMIPct: "Percent of AMI",
  Eligibility: "Eligibility",
  Matrix: "Calculation table version",
  UnitSize: "Unit size",
  RateType: "Rate type",
  MonthlyFMR: "Monthly FMR",
  OutputLimit: "Calculated output",
  Formula: "Formula",
};

function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth = Math.max(0, depth - 1);
    else if (char === delimiter && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function humanize(key: string): string {
  return LABELS[key]
    ?? key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
}

function meaningful(value: string): boolean {
  return !!value && !/^(?:NA|None|null|undefined)$/i.test(value);
}

function parsePairs(value: string, delimiter = "|"): Array<[string, string]> {
  return splitTopLevel(value, delimiter)
    .map((part) => {
      const nested = /^([A-Za-z][A-Za-z0-9]*)(\{[\s\S]*\})$/.exec(part.trim());
      if (nested) return [nested[1], nested[2]] as [string, string];
      const colon = part.indexOf(":");
      if (colon <= 0) return null;
      const key = part.slice(0, colon).trim();
      const item = part.slice(colon + 1).trim();
      return /^[A-Za-z][A-Za-z0-9]*$/.test(key) ? [key, item] as [string, string] : null;
    })
    .filter((pair): pair is [string, string] => !!pair);
}

function parseCommaPairs(value: string, keys: string[]): Array<[string, string]> {
  const boundary = new RegExp(`,(?=(?:${keys.join("|")}):)`);
  return value.split(boundary)
    .map((part) => {
      const colon = part.indexOf(":");
      return colon > 0
        ? [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string]
        : null;
    })
    .filter((pair): pair is [string, string] => !!pair);
}

function expandPair(prefix: string, key: string, value: string): WidgetField[] {
  if (!meaningful(value)) return [];

  if (key === "AMI" && value.startsWith("{") && value.endsWith("}")) {
    return parseCommaPairs(
      value.slice(1, -1),
      ["County", "HH", "Basis", "MonthlyIncome", "AMI100", "AMI30", "Pct", "Status"],
    )
      .flatMap(([nestedKey, nestedValue]) =>
        expandPair(`${prefix} — AMI`, nestedKey, nestedValue),
      );
  }

  if (key === "StubAudit" && value.startsWith("[") && value.endsWith("]")) {
    return splitTopLevel(value.slice(1, -1), ";").flatMap((stub, index) => {
      const match = /^#(\d+)\{([\s\S]*)\}$/.exec(stub.trim());
      if (!match) return [];
      const number = match[1] || String(index + 1);
      return parseCommaPairs(
        match[2],
        ["Use", "Work", "Pay", "Gross", "Class", "Note"],
      ).flatMap(([stubKey, stubValue]) =>
        expandPair(`${prefix} — Paystub ${number}`, stubKey, stubValue),
      );
    });
  }

  return [{
    label: `${prefix} — ${humanize(key)}`.slice(0, 200),
    value: value.slice(0, 2000),
  }];
}

/**
 * Expands the compact audit value emitted by the HRDC custom calculator widgets.
 * Ordinary Jotform answers are returned unchanged.
 */
export function expandWidgetAnswer(
  label: string,
  value: string,
  type?: string,
): WidgetField[] {
  const safeLabel = label.trim().slice(0, 200);
  const safeValue = value.trim().slice(0, 20_000);
  if (!safeLabel || !safeValue) return [];

  const pairs = parsePairs(safeValue);
  const looksStructured = pairs.length >= 2
    && (type === "control_widget" || pairs.some(([key]) => key in LABELS || key === "AMI" || key === "StubAudit"));
  if (!looksStructured) return [{ label: safeLabel, value: safeValue.slice(0, 2000) }];

  return pairs
    .flatMap(([key, item]) => expandPair(safeLabel, key, item))
    .slice(0, 80);
}
