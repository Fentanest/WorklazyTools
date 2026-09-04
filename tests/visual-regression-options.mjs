const MAX_VISUAL_CONCURRENCY = 32;

export function resolveVisualConcurrency(rawValue, availableCpuCount) {
  if (!Number.isInteger(availableCpuCount) || availableCpuCount < 1) {
    throw new Error(`Available CPU count must be a positive integer, received ${availableCpuCount}.`);
  }

  const defaultValue = Math.max(1, Math.min(4, Math.floor(availableCpuCount / 2)));
  if (rawValue === undefined || rawValue.trim() === "") {
    return Object.freeze({ value: defaultValue, source: "cpu-default", availableCpuCount });
  }
  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(`VISUAL_CONCURRENCY must be an integer from 1 to ${MAX_VISUAL_CONCURRENCY}, received ${rawValue}.`);
  }
  const value = Number.parseInt(rawValue, 10);
  if (value < 1 || value > MAX_VISUAL_CONCURRENCY) {
    throw new Error(`VISUAL_CONCURRENCY must be an integer from 1 to ${MAX_VISUAL_CONCURRENCY}, received ${rawValue}.`);
  }
  return Object.freeze({ value, source: "environment", availableCpuCount });
}

export function parseVisualOnly(rawValue) {
  if (rawValue === undefined || rawValue.trim() === "") return Object.freeze([]);
  const terms = [...new Set(rawValue.split(",").map((term) => term.trim()).filter(Boolean))];
  if (terms.length === 0) throw new Error("VISUAL_ONLY must contain at least one scenarioId, routeId, or toolId.");
  return Object.freeze(terms);
}

export function filterVisualScenarios(scenarios, terms) {
  if (terms.length === 0) return scenarios;
  const unknownTerms = terms.filter((term) => !scenarios.some((scenario) => (
    scenario.scenarioId === term || scenario.routeId === term || scenario.toolId === term
  )));
  if (unknownTerms.length > 0) {
    throw new Error(`VISUAL_ONLY did not match a scenarioId, routeId, or toolId: ${unknownTerms.join(", ")}.`);
  }
  const termSet = new Set(terms);
  return scenarios.filter((scenario) => (
    termSet.has(scenario.scenarioId) || termSet.has(scenario.routeId) || termSet.has(scenario.toolId)
  ));
}
