// Serialized into each selected page before application scripts run. Keep this
// function self-contained; browser timers and performance.now() remain native.
export function installFixedDate(fixedTime) {
  const NativeDate = globalThis.Date;
  const now = () => fixedTime;
  globalThis.Date = new Proxy(NativeDate, {
    apply() {
      return new NativeDate(fixedTime).toString();
    },
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [fixedTime], newTarget);
    },
    get(target, property, receiver) {
      return property === "now" ? now : Reflect.get(target, property, receiver);
    },
  });
}

export async function configureVisualClock(page, scenario, clock) {
  if (!Object.hasOwn(clock.toolReasons, scenario.toolId)) return null;
  const fixedTime = Date.parse(clock.isoTime);
  if (!Number.isFinite(fixedTime)) throw new Error(`Invalid visual clock instant: ${clock.isoTime}.`);
  await page.evaluateOnNewDocument(installFixedDate, fixedTime);
  return fixedTime;
}
