import assert from "node:assert/strict";
import test from "node:test";

import { assertStaticFaqHtml } from "../../scripts/validate-static-output.mjs";

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
