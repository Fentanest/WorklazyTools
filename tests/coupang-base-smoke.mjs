import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

for (const base of ["/", "/worklazytools/"]) {
  const output = path.resolve(`docs/jobs/todo/coupang-base-${process.pid}-${base === "/" ? "root" : "subpath"}.mjs`);
  await build({
    entryPoints: ["src/components/CoupangBanner.tsx"], bundle: true,
    platform: "node", format: "esm", jsx: "automatic", packages: "external", outfile: output,
    define: {
      "import.meta.env.PROD": "true",
      "import.meta.env.BASE_URL": JSON.stringify(base),
      "import.meta.env.VITE_LOCAL_QA": '"0"',
    },
  });
  try {
    const { CoupangBanner } = await import(pathToFileURL(output).href);
    for (const language of ["ko", "en"]) {
      const dom = new JSDOM(`<html lang="${language}"><body><div id="root"></div></body></html>`, {
        url: `https://example.test${base}${language}/tools/text-merger/`,
      });
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      const root = createRoot(document.getElementById("root"));
      try {
        await act(async () => root.render(React.createElement(CoupangBanner, { routeKey: "/tools/text-merger" })));
        const expected = language === "en" ? "Coupang Partners advertisement" : "쿠팡 파트너스 광고";
        assert.equal(document.querySelector("iframe")?.title, expected, `${base}${language}: iframe title`);
        assert.equal(document.querySelector("section.coupang-banner")?.getAttribute("aria-label"), expected, `${base}${language}: section label`);
        const disclosure = document.querySelector(".coupang-banner-disclosure")?.textContent ?? "";
        assert.match(disclosure, language === "en" ? /commission from purchases/ : /수수료를 제공받습니다/, `${base}${language}: affiliate disclosure`);
        console.log(`PASS ${base}${language}: Coupang label and disclosure`);
      } finally {
        await act(async () => root.unmount());
        dom.window.close();
      }
    }
  } finally {
    await fs.rm(output, { force: true });
  }
}
