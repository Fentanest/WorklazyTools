import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function loadCard() {
  const exports: any = {};
  const icon = () => null;
  const require = (id: string): any => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "react-i18next") return { useTranslation: () => ({ t: (key: string) => key }) };
    if (id === "react-router-dom") return { Link: ({ to, children, ...props }: any) => React.createElement("a", { ...props, href: to }, children) };
    if (id.endsWith("/personalization")) return { usePersonalization: () => ({ favorites: [], favoritesEnabled: true }) };
    if (id.endsWith("/routing")) return { useAppLanguage: () => "en" };
    if (id.endsWith("/utils")) return { cn: (...items: any[]) => items.filter(Boolean).join(" ") };
    if (id.endsWith("/AnalyticsLoader")) return { trackToolOpen() {} };
    if (id.endsWith("/toolAccentStyles")) return { getToolIconTone: () => "utility" };
    if (id.endsWith("/ui/card")) return { Card: ({ as: Tag, children, ...props }: any) => React.createElement(Tag, props, children) };
    return { ArrowRight: icon, Star: icon };
  };
  const source = path.resolve(process.env.CATALOG_SOURCE_ROOT ?? ".", "src/components/ToolCard.tsx");
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require }, { filename: source });
  return exports.ToolCard;
}
for (const headingLevel of [2, 3]) test(`tool card supports heading level ${headingLevel} without changing its copy`, () => {
  const ToolCard = loadCard();
  const tool = { id: "excel-merger", title: "Merge spreadsheets", path: "/tools/excel-merger", icon: () => null, accent: "green", eyebrow: "SPREADSHEET", description: "Merge files locally", highlights: [] };
  const html = renderToStaticMarkup(React.createElement(ToolCard, { tool, ...(headingLevel === 3 ? { headingLevel } : {}) }));
  assert.ok(html.includes(`<h${headingLevel}>Merge spreadsheets</h${headingLevel}>`));
  assert.ok(html.includes("Merge files locally"));
  assert.equal(html.includes(`<h${headingLevel === 3 ? 2 : 3}>`), false);
});
