/** Exact decimal inputs and integer ratios. Convert to Number only for output,
 * after applying the requested won/10-won rounding rule. */
export function amount(value: number): PayrollAmount {
  if (!Number.isFinite(value)) return new PayrollAmount(0n, 0n);
  const [decimal, exponent = "0"] = value.toString().split("e");
  const places = (decimal.split(".")[1]?.length ?? 0) - Number(exponent);
  const digits = BigInt(decimal.replace(".", ""));
  return places >= 0
    ? new PayrollAmount(digits, 10n ** BigInt(places))
    : new PayrollAmount(digits * 10n ** BigInt(-places), 1n);
}

class PayrollAmount {
  private numerator: bigint;
  private denominator: bigint;

  constructor(numerator: bigint, denominator: bigint) {
    // Non-finite inputs propagate NaN rather than throwing during input editing.
    if (denominator === 0n) {
      this.numerator = 0n;
      this.denominator = 0n;
      return;
    }
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    let a = numerator < 0n ? -numerator : numerator;
    let b = denominator;
    while (b) { const remainder = a % b; a = b; b = remainder; }
    this.numerator = numerator / a;
    this.denominator = denominator / a;
  }

  add(value: PayrollAmount | number): PayrollAmount {
    const other = typeof value === "number" ? amount(value) : value;
    return new PayrollAmount(this.numerator * other.denominator + other.numerator * this.denominator, this.denominator * other.denominator);
  }

  subtract(value: PayrollAmount | number): PayrollAmount {
    const other = typeof value === "number" ? amount(value) : value;
    return this.add(new PayrollAmount(-other.numerator, other.denominator));
  }

  multiply(value: number, divisor = 1): PayrollAmount {
    const factor = amount(value), denominator = amount(divisor);
    return new PayrollAmount(this.numerator * factor.numerator * denominator.denominator, this.denominator * factor.denominator * denominator.numerator);
  }

  min(value: PayrollAmount | number): PayrollAmount {
    const other = typeof value === "number" ? amount(value) : value;
    if (!this.denominator || !other.denominator) return amount(NaN);
    return this.lessThanOrEqual(other) ? this : other;
  }

  max(value: PayrollAmount | number): PayrollAmount {
    const other = typeof value === "number" ? amount(value) : value;
    if (!this.denominator || !other.denominator) return amount(NaN);
    return this.lessThanOrEqual(other) ? other : this;
  }

  lessThanOrEqual(value: PayrollAmount | number): boolean {
    const other = typeof value === "number" ? amount(value) : value;
    return !!this.denominator && !!other.denominator && this.numerator * other.denominator <= other.numerator * this.denominator;
  }

  floor(unit: number): number {
    if (!this.denominator) return NaN;
    return Number(floorDivide(this.numerator, this.denominator * BigInt(unit)) * BigInt(unit));
  }

  round(): number {
    if (!this.denominator) return NaN;
    // Same half-up/toward-positive-infinity tie rule as Math.round.
    return Number(floorDivide(this.numerator * 2n + this.denominator, this.denominator * 2n));
  }

  toNumber(): number { return Number(this.numerator) / Number(this.denominator); }
}

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return numerator < 0n && numerator % denominator !== 0n ? quotient - 1n : quotient;
}
