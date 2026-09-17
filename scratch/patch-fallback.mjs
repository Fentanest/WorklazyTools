import fs from "fs";

let content = fs.readFileSync("src/features/document-redactor/DocumentRedactorFallback.tsx", "utf-8");
content = content.replace(/\{c\.guide\s*&&\s*\(/, '(');
fs.writeFileSync("src/features/document-redactor/DocumentRedactorFallback.tsx", content);
