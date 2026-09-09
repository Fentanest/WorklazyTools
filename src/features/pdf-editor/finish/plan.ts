export type FinishExecutionStage =
  | "structure-and-forms"
  | "background"
  | "original"
  | "foreground"
  | "numbers-and-headers"
  | "stamp"
  | "raster";

export interface FinishPlanOptions {
  structureOrForms?: boolean;
  background?: boolean;
  foreground?: boolean;
  numbersOrHeaders?: boolean;
  stamp?: boolean;
  raster?: boolean;
}

export interface FinishPlanStep {
  order: number;
  stage: FinishExecutionStage;
  enabled: boolean;
}

export interface FinishExecutionPlan {
  steps: FinishPlanStep[];
  enabledStages: FinishExecutionStage[];
}

export const FINISH_EXECUTION_ORDER: readonly FinishExecutionStage[] = [
  "structure-and-forms",
  "background",
  "original",
  "foreground",
  "numbers-and-headers",
  "stamp",
  "raster",
];

export function createFinishExecutionPlan(options: FinishPlanOptions): FinishExecutionPlan {
  const flags: Record<FinishExecutionStage, boolean> = {
    "structure-and-forms": options.structureOrForms ?? false,
    background: options.background ?? false,
    original: true,
    foreground: options.foreground ?? false,
    "numbers-and-headers": options.numbersOrHeaders ?? false,
    stamp: options.stamp ?? false,
    raster: options.raster ?? false,
  };
  const steps = FINISH_EXECUTION_ORDER.map((stage, index) => ({ order: index + 1, stage, enabled: flags[stage] }));
  return { steps, enabledStages: steps.filter(({ enabled }) => enabled).map(({ stage }) => stage) };
}
