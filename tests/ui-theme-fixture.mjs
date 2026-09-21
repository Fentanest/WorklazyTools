// W5 shared theme fixture (N5): one serialized seed for Puppeteer
// evaluateOnNewDocument and Playwright addInitScript, plus a pre-capture
// assertion shared by the visual, accessibility, and rendering harnesses.
//
// Sparse-suite profile themes ("light"/"dark") resolve to the default family
// (light-coral/dark-coral). Explicit mint profile themes ("light-mint"/
// "dark-mint") resolve to themselves now that the product ships the mint
// family; a bare "mint" without a scheme is still rejected. The seed stores ONLY worklazy-theme: locale and consent stay under
// each harness's own control so established captures cannot drift. The
// product bootstrap (index.html inline script + React) owns setting
// data-theme from that stored value; a seed never writes the DOM directly,
// so a missed bootstrap cannot hide behind the fixture.
import assert from "node:assert/strict";

export const THEME_FAMILY_DEFAULT = Object.freeze({ light: "light-coral", dark: "dark-coral" });
const THEME_FAMILY_MINT = Object.freeze({ "light-mint": "light-mint", "dark-mint": "dark-mint" });

export function themeForProfile(profileTheme) {
  const theme = THEME_FAMILY_DEFAULT[profileTheme] ?? THEME_FAMILY_MINT[profileTheme];
  if (!theme) throw new Error(`Unknown visual profile theme: ${profileTheme}.`);
  return theme;
}

export function colorSchemeForProfile(profileTheme) {
  return themeForProfile(profileTheme).startsWith("dark-") ? "dark" : "light";
}

// Self-contained: serialized into the browser by either adapter.
export function seedThemeFixture(theme) {
  if (window.top !== window) return; // Vendor frames keep their own policy.
  try {
    window.localStorage.setItem("worklazy-theme", theme);
  } catch {
    // Storage blocked: the product falls back to light-coral, and the
    // assertion below reports the mismatch instead of hiding it.
  }
}

export async function installThemeFixture(target, profileTheme, driver = "playwright") {
  const theme = themeForProfile(profileTheme);
  if (driver === "puppeteer") await target.evaluateOnNewDocument(seedThemeFixture, theme);
  else await target.addInitScript(seedThemeFixture, theme);
  return theme;
}

export async function assertThemeFixture(page, { theme, locale }) {
  const want = themeForProfile(theme);
  const dom = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    stored: window.localStorage.getItem("worklazy-theme"),
    scheme: getComputedStyle(document.documentElement).colorScheme,
    lang: document.documentElement.lang,
  }));
  assert.equal(dom.theme, want, `DOM theme differs from capture name (want ${want})`);
  assert.equal(dom.stored, want, `stored theme differs from capture name (want ${want})`);
  assert.equal(dom.scheme, want.startsWith("dark-") ? "dark" : "light", "native color scheme follows the resolved theme");
  assert.equal(String(dom.lang).split("-")[0], String(locale).split("-")[0], "document language follows the capture locale");
  return dom;
}
