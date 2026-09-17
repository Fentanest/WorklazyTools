import fs from "fs";

let page = fs.readFileSync("src/features/office-editor/OfficeEditorPage.tsx", "utf-8");
page = page.replace(
  /if \(location\.search !== "\?guide=1"\)/,
  'const searchParams = new URLSearchParams(location.search);\n    if (searchParams.get("guide") !== "1")'
);
fs.writeFileSync("src/features/office-editor/OfficeEditorPage.tsx", page);

let appPage = fs.readFileSync("src/features/office-editor/OfficeEditorAppPage.tsx", "utf-8");
appPage = appPage.replace(
  /\{state === "error" && file \? <Button className="min-h-10([^>]+)>\{L\("다시 시도", "Try again"\)\}<\/Button> : null\}/,
  '{state === "error" ? <Button className="min-h-10$1>{L("다시 시도", "Try again")}</Button> : null}'
);
fs.writeFileSync("src/features/office-editor/OfficeEditorAppPage.tsx", appPage);
