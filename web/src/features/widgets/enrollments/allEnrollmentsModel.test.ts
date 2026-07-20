import { describe, expect, it } from "vitest";
import {
  applyBaseFilters,
  applyChipFilters,
  buildEnrollmentReportRows,
  groupRowsByGrant,
  groupRowsByPopulation,
  monthsBetweenISO,
  populationKeyOf,
  summarizeEnrollmentRows,
} from "./allEnrollmentsModel";

const ASOF = "2026-07-16";

function fixture() {
  const customers = new Map<string, Record<string, unknown>>([
    [
      "c1",
      {
        id: "c1",
        population: "Youth",
        status: "active",
        active: true,
        caseManagerId: "cm1",
        caseManagerName: "Casey Manager",
        assistanceLength: { firstDateOfAssistance: "2025-01-10" },
      },
    ],
    ["c2", { id: "c2", population: "family", status: "active", active: true }],
    ["c3", { id: "c3", status: "inactive", active: false }],
  ]);
  const grants = new Map<string, Record<string, unknown>>([
    ["g1", { id: "g1", name: "Grant One", budget: { total: 1000 } }],
    ["g2", { id: "g2", name: "Grant Two", budget: { total: 500 } }],
    ["p1", { id: "p1", name: "Program One", kind: "program" }],
  ]);
  const enrollments: Array<Record<string, unknown>> = [
    // c1 migrated g1 → g2; old enrollment closed, new active, started this month
    {
      id: "e1",
      grantId: "g1",
      customerId: "c1",
      startDate: "2025-03-01",
      endDate: "2026-06-30",
      status: "closed",
      migratedTo: { enrollmentId: "e2", grantId: "g2", cutover: "2026-07-01" },
    },
    {
      id: "e2",
      grantId: "g2",
      customerId: "c1",
      startDate: "2026-07-01",
      status: "active",
      migratedFrom: { enrollmentId: "e1", grantId: "g1", cutover: "2026-07-01" },
    },
    // c2 active in a program since Jan
    { id: "e3", grantId: "p1", customerId: "c2", startDate: "2026-01-15", status: "active" },
    // c3 inactive customer, closed enrollment
    { id: "e4", grantId: "g1", customerId: "c3", startDate: "2024-05-01", endDate: "2025-05-01", status: "closed" },
    // deleted enrollments are excluded
    { id: "e5", grantId: "g1", customerId: "c2", startDate: "2026-02-01", status: "deleted" },
    // duplicate id is deduped
    { id: "e3", grantId: "p1", customerId: "c2", startDate: "2026-01-15", status: "active" },
  ];
  return {
    enrollments,
    customersById: customers,
    grantsById: grants,
    customerNameById: new Map([
      ["c1", "Alice Young"],
      ["c2", "Bob Family"],
      ["c3", "Cara Gone"],
    ]),
    grantNameById: new Map([
      ["g1", "Grant One"],
      ["g2", "Grant Two"],
      ["p1", "Program One"],
    ]),
    asOf: ASOF,
  };
}

describe("monthsBetweenISO", () => {
  it("floors whole months and clamps at zero", () => {
    expect(monthsBetweenISO("2026-01-15", "2026-03-14")).toBe(1);
    expect(monthsBetweenISO("2026-01-15", "2026-03-15")).toBe(2);
    expect(monthsBetweenISO("2026-03-01", "2026-02-01")).toBe(0);
    expect(monthsBetweenISO("", "2026-02-01")).toBeNull();
  });
});

describe("populationKeyOf", () => {
  it("normalizes case and maps anything else to Unknown", () => {
    expect(populationKeyOf("Youth")).toBe("Youth");
    expect(populationKeyOf("family")).toBe("Family");
    expect(populationKeyOf(null)).toBe("Unknown");
    expect(populationKeyOf("household")).toBe("Unknown");
  });
});

describe("buildEnrollmentReportRows", () => {
  it("excludes deleted enrollments and dedupes by id", () => {
    const rows = buildEnrollmentReportRows(fixture());
    expect(rows.map((r) => r.enrollmentId).sort()).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("computes months in enrollment (to end date when closed, to asOf when active)", () => {
    const rows = buildEnrollmentReportRows(fixture());
    const byId = new Map(rows.map((r) => [r.enrollmentId, r]));
    expect(byId.get("e1")?.monthsActive).toBe(15); // 2025-03-01 → 2026-06-30
    expect(byId.get("e3")?.monthsActive).toBe(6); // 2026-01-15 → 2026-07-16
    expect(byId.get("e4")?.monthsActive).toBe(12); // 2024-05-01 → 2025-05-01
  });

  it("flags new-this-month and migration direction", () => {
    const rows = buildEnrollmentReportRows(fixture());
    const byId = new Map(rows.map((r) => [r.enrollmentId, r]));
    expect(byId.get("e2")?.isNewInMonth).toBe(true);
    expect(byId.get("e3")?.isNewInMonth).toBe(false);
    expect(byId.get("e2")?.migratedIn).toBe(true);
    expect(byId.get("e2")?.migratedInFromGrantId).toBe("g1");
    expect(byId.get("e1")?.migratedOut).toBe(true);
    expect(byId.get("e1")?.migratedOutToGrantId).toBe("g2");
  });

  it("computes customer tenure from the first assistance date while active, and to last end date when inactive", () => {
    const rows = buildEnrollmentReportRows(fixture());
    const byId = new Map(rows.map((r) => [r.enrollmentId, r]));
    // c1: firstDateOfAssistance 2025-01-10 predates earliest start 2025-03-01; active → to asOf
    expect(byId.get("e2")?.customerSince).toBe("2025-01-10");
    expect(byId.get("e2")?.customerTenureMonths).toBe(18);
    // c3: inactive → tenure runs to their last enrollment end date
    expect(byId.get("e4")?.customerSince).toBe("2024-05-01");
    expect(byId.get("e4")?.customerTenureMonths).toBe(12);
  });
});

describe("summarizeEnrollmentRows", () => {
  it("counts totals, actives, new-this-month, migrations, and population buckets", () => {
    const rows = buildEnrollmentReportRows(fixture());
    const s = summarizeEnrollmentRows(rows);
    expect(s.total).toBe(4);
    expect(s.active).toBe(2); // e2, e3
    expect(s.inactive).toBe(2); // e1, e4
    expect(s.newThisMonth).toBe(1); // e2
    expect(s.migratedIn).toBe(1);
    expect(s.migratedOut).toBe(1);
    expect(s.migratedCustomers).toBe(1); // both migration rows are c1
    expect(s.distinctCustomers).toBe(3);
    expect(s.byPopulation.Youth.total).toBe(2); // c1's two enrollments
    expect(s.byPopulation.Family.total).toBe(1);
    expect(s.byPopulation.Unknown.total).toBe(1); // c3 has no population
    expect(s.unknownPopulation).toBe(1);
  });
});

describe("grouping", () => {
  it("groups by grant with per-grant summaries sorted by name", () => {
    const groups = groupRowsByGrant(buildEnrollmentReportRows(fixture()));
    expect(groups.map((g) => g.grantName)).toEqual(["Grant One", "Grant Two", "Program One"]);
    const g1 = groups[0];
    expect(g1.summary.total).toBe(2); // e1 + e4
    expect(g1.summary.migratedOut).toBe(1);
    expect(groups[1].summary.migratedIn).toBe(1);
    expect(groups[2].bucket).toBe("program");
  });

  it("groups by population in fixed order including Unknown", () => {
    const groups = groupRowsByPopulation(buildEnrollmentReportRows(fixture()));
    expect(groups.map((g) => g.population)).toEqual(["Youth", "Individual", "Family", "Unknown"]);
    expect(groups[0].summary.total).toBe(2);
    expect(groups[1].summary.total).toBe(0);
    expect(groups[3].summary.total).toBe(1);
  });
});

describe("filters", () => {
  it("base filters scope by bucket, case manager, and text query", () => {
    const rows = buildEnrollmentReportRows(fixture());
    expect(applyBaseFilters(rows, { bucket: "program", caseManagerId: "all", query: "" }).map((r) => r.enrollmentId)).toEqual(["e3"]);
    expect(applyBaseFilters(rows, { bucket: "all", caseManagerId: "cm1", query: "" }).map((r) => r.enrollmentId).sort()).toEqual(["e1", "e2"]);
    expect(applyBaseFilters(rows, { bucket: "all", caseManagerId: "all", query: "alice" }).length).toBe(2);
  });

  it("chip filters narrow by status, population, new-this-month, and migration", () => {
    const rows = buildEnrollmentReportRows(fixture());
    const none = { status: "all" as const, population: "all" as const, newThisMonth: false, migratedOnly: false };
    expect(applyChipFilters(rows, { ...none, status: "active" }).length).toBe(2);
    expect(applyChipFilters(rows, { ...none, status: "inactive" }).length).toBe(2);
    expect(applyChipFilters(rows, { ...none, population: "Unknown" }).map((r) => r.enrollmentId)).toEqual(["e4"]);
    expect(applyChipFilters(rows, { ...none, newThisMonth: true }).map((r) => r.enrollmentId)).toEqual(["e2"]);
    expect(applyChipFilters(rows, { ...none, migratedOnly: true }).map((r) => r.enrollmentId).sort()).toEqual(["e1", "e2"]);
  });
});
