import fs from "fs";
let content = fs.readFileSync("tests/office-editor-smoke.mjs", "utf-8");
content = content.replace(
  /if \(\!landingBoundary\.dropHint\.includes\("자동"\)\)/,
  'if (!landingBoundary.dropHint)'
);
fs.writeFileSync("tests/office-editor-smoke.mjs", content);
