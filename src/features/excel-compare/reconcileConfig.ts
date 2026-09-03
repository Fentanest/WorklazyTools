import type { ExcelComparePairOptions } from "./types.ts";

export type ReconcileConfig = NonNullable<ExcelComparePairOptions["reconcile"]>;

export function isReconcileConfigValid(config: ReconcileConfig | undefined) {
  if (!config || !validColumn(config.leftAmountColumn) || !validColumn(config.rightAmountColumn)) return false;
  if (!validOptionalPair(config.leftDateColumn, config.rightDateColumn)) return false;
  if (!validOptionalPair(config.leftPartnerColumn, config.rightPartnerColumn)) return false;
  return Number.isFinite(config.dateToleranceDays) && config.dateToleranceDays >= 0
    && Number.isFinite(config.roundingUnit) && config.roundingUnit > 0;
}

function validOptionalPair(left: number | undefined, right: number | undefined) {
  if (left === undefined || right === undefined) return left === undefined && right === undefined;
  return validColumn(left) && validColumn(right);
}

function validColumn(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}
