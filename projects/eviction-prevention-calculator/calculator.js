(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EPCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AMI_TABLE = Object.freeze({
    Gallatin: Object.freeze([7600, 8683, 9767, 10850, 11725, 12592, 13458, 14325]),
    Park: Object.freeze([5583, 6375, 7175, 7967, 8608, 9242, 9883, 10517]),
    Meagher: Object.freeze([5308, 6067, 6825, 7583, 8192, 8800, 9408, 10017])
  });

  const FMR_TABLE = Object.freeze({
    Gallatin: Object.freeze({ Studio: 1485, "1BR": 1642, "2BR": 2154, "3BR": 2996, "4BR": 3537 }),
    Park: Object.freeze({ Studio: 1107, "1BR": 1385, "2BR": 1605, "3BR": 2232, "4BR": 2692 }),
    Meagher: Object.freeze({ Studio: 1044, "1BR": 1087, "2BR": 1393, "3BR": 1925, "4BR": 2252 })
  });

  const FREQUENCIES = Object.freeze({
    weekly: Object.freeze({ label: "weekly", minimum: 4, expected: "4–5 paystubs", periodsPerYear: 52 }),
    biweekly: Object.freeze({ label: "bi-weekly", minimum: 2, expected: "2–3 paystubs", periodsPerYear: 26 }),
    semimonthly: Object.freeze({ label: "semi-monthly", minimum: 2, expected: "2 paystubs", periodsPerYear: 24 }),
    monthly: Object.freeze({ label: "monthly", minimum: 1, expected: "1 paystub", periodsPerYear: 12 })
  });

  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function addDays(value, days) {
    const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  }

  function periodFor(asOfDate) {
    const end = parseDate(asOfDate);
    if (!end) return { start: null, end: null, startISO: "", endISO: "" };
    const start = addDays(end, -29);
    return { start, end, startISO: toISODate(start), endISO: toISODate(end) };
  }

  function inclusiveDays(start, end) {
    if (!start || !end || start > end) return 0;
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  }

  function overlapDays(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB || startA > endA || startB > endB) return 0;
    return inclusiveDays(new Date(Math.max(startA, startB)), new Date(Math.min(endA, endB)));
  }

  function asMoneyNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function projectAnnualizedIncome(grossChecks, frequency, otherMonthlyIncome = 0) {
    const frequencyConfig = FREQUENCIES[frequency];
    const includedChecks = (grossChecks || [])
      .map(asMoneyNumber)
      .filter(value => value > 0);
    const averageCheck = includedChecks.length
      ? includedChecks.reduce((sum, value) => sum + value, 0) / includedChecks.length
      : 0;
    const annualizedPay = frequencyConfig ? averageCheck * frequencyConfig.periodsPerYear : 0;
    const annualizedIncome = annualizedPay + asMoneyNumber(otherMonthlyIncome) * 12;
    return {
      includedCheckCount: includedChecks.length,
      averageCheck,
      annualizedPay,
      annualizedIncome,
      averageMonthlyIncome: annualizedIncome / 12,
      estimated30DayIncome: annualizedIncome * 30 / 365
    };
  }

  function select30DayIncomeBasis(basis, projection, actualReceived30 = 0) {
    const useActual = basis === "actualReceived";
    return {
      basis: useActual ? "actualReceived" : "annualized",
      incomeUsed30: useActual
        ? asMoneyNumber(actualReceived30)
        : asMoneyNumber(projection && projection.estimated30DayIncome),
      amiMonthlyIncome: useActual
        ? asMoneyNumber(actualReceived30)
        : asMoneyNumber(projection && projection.averageMonthlyIncome)
    };
  }

  function calculateAmiReview(monthlyIncome, county, householdSize) {
    const table = AMI_TABLE[county];
    const size = Math.floor(Number(householdSize));
    if (!table || size < 1 || size > table.length) return null;
    const income = asMoneyNumber(monthlyIncome);
    const ami100 = table[size - 1];
    const ami30 = ami100 * 0.3;
    const percent = income / ami100 * 100;
    return {
      county,
      householdSize: size,
      monthlyIncome: income,
      ami100,
      ami30,
      percent,
      status: percent <= 30 ? "AtOrBelow30" : "Above30"
    };
  }

  function calculateStub(stub, period) {
    const gross = asMoneyNumber(stub.gross);
    const payDate = parseDate(stub.payDate);
    const workStart = parseDate(stub.workStart);
    const workEnd = parseDate(stub.workEnd);
    const hasValidWorkPeriod = Boolean(workStart && workEnd && workStart <= workEnd);
    const receivedInWindow = Boolean(payDate && period.start && payDate >= period.start && payDate <= period.end);
    const receivedAmount = receivedInWindow ? gross : 0;

    let earnedAmount = 0;
    let overlap = 0;
    let workDays = 0;
    let earnedFallback = false;
    if (hasValidWorkPeriod && period.start) {
      workDays = inclusiveDays(workStart, workEnd);
      overlap = overlapDays(workStart, workEnd, period.start, period.end);
      earnedAmount = workDays > 0 ? gross * (overlap / workDays) : 0;
    } else if (receivedInWindow) {
      earnedAmount = gross;
      earnedFallback = true;
    }

    return {
      gross,
      payDate,
      workStart,
      workEnd,
      hasValidWorkPeriod,
      receivedInWindow,
      receivedAmount,
      earnedAmount,
      earnedFallback,
      overlapDays: overlap,
      workDays
    };
  }

  function calculate(state) {
    const period = periodFor(state.asOfDate);
    const warnings = [];
    let receivedPayroll = 0;
    let earnedPayroll = 0;
    const sourceResults = [];

    (state.sources || []).forEach((source, sourceIndex) => {
      const frequency = FREQUENCIES[source.frequency] || FREQUENCIES.weekly;
      const stubResults = (source.stubs || []).map(stub => calculateStub(stub, period));
      receivedPayroll += stubResults.reduce((sum, result) => sum + result.receivedAmount, 0);
      earnedPayroll += stubResults.reduce((sum, result) => sum + result.earnedAmount, 0);

      const receivedCount = stubResults.filter(result => result.receivedInWindow && result.gross > 0).length;
      const earnedCount = stubResults.filter(result => result.earnedAmount > 0).length;
      const primaryCount = state.incomeMethod === "received" ? receivedCount : earnedCount;
      const missingWorkDates = stubResults.filter(result => result.gross > 0 && result.earnedFallback).length;
      const invalidWorkDates = (source.stubs || []).filter(stub => {
        const start = parseDate(stub.workStart);
        const end = parseDate(stub.workEnd);
        return start && end && start > end;
      }).length;

      if (primaryCount < frequency.minimum) {
        warnings.push(`${source.person || source.employer || `Income source ${sourceIndex + 1}`}: ${primaryCount} qualifying paystub${primaryCount === 1 ? "" : "s"} entered; ${frequency.expected} are normally needed to cover 30 days.`);
      }
      if (state.incomeMethod === "earned" && missingWorkDates > 0) {
        warnings.push(`${source.person || source.employer || `Income source ${sourceIndex + 1}`}: ${missingWorkDates} paid-in-period stub${missingWorkDates === 1 ? "" : "s"} lacked a valid work period and used the full check as a fallback.`);
      }
      if (invalidWorkDates > 0) {
        warnings.push(`${source.person || source.employer || `Income source ${sourceIndex + 1}`}: ${invalidWorkDates} stub${invalidWorkDates === 1 ? " has" : "s have"} a work end date before the start date.`);
      }

      sourceResults.push({ source, frequency, stubResults, receivedCount, earnedCount, primaryCount });
    });

    if (!period.start) warnings.push("Choose a calculation as-of date to establish the 30-day period.");

    const otherIncome = asMoneyNumber(state.otherIncome);
    const receivedTotal = receivedPayroll + otherIncome;
    const earnedTotal = earnedPayroll + otherIncome;
    const primaryTotal = state.incomeMethod === "received" ? receivedTotal : earnedTotal;
    const estimatedAnnual = primaryTotal * 12;

    const countyTable = AMI_TABLE[state.county];
    const requestedHHSize = Math.floor(Number(state.householdSize));
    const householdSize = countyTable && Number.isFinite(requestedHHSize)
      ? Math.max(1, Math.min(requestedHHSize, countyTable.length))
      : null;
    const ami100 = householdSize ? countyTable[householdSize - 1] : null;
    const amiPercent = ami100 ? (primaryTotal / ami100) * 100 : null;
    const ami = ami100 ? {
      30: ami100 * 0.3,
      50: ami100 * 0.5,
      60: ami100 * 0.6,
      80: ami100 * 0.8,
      100: ami100
    } : null;

    const fmr = FMR_TABLE[state.county] && FMR_TABLE[state.county][state.unitSize] != null
      ? FMR_TABLE[state.county][state.unitSize]
      : null;
    const esgLimit = fmr == null ? null : Math.round(2 * 0.8 * fmr);
    const requestedAssistance = state.requestedAssistance === "" || state.requestedAssistance == null
      ? null
      : asMoneyNumber(state.requestedAssistance);

    return {
      period,
      sourceResults,
      warnings,
      otherIncome,
      receivedPayroll,
      earnedPayroll,
      receivedTotal,
      earnedTotal,
      primaryTotal,
      estimatedAnnual,
      householdSize,
      ami100,
      amiPercent,
      ami,
      fmr,
      esgLimit,
      requestedAssistance,
      isAtOrBelow30: ami ? primaryTotal <= ami[30] : null,
      isWithinEsgLimit: esgLimit != null && requestedAssistance != null ? requestedAssistance <= esgLimit : null
    };
  }

  return {
    AMI_TABLE,
    FMR_TABLE,
    FREQUENCIES,
    addDays,
    calculate,
    calculateAmiReview,
    calculateStub,
    inclusiveDays,
    overlapDays,
    parseDate,
    periodFor,
    projectAnnualizedIncome,
    select30DayIncomeBasis,
    toISODate
  };
});
