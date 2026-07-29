const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Calc = require("../calculator.js");

function baseState(overrides = {}) {
  return {
    asOfDate: "2026-07-23",
    incomeMethod: "earned",
    county: "Gallatin",
    householdSize: "2",
    unitSize: "1BR",
    requestedAssistance: "2500",
    otherIncome: "100",
    sources: [],
    ...overrides
  };
}

test("May 2026 AMI and FMR matrices match the approved values", () => {
  assert.deepEqual(Calc.AMI_TABLE.Gallatin, [7600, 8683, 9767, 10850, 11725, 12592, 13458, 14325]);
  assert.deepEqual(Calc.AMI_TABLE.Meagher, [5308, 6067, 6825, 7583, 8192, 8800, 9408, 10017]);
  assert.deepEqual(Calc.AMI_TABLE.Park, [5583, 6375, 7175, 7967, 8608, 9242, 9883, 10517]);
  assert.deepEqual(Calc.FMR_TABLE.Gallatin, { Studio: 1485, "1BR": 1642, "2BR": 2154, "3BR": 2996, "4BR": 3537 });
  assert.deepEqual(Calc.FMR_TABLE.Meagher, { Studio: 1044, "1BR": 1087, "2BR": 1393, "3BR": 1925, "4BR": 2252 });
  assert.deepEqual(Calc.FMR_TABLE.Park, { Studio: 1107, "1BR": 1385, "2BR": 1605, "3BR": 2232, "4BR": 2692 });
});

test("deployed compatibility widgets retain inputs and emit versioned one-field audit values", () => {
  const ami = fs.readFileSync(path.join(__dirname, "../deploy/AMI_calculator.html"), "utf8");
  const fmr = fs.readFileSync(path.join(__dirname, "../deploy/fmr_widget.html"), "utf8");

  for (const input of ['id="county"', 'id="hhsize"', 'id="income"']) assert.ok(ami.includes(input));
  for (const setting of ["ami-matrix", "use-commas", "date-stamp"]) assert.ok(ami.includes(`getWidgetSetting("${setting}")`));
  assert.ok(ami.includes("CalcV:2|Widget:AMI|County:"));
  assert.ok(ami.includes("|AMI30Monthly:"));
  assert.ok(ami.includes("|Eligibility:"));

  for (const input of ['id="county"', 'id="unitSize"', 'name="rateType"']) assert.ok(fmr.includes(input));
  for (const setting of ["fmr-matrix", "date-stamp"]) assert.ok(fmr.includes(`getWidgetSetting("${setting}")`));
  assert.ok(fmr.includes("CalcV:2|Widget:FMR_ESG|County:"));
  assert.ok(fmr.includes("|OutputLimit:"));
  assert.ok(fmr.includes("|Formula:"));

  for (const html of [ami, fmr]) {
    assert.ok(html.includes("JFCustomWidget.sendSubmit({valid:!!submitString,value:submitString})"));
  }
});

test("annualized paystub projection produces monthly and 30-day estimates", () => {
  const projection = Calc.projectAnnualizedIncome([920.50, 985.25], "biweekly");
  assert.equal(projection.includedCheckCount, 2);
  assert.equal(projection.averageCheck, 952.875);
  assert.equal(projection.annualizedIncome, 24774.75);
  assert.equal(projection.averageMonthlyIncome, 2064.5625);
  assert.equal(projection.estimated30DayIncome.toFixed(2), "2036.28");
});

test("annualized projection includes other projected monthly income", () => {
  const projection = Calc.projectAnnualizedIncome([1000, 1100], "weekly", 250);
  assert.equal(projection.averageCheck, 1050);
  assert.equal(projection.annualizedPay, 54600);
  assert.equal(projection.annualizedIncome, 57600);
  assert.equal(projection.averageMonthlyIncome, 4800);
  assert.equal(projection.estimated30DayIncome.toFixed(2), "4734.25");
});

test("30-day basis toggle selects annualized estimate or actual received income", () => {
  const projection = Calc.projectAnnualizedIncome([920.50, 985.25], "biweekly");
  const annualized = Calc.select30DayIncomeBasis("annualized", projection, 0);
  assert.equal(annualized.incomeUsed30.toFixed(2), "2036.28");
  assert.equal(annualized.amiMonthlyIncome.toFixed(2), "2064.56");

  const actual = Calc.select30DayIncomeBasis("actualReceived", projection, 985.25);
  assert.equal(actual.incomeUsed30, 985.25);
  assert.equal(actual.amiMonthlyIncome, 985.25);
});

test("optional AMI uses the income selected by the 30-day basis", () => {
  const projection = Calc.projectAnnualizedIncome([920.50, 985.25], "biweekly");
  const annualizedBasis = Calc.select30DayIncomeBasis("annualized", projection, 0);
  const projectedAmi = Calc.calculateAmiReview(annualizedBasis.amiMonthlyIncome, "Gallatin", 2);
  assert.equal(projectedAmi.ami100, 8683);
  assert.equal(projectedAmi.ami30, 2604.9);
  assert.equal(projectedAmi.percent.toFixed(1), "23.8");

  const actualBasis = Calc.select30DayIncomeBasis("actualReceived", projection, 985.25);
  const actualAmi = Calc.calculateAmiReview(actualBasis.amiMonthlyIncome, "Gallatin", 2);
  assert.equal(actualAmi.percent.toFixed(1), "11.3");
});

test("30-day period includes the as-of date and prior 29 calendar days", () => {
  assert.deepEqual(
    { start: Calc.periodFor("2026-07-23").startISO, end: Calc.periodFor("2026-07-23").endISO },
    { start: "2026-06-24", end: "2026-07-23" }
  );
});

test("earned method prorates a check by overlapping calendar days", () => {
  const result = Calc.calculate(baseState({
    otherIncome: "0",
    sources: [{
      frequency: "biweekly",
      stubs: [{
        workStart: "2026-06-20",
        workEnd: "2026-07-03",
        payDate: "2026-07-08",
        gross: "1400"
      }]
    }]
  }));
  assert.equal(result.sourceResults[0].stubResults[0].workDays, 14);
  assert.equal(result.sourceResults[0].stubResults[0].overlapDays, 10);
  assert.equal(result.earnedTotal, 1000);
  assert.equal(result.receivedTotal, 1400);
});

test("received method counts full checks with pay dates inside the window", () => {
  const result = Calc.calculate(baseState({
    incomeMethod: "received",
    otherIncome: "0",
    sources: [{
      frequency: "monthly",
      stubs: [
        { payDate: "2026-06-23", gross: "900" },
        { payDate: "2026-06-24", gross: "1000" },
        { payDate: "2026-07-23", gross: "1100" },
        { payDate: "2026-07-24", gross: "1200" }
      ]
    }]
  }));
  assert.equal(result.receivedTotal, 2100);
});

test("AMI values match the trusted widget matrix and use monthly income", () => {
  const result = Calc.calculate(baseState({ otherIncome: "1000" }));
  assert.equal(result.ami100, 8683);
  assert.equal(result.ami[30], 2604.9);
  assert.equal(result.amiPercent.toFixed(1), "11.5");
  assert.equal(result.isAtOrBelow30, true);
});

test("FMR and ESG limit match the trusted widget formula", () => {
  const result = Calc.calculate(baseState());
  assert.equal(result.fmr, 1642);
  assert.equal(result.esgLimit, 2627);
  assert.equal(result.isWithinEsgLimit, true);
});

test("earned method warns when work dates are missing and uses pay-date fallback", () => {
  const result = Calc.calculate(baseState({
    otherIncome: "0",
    sources: [{
      person: "A",
      frequency: "monthly",
      stubs: [{ payDate: "2026-07-10", gross: "1800" }]
    }]
  }));
  assert.equal(result.earnedTotal, 1800);
  assert.ok(result.warnings.some(warning => warning.includes("fallback")));
});
