import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link } from "react-router-dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

for (const base of ["/", "/worklazytools/"]) {
  const output = path.resolve(`docs/jobs/todo/analytics-base-${process.pid}-${base === "/" ? "root" : "subpath"}.mjs`);
  await build({
    entryPoints: ["src/components/AnalyticsLoader.tsx"], bundle: true,
    platform: "node", format: "esm", packages: "external", outfile: output,
    define: {
      "import.meta.env.PROD": "true",
      "import.meta.env.BASE_URL": JSON.stringify(base),
      "import.meta.env.VITE_LOCAL_QA": '"0"',
    },
  });
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `https://example.test${base}ko/tools/text-merger/`,
    referrer: `https://example.test${base}ko/tools/`,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  try {
    const { AnalyticsLoader } = await import(pathToFileURL(output).href);
    const root = createRoot(document.getElementById("root"));
    const naverViews = [];
    const render = () => React.createElement(BrowserRouter, {
      basename: base === "/" ? undefined : base.slice(0, -1),
    }, React.createElement(React.Fragment, null,
      React.createElement(AnalyticsLoader, { ready: true }),
      React.createElement(Link, { to: "/en/tools/pdf-editor/", id: "next" }, "Next"),
      React.createElement(Link, { to: "/ko/tools/text-merger/", id: "back" }, "Back"),
    ));
    await act(async () => root.render(render()));
    window.wcs = { event() {} };
    window.wcs_do = () => naverViews.push(window.location.pathname);
    await act(async () => {
      for (const script of document.querySelectorAll("script")) script.dispatchEvent(new window.Event("load"));
    });
    const googleViews = () => (window.dataLayer ?? []).filter((entry) => entry[0] === "event" && entry[1] === "page_view").map((entry) => entry[2]);
    assert.equal(googleViews().length, 1, `${base}: direct Google view`);
    assert.equal(naverViews.length, 1, `${base}: direct Naver view`);
    assert.equal(googleViews()[0].page_path, `${base === "/" ? "" : base.slice(0, -1)}/ko/tools/text-merger/`);
    const click = async (id) => act(async () => {
      document.getElementById(id).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    await click("next");
    assert.equal(googleViews().length, 2, `${base}: SPA Google view`);
    assert.equal(naverViews.length, 2, `${base}: SPA Naver view`);
    await click("back");
    assert.equal(googleViews().length, 3, `${base}: revisit Google view`);
    assert.equal(naverViews.length, 3, `${base}: revisit Naver view`);
    assert.equal(document.querySelectorAll("script[data-worklazy-google-analytics]").length, 1);
    assert.equal(document.querySelectorAll("script[data-worklazy-naver-analytics]").length, 1);
    console.log(`PASS ${base} direct, SPA, revisit: GA 3 / Naver 3`);
    await act(async () => root.unmount());
  } finally {
    dom.window.close();
    await fs.rm(output, { force: true });
  }
}
