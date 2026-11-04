import { differenceInCalendarDays, parseISO } from "date-fns";
import { amount } from "./payrollAmount.ts";

// All rate numerators share this denominator; floating rates below are display-only.
const RATE_SCALE = 100_000;
const RATE = { pension: 4_750, health: 3_595, longTermCare: 13_140, employment: 900 } as const;

export const PAYROLL_STANDARD = {
  effectiveDate: "2026-07-01",
  pensionEmployeeRate: RATE.pension / RATE_SCALE,
  pensionMinBase: 410_000,
  pensionMaxBase: 6_590_000,
  healthEmployeeRate: RATE.health / RATE_SCALE,
  longTermCareToHealthRate: RATE.longTermCare / RATE_SCALE,
  employmentEmployeeRate: RATE.employment / RATE_SCALE,
} as const;

export function calculateWeeklyAllowance(weeklyHours: number, hourlyWage: number) {
  const eligible = weeklyHours >= 15;
  const paidHours = amount(eligible ? Math.min(weeklyHours, 40) : 0).multiply(8, 40);
  return { eligible, paidHours: paidHours.toNumber(), allowance: paidHours.multiply(hourlyWage).round() };
}

export function calculateNetPay(monthlySalary: number, dependents: number, children: number) {
  const salary = amount(monthlySalary);
  const pension = pensionBase(monthlySalary).multiply(RATE.pension, RATE_SCALE).floor(10);
  const health = salary.multiply(RATE.health, RATE_SCALE).floor(10);
  // Care insurance uses the already truncated health premium, not the raw premium.
  const longTermCare = amount(health).multiply(RATE.longTermCare, RATE_SCALE).floor(10);
  const employment = salary.multiply(RATE.employment, RATE_SCALE).floor(10);
  const incomeTax = monthlyIncomeTax(monthlySalary, Math.max(1, dependents), children).floor(10);
  const localTax = amount(incomeTax).multiply(1, 10).floor(10);
  const deductions = pension + health + longTermCare + employment + incomeTax + localTax;
  return { pension, health, longTermCare, employment, incomeTax, localTax, deductions, net: salary.subtract(deductions).max(0).toNumber() };
}

export function estimateMonthlyIncomeTax(monthly: number, dependents: number, children: number) {
  return monthlyIncomeTax(monthly, dependents, children).toNumber();
}

function pensionBase(monthly: number) {
  return amount(monthly).max(PAYROLL_STANDARD.pensionMinBase).min(PAYROLL_STANDARD.pensionMaxBase);
}

function monthlyIncomeTax(monthly: number, dependents: number, children: number) {
  const gross = amount(monthly).multiply(12);
  const earnedDeduction = (gross.lessThanOrEqual(5_000_000) ? gross.multiply(70, 100)
    : gross.lessThanOrEqual(15_000_000) ? gross.subtract(5_000_000).multiply(40, 100).add(3_500_000)
    : gross.lessThanOrEqual(45_000_000) ? gross.subtract(15_000_000).multiply(15, 100).add(7_500_000)
    : gross.lessThanOrEqual(100_000_000) ? gross.subtract(45_000_000).multiply(5, 100).add(12_000_000)
    : gross.subtract(100_000_000).multiply(2, 100).add(14_750_000)).min(20_000_000);
  const personal = amount(dependents).multiply(1_500_000);
  // Preserve the estimator's untruncated annual pension deduction.
  const pensionDeduction = pensionBase(monthly).multiply(RATE.pension, RATE_SCALE).multiply(12);
  const simplifiedSpecial = dependents === 1 ? gross.multiply(4, 100).add(3_100_000)
    : dependents === 2 ? gross.multiply(4, 100).add(3_600_000) : gross.multiply(7, 100).add(5_000_000);
  const base = gross.subtract(earnedDeduction).subtract(personal).subtract(pensionDeduction).subtract(simplifiedSpecial).max(0);
  const calculated = progressiveTax(base);
  const calculatedCredit = calculated.lessThanOrEqual(1_300_000) ? calculated.multiply(55, 100) : calculated.subtract(1_300_000).multiply(30, 100).add(715_000);
  const creditCap = gross.lessThanOrEqual(33_000_000) ? amount(740_000)
    : gross.lessThanOrEqual(70_000_000) ? amount(740_000).subtract(gross.subtract(33_000_000).multiply(8, 1_000)).max(660_000)
    : amount(660_000).subtract(gross.subtract(70_000_000).multiply(5, 1_000)).max(500_000);
  const childCredit = children <= 0 ? amount(0) : children === 1 ? amount(250_000) : children === 2 ? amount(550_000) : amount(children).subtract(2).multiply(400_000).add(550_000);
  return calculated.subtract(calculatedCredit.min(creditCap)).subtract(childCredit).max(0).multiply(1, 12);
}

function progressiveTax(base: ReturnType<typeof amount>) {
  const brackets = [[14_000_000, 6], [50_000_000, 15], [88_000_000, 24], [150_000_000, 35], [300_000_000, 38], [500_000_000, 40], [1_000_000_000, 42]] as const;
  let remaining = base; let previous = 0; let tax = amount(0);
  for (const [limit, rate] of brackets) {
    const taxable = remaining.min(limit - previous);
    if (taxable.lessThanOrEqual(0)) return tax;
    tax = tax.add(taxable.multiply(rate, 100));
    remaining = remaining.subtract(taxable);
    previous = limit;
  }
  tax = tax.add(remaining.multiply(45, 100));
  return tax;
}

export function calculateSeverance(input: { hireDate: string; retirementDate: string; wagesThreeMonths: number; annualBonus: number; annualLeavePay: number; periodDays: number; weeklyHours: number }) {
  const serviceDays = differenceInCalendarDays(parseISO(input.retirementDate), parseISO(input.hireDate)) + 1;
  const eligible = serviceDays >= 365 && input.weeklyHours >= 15;
  const includedExtra = amount(input.annualBonus).add(input.annualLeavePay).multiply(3, 12);
  const averageDailyWage = input.periodDays > 0 ? amount(input.wagesThreeMonths).add(includedExtra).multiply(1, input.periodDays) : amount(0);
  return { eligible, serviceDays, includedExtra: includedExtra.toNumber(), averageDailyWage: averageDailyWage.toNumber(), severance: eligible ? averageDailyWage.multiply(30).multiply(serviceDays, 365).toNumber() : 0 };
}
