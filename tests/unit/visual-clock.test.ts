import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { configureVisualClock, installFixedDate } from "../visual-regression-clock.mjs";
import { qaCaptureScenarios, visualRegressionConfig } from "../visual-regression.config.mjs";

const clock = visualRegressionConfig.environment.clock;
const fixedTime = Date.parse(clock.isoTime);

test("visual Date ignores host day/year changes and preserves explicit dates and native timers", async () => {
  for (const hostTime of ["2026-09-05T14:59:59.999Z", "2026-09-06T15:00:00Z", "2027-01-01T00:00:00Z"]) {
    const context = vm.createContext({ hostTime, setTimeout, setInterval, clearTimeout, clearInterval, performance });
    vm.runInContext(`
      const NativeDate = Date;
      const hostMillis = NativeDate.parse(hostTime);
      globalThis.Date = class HostDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [hostMillis])); }
        static now() { return hostMillis; }
      };
    `, context);
    assert.equal(vm.runInContext("Date.now()", context), Date.parse(hostTime));
    vm.runInContext(`(${installFixedDate.toString()})(${fixedTime})`, context);
    assert.equal(vm.runInContext("Date.now()", context), fixedTime);
    assert.equal(vm.runInContext("new Date().toISOString()", context), clock.isoTime);
    assert.equal(vm.runInContext("Date('ignored')", context), vm.runInContext(`new NativeDate(${fixedTime}).toString()`, context));
    assert.equal(vm.runInContext("new Date(0).getTime()", context), 0);
    assert.equal(vm.runInContext("new Date('2024-02-29T12:34:56Z').toISOString()", context), "2024-02-29T12:34:56.000Z");
    assert.equal(vm.runInContext("new Date(2024, 1, 29).getDate()", context), 29);
    assert.equal(vm.runInContext("new Date(new Date(0)).getTime()", context), 0);
    assert.equal(vm.runInContext("Number.isNaN(new Date(undefined).getTime())", context), true);
    assert.equal(vm.runInContext("Date.parse('1970-01-01T00:00:00Z')", context), 0);
    assert.equal(vm.runInContext("Date.UTC(1970, 0, 1)", context), 0);
    assert.equal(vm.runInContext("new Date() instanceof Date && new Date() instanceof NativeDate", context), true);
    assert.equal(vm.runInContext("class DerivedDate extends Date {}; new DerivedDate() instanceof DerivedDate", context), true);
    for (const [name, original] of Object.entries({ setTimeout, setInterval, clearTimeout, clearInterval, performance })) {
      assert.equal(vm.runInContext(name, context), original);
    }
    const before = performance.now();
    await vm.runInContext("new Promise(resolve => setTimeout(resolve, 10))", context);
    assert.ok(performance.now() > before);
    assert.equal(vm.runInContext("Date.now()", context), fixedTime);
  }
});

test("all states and QA profiles of the three calendar tools receive the same pre-navigation clock", async () => {
  assert.deepEqual(Object.keys(clock.toolReasons).sort(), ["payroll-calculator", "timezone-calculator", "work-calculator"]);
  for (const [scenarios, expectedCaptures] of [[visualRegressionConfig.scenarios, 21], [qaCaptureScenarios, 72]] as const) {
    let fixedScenarios = 0;
    let fixedCaptures = 0;
    for (const scenario of scenarios) {
      const registrations: unknown[][] = [];
      const page = { evaluateOnNewDocument: async (...args: unknown[]) => { registrations.push(args); } };
      const result = await configureVisualClock(page, scenario, clock);
      if (["payroll-calculator", "timezone-calculator", "work-calculator"].includes(scenario.toolId)) {
        assert.equal(result, fixedTime);
        assert.deepEqual(registrations, [[installFixedDate, fixedTime]]);
        assert.ok(clock.toolReasons[scenario.toolId]);
        fixedScenarios += 1;
        fixedCaptures += scenario.profiles.length;
      } else {
        assert.equal(result, null);
        assert.deepEqual(registrations, []);
      }
    }
    assert.equal(fixedScenarios, 9);
    assert.equal(fixedCaptures, expectedCaptures);
  }
  await assert.rejects(configureVisualClock({}, { toolId: "work-calculator" }, { ...clock, isoTime: "invalid" }), /Invalid visual clock/);
});
