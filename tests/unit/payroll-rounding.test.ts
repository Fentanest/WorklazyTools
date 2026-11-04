import assert from "node:assert/strict";
import test from "node:test";

import { calculateNetPay, calculateSeverance, calculateWeeklyAllowance, estimateMonthlyIncomeTax } from "../../src/features/payroll-calculator/payroll.ts";

test("employment premium truncates exact decimal rates at the 10-won boundary", () => {
  for (const [salary, expected] of [
    [409_999, 3_680], [410_000, 3_690], [410_001, 3_690],
    [2_999_999, 26_990], [3_000_000, 27_000], [3_000_001, 27_000],
    [6_000_000, 54_000], [10_000_000, 90_000],
    // A real fraction below the boundary must not be rounded up by an epsilon.
    [2_999_999.9999999, 26_990], [3_000_000.0000001, 27_000], [1e-7, 0],
  ]) assert.equal(calculateNetPay(salary, 1, 0).employment, expected, `${salary}`);
});

test("pension preserves the base floor/cap and truncates only after the rate", () => {
  for (const [salary, expected] of [
    [0, 19_470], [409_999, 19_470], [410_000, 19_470], [410_001, 19_470],
    [411_999, 19_560], [412_000, 19_570], [412_001, 19_570],
    [6_589_999, 313_020], [6_590_000, 313_020], [6_590_001, 313_020], [100_000_000, 313_020],
  ]) assert.equal(calculateNetPay(salary, 1, 0).pension, expected, `${salary}`);
});

test("health and care insurance retain each separate truncation step", () => {
  for (const [salary, health, care] of [
    [1_302_910, 46_830, 6_150],
    // Using the untruncated health premium here would incorrectly give 6,150.
    [1_301_910, 46_800, 6_140],
    [1_390_820, 49_990, 6_560], [1_390_821, 50_000, 6_570],
    [1_999_999, 71_890, 9_440], [2_000_000, 71_900, 9_440], [2_000_001, 71_900, 9_440],
    [2_781_642, 100_000, 13_140], [3_000_000, 107_850, 14_170],
  ]) {
    const result = calculateNetPay(salary, 1, 0);
    assert.equal(result.health, health, `${salary}: health`);
    assert.equal(result.longTermCare, care, `${salary}: care`);
  }
});

test("income/local tax preserve deduction, bracket and credit boundaries", () => {
  // Frozen values independently evaluated with Python Fraction and the
  // equivalent quick-deduction tax formula (not the production bracket loop).
  for (const [salary, incomeTax, localTax] of [
    [416_666, 0, 0], [416_667, 0, 0],
    [1_249_999, 3_570, 350], [1_250_000, 3_570, 350], [1_250_001, 3_570, 350],
    [2_606_557, 31_490, 3_140], [2_606_558, 31_500, 3_150],
    [2_749_999, 38_880, 3_880], [2_750_000, 38_880, 3_880], [2_750_001, 38_880, 3_880],
    [2_941_712, 48_740, 4_870], [2_941_713, 48_750, 4_870],
    [3_749_999, 145_780, 14_570], [3_750_000, 145_780, 14_570], [3_750_001, 145_780, 14_570],
    [5_833_333, 415_310, 41_530], [5_833_334, 415_310, 41_530],
    [6_589_999, 545_910, 54_590], [6_590_000, 545_910, 54_590], [6_590_001, 545_910, 54_590],
    [8_333_333, 935_370, 93_530], [8_333_334, 935_370, 93_530],
    [10_000_000, 1_346_060, 134_600], [15_000_000, 2_991_060, 299_100],
    [30_000_000, 8_373_120, 837_310], [50_000_000, 16_130_860, 1_613_080],
    [100_000_000, 36_599_970, 3_659_990], [200_000_000, 79_799_970, 7_979_990],
  ]) {
    const result = calculateNetPay(salary, 1, 0);
    assert.equal(result.incomeTax, incomeTax, `${salary}: income`);
    assert.equal(result.localTax, localTax, `${salary}: local`);
  }
  // The public estimate remains untruncated; only the payroll result is floored.
  assert.equal(estimateMonthlyIncomeTax(3_000_000, 1, 0), 664_000 / 12);
});

test("personal, special and child credits preserve dependent and zero-tax branches", () => {
  for (const [dependents, children, incomeTax, localTax] of [
    [0, 0, 55_330, 5_530], [1, 0, 55_330, 5_530],
    [1, 1, 34_500, 3_450], [1, 2, 9_500, 950], [1, 3, 0, 0],
    [2, 0, 40_500, 4_050], [2, 1, 19_660, 1_960], [2, 2, 0, 0],
    [3, 0, 26_140, 2_610], [3, 1, 5_310, 530], [3, 2, 0, 0],
    [5, 0, 19_390, 1_930], [5, 1, 0, 0],
  ]) {
    const result = calculateNetPay(3_000_000, dependents, children);
    assert.equal(result.incomeTax, incomeTax, `${dependents}/${children}: income`);
    assert.equal(result.localTax, localTax, `${dependents}/${children}: local`);
  }
});

test("deduction totals and net use the corrected premiums without an extra rounding step", () => {
  const result = calculateNetPay(3_000_000.25, 1, 0);
  assert.equal(result.deductions, 352_380);
  assert.equal(result.net, 2_647_620.25);
  assert.equal(result.deductions, result.pension + result.health + result.longTermCare + result.employment + result.incomeTax + result.localTax);
  assert.equal(calculateNetPay(0, 1, 0).net, 0);
});

test("weekly allowance rounds exact half-won values after fractional paid hours", () => {
  assert.deepEqual(calculateWeeklyAllowance(15.01, 1_250), { eligible: true, paidHours: 3.002, allowance: 3_753 });
  assert.equal(calculateWeeklyAllowance(15.0099999, 1_250).allowance, 3_752);
  assert.equal(calculateWeeklyAllowance(14.99, 10_000).allowance, 0);
  assert.equal(calculateWeeklyAllowance(15, 10_000).allowance, 30_000);
  assert.equal(calculateWeeklyAllowance(41, 10_000).allowance, 80_000);
});

test("severance keeps fractional bonus allocation and daily wage until the final result", () => {
  const input = { hireDate: "2025-01-01", retirementDate: "2025-12-31", wagesThreeMonths: 9_000_001, annualBonus: 1, annualLeavePay: 1, periodDays: 90, weeklyHours: 15 };
  const result = calculateSeverance(input);
  assert.equal(result.serviceDays, 365);
  assert.equal(result.includedExtra, 0.5);
  assert.equal(result.averageDailyWage, 9_000_001.5 / 90);
  assert.equal(result.severance, 3_000_000.5);
  assert.equal(calculateSeverance({ ...input, periodDays: 0 }).severance, 0);
  assert.equal(calculateSeverance({ ...input, weeklyHours: 14.99 }).severance, 0);
});

test("non-finite numeric input does not throw during a payroll edit", () => {
  assert.ok(Number.isNaN(calculateNetPay(NaN, 1, 0).net));
  assert.ok(Number.isNaN(calculateNetPay(Infinity, 1, 0).net));
});
