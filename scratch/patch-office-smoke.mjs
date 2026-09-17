import fs from "fs";

let content = fs.readFileSync("tests/office-editor-smoke.mjs", "utf-8");

// Change /ko/tools/office-editor to /ko/tools/office-editor?guide=1
content = content.replace(
  /\/ko\/tools\/office-editor(["`])/,
  '/ko/tools/office-editor?guide=1$1'
);

// We need an auto-start test without file.
// Let's prepend it before the main test.
const prepTest = `
  // Auto-start test (no file, no click)
  await page.goto(\`\${baseUrl}/ko/tools/office-editor/app/\`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("[data-testid='office-toolbar-document']") === null && document.querySelector("[data-testid='office-canvas-shell'][data-active='true']"));
  console.log("Auto-start ready without file.");
`;
content = content.replace(
  /await page\.goto\(`\$\{baseUrl\}\/ko\/tools\/office-editor\?guide=1`, \{ waitUntil: "networkidle0" \}\);/,
  prepTest + '\n  await page.goto(`${baseUrl}/ko/tools/office-editor?guide=1`, { waitUntil: "networkidle0" });'
);

fs.writeFileSync("tests/office-editor-smoke.mjs", content);
