import fs from "fs";
const lines = fs.readFileSync("src/app/seo.ts", "utf-8").split("\n");
const block = lines.slice(19, 275).join("\n");
const jsCode = block.replace(/const faqByLanguageAndPath[^=]*=\s*/, "export default ");
fs.writeFileSync("scratch/seo-faqs.js", jsCode);
