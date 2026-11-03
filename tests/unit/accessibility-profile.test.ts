import assert from "node:assert/strict";
import test from "node:test";
import { applyAccessibilityProfile } from "../accessibility-profile.mjs";
import { pages, resolveAuditLocale } from "../accessibility-audit.mjs";
import { themeForProfile } from "../ui-theme-fixture.mjs";

test("recollection profiles cover all 16 combinations and retain registered scenarios and ownership", () => {
  const seen = new Set<string>();
  for (const theme of ["light-coral", "dark-coral", "light-mint", "dark-mint"]) {
    for (const language of ["ko", "en"]) for (const viewport of ["desktop", "mobile"]) {
      const profile = `${theme}|${language}|${viewport}`;
      seen.add(profile);
      for (const target of pages) {
        const actual = applyAccessibilityProfile(target, profile);
        assert.equal(actual.id, target.id);
        assert.equal(actual.scenario, target.scenario);
        assert.equal(actual.ownedSelector, target.ownedSelector);
        assert.equal(themeForProfile(actual.theme), theme);
        assert.equal(actual.colorScheme, theme.split("-")[0]);
        assert.match(actual.path, new RegExp(`^/${language}(?:/|$)`));
        assert.equal(resolveAuditLocale(actual), language === "ko" ? "ko-KR" : "en-US");
        assert.equal(actual.viewport?.width, viewport === "mobile" ? 412 : undefined);
      }
    }
  }
  assert.equal(seen.size, 16);
});

test("ordinary audit identity is preserved; malformed profile fails instead of silently skipping", () => {
  assert.equal(applyAccessibilityProfile(pages[0], undefined), pages[0]);
  for (const invalid of ["mint|ko|mobile", "light-coral|fr|mobile", "light-coral|en|tablet", "light-coral|en|mobile|extra"]) {
    assert.throws(() => applyAccessibilityProfile(pages[0], invalid), /Invalid A11Y_PROFILE/);
  }
  const hwp = pages.find(({ id }) => id === "hwp-editor")!;
  assert.equal(applyAccessibilityProfile(hwp, "dark-mint|en|mobile").readySelector, 'iframe[title="rhwp HWP document editor"]');
});
