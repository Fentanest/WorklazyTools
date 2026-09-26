type EligibilitySource = "routeError" | "routePending" | "folioTraceUnpublished";

const eligibilityFlags = new Set<EligibilitySource>();

export function setAdIneligible(source: EligibilitySource, ineligible: boolean) {
  const before = eligibilityFlags.size > 0;
  if (ineligible) {
    eligibilityFlags.add(source);
  } else {
    eligibilityFlags.delete(source);
  }
  const after = eligibilityFlags.size > 0;
  if (before !== after) {
    window.dispatchEvent(new CustomEvent("wl-ad-eligibility-changed"));
  }
}

export function isAdIneligible() {
  return eligibilityFlags.size > 0;
}
