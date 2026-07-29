import assert from "node:assert/strict";
import test from "node:test";

function scheduleProjection({
  wage,
  usualHours,
  employmentStartDay,
  reducedHours = null,
  reducedStartDay = null,
  reducedEndDay = null,
  windowDays = 30
}) {
  let hours = 0;
  for (let day = 1; day <= windowDays; day += 1) {
    if (day < employmentStartDay) continue;
    const reduced = reducedHours != null
      && day >= reducedStartDay
      && (reducedEndDay == null || day <= reducedEndDay);
    hours += (reduced ? reducedHours : usualHours) / 7;
  }
  return { hours, pay: hours * wage };
}

test("a full 30-day, 40-hour schedule prorates weekly hours across the window", () => {
  const result = scheduleProjection({ wage: 20, usualHours: 40, employmentStartDay: 1 });
  assert.equal(Number(result.hours.toFixed(2)), 171.43);
  assert.equal(Number(result.pay.toFixed(2)), 3428.57);
});

test("employment beginning midway through the window excludes pre-employment days", () => {
  const result = scheduleProjection({ wage: 18, usualHours: 35, employmentStartDay: 16 });
  assert.equal(Number(result.hours.toFixed(2)), 75);
  assert.equal(Number(result.pay.toFixed(2)), 1350);
});

test("temporary reduced hours replace usual hours only inside the special-case range", () => {
  const result = scheduleProjection({
    wage: 25,
    usualHours: 40,
    employmentStartDay: 1,
    reducedHours: 20,
    reducedStartDay: 11,
    reducedEndDay: 20
  });
  assert.equal(Number(result.hours.toFixed(2)), 142.86);
  assert.equal(Number(result.pay.toFixed(2)), 3571.43);
});

test("an ongoing reduction applies through the end of the window", () => {
  const result = scheduleProjection({
    wage: 16,
    usualHours: 32,
    employmentStartDay: 1,
    reducedHours: 12,
    reducedStartDay: 21
  });
  assert.equal(Number(result.hours.toFixed(2)), 108.57);
  assert.equal(Number(result.pay.toFixed(2)), 1737.14);
});
