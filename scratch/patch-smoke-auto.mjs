import fs from "fs";
let content = fs.readFileSync("tests/office-editor-smoke.mjs", "utf-8");

const autoStart = `
  // Auto-start test (no file, no click)
  await page.goto(\`\${baseUrl}/ko/tools/office-editor/app/\`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("[data-testid='office-canvas-shell'][data-active='true']"));
  console.log("Auto-start ready without file.");
`;

content = content.replace(
  /await page\.goto\(`\$\{baseUrl\}\/ko\/tools\/office-editor\?guide=1`, \{ waitUntil: "networkidle0" \}\);/,
  autoStart + '\n  await page.goto(`${baseUrl}/ko/tools/office-editor?guide=1`, { waitUntil: "networkidle0" });'
);

fs.writeFileSync("tests/office-editor-smoke.mjs", content);
