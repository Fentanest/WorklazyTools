import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { assertThemeFixture, colorSchemeForProfile, installThemeFixture, seedThemeFixture, themeForProfile } from "../ui-theme-fixture.mjs";

test("sparse profile themes resolve to the default family only", () => {
  assert.equal(themeForProfile("light"), "light-coral");
  assert.equal(themeForProfile("dark"), "dark-coral");
  assert.throws(() => themeForProfile("mint"), /Unknown visual profile theme/);
});

test("explicit mint profile themes resolve to themselves", () => {
  assert.equal(themeForProfile("light-mint"), "light-mint");
  assert.equal(themeForProfile("dark-mint"), "dark-mint");
  assert.equal(colorSchemeForProfile("light-mint"), "light");
  assert.equal(colorSchemeForProfile("dark-mint"), "dark");
  assert.equal(colorSchemeForProfile("light"), "light");
  assert.equal(colorSchemeForProfile("dark"), "dark");
});

test("seed stores only the theme key and skips vendor frames", () => {
  const store = new Map<string, string>();
  const localStorage = { setItem: (key: string, value: string) => { store.set(key, value); } };
  const sandbox = {
    window: { localStorage } as Record<string, unknown>,
    localStorage,
  };
  sandbox.window.top = sandbox.window;
  vm.runInNewContext(`(${seedThemeFixture.toString()})("dark-coral")`, sandbox);
  assert.deepEqual([...store.entries()], [["worklazy-theme", "dark-coral"]]);
});

test("installer delegates to the matching driver adapter", async () => {
  const calls: Array<[string, unknown]> = [];
  const puppeteerTarget = { evaluateOnNewDocument: async (fn: unknown, arg: unknown) => { calls.push(["puppeteer", arg]); } };
  const playwrightTarget = { addInitScript: async (fn: unknown, arg: unknown) => { calls.push(["playwright", arg]); } };
  assert.equal(await installThemeFixture(puppeteerTarget, "dark", "puppeteer"), "dark-coral");
  assert.equal(await installThemeFixture(playwrightTarget, "light", "playwright"), "light-coral");
  assert.deepEqual(calls, [["puppeteer", "dark-coral"], ["playwright", "light-coral"]]);
});

test("assertion pins DOM, storage, native scheme, and locale before capture", async () => {
  const page = {
    evaluate: async () => ({ theme: "dark-coral", stored: "dark-coral", scheme: "dark", lang: "ko" }),
  };
  const dom = await assertThemeFixture(page, { theme: "dark", locale: "ko" });
  assert.equal(dom.theme, "dark-coral");
  const mintDom = await assertThemeFixture({
    evaluate: async () => ({ theme: "dark-mint", stored: "dark-mint", scheme: "dark", lang: "en" }),
  }, { theme: "dark-mint", locale: "en" });
  assert.equal(mintDom.theme, "dark-mint");
  await assert.rejects(() => assertThemeFixture({
    evaluate: async () => ({ theme: "light-coral", stored: "dark-coral", scheme: "light", lang: "ko" }),
  }, { theme: "dark", locale: "ko" }), /DOM theme differs/);
  await assert.rejects(() => assertThemeFixture({
    evaluate: async () => ({ theme: "dark-coral", stored: "dark-coral", scheme: "light", lang: "ko" }),
  }, { theme: "dark", locale: "ko" }), /native color scheme/);
});
