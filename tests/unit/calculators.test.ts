import assert from "node:assert/strict";
import test from "node:test";

import { calculateAnnualLeave, calculateBusinessDays, getKoreanHolidays } from "../../src/features/work-calculator/workCalculator.ts";
import { calculateNetPay, calculateSeverance, calculateWeeklyAllowance, estimateMonthlyIncomeTax } from "../../src/features/payroll-calculator/payroll.ts";
import { generatePassword } from "../../src/features/security-tools/securityPassword.ts";

test("Korean holidays use the Dangi calendar and emit one substitute for one overlap", () => {
  const holidays2025 = getKoreanHolidays(2025);
  assert.ok(holidays2025.some((holiday) => holiday.date === "2025-01-29" && holiday.name === "설날"));
  assert.equal(holidays2025.filter((holiday) => holiday.substitute && holiday.date.startsWith("2025-05-")).length, 1);
  assert.ok(holidays2025.some((holiday) => holiday.date === "2025-05-06" && holiday.substitute));

  const holidays2026 = getKoreanHolidays(2026);
  assert.ok(holidays2026.some((holiday) => holiday.date === "2026-02-17" && holiday.name === "설날"));
  assert.ok(holidays2026.some((holiday) => holiday.date === "2026-06-03"));
  const holidays2027 = getKoreanHolidays(2027);
  assert.ok(holidays2027.some((holiday) => holiday.date === "2027-02-07"));
  assert.ok(getKoreanHolidays(2028).some((holiday) => holiday.date === "2028-01-27" && holiday.name === "설날"));
  assert.ok(getKoreanHolidays(2030).some((holiday) => holiday.date === "2030-02-03" && holiday.name === "설날"));
});

test("first-year leave requires completed months rather than calendar month boundaries", () => {
  assert.equal(calculateAnnualLeave("2026-01-31", "2026-02-01", "hire").days, 0);
  assert.equal(calculateAnnualLeave("2026-01-31", "2026-02-28", "hire").days, 1);
  assert.equal(calculateAnnualLeave("2026-01-01", "2026-11-15", "hire").days, 10);
});

test("custom holidays reject malformed or impossible calendar dates", () => {
  assert.throws(() => calculateBusinessDays("2026-01-01", "2026-01-31", ["2026-02-30"]), /형식/);
  assert.throws(() => calculateBusinessDays("2026-01-01", "2026-01-31", ["tomorrow"], "en"), /Invalid/);
});

test("payroll formulas preserve statutory thresholds and tax credit structure", () => {
  assert.deepEqual(calculateWeeklyAllowance(14.99, 10_000), { eligible: false, paidHours: 0, allowance: 0 });
  assert.equal(calculateWeeklyAllowance(40, 10_000).allowance, 80_000);
  assert.ok(Number.isFinite(estimateMonthlyIncomeTax(100_000_000, 1, 0)));
  const severance = calculateSeverance({
    hireDate: "2024-01-01",
    retirementDate: "2025-01-01",
    wagesThreeMonths: 9_000_000,
    annualBonus: 0,
    annualLeavePay: 0,
    periodDays: 92,
    weeklyHours: 14,
  });
  assert.equal(severance.eligible, false);
  assert.equal(severance.severance, 0);
});

test("monthly payroll keeps exact official-rate mapping outputs", () => {
  assert.equal(estimateMonthlyIncomeTax(3_000_000, 1, 0), 55_333.333333333336);
  assert.deepEqual(calculateNetPay(3_000_000, 1, 0), {
    pension: 142_500,
    health: 107_850,
    longTermCare: 14_170,
    employment: 26_990,
    incomeTax: 55_330,
    localTax: 5_530,
    deductions: 352_370,
    net: 2_647_630,
  });
});

test("password generation includes every selected character group", () => {
  const groups = ["ABC", "abc", "234", "!@#"];
  const password = generatePassword(24, groups);
  assert.equal(password.length, 24);
  for (const group of groups) assert.ok([...password].some((character) => group.includes(character)));
});
