import { differenceInCalendarDays, parseISO } from "date-fns";

export const PAYROLL_STANDARD = {
  effectiveDate: "2026-07-01",
  pensionEmployeeRate: 0.0475,
  pensionMinBase: 410_000,
  pensionMaxBase: 6_590_000,
  healthEmployeeRate: 0.03595,
  longTermCareToHealthRate: 0.1314,
  employmentEmployeeRate: 0.009,
} as const;

export function calculateWeeklyAllowance(weeklyHours: number, hourlyWage: number) {
  const eligible = weeklyHours >= 15;
  const paidHours = eligible ? Math.min(weeklyHours / 40, 1) * 8 : 0;
  return { eligible, paidHours, allowance: Math.round(paidHours * hourlyWage) };
}

export function calculateNetPay(monthlySalary: number, dependents: number, children: number) {
  const pensionBase = Math.min(PAYROLL_STANDARD.pensionMaxBase, Math.max(PAYROLL_STANDARD.pensionMinBase, monthlySalary));
  const pension = round10(pensionBase * PAYROLL_STANDARD.pensionEmployeeRate);
  const health = round10(monthlySalary * PAYROLL_STANDARD.healthEmployeeRate);
  const longTermCare = round10(health * PAYROLL_STANDARD.longTermCareToHealthRate);
  const employment = round10(monthlySalary * PAYROLL_STANDARD.employmentEmployeeRate);
  const incomeTax = round10(estimateMonthlyIncomeTax(monthlySalary, Math.max(1, dependents), children));
  const localTax = Math.floor(incomeTax * 0.1 / 10) * 10;
  const deductions = pension + health + longTermCare + employment + incomeTax + localTax;
  return { pension, health, longTermCare, employment, incomeTax, localTax, deductions, net: Math.max(0, monthlySalary - deductions) };
}

function estimateMonthlyIncomeTax(monthly: number, dependents: number, children: number) {
  const gross = monthly * 12;
  const earnedDeduction = gross <= 5_000_000 ? gross * 0.7 : gross <= 15_000_000 ? 3_500_000 + (gross - 5_000_000) * 0.4 : gross <= 45_000_000 ? 7_500_000 + (gross - 15_000_000) * 0.15 : gross <= 100_000_000 ? 12_000_000 + (gross - 45_000_000) * 0.05 : 14_750_000 + (gross - 100_000_000) * 0.02;
  const personal = dependents * 1_500_000;
  const pensionDeduction = Math.min(PAYROLL_STANDARD.pensionMaxBase, Math.max(PAYROLL_STANDARD.pensionMinBase, monthly)) * PAYROLL_STANDARD.pensionEmployeeRate * 12;
  const simplifiedSpecial = dependents === 1 ? 3_100_000 + gross * 0.04 : dependents === 2 ? 3_600_000 + gross * 0.04 : 5_000_000 + gross * 0.07;
  const base = Math.max(0, gross - earnedDeduction - personal - pensionDeduction - simplifiedSpecial);
  const calculated = progressiveTax(base);
  const creditRate = calculated <= 1_300_000 ? 0.55 : 0.3;
  const creditCap = gross <= 33_000_000 ? 740_000 : gross <= 70_000_000 ? Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008) : Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.005);
  const childCredit = children <= 0 ? 0 : children === 1 ? 250_000 : children === 2 ? 550_000 : 550_000 + (children - 2) * 400_000;
  return Math.max(0, calculated - Math.min(calculated * creditRate, creditCap) - childCredit) / 12;
}

function progressiveTax(base: number) {
  const brackets = [[14_000_000, 0.06], [50_000_000, 0.15], [88_000_000, 0.24], [150_000_000, 0.35], [300_000_000, 0.38], [500_000_000, 0.4], [1_000_000_000, 0.42], [Infinity, 0.45]] as const;
  let remaining = base; let previous = 0; let tax = 0;
  for (const [limit, rate] of brackets) { const amount = Math.min(remaining, limit - previous); if (amount <= 0) break; tax += amount * rate; remaining -= amount; previous = limit; }
  return tax;
}

export function calculateSeverance(input: { hireDate: string; retirementDate: string; wagesThreeMonths: number; annualBonus: number; annualLeavePay: number; periodDays: number; weeklyHours: number }) {
  const serviceDays = differenceInCalendarDays(parseISO(input.retirementDate), parseISO(input.hireDate)) + 1;
  const eligible = serviceDays >= 365 && input.weeklyHours >= 15;
  const includedExtra = (input.annualBonus + input.annualLeavePay) * 3 / 12;
  const averageDailyWage = input.periodDays > 0 ? (input.wagesThreeMonths + includedExtra) / input.periodDays : 0;
  return { eligible, serviceDays, includedExtra, averageDailyWage, severance: eligible ? averageDailyWage * 30 * serviceDays / 365 : 0 };
}

function round10(value: number) { return Math.floor(value / 10) * 10; }
