import assert from "node:assert/strict";
import test from "node:test";

import { assertStaticFaqHtml, assertStaticPrivacyRecipesHtml, assertStaticPrivacySectionsHtml } from "../../scripts/validate-static-output.mjs";

const expectedQuestion = "Can it perfectly restore Word or Excel structure?";

function faqFixture({
  includeFaqPage = true,
  bodyQuestions = [expectedQuestion],
  jsonQuestions = [expectedQuestion],
} = {}) {
  const structuredData = includeFaqPage
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: jsonQuestions.map((question) => ({ "@type": "Question", name: question })),
      })}</script>`
    : '<script type="application/ld+json">{"@type":"WebPage"}</script>';
  const body = bodyQuestions.map((question) => `<h3>${question}</h3><p>Answer</p>`).join("");
  return `<!doctype html><html><head>${structuredData}</head><body><main class="seo-static-fallback"><section><h2>FAQ</h2>${body}</section></main></body></html>`;
}

test("static FAQ validation accepts matching parsed FAQPage and body questions", () => {
  assert.doesNotThrow(() => assertStaticFaqHtml(faqFixture(), { expectedQuestion }));
});

test("static FAQ validation separates missing FAQPage", () => {
  assert.throws(
    () => assertStaticFaqHtml(faqFixture({ includeFaqPage: false }), { expectedQuestion }),
    /FAQPage JSON-LD 없음/,
  );
});

test("static FAQ validation separates a missing required question", () => {
  assert.throws(
    () => assertStaticFaqHtml(faqFixture({ bodyQuestions: ["Another question"], jsonQuestions: ["Another question"] }), { expectedQuestion }),
    new RegExp(`필수 질문 누락: ${expectedQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
});

test("static FAQ validation separates body and JSON-LD mismatch", () => {
  assert.throws(
    () => assertStaticFaqHtml(faqFixture({ bodyQuestions: [expectedQuestion, "Body only"] }), { expectedQuestion }),
    /본문 FAQ와 JSON-LD 불일치/,
  );
});

const recipePolicy = { title: "Saved cleaning rules", description: "Explicitly saved rules remain in this browser." };
const recipePolicyBody = `<h2>${recipePolicy.title}</h2><p>${recipePolicy.description}</p>`;
const privacyFixture = (body: string) => `<main class="seo-static-fallback">${body}</main>`;

test("static privacy recipe validation accepts the shared heading and full policy text", () => {
  assert.doesNotThrow(() => assertStaticPrivacyRecipesHtml(privacyFixture(recipePolicyBody), recipePolicy));
});

test("static privacy recipe validation rejects a missing notice and script-only copy", () => {
  for (const html of [privacyFixture(""), `<script>${recipePolicyBody}</script>`, recipePolicyBody]) {
    assert.throws(() => assertStaticPrivacyRecipesHtml(html, recipePolicy), /static Excel cleaner recipe policy/);
  }
});

test("static privacy recipe validation rejects a heading without the full policy paragraph", () => {
  for (const text of ["", "Partial policy"]) {
    assert.throws(() => assertStaticPrivacyRecipesHtml(privacyFixture(`<h2>${recipePolicy.title}</h2><p>${text}</p>`), recipePolicy), /static Excel cleaner recipe policy/);
  }
});

test("static privacy recipe validation rejects duplicate and hidden notices", () => {
  for (const html of [privacyFixture(recipePolicyBody.repeat(2)), `<main class="seo-static-fallback" hidden>${recipePolicyBody}</main>`, privacyFixture(`<h2>${recipePolicy.title}</h2><p hidden>${recipePolicy.description}</p>`)]) {
    assert.throws(() => assertStaticPrivacyRecipesHtml(html, recipePolicy), /static Excel cleaner recipe policy/);
  }
});

test("static privacy recipe validation rejects empty expected copy", () => {
  assert.throws(() => assertStaticPrivacyRecipesHtml(privacyFixture(recipePolicyBody), { ...recipePolicy, description: "" }), /missing Excel cleaner recipe policy copy/);
});

const privacySections = [
  { title: "Local processing", paragraphs: ["Files stay in the browser."], items: ["Office handoff is temporarily stored in IndexedDB."] },
  { title: "Analytics and advertising", paragraphs: ["Providers may use cookies."], items: [] },
];
const fullPrivacyCopy = { sections: privacySections, cleanerRecipes: recipePolicy };
const sectionHtml = (section: typeof privacySections[number]) => `<h2>${section.title}</h2>${section.paragraphs.map((p) => `<p>${p}</p>`).join("")}${section.items.length ? `<ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}`;
const fullPrivacyBody = privacySections.map(sectionHtml).join("") + recipePolicyBody;

test("static privacy section validation accepts all policy paragraphs and items in client order", () => {
  assert.doesNotThrow(() => assertStaticPrivacySectionsHtml(privacyFixture(fullPrivacyBody), fullPrivacyCopy));
});

test("static privacy section validation rejects recipe-only output", () => {
  assert.throws(() => assertStaticPrivacySectionsHtml(privacyFixture(recipePolicyBody), fullPrivacyCopy), /static privacy sections/);
});

test("static privacy section validation rejects missing, duplicated and reordered headings", () => {
  for (const body of [sectionHtml(privacySections[0]) + recipePolicyBody, sectionHtml(privacySections[0]) + fullPrivacyBody, [...privacySections].reverse().map(sectionHtml).join("") + recipePolicyBody]) {
    assert.throws(() => assertStaticPrivacySectionsHtml(privacyFixture(body), fullPrivacyCopy), /static privacy sections/);
  }
});

test("static privacy section validation rejects missing Office items and changed paragraphs", () => {
  for (const body of [fullPrivacyBody.replace(`<li>${privacySections[0].items[0]}</li>`, ""), fullPrivacyBody.replace(privacySections[1].paragraphs[0], "Partial notice")]) {
    assert.throws(() => assertStaticPrivacySectionsHtml(privacyFixture(body), fullPrivacyCopy), /static privacy content/);
  }
});

test("static privacy section validation rejects hidden headings, paragraphs and list items", () => {
  for (const body of [fullPrivacyBody.replace("<h2>", "<h2 hidden>"), fullPrivacyBody.replace("<p>", "<p hidden>"), fullPrivacyBody.replace("<li>", "<li hidden>")]) {
    assert.throws(() => assertStaticPrivacySectionsHtml(privacyFixture(body), fullPrivacyCopy), /static privacy (sections|content)/);
  }
});

test("static privacy section validation rejects an empty section expectation", () => {
  assert.throws(() => assertStaticPrivacySectionsHtml(privacyFixture(fullPrivacyBody), { ...fullPrivacyCopy, sections: [] }), /missing privacy policy sections/);
});
